use b3_utils::{
    memory::{
        types::{DefaultVMCell, DefaultVMMap},
        with_stable_memory_mut,
    },
    nonce::Nonce,
};

use std::cell::RefCell;

use crate::stable::MemoryPartition;

use super::EncryptedText;

type EncryptedTexts = DefaultVMMap<Nonce, EncryptedText>;

thread_local! {
    pub static TEXT_COUNTER: RefCell<DefaultVMCell<Nonce>> = RefCell::new(with_stable_memory_mut(|pm| pm.init_cell("stable_counter", MemoryPartition::TextCounter.id()).unwrap()));
    pub static ENCRYPTED_TEXTS: RefCell<EncryptedTexts> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("text", MemoryPartition::EncryptedTexts.id()).unwrap()));
}

pub fn with_encrypted_texts<F, R>(f: F) -> R
where
    F: FnOnce(&mut DefaultVMMap<Nonce, EncryptedText>) -> R,
{
    ENCRYPTED_TEXTS.with(|encrypted_texts| f(&mut *encrypted_texts.borrow_mut()))
}

pub fn with_encrypted_text<F, R>(text_id: &Nonce, f: F) -> Result<R, String>
where
    F: FnOnce(&mut EncryptedText) -> Result<R, String>,
{
    with_encrypted_texts(|encrypted_texts| {
        f(&mut encrypted_texts
            .get(text_id)
            .ok_or("Error::Text not found!".to_string())?)
    })
}

pub fn increment_nonce() -> Result<Nonce, String> {
    TEXT_COUNTER.with(|nonce| {
        let mut nonce = nonce.borrow_mut();

        let current = nonce.get().add(1);

        let next = nonce.set(current).map_err(|_| {
            "Error::Nonce counter overflowed. This should never happen, please contact the developers!"
        })?;

        Ok(next)
    })
}

pub fn get_nonce() -> Nonce {
    TEXT_COUNTER.with(|nonce| {
        let nonce = nonce.borrow();

        nonce.get().current()
    })
}
