//! Shared PocketIC harness for the B3Note backend tests.
//!
//! The tests run the real canister wasm against a PocketIC instance whose II
//! subnet holds the `key_1` vetKD key, and do the client-side cryptography with
//! the `ic-vetkeys` crate, which is interoperable with the `@icp-sdk/vetkeys`
//! library the frontend uses.

#![allow(dead_code)]

use std::path::PathBuf;
use std::time::Duration;

use backend::types::*;
use candid::utils::ArgumentEncoder;
use candid::{decode_one, encode_args, encode_one, CandidType, Principal};
use ed25519_dalek::{Signer, SigningKey};
use ic_vetkeys::{
    DerivedPublicKey, EncryptedVetKey, IbeCiphertext, IbeIdentity, IbeSeed, MasterPublicKey,
    TransportSecretKey, VetKey,
};
use pocket_ic::{PocketIc, PocketIcBuilder, RejectResponse};
use rand::{rngs::OsRng, RngCore};
use serde::de::DeserializeOwned;
use serde_bytes::ByteBuf;
use vetkeys_management_canister::{VetKDCurve, VetKDKeyId};

pub const SEC: u64 = 1_000_000_000;
pub const VETKD_KEY: &str = "key_1";
/// Domain separator and associated data the frontend uses for notes.
pub const NOTE_DOMAIN: &str = "b3note/note/v1";

fn wasm(name: &str, env: &str) -> Vec<u8> {
    let path = std::env::var_os(env).map(PathBuf::from).unwrap_or_else(|| {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../target/wasm32-unknown-unknown/release")
            .join(format!("{name}.wasm"))
    });
    std::fs::read(&path).unwrap_or_else(|e| {
        panic!(
            "cannot read {} ({e}); build the canisters first with `./scripts/build-canisters.sh`",
            path.display()
        )
    })
}

pub fn backend_wasm() -> Vec<u8> {
    wasm("backend", "BACKEND_WASM")
}

pub fn mock_llm_wasm() -> Vec<u8> {
    wasm("mock_llm", "MOCK_LLM_WASM")
}

/// A distinct, non-anonymous principal per `n`.
pub fn user(n: u8) -> Principal {
    Principal::self_authenticating([n; 32])
}

pub fn random_id() -> (String, [u8; 16]) {
    let mut bytes = [0u8; 16];
    OsRng.fill_bytes(&mut bytes);
    (hex::encode(bytes), bytes)
}

pub fn key_id(name: &str) -> VetKDKeyId {
    VetKDKeyId {
        curve: VetKDCurve::Bls12_381_G2,
        name: name.to_string(),
    }
}

pub struct TestEnv {
    pub pic: PocketIc,
    pub backend: Principal,
    pub llm: Principal,
    pub controller: Principal,
}

impl TestEnv {
    pub fn new() -> Self {
        Self::with_args(InitArgs::default())
    }

    /// Installs the mock LLM canister and the backend (configured to use it
    /// unless `args` names another LLM canister).
    pub fn with_args(mut args: InitArgs) -> Self {
        let pic = PocketIcBuilder::new()
            .with_ii_subnet()
            .with_application_subnet()
            .build();
        let controller = Principal::self_authenticating(b"b3note-controller");
        let app_subnet = pic.topology().get_app_subnets()[0];

        let llm = pic.create_canister_on_subnet(Some(controller), None, app_subnet);
        pic.add_cycles(llm, 10_000_000_000_000);
        pic.install_canister(
            llm,
            mock_llm_wasm(),
            encode_args(()).unwrap(),
            Some(controller),
        );

        let backend = pic.create_canister_on_subnet(Some(controller), None, app_subnet);
        pic.add_cycles(backend, 100_000_000_000_000);
        if args.vetkd_key_name.is_none() {
            args.vetkd_key_name = Some(VETKD_KEY.to_string());
        }
        if args.llm_canister.is_none() {
            args.llm_canister = Some(llm);
        }
        pic.install_canister(
            backend,
            backend_wasm(),
            encode_one(Some(args)).unwrap(),
            Some(controller),
        );
        let env = Self {
            pic,
            backend,
            llm,
            controller,
        };
        // Let the init timer fetch the public keys.
        env.tick(5);
        env
    }

    pub fn tick(&self, n: usize) {
        for _ in 0..n {
            self.pic.tick();
        }
    }

    /// Moves the clock forward and lets timers fire.
    pub fn advance_secs(&self, secs: u64) {
        self.pic.advance_time(Duration::from_secs(secs));
        self.tick(3);
    }

