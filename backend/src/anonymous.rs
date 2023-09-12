use b3_utils::{
    memory::types::{BoundedStorable, Storable},
    nonce::Nonce,
    NanoTimeStamp,
};
use candid::CandidType;
use ciborium::de::from_reader;
use ciborium::ser::into_writer;
use serde::{Deserialize, Serialize};
use std::io::Cursor;

use crate::{constants::ANONYMOUS_USER_DATA_EXPIRATION, types::PublicKey};

mod store;
pub use store::*;

#[derive(Default, Debug, Serialize, Clone, CandidType, Deserialize)]
pub struct AnonymousUserData {
    texts: Vec<Nonce>,
    created_at: NanoTimeStamp,
    decryption_key: Option<Vec<u8>>,
}

impl BoundedStorable for AnonymousUserData {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 500;
}

impl AnonymousUserData {
    pub fn new(decryption_key: Option<Vec<u8>>) -> Self {
        Self {
            texts: vec![],
            created_at: NanoTimeStamp::now(),
            decryption_key,
        }
    }

    pub fn set_decryption_key(&mut self, key: Vec<u8>) {
        self.decryption_key = Some(key);
    }

    pub fn is_expired(&self) -> bool {
        self.created_at.elapsed().to_secs() > ANONYMOUS_USER_DATA_EXPIRATION
    }

    pub fn has_text_id(&self, text_id: &Nonce) -> bool {
        self.texts.contains(text_id)
    }

    pub fn add_text_id(&mut self, text_id: Nonce) -> Result<(), &'static str> {
        if self.texts.len() >= 5 {
            return Err("Maximum of 5 text are allowed");
        }

        self.texts.push(text_id);

        Ok(())
    }

    pub fn remove_text_id(&mut self, text_id: &Nonce) -> Result<(), &'static str> {
        if self.texts.len() < 1 {
            return Err("No text to remove");
        }

        self.texts.retain(|id| id != text_id);

        Ok(())
    }

    pub fn iter_texts(&self) -> impl Iterator<Item = &Nonce> {
        self.texts.iter()
    }

    pub fn get_created_at(&self) -> NanoTimeStamp {
        self.created_at.clone()
    }

    pub fn get_decryption_key(&self) -> Result<Vec<u8>, String> {
        if self.is_expired() {
            return Err("Decryption key expired".to_string());
        }

        if let Some(decryption_key) = self.decryption_key.clone() {
            if decryption_key.len() != 192 {
                return Err("Decryption key is not Valid!".to_string());
            }

            return Ok(decryption_key);
        } else {
            return Err("No decryption key found".to_string());
        }
    }
}

impl Storable for AnonymousUserData {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        let mut bytes = vec![];
        into_writer(&self, &mut bytes).unwrap();
        std::borrow::Cow::Owned(bytes)
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        from_reader(&mut Cursor::new(&bytes)).unwrap()
    }
}

pub fn get_anonymous_user(public_key: &PublicKey) -> Result<AnonymousUserData, String> {
    with_anonymous_user(public_key, |anonymous_user| Ok(anonymous_user.clone()))
}
