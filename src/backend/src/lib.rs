use aes_wasm::aes256gcm;
use candid::Principal;

use ic_bls12_381::{pairing, G2Affine};
use ic_cdk::{query, update};
use std::{cell::RefCell, collections::HashMap, str::FromStr};
use types::{
    CanisterId, VetKDCurve, VetKDEncryptedKeyReply, VetKDEncryptedKeyRequest, VetKDKeyId,
    VetKDPublicKeyReply, VetKDPublicKeyRequest,
};
use vetkd::{augmented_hash_to_g1, deserialize_g1, deserialize_g2};

mod types;
mod vetkd;

const VETKD_SYSTEM_API_CANISTER_ID: &str = "wfdtj-lyaaa-aaaap-abakq-cai";

struct OneTimePassword {
    time_lock: u64,
    public_key: Vec<u8>,
}

type TextId = usize;
type EncryptedText = Vec<u8>;

thread_local! {
    static USERS: RefCell<HashMap<Principal, Vec<TextId>>> = RefCell::default();
    static ONE_TIME_PASSWORD: RefCell<HashMap<TextId, OneTimePassword>> = RefCell::default();
    static ENCRYPTED_TEXTS: RefCell<HashMap<TextId, EncryptedText>> = RefCell::default();
}

#[query]
fn get_caller() -> Principal {
    debug_println_caller("get_caller");

    ic_cdk::caller()
}

#[query]
fn user_notes() -> Vec<String> {
    debug_println_caller("user_notes");

    let caller = ic_cdk::caller();

    USERS.with(|users| {
        let users = users.borrow();

        users
            .get(&caller)
            .map(|ids| {
                ids.iter()
                    .filter_map(|id| {
                        ENCRYPTED_TEXTS.with(|texts| {
                            let texts = texts.borrow();

                            texts.get(id).cloned()
                        })
                    })
                    .map(|text| hex::encode(text))
                    .collect()
            })
            .unwrap_or_default()
    })
}

#[query]
fn get_time() -> u64 {
    debug_println_caller("get_time");

    ic_cdk::api::time()
}

#[update]
fn set_one_time_password(text_id: TextId, public_key: String) {
    debug_println_caller("set_one_time_password");

    let public_key = hex::decode(public_key).expect("Invalid hex encoding");

    ONE_TIME_PASSWORD.with(|otp| {
        let mut otp = otp.borrow_mut();

        otp.insert(
            text_id,
            OneTimePassword {
                time_lock: ic_cdk::api::time() + 60 * 1_000_000_000,
                public_key,
            },
        );
    });
}

#[update]
async fn read_with_one_time_password(
    text_id: TextId,
    signature: String,
    auth_code: String,
) -> (EncryptedText, Vec<u8>) {
    debug_println_caller("login_with_one_time_password");

    let one_time_password = ONE_TIME_PASSWORD
        .with(|otp| {
            let mut otp = otp.borrow_mut();

            otp.remove(&text_id)
        })
        .unwrap();

    if one_time_password.time_lock < ic_cdk::api::time() {
        ic_cdk::trap("one time password is locked");
    }

    let auth_code = hex::decode(auth_code).expect("Invalid hex encoding");
    let signature = hex::decode(signature).expect("Invalid hex encoding");

    let verified = verify_vrf_proof(&one_time_password.public_key, &signature, &auth_code);

    if !verified.unwrap() {
        ic_cdk::trap("invalid signature");
    }

    let encrypted_text = ENCRYPTED_TEXTS
        .with(|texts| {
            let texts = texts.borrow();

            texts.get(&text_id).cloned()
        })
        .expect("text not found");

    let request = VetKDEncryptedKeyRequest {
        derivation_id: signature,
        public_key_derivation_path: vec![b"ibe_encryption".to_vec()],
        key_id: bls12_381_test_key_1(),
        encryption_public_key: one_time_password.public_key,
    };

    let (encrypted_key,): (VetKDEncryptedKeyReply,) = ic_cdk::call(
        vetkd_system_api_canister_id(),
        "vetkd_encrypted_key",
        (request,),
    )
    .await
    .expect("call to vetkd_encrypted_key failed");

    (encrypted_text, encrypted_key.encrypted_key)
}

