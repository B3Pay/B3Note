use b3_utils::{
    memory::{
        init_stable_mem_refcell,
        timer::DefaultTaskTimer,
        types::{DefaultVMCell, DefaultVMMap},
    },
    nonce::Nonce,
    Subaccount,
};
use std::{cell::RefCell, ops::Add};

use crate::{types::*, utils::vec_to_fixed_array};

thread_local! {
    pub static TEXT_COUNTER: RefCell<DefaultVMCell<Nonce>> = init_stable_mem_refcell("stable_counter", 100).unwrap();

    pub static IBE_ENCRYPTION_KEYS: RefCell<EncryptionKey> = RefCell::new([0; 96]);
    pub static SYMMETRIC_ENCRYPTION_KEYS: RefCell<EncryptionKey> = RefCell::new([0; 96]);

    pub static TASK_TIMER: RefCell<DefaultTaskTimer<Task>> = init_stable_mem_refcell("task_timer", 1).unwrap();

    pub static USERS: RefCell<DefaultVMMap<Subaccount, UserData>> = init_stable_mem_refcell("users", 10).unwrap();
    pub static ANONYMOUS_USERS: RefCell<DefaultVMMap<PublicKey, AnonymousUserData>> = init_stable_mem_refcell("anonymous_users", 11).unwrap();

    pub static USER_PASS: RefCell<DefaultVMMap<UserName, EncryptedHashedPassword>> = init_stable_mem_refcell("password", 12).unwrap();

    pub static ONE_TIME_KEYS: RefCell<DefaultVMMap<Nonce, OneTimeKey>> = init_stable_mem_refcell("one_time_key", 13).unwrap();
    pub static ENCRYPTED_TEXTS: RefCell<DefaultVMMap<Nonce, EncryptedText>> = init_stable_mem_refcell("text", 14).unwrap();

}

pub fn increment_nonce() -> Result<Nonce, String> {
    TEXT_COUNTER.with(|nonce| {
        let mut nonce = nonce.borrow_mut();

        let current = nonce.get().add(Nonce::from(1));

        let next = nonce.set(current).map_err(|_| {
            "Error::Nonce counter overflowed. This should never happen, please contact the developers!"
        })?;

        Ok(next)
    })
}

pub fn set_ibe_encryption_key(key: Vec<u8>) {
    let key = vec_to_fixed_array(&key).unwrap();

    IBE_ENCRYPTION_KEYS.with(|ibe_encrypted_key| {
        *ibe_encrypted_key.borrow_mut() = key;
    })
}

pub fn get_ibe_encrypted_key() -> EncryptionKey {
    IBE_ENCRYPTION_KEYS.with(|ibe_encrypted_key| *ibe_encrypted_key.borrow())
}

pub fn set_symmetric_encryption_key(key: Vec<u8>) {
    let key = vec_to_fixed_array(&key).unwrap();

    SYMMETRIC_ENCRYPTION_KEYS.with(|symmetric_encrypted_key| {
        *symmetric_encrypted_key.borrow_mut() = key;
    })
}

pub fn get_symmetric_encrypted_key() -> EncryptionKey {
    SYMMETRIC_ENCRYPTION_KEYS.with(|symmetric_encrypted_key| *symmetric_encrypted_key.borrow())
}

pub fn with_anonymous_users<F, R>(f: F) -> R
where
    F: FnOnce(&mut DefaultVMMap<PublicKey, AnonymousUserData>) -> R,
{
    ANONYMOUS_USERS.with(|anonymous_users| f(&mut *anonymous_users.borrow_mut()))
}

pub fn with_anonymous_user<F, R>(public_key: &PublicKey, f: F) -> Result<R, String>
where
    F: FnOnce(&mut AnonymousUserData) -> Result<R, String>,
{
    with_anonymous_users(|anonymous_users| {
        f(&mut anonymous_users
            .get(public_key)
            .ok_or("Error::Public key not found!".to_string())?)
    })
}

pub fn with_anonymous_user_or_add<F, R>(public_key: &PublicKey, f: F) -> R
where
    F: FnOnce(&mut AnonymousUserData) -> R,
{
    with_anonymous_users(|anonymous_users| {
        let mut anonymous_user = anonymous_users
            .get(public_key)
            .unwrap_or_else(|| AnonymousUserData::new(None));

        let result = f(&mut anonymous_user);

        anonymous_users.insert(public_key.clone(), anonymous_user);

        result
    })
}

pub fn with_task_timer<F, R>(f: F) -> R
where
    F: FnOnce(&mut DefaultTaskTimer<Task>) -> R,
{
    TASK_TIMER.with(|task_timer| f(&mut *task_timer.borrow_mut()))
}

pub fn with_users<F, R>(f: F) -> R
where
    F: FnOnce(&mut DefaultVMMap<Subaccount, UserData>) -> R,
{
    USERS.with(|users| f(&mut *users.borrow_mut()))
}

pub fn with_user<F, R>(user: &Subaccount, f: F) -> Result<R, String>
where
    F: FnOnce(&mut UserData) -> Result<R, String>,
{
    with_users(|users| {
        f(&mut users
            .get(user)
            .ok_or("Error::User not found!".to_string())?)
    })
}

pub fn with_user_or_add<F, R>(user: &Subaccount, f: F) -> R
where
    F: FnOnce(&mut UserData) -> R,
{
    with_users(|users| {
        let mut user_data = users.get(user).unwrap_or_else(|| UserData::default());

        let result = f(&mut user_data);

        users.insert(user.clone(), user_data);

        result
    })
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

pub fn with_one_time_keys<F, R>(f: F) -> R
where
    F: FnOnce(&mut DefaultVMMap<Nonce, OneTimeKey>) -> R,
{
    ONE_TIME_KEYS.with(|one_time_key| f(&mut *one_time_key.borrow_mut()))
}

pub fn with_one_time_key<F, R>(text_id: &Nonce, f: F) -> Result<R, String>
where
    F: FnOnce(&mut OneTimeKey) -> Result<R, String>,
{
    with_one_time_keys(|one_time_key| {
        f(&mut one_time_key
            .get(text_id)
            .ok_or("Error::One time key not found!".to_string())?)
    })
}

pub fn with_one_time_key_and_try<F, R>(text_id: &Nonce, f: F) -> Result<R, String>
where
    F: FnOnce(&mut OneTimeKey) -> Result<R, String>,
{
    with_one_time_keys(|one_time_key| {
        let mut one_time_key = one_time_key
            .get(text_id)
            .ok_or("Error::Text not found!".to_string())?;

        let result = f(&mut one_time_key);

        one_time_key.add_try();

        result
    })
}
