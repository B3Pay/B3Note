use std::cell::RefCell;

use b3_utils::{log, vetkd::VetKDManagement};

use crate::{types::*, utils::vec_to_fixed_array};

thread_local! {
    pub static IBE_ENCRYPTION_KEY: RefCell<EncryptionKey> = RefCell::new([0; 96]);
    pub static SYMMETRIC_ENCRYPTION_KEY: RefCell<EncryptionKey> = RefCell::new([0; 96]);
    pub static TWO_FACTOR_AUTHENTICATION_KEY: RefCell<EncryptionKey> = RefCell::new([0; 96]);
}

pub async fn fetch_encryption_keys() {
    log!("Fetching keys...");
    let canister_id = ic_cdk::id();

    let symmetric_key = VetKDManagement(canister_id)
        .request_public_key(vec![b"symmetric_key".to_vec()])
        .await
        .unwrap();

    let ibe_encryption_key = VetKDManagement(canister_id)
        .request_public_key(vec![b"ibe_encryption".to_vec()])
        .await
        .unwrap();

    let authentication_key = VetKDManagement(canister_id)
        .request_public_key(vec![b"two_factor_authentication".to_vec()])
        .await
        .unwrap();

    log!("Caching keys...");

    set_symmetric_encryption_key(symmetric_key);
    set_ibe_encryption_key(ibe_encryption_key);
    set_two_factor_authentication_key(authentication_key);
}

pub fn set_ibe_encryption_key(key: Vec<u8>) {
    let key = vec_to_fixed_array(&key).unwrap();

    IBE_ENCRYPTION_KEY.with(|ibe_encrypted_key| {
        *ibe_encrypted_key.borrow_mut() = key;
    })
}

pub fn set_symmetric_encryption_key(key: Vec<u8>) {
    let key = vec_to_fixed_array(&key).unwrap();

    SYMMETRIC_ENCRYPTION_KEY.with(|symmetric_encrypted_key| {
        *symmetric_encrypted_key.borrow_mut() = key;
    })
}

pub fn set_two_factor_authentication_key(key: Vec<u8>) {
    let key = vec_to_fixed_array(&key).unwrap();

    TWO_FACTOR_AUTHENTICATION_KEY.with(|two_factor_authentication_key| {
        *two_factor_authentication_key.borrow_mut() = key;
    })
}

pub fn get_ibe_encrypted_key() -> EncryptionKey {
    IBE_ENCRYPTION_KEY.with(|ibe_encrypted_key| *ibe_encrypted_key.borrow())
}

pub fn get_symmetric_encrypted_key() -> EncryptionKey {
    SYMMETRIC_ENCRYPTION_KEY.with(|symmetric_encrypted_key| *symmetric_encrypted_key.borrow())
}

pub fn get_two_factor_authentication_key() -> EncryptionKey {
    TWO_FACTOR_AUTHENTICATION_KEY
        .with(|two_factor_authentication_key| *two_factor_authentication_key.borrow())
}
