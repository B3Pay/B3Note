use aes_wasm::aes256gcm;
use candid::{CandidType, Deserialize, Principal};

use ic_bls12_381::{pairing, G1Affine, G2Affine};
use ic_cdk::{println, query, update};
use std::{cell::RefCell, collections::HashMap, str::FromStr};
use types::{
    CanisterId, VetKDCurve, VetKDEncryptedKeyReply, VetKDEncryptedKeyRequest, VetKDKeyId,
    VetKDPublicKeyReply, VetKDPublicKeyRequest,
};
use vetkd::{augmented_hash_to_g1, deserialize_g1, deserialize_g2};

mod types;
mod vetkd;

const VETKD_SYSTEM_API_CANISTER_ID: &str = "wfdtj-lyaaa-aaaap-abakq-cai";

#[derive(Default, Clone, CandidType, Deserialize)]
struct EncryptedText {
    time_lock: u64,
    plain_text: String,
    public_key: Vec<u8>,
}

struct OneTimePassword {
    time_lock: u64,
    signature: Vec<u8>,
    public_key: Vec<u8>,
}

type TextId = usize;

thread_local! {
    static USERS: RefCell<HashMap<String, Principal>> = RefCell::default();
    static ONE_TIME_PASSWORD: RefCell<HashMap<Principal, OneTimePassword>> = RefCell::default();
    static ENCRYPTED_TEXTS: RefCell<HashMap<TextId, EncryptedText>> = RefCell::default();
    static SYMMETRIC_KEY: RefCell<String> = RefCell::new("b0fd33ed65d976f59718d0faab153152df34988d91eb8676210265fdff41f6d7480bcdc3ea06bd3baae7f852a12f7b7b0f264fe0bb19d582debcc5c44c00b4df71deaeec21b4af95df7589ed2e6a982cb0ffdc65b76ab8c36db4424211a74213".to_string());
}

#[query]
fn get_caller() -> Principal {
    debug_println_caller("get_caller");

    ic_cdk::caller()
}

#[query]
fn get_time() -> u64 {
    debug_println_caller("get_time");

    ic_cdk::api::time()
}

#[update]
fn register_user(username: String) {
    debug_println_caller("register_user");

    let caller = ic_cdk::caller();

    USERS.with(|users| {
        let mut users = users.borrow_mut();

        users.insert(username, caller);
    });
}

#[update]
fn set_one_time_password(public_key: String, signature: String) {
    debug_println_caller("set_one_time_password");

    let caller = ic_cdk::caller();

    let signature = hex::decode(signature).expect("Invalid hex encoding");
    let public_key = hex::decode(public_key).expect("Invalid hex encoding");

    ONE_TIME_PASSWORD.with(|otp| {
        let mut otp = otp.borrow_mut();

        otp.insert(
            caller,
            OneTimePassword {
                time_lock: ic_cdk::api::time() + 60 * 1_000_000_000,
                signature,
                public_key,
            },
        );
    });
}

