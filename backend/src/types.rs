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

const ONE_TIME_KEY_EXPIRATION: u64 = 60 * 60 * 24 * 1; // 1 days

pub type PublicKey = [u8; 48];

pub type EncryptionKey = [u8; 96];

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
    pub text: Vec<u8>,
}

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

#[derive(Default, Serialize, Clone, CandidType, Deserialize)]
pub struct OneTimeKey {
    time_lock: NanoTimeStamp,
    public_key: Vec<u8>,
    tries: u8,
}

impl OneTimeKey {
    pub fn new(public_key: PublicKey) -> Self {
        let public_key = public_key.to_vec();

        Self {
            time_lock: NanoTimeStamp::now().add_secs(ONE_TIME_KEY_EXPIRATION),
            public_key,
            tries: 0,
        }
    }

    pub fn reset_time_lock(&mut self) {
        self.time_lock = NanoTimeStamp::now().add_secs(ONE_TIME_KEY_EXPIRATION);
    }

    pub fn out_of_tries(&self) -> bool {
        self.tries >= 3
    }

    pub fn add_try(&mut self) {
        self.tries += 1;
    }

    pub fn tries(&self) -> u8 {
        self.tries
    }

    pub fn is_expired(&self) -> bool {
        self.time_lock.has_passed()
    }

    pub fn public_key(&self) -> &[u8] {
        &self.public_key
    }
}

impl BoundedStorable for OneTimeKey {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 200;
}

impl Storable for OneTimeKey {
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
pub struct AnonymousUserData {
    texts: Vec<Nonce>,
    decryption_key: Vec<u8>,
}

impl BoundedStorable for AnonymousUserData {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 500;
}

impl AnonymousUserData {
    pub fn set_decryption_key(&mut self, key: Vec<u8>) {
        self.decryption_key = key;
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

#[derive(Serialize, Clone, CandidType, Deserialize)]
pub struct AuthenticatedSignature {
    pub signature: Vec<u8>,
    pub created_at: NanoTimeStamp,
}

#[derive(Default, Serialize, Clone, CandidType, Deserialize)]
pub struct UserData {
    texts: Vec<Nonce>,
    public_key: Vec<u8>,
    signature: Option<AuthenticatedSignature>,
}

impl BoundedStorable for UserData {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 100;
}

impl UserData {
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
