use serde::Deserialize;

mod store;
pub use store::*;

mod stable;

#[derive(candid::CandidType, Clone, Deserialize)]
pub struct EncryptedText(Vec<u8>);

impl EncryptedText {
    pub fn new(text: Vec<u8>) -> Self {
        Self(text)
    }

    pub fn set_text(&mut self, text: Vec<u8>) {
        self.0 = text;
    }

    pub fn into_inner(&self) -> Vec<u8> {
        self.0.clone()
    }
}
