use b3_utils::{
    memory::types::{BoundedStorable, Storable},
    NanoTimeStamp,
};
use candid::CandidType;
use ciborium::de::from_reader;
use ciborium::ser::into_writer;
use serde::{Deserialize, Serialize};
use std::io::Cursor;

#[derive(CandidType, Clone, PartialEq, Eq, PartialOrd, Ord, Deserialize)]
pub struct UserName(String);

impl BoundedStorable for UserName {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 100;
}

impl Storable for UserName {
    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Self(String::from_utf8(bytes.into_owned()).unwrap())
    }

    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        self.0.as_bytes().to_vec().into()
    }
}

#[derive(CandidType, Clone, Deserialize)]
pub struct EncryptedHashedPassword(Vec<u8>);

impl BoundedStorable for EncryptedHashedPassword {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 100;
}

impl Storable for EncryptedHashedPassword {
    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Self(bytes.into_owned())
    }

    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        self.0.clone().into()
    }
}

#[derive(candid::CandidType, Serialize, Clone, PartialEq, Eq, PartialOrd, Ord, Deserialize)]
pub struct TextId(pub [u8; 8]);

#[derive(candid::CandidType, Clone, Deserialize)]
pub struct UserText {
    pub id: TextId,
    pub note: EncryptedText,
}

impl BoundedStorable for TextId {
    const IS_FIXED_SIZE: bool = true;
    const MAX_SIZE: u32 = 8;
}

impl Storable for TextId {
    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        let bytes = bytes.into_owned();

        let mut id = [0u8; 8];
        id.copy_from_slice(&bytes);

        Self(id)
    }

    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        self.0.to_vec().into()
    }
}

impl BoundedStorable for OneTimePassword {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 40;
}

impl Storable for OneTimePassword {
    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        let bytes = bytes.into_owned();

        let time_lock = u64::from_be_bytes(bytes[0..8].try_into().unwrap());
        let public_key = bytes[8..].try_into().unwrap();

        Self {
            time_lock,
            public_key,
        }
    }

    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        let mut bytes = vec![];

        bytes.extend_from_slice(&self.time_lock.to_be_bytes());
        bytes.extend_from_slice(&self.public_key);

        bytes.into()
    }
}

pub struct OneTimePassword {
    pub time_lock: u64,
    pub public_key: Vec<u8>,
}

#[derive(candid::CandidType, Clone, Deserialize)]
pub struct EncryptedText(pub Vec<u8>);

impl BoundedStorable for EncryptedText {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 1000;
}

impl Storable for EncryptedText {
    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Self(bytes.into_owned())
    }

    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        self.0.clone().into()
    }
}

#[derive(Serialize, Clone, CandidType, Deserialize)]
pub struct AuthenticatedSignature {
    pub signature: Vec<u8>,
    pub created_at: NanoTimeStamp,
}

impl AuthenticatedSignature {
    pub fn new(signature: Vec<u8>) -> Self {
        Self {
            signature,
            created_at: NanoTimeStamp::now(),
        }
    }
}

#[derive(Default, Serialize, Clone, CandidType, Deserialize)]
pub struct UserData {
    pub texts: Vec<TextId>,
    pub public_key: Vec<u8>,
    pub signature: Option<AuthenticatedSignature>,
}

impl BoundedStorable for UserData {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 100;
}

impl Storable for UserData {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        let mut bytes = vec![];
        into_writer(&self, &mut bytes).unwrap();
        std::borrow::Cow::Owned(bytes)
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        from_reader(&mut Cursor::new(&bytes)).unwrap()
    }
}
