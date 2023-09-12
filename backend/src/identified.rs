use b3_utils::{
    memory::types::{BoundedStorable, Storable},
    nonce::Nonce,
};
use candid::CandidType;
use ciborium::de::from_reader;
use ciborium::ser::into_writer;
use serde::{Deserialize, Serialize};
use std::io::Cursor;

mod store;
pub use store::*;

use crate::types::AuthenticatedSignature;

#[derive(Default, Serialize, Clone, CandidType, Deserialize)]
pub struct IdentifiedUserData {
    texts: Vec<Nonce>,
    public_key: Vec<u8>,
    signature: Option<AuthenticatedSignature>,
}

impl BoundedStorable for IdentifiedUserData {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 500;
}

impl IdentifiedUserData {
    pub fn new(public_key: Vec<u8>, text_id: Option<Nonce>) -> Self {
        Self {
            texts: text_id.into_iter().collect(),
            public_key,
            signature: None,
        }
    }

    pub fn add_text_id(&mut self, text_id: Nonce) -> Result<(), &'static str> {
        if self.texts.len() > 10 {
            return Err("Maximum of 10 text are allowed");
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
}

impl Storable for IdentifiedUserData {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        let mut bytes = vec![];
        into_writer(&self, &mut bytes).unwrap();
        std::borrow::Cow::Owned(bytes)
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        from_reader(&mut Cursor::new(&bytes)).unwrap()
    }
}