#[update]
async fn symmetric_key_verification_key() -> String {
    let request = VetKDPublicKeyRequest {
        canister_id: None,
        derivation_path: vec![b"symmetric_key".to_vec()],
        key_id: bls12_381_test_key_1(),
    };

    let (response,): (VetKDPublicKeyReply,) = ic_cdk::call(
        vetkd_system_api_canister_id(),
        "vetkd_public_key",
        (request,),
    )
    .await
    .expect("call to vetkd_public_key failed");

    hex::encode(response.public_key)
}

#[update]
async fn symmetric_key_verification_key_for(canister_id: Option<Principal>) -> String {
    let request = VetKDPublicKeyRequest {
        canister_id,
        derivation_path: vec![b"symmetric_key".to_vec()],
        key_id: bls12_381_test_key_1(),
    };

    let (response,): (VetKDPublicKeyReply,) = ic_cdk::call(
        vetkd_system_api_canister_id(),
        "vetkd_public_key",
        (request,),
    )
    .await
    .expect("call to vetkd_public_key failed");

    hex::encode(response.public_key)
}

#[update]
async fn encrypted_symmetric_key_for_caller(encryption_public_key: Vec<u8>) -> String {
    debug_println_caller("encrypted_symmetric_key_for_caller");

    let request = VetKDEncryptedKeyRequest {
        derivation_id: ic_cdk::caller().as_slice().to_vec(),
        public_key_derivation_path: vec![b"symmetric_key".to_vec()],
        key_id: bls12_381_test_key_1(),
        encryption_public_key,
    };

    let (response,): (VetKDEncryptedKeyReply,) = ic_cdk::call(
        vetkd_system_api_canister_id(),
        "vetkd_encrypted_key",
        (request,),
    )
    .await
    .expect("call to vetkd_encrypted_key failed");

    hex::encode(response.encrypted_key)
}

#[update]
async fn ibe_encryption_key() -> String {
    let request = VetKDPublicKeyRequest {
        canister_id: None,
        derivation_path: vec![b"ibe_encryption".to_vec()],
        key_id: bls12_381_test_key_1(),
    };

    let (response,): (VetKDPublicKeyReply,) = ic_cdk::call(
        vetkd_system_api_canister_id(),
        "vetkd_public_key",
        (request,),
    )
    .await
    .expect("call to vetkd_public_key failed");

    hex::encode(response.public_key)
}

#[update]
async fn encrypted_ibe_decryption_key_for_caller(
    encryption_public_key: Vec<u8>,
    derivation_id: Vec<u8>,
) -> String {
    debug_println_caller("encrypted_ibe_decryption_key_for_caller");

    let request = VetKDEncryptedKeyRequest {
        derivation_id,
        public_key_derivation_path: vec![b"ibe_encryption".to_vec()],
        key_id: bls12_381_test_key_1(),
        encryption_public_key,
    };

    let (response,): (VetKDEncryptedKeyReply,) = ic_cdk::call(
        vetkd_system_api_canister_id(),
        "vetkd_encrypted_key",
        (request,),
    )
    .await
    .expect("call to vetkd_encrypted_key failed");

    hex::encode(response.encrypted_key)
}

#[query]
fn get_encrypted_texts() -> Vec<(TextId, String)> {
    debug_println_caller("get_encrypted_texts");

    ENCRYPTED_TEXTS.with(|texts| {
        let texts = texts.borrow();

        texts
            .iter()
            .map(|(id, text)| (*id, hex::encode(text)))
            .collect()
    })
}

#[update]
async fn save_encrypted_text(encrypted_text: String) {
    debug_println_caller("save_encrypted_text");

    ENCRYPTED_TEXTS.with(|texts| {
        let mut texts = texts.borrow_mut();

        let id = texts.len();

        texts.insert(id, encrypted_text.into());
    });
}

#[update]
async fn get_encrypted_text(
    encryption_public_key: Vec<u8>,
    text_id: TextId,
) -> (EncryptedText, String) {
    debug_println_caller("get_encrypted_text");

    let caller = ic_cdk::caller();

    let encrypted_text = ENCRYPTED_TEXTS
        .with(|t| t.borrow().get(&text_id).cloned())
        .expect("text not found");

    let request = VetKDEncryptedKeyRequest {
        derivation_id: caller.as_slice().to_vec(),
        public_key_derivation_path: vec![b"ibe_encryption".to_vec()],
        key_id: bls12_381_test_key_1(),
        encryption_public_key,
    };

    let (response,): (VetKDEncryptedKeyReply,) = ic_cdk::call(
        vetkd_system_api_canister_id(),
        "vetkd_decrypted_key",
        (request,),
    )
    .await
    .expect("call to vetkd_decrypted_key failed");

    (encrypted_text, hex::encode(response.encrypted_key))
}