#[update]
fn login_with_one_time_password(username: String, auth_code: String) -> bool {
    debug_println_caller("login_with_one_time_password");

    let caller = USERS
        .with(|users| {
            let users = users.borrow();

            users.get(&username).ok_or("user not found").cloned()
        })
        .unwrap();

    let one_time_password = ONE_TIME_PASSWORD
        .with(|otp| {
            let mut otp = otp.borrow_mut();

            otp.remove(&caller).ok_or("one time password not found")
        })
        .unwrap();

    if one_time_password.time_lock < ic_cdk::api::time() {
        ic_cdk::trap("one time password is locked");
    }

    let auth_code = hex::decode(auth_code).expect("Invalid hex encoding");

    verify_vrf_proof(
        &one_time_password.public_key,
        &one_time_password.signature,
        &auth_code,
    )
    .expect("verification failed")
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
fn get_encrypted_texts() -> Vec<(TextId, EncryptedText)> {
    debug_println_caller("get_encrypted_texts");

    ENCRYPTED_TEXTS.with(|texts| {
        let texts = texts.borrow();

        texts.iter().map(|(id, text)| (*id, text.clone())).collect()
    })
}

#[update]
async fn save_encrypted_text(encrypted_text: EncryptedText) {
    debug_println_caller("save_encrypted_text");

    ENCRYPTED_TEXTS.with(|texts| {
        let mut texts = texts.borrow_mut();

        let id = texts.len();

        texts.insert(id, encrypted_text);
    });
}

#[update]
async fn get_encrypted_text(encryption_public_key: Vec<u8>, text_id: TextId) -> String {
    debug_println_caller("get_encrypted_text");

    let caller = ic_cdk::caller();

    let encrypted_text = ENCRYPTED_TEXTS
        .with(|t| t.borrow().get(&text_id).cloned())
        .expect("text not found");

    if encrypted_text.time_lock < ic_cdk::api::time() {
        ic_cdk::trap("text is locked");
    }

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

    hex::encode(response.encrypted_key)
}

#[update]
async fn read_encrypted_text(text_id: TextId) -> String {
    debug_println_caller("get_encrypted_text");

    let caller = ic_cdk::caller();

    let encrypted_text = ENCRYPTED_TEXTS
        .with(|t| t.borrow().get(&text_id).cloned())
        .expect("text not found");

    if encrypted_text.time_lock < ic_cdk::api::time() {
        ic_cdk::trap("text is locked");
    }

    let request = VetKDEncryptedKeyRequest {
        derivation_id: caller.as_slice().to_vec(),
        public_key_derivation_path: vec![b"ibe_encryption".to_vec()],
        key_id: bls12_381_test_key_1(),
        encryption_public_key: encrypted_text.public_key,
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

pub fn verify_ownership(signature: &G1Affine, public_key: &G2Affine, message: &[u8]) -> bool {
    let hash = augmented_hash_to_g1(public_key, message);

    let pairing_check = ic_bls12_381::pairing(&signature, &G2Affine::generator())
        == ic_bls12_381::pairing(&hash, &public_key);

    pairing_check
}

#[update]
fn verify_ownership_caller(
    signature_hex: String,
    public_key_hex: String,
    message_hex: String,
) -> bool {
    debug_println_caller("verify_ownership_caller");

    // Convert hex to bytes
    let signature_bytes = hex::decode(signature_hex).expect("Invalid hex encoding");
    let public_key_bytes = hex::decode(public_key_hex).expect("Invalid hex encoding");
    let message_bytes = hex::decode(message_hex).expect("Invalid hex encoding");

    // Deserialize the signature
    let signature = deserialize_g1(&signature_bytes).unwrap();
    let public_key = deserialize_g2(&public_key_bytes).unwrap();

    // Verify the ownership
    verify_ownership(&signature, &public_key, &message_bytes)
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

pub fn verify_signature_with_encrypted_key(message: &[u8], signature_bytes: &[u8]) -> bool {
    // Deserialize the signature
    todo!("deserialize the signature");
}

#[update]
fn verify_signature_with_encrypted_key_caller(message_hex: String, signature_hex: String) -> bool {
    debug_println_caller("verify_signature_with_encrypted_key_caller");

    // Convert hex to bytes
    let message_bytes = hex::decode(message_hex).expect("Invalid hex encoding");
    let signature_bytes = hex::decode(signature_hex).expect("Invalid hex encoding");

    // Verify the signature
    verify_signature_with_encrypted_key(&message_bytes, &signature_bytes)
}

async fn decrypt_note(
    encrypted_note_id: String,
) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let encrypted_text_id = encrypted_note_id.parse::<TextId>()?;

    let encrypted_text = ENCRYPTED_TEXTS.with(|texts| {
        let texts = texts.borrow();

        texts.get(&encrypted_text_id).cloned()
    });

    let encrypted_text = match encrypted_text {
        Some(encrypted_text) => encrypted_text,
        None => return Err("invalid encrypted note ID".into()),
    };

    Ok(encrypted_text.plain_text)
}

fn save_encrypted_note(plain_text: String) -> TextId {
    let encrypted_text_id = ENCRYPTED_TEXTS.with(|texts| {
        let mut texts = texts.borrow_mut();

        let encrypted_text = EncryptedText {
            time_lock: ic_cdk::api::time(),
            plain_text,
            public_key: vec![],
        };

        let id = texts.len();
        texts.insert(id, encrypted_text);

        id
    });

    encrypted_text_id
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
