use b3_utils::memory::types::{BoundedStorable, Storable};
use serde::Deserialize;

mod store;
pub use store::*;

#[derive(candid::CandidType, Clone, Deserialize)]
pub struct EncryptedText(Vec<u8>);

impl EncryptedText {
    pub fn new(text: Vec<u8>) -> Self {
        Self(text)
    }

    pub fn clone(&self) -> Vec<u8> {
        self.0.clone()
    }
}

impl BoundedStorable for EncryptedText {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 1128;
}

impl Storable for EncryptedText {
    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Self(bytes.into_owned())
    }

    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        self.0.clone().into()
    }
}
