use b3_utils::{
    memory::types::{BoundedStorable, Storable},
    vec_to_hex_string, NanoTimeStamp,
};
use candid::CandidType;
use ciborium::de::from_reader;
use ciborium::ser::into_writer;
use core::fmt;
use serde::{Deserialize, Serialize};
use std::io::Cursor;

pub type PublicKey = [u8; 48];

pub type EncryptionKey = [u8; 96];

pub type DecryptionKey = [u8; 192];

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

#[derive(candid::CandidType, Clone, Deserialize)]
pub struct UserText {
    pub id: String,
    pub text: String,
}

#[derive(Clone)]
pub struct OneTimePassword {
    pub time_lock: u64,
    pub public_key: Vec<u8>,
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

#[derive(candid::CandidType, Clone, Deserialize)]
pub struct EncryptedText(pub Vec<u8>);

impl fmt::Display for EncryptedText {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", vec_to_hex_string(&self.0))
    }
}

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
pub struct AnonymousUserData {
    texts: Vec<u64>,
    decryption_key: Vec<u8>,
}

impl BoundedStorable for AnonymousUserData {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 500;
}

impl AnonymousUserData {
    pub fn new(decryption_key: Vec<u8>, text_id: Option<u64>) -> Self {
        Self {
            texts: text_id.into_iter().collect(),
            decryption_key,
        }
    }

    pub fn add_text_id(&mut self, text_id: u64) -> Result<(), &'static str> {
        if self.texts.len() >= 5 {
            return Err("Maximum of 5 text are allowed");
        }

        self.texts.push(text_id);

        Ok(())
    }

    pub fn remove_text_id(&mut self, text_id: &u64) -> Result<(), &'static str> {
        if self.texts.len() < 1 {
            return Err("No text to remove");
        }

        self.texts.retain(|id| id != text_id);

        Ok(())
    }

    pub fn iter_texts(&self) -> impl Iterator<Item = &u64> {
        self.texts.iter()
    }

    pub fn get_decryption_key(&self) -> Result<Vec<u8>, String> {
        if self.decryption_key.len() != 192 {
            return Err("Decryption key is not Valid!".to_string());
        }

        Ok(self.decryption_key.clone())
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

#[derive(Default, Serialize, Clone, CandidType, Deserialize)]
pub struct UserData {
    texts: Vec<u64>,
    public_key: Vec<u8>,
    signature: Option<AuthenticatedSignature>,
}

impl BoundedStorable for UserData {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 100;
}

impl UserData {
    pub fn new(public_key: Vec<u8>, text_id: Option<u64>) -> Self {
        Self {
            texts: text_id.into_iter().collect(),
            public_key,
            signature: None,
        }
    }

    pub fn add_text_id(&mut self, new_texts: u64) -> Result<(), &'static str> {
        if self.texts.len() > 10 {
            return Err("Maximum of 10 u64s are allowed");
        }

        self.texts.push(new_texts);

        Ok(())
    }

    pub fn remove_text_id(&mut self, text_id: &u64) -> Result<(), &'static str> {
        if self.texts.len() < 1 {
            return Err("No u64s to remove");
        }

        self.texts.retain(|id| id != text_id);

        Ok(())
    }

    pub fn public_key(&self) -> &Vec<u8> {
        &self.public_key
    }

    pub fn texts(&self) -> &Vec<u64> {
        &self.texts
    }

    pub fn iter_texts(&self) -> impl Iterator<Item = &u64> {
        self.texts.iter()
    }
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

#[derive(CandidType, Debug, PartialEq, Eq, PartialOrd, Ord, Clone, Serialize, Deserialize)]
pub enum Task {
    Initialize,
    Reinialize,
    SendEmail {
        email: String,
        subject: String,
        body: String,
    },
    SendText {
        phone_number: String,
        body: String,
    },
}

impl Storable for Task {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        let mut bytes = vec![];
        into_writer(&self, &mut bytes).unwrap();
        std::borrow::Cow::Owned(bytes)
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        from_reader(&mut Cursor::new(&bytes)).unwrap()
    }
}

impl BoundedStorable for Task {
    const MAX_SIZE: u32 = 24;
    const IS_FIXED_SIZE: bool = true;
}
