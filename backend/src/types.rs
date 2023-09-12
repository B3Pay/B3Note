use b3_utils::NanoTimeStamp;
use candid::CandidType;
use serde::{Deserialize, Serialize};

pub type PublicKey = [u8; 48];

pub type EncryptionKey = [u8; 96];

#[derive(candid::CandidType, Clone, Deserialize)]
pub struct UserText {
    pub id: String,
    pub text: Vec<u8>,
}

#[derive(Serialize, Clone, CandidType, Deserialize)]
pub struct AuthenticatedSignature {
    pub signature: Vec<u8>,
    pub created_at: NanoTimeStamp,
}