    pub fn now(&self) -> u64 {
        self.pic.get_time().as_nanos_since_unix_epoch()
    }

    pub fn update_raw<A: ArgumentEncoder>(
        &self,
        sender: Principal,
        method: &str,
        args: A,
    ) -> std::result::Result<Vec<u8>, RejectResponse> {
        self.pic
            .update_call(self.backend, sender, method, encode_args(args).unwrap())
    }

    pub fn update<R: CandidType + DeserializeOwned, A: ArgumentEncoder>(
        &self,
        sender: Principal,
        method: &str,
        args: A,
    ) -> R {
        let bytes = self
            .update_raw(sender, method, args)
            .unwrap_or_else(|e| panic!("update `{method}` was rejected: {e:?}"));
        decode_one(&bytes).unwrap()
    }

    pub fn query<R: CandidType + DeserializeOwned, A: ArgumentEncoder>(
        &self,
        sender: Principal,
        method: &str,
        args: A,
    ) -> R {
        let bytes = self
            .pic
            .query_call(self.backend, sender, method, encode_args(args).unwrap())
            .unwrap_or_else(|e| panic!("query `{method}` was rejected: {e:?}"));
        decode_one(&bytes).unwrap()
    }

    pub fn upgrade(&self, args: Option<InitArgs>) -> std::result::Result<(), RejectResponse> {
        let result = self.pic.upgrade_canister(
            self.backend,
            backend_wasm(),
            encode_one(args).unwrap(),
            Some(self.controller),
        );
        self.tick(5);
        result
    }

    // -- keys ------------------------------------------------------------

    pub fn public_keys(&self) -> PublicKeys {
        self.update::<Result<PublicKeys>, _>(Principal::anonymous(), "load_public_keys", ())
            .expect("public keys")
    }

    /// The key every honest client derives offline for this canister and
    /// context, from PocketIC's well-known master public key.
    pub fn expected_public_key(&self, context: &[u8]) -> DerivedPublicKey {
        MasterPublicKey::for_pocketic_key(&key_id(VETKD_KEY))
            .expect("known PocketIC key")
            .derive_canister_key(self.backend.as_slice())
            .derive_sub_key(context)
    }

    pub fn try_user_vetkey(&self, caller: Principal) -> Result<VetKey> {
        let tsk = transport_key();
        let reply: Result<EncryptedUserKey> = self.update(
            caller,
            "get_encrypted_user_key",
            (ByteBuf::from(tsk.public_key()),),
        );
        let reply = reply?;
        let dpk = DerivedPublicKey::deserialize(&reply.verification_key).unwrap();
        assert_eq!(
            dpk,
            self.expected_public_key(backend::USER_KEY_CONTEXT),
            "the canister must hand out its genuine derived public key"
        );
        Ok(EncryptedVetKey::deserialize(&reply.encrypted_key)
            .unwrap()
            .decrypt_and_verify(&tsk, &dpk, caller.as_slice())
            .expect("the vetKey must verify against the caller's principal"))
    }

    pub fn user_vetkey(&self, caller: Principal) -> VetKey {
        self.try_user_vetkey(caller).expect("user vetKey")
    }

    // -- notes -----------------------------------------------------------

    pub fn create_note(&self, owner: Principal, vetkey: &VetKey, text: &str) -> Note {
        let (id, bytes) = random_id();
        let ciphertext = encrypt_note(vetkey, &bytes, text);
        self.update::<Result<Note>, _>(
            owner,
            "create_note",
            (CreateNoteArgs {
                id,
                ciphertext: ByteBuf::from(ciphertext),
                expires_at: None,
            },),
        )
        .expect("create_note")
    }

    pub fn list_notes(&self, owner: Principal) -> Vec<Note> {
        let page: Result<NotePage> = self.query(
            owner,
            "list_notes",
            (ListNotesArgs {
                cursor: None,
                limit: None,
            },),
        );
        page.expect("list_notes").notes
    }

    pub fn account(&self, owner: Principal) -> Account {
        self.query::<Result<Account>, _>(owner, "get_account", ())
            .expect("account")
    }

    pub fn stats(&self) -> Stats {
        self.query(Principal::anonymous(), "get_stats", ())
    }

    // -- shares ----------------------------------------------------------

