use b3_utils::{
    memory::{timer::TaskTimerPartition, types::DefaultVMMap, with_stable_memory_mut},
    nonce::Nonce,
    Subaccount,
};
use std::cell::RefCell;

use crate::{types::*, utils::vec_to_fixed_array};

thread_local! {
    pub static NONCE: RefCell<Nonce> = RefCell::new(Nonce::zero());

    pub static IBE_ENCRYPTION_KEYS: RefCell<EncryptionKey> = RefCell::new([0; 96]);
    pub static SYMMETRIC_ENCRYPTION_KEYS: RefCell<EncryptionKey> = RefCell::new([0; 96]);

    pub static TASK_TIMER: RefCell<TaskTimerPartition<Task>> = RefCell::new(with_stable_memory_mut(|pm| TaskTimerPartition::init(pm, 1)));

    pub static USERS: RefCell<DefaultVMMap<Subaccount, UserData>> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("users", 10).unwrap()));
    pub static ANONYMOUS_USERS: RefCell<DefaultVMMap<PublicKey, AnonymousUserData>> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("anonymous_users", 11).unwrap()));

    pub static USER_PASS: RefCell<DefaultVMMap<UserName, EncryptedHashedPassword>> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("password", 12).unwrap()));
    pub static ONE_TIME_KEYS: RefCell<DefaultVMMap<u64, OneTimePassword>> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("one_time_key", 13).unwrap()));
    pub static ENCRYPTED_TEXTS: RefCell<DefaultVMMap<u64, EncryptedText>> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("text", 14).unwrap()));
}

pub fn increment_nonce() -> u64 {
    NONCE.with(|nonce| nonce.borrow_mut().next().0)
}

pub fn get_nonce() -> Nonce {
    NONCE.with(|nonce| nonce.borrow().current())
}

pub fn set_nonce(nonce: Nonce) {
    NONCE.with(|nonce_| *nonce_.borrow_mut() = nonce);
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
            .ok_or("Public key not found".to_string())?)
    })
}

pub fn with_anonymous_user_decryption_key(public_key: &PublicKey) -> Result<Vec<u8>, String> {
    with_anonymous_user(public_key, |anonymous_user| {
        anonymous_user.get_decryption_key()
    })
}

pub fn with_anonymous_user_or_add<F, R>(public_key: &PublicKey, f: F) -> R
where
    F: FnOnce(&mut AnonymousUserData) -> R,
{
    with_anonymous_users(|anonymous_users| {
        let mut anonymous_user = anonymous_users
            .get(public_key)
            .unwrap_or_else(|| AnonymousUserData::default());

        let result = f(&mut anonymous_user);

        anonymous_users.insert(*public_key, anonymous_user);

        result
    })
}

pub fn with_task_timer<F, R>(f: F) -> R
where
    F: FnOnce(&mut TaskTimerPartition<Task>) -> R,
{
    TASK_TIMER.with(|task_timer| f(&mut *task_timer.borrow_mut()))
}

pub fn with_users<F, R>(f: F) -> R
where
    F: FnOnce(&mut DefaultVMMap<Subaccount, UserData>) -> R,
{
    USERS.with(|users| f(&mut *users.borrow_mut()))
}

pub fn with_user_pass<F, R>(f: F) -> R
where
    F: FnOnce(&mut DefaultVMMap<UserName, EncryptedHashedPassword>) -> R,
{
    USER_PASS.with(|user_pass| f(&mut *user_pass.borrow_mut()))
}

pub fn with_one_time_keys<F, R>(f: F) -> R
where
    F: FnOnce(&mut DefaultVMMap<u64, OneTimePassword>) -> R,
{
    ONE_TIME_KEYS.with(|one_time_key| f(&mut *one_time_key.borrow_mut()))
}

pub fn with_encrypted_texts<F, R>(f: F) -> R
where
    F: FnOnce(&mut DefaultVMMap<u64, EncryptedText>) -> R,
{
    ENCRYPTED_TEXTS.with(|encrypted_texts| f(&mut *encrypted_texts.borrow_mut()))
}

pub fn with_user<F, R>(user: &Subaccount, f: F) -> Result<R, String>
where
    F: FnOnce(&mut UserData) -> Result<R, String>,
{
    with_users(|users| f(&mut users.get(user).ok_or("User not found".to_string())?))
}

pub fn with_user_pass_by_name<F, R>(user_name: &UserName, f: F) -> Result<R, String>
where
    F: FnOnce(&mut EncryptedHashedPassword) -> Result<R, String>,
{
    with_user_pass(|user_pass| {
        f(&mut user_pass
            .get(user_name)
            .ok_or("User not found".to_string())?)
    })
}

pub fn with_encrypted_text<F, R>(text_id: &u64, f: F) -> Result<R, String>
where
    F: FnOnce(&mut EncryptedText) -> Result<R, String>,
{
    with_encrypted_texts(|encrypted_texts| {
        f(&mut encrypted_texts
            .get(text_id)
            .ok_or("Text not found".to_string())?)
    })
}

pub fn with_one_time_key_and_remove<F, R>(text_id: &u64, f: F) -> Result<R, String>
where
    F: FnOnce(&mut OneTimePassword) -> Result<R, String>,
{
    with_one_time_keys(|one_time_key| {
        f(&mut one_time_key
            .remove(text_id)
            .ok_or("One time key not found".to_string())?)
    })
}