#[update]
async fn read_encrypted_text(text_id: TextId) -> String {
    debug_println_caller("get_encrypted_text");

    let caller = ic_cdk::caller();

    let encrypted_text = ENCRYPTED_TEXTS
        .with(|t| t.borrow().get(&text_id).cloned())
        .expect("text not found");

    let request = VetKDEncryptedKeyRequest {
        derivation_id: caller.as_slice().to_vec(),
        public_key_derivation_path: vec![b"ibe_encryption".to_vec()],
        key_id: bls12_381_test_key_1(),
        encryption_public_key: encrypted_text,
    };

    let (response,): (VetKDEncryptedKeyReply,) = ic_cdk::call(
        vetkd_system_api_canister_id(),
        "vetkd_decrypted_key",
        (request,),
    )
    .await
    .expect("call to vetkd_decrypted_key failed");

    hex::encode(response.encrypted_key)
}

/// Verify a VRF proof based on ver_proof
pub fn verify_vrf_proof(
    public_key_bytes: &[u8],
    signature_bytes: &[u8],
    data_bytes: &[u8],
) -> Result<bool, String> {
    // Deserialize the public key
    let public_key = deserialize_g2(public_key_bytes)?;

    // Deserialize the proof
    let signature = deserialize_g1(signature_bytes)?;

    // Hash the input to a curve point
    let hashed_input = augmented_hash_to_g1(&G2Affine::generator(), data_bytes);

    // Verify the VRF proof
    let result = pairing(&signature, &G2Affine::generator()) == pairing(&hashed_input, &public_key);

    Ok(result)
}

#[update]
fn verify_caller(
    auth_code: String,
    public_key_hex: String,
    vrf_proof_hex: String,
) -> Result<bool, String> {
    debug_println_caller("get_caller");

    // Convert hex to bytes
    let input = hex::decode(auth_code).expect("Invalid hex encoding");
    let public_key_bytes = hex::decode(public_key_hex).expect("Invalid hex encoding");
    let vrf_proof_bytes = hex::decode(vrf_proof_hex).expect("Invalid hex encoding");

    // Verify the VRF proof
    verify_vrf_proof(&public_key_bytes, &vrf_proof_bytes, &input)
        .map_err(|e| format!("Verification error: {:?}", e))
}

#[update]
pub fn decrypt_text(
    encrypted_note_hex: String,
    symmetric_key_hex: String,
) -> Result<String, String> {
    // Convert hex to bytes
    let encrypted_note = hex::decode(encrypted_note_hex).expect("Invalid hex encoding");
    let symmetric_key: aes256gcm::Key = hex::decode(symmetric_key_hex)
        .expect("Invalid hex encoding")
        .try_into()
        .expect("Invalid key length");

    // Extract IV (nonce) and ciphertext
    let nonce: aes256gcm::Nonce = encrypted_note[0..aes256gcm::NONCE_LEN]
        .try_into()
        .expect("Invalid nonce length");
    let ciphertext_and_tag = &encrypted_note[aes256gcm::NONCE_LEN..];

    // Decrypt the ciphertext
    let data = aes256gcm::decrypt(ciphertext_and_tag, &[], &symmetric_key, nonce)
        .map_err(|e| format!("Decryption error: {:?}", e))?;

    // Return the decrypted data
    String::from_utf8(data).map_err(|e| format!("Invalid UTF-8 sequence: {:?}", e))
}

#[update]
fn save_encrypted_note(plain_text: String) -> TextId {
    ENCRYPTED_TEXTS.with(|texts| {
        let mut texts = texts.borrow_mut();

        let id = texts.len();
        texts.insert(id, plain_text.into());

        id
    })
}

fn bls12_381_test_key_1() -> VetKDKeyId {
    VetKDKeyId {
        curve: VetKDCurve::Bls12_381,
        name: "test_key_1".to_string(),
    }
}

fn vetkd_system_api_canister_id() -> CanisterId {
    CanisterId::from_str(VETKD_SYSTEM_API_CANISTER_ID).expect("failed to create canister ID")
}

fn debug_println_caller(method_name: &str) {
    ic_cdk::println!(
        "{}: caller: {} (isAnonymous: {})",
        method_name,
        ic_cdk::caller().to_text(),
        ic_cdk::caller() == candid::Principal::anonymous()
    );
}

ic_cdk::export_candid!();