    /// Encrypts `text` to a fresh share id and uploads it. Returns the share id
    /// and the signing key that a link would carry.
    pub fn create_share(
        &self,
        owner: Principal,
        note_id: Option<String>,
        text: &str,
        max_views: u32,
        expires_in_secs: u64,
    ) -> Result<(String, SigningKey)> {
        let (id, bytes) = random_id();
        let dpk = DerivedPublicKey::deserialize(&self.public_keys().share_key).unwrap();
        assert_eq!(dpk, self.expected_public_key(backend::SHARE_KEY_CONTEXT));
        let ciphertext = IbeCiphertext::encrypt(
            &dpk,
            &IbeIdentity::from_bytes(&bytes),
            text.as_bytes(),
            &IbeSeed::random(&mut OsRng),
        );
        let signing_key = SigningKey::generate(&mut OsRng);
        let info: Result<ShareInfo> = self.update(
            owner,
            "create_share",
            (CreateShareArgs {
                id: id.clone(),
                note_id,
                ciphertext: ByteBuf::from(ciphertext.serialize()),
                verifying_key: ByteBuf::from(signing_key.verifying_key().to_bytes().to_vec()),
                max_views,
                expires_in_secs,
            },),
        );
        let info = info?;
        assert_eq!(info.id, id);
        assert_eq!(info.views_left, max_views);
        Ok((id, signing_key))
    }

    /// Opens a share the way the frontend does and decrypts it.
    pub fn open_share(
        &self,
        reader: Principal,
        id: &str,
        signing_key: &SigningKey,
    ) -> Result<(String, OpenedShare)> {
        let tsk = transport_key();
        self.open_share_with(reader, id, signing_key, &tsk)
    }

    pub fn open_share_with(
        &self,
        reader: Principal,
        id: &str,
        signing_key: &SigningKey,
        tsk: &TransportSecretKey,
    ) -> Result<(String, OpenedShare)> {
        let id_bytes = hex::decode(id).unwrap();
        let message = [backend::SHARE_OPEN_DOMAIN, &id_bytes, &tsk.public_key()].concat();
        let signature = signing_key.sign(&message);
        let opened: Result<OpenedShare> = self.update(
            reader,
            "open_share",
            (OpenShareArgs {
                id: id.to_string(),
                transport_public_key: ByteBuf::from(tsk.public_key()),
                signature: ByteBuf::from(signature.to_bytes().to_vec()),
            },),
        );
        let opened = opened?;
        let dpk = DerivedPublicKey::deserialize(&opened.verification_key).unwrap();
        assert_eq!(dpk, self.expected_public_key(backend::SHARE_KEY_CONTEXT));
        let vetkey = EncryptedVetKey::deserialize(&opened.encrypted_key)
            .unwrap()
            .decrypt_and_verify(tsk, &dpk, &id_bytes)
            .expect("the share vetKey must verify against the share id");
        let plaintext = IbeCiphertext::deserialize(&opened.ciphertext)
            .unwrap()
            .decrypt(&vetkey)
            .expect("the share must decrypt");
        Ok((String::from_utf8(plaintext).unwrap(), opened))
    }

    pub fn share_info(&self, id: &str) -> Result<PublicShareInfo> {
        self.query(Principal::anonymous(), "get_share", (id.to_string(),))
    }

    // -- AI --------------------------------------------------------------

    pub fn ai(&self, caller: Principal, task: AiTask, text: &str) -> Result<AiResponse> {
        self.update(
            caller,
            "ai_assist",
            (AiRequest {
                task,
                text: text.to_string(),
            },),
        )
    }

    pub fn llm_calls(&self) -> u64 {
        let bytes = self
            .pic
            .query_call(
                self.llm,
                Principal::anonymous(),
                "calls",
                encode_args(()).unwrap(),
            )
            .unwrap();
        decode_one(&bytes).unwrap()
    }
}

pub fn transport_key() -> TransportSecretKey {
    let mut seed = vec![0u8; 32];
    OsRng.fill_bytes(&mut seed);
    TransportSecretKey::from_seed(seed).unwrap()
}

/// Encrypts a note body the way the frontend does: AES-GCM with a key derived
/// from the user's vetKey, bound to the note id.
pub fn encrypt_note(vetkey: &VetKey, id: &[u8; 16], text: &str) -> Vec<u8> {
    vetkey
        .as_derived_key_material()
        .encrypt_message(text.as_bytes(), NOTE_DOMAIN, id, &mut OsRng)
        .unwrap()
}

pub fn decrypt_note(vetkey: &VetKey, note: &Note) -> std::result::Result<String, String> {
    let id: [u8; 16] = hex::decode(&note.id).unwrap().try_into().unwrap();
    vetkey
        .as_derived_key_material()
        .decrypt_message(&note.ciphertext, NOTE_DOMAIN, &id)
        .map(|bytes| String::from_utf8(bytes).unwrap())
        .map_err(|e| format!("{e:?}"))
}
