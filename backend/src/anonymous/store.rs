use b3_utils::memory::{types::DefaultVMMap, with_stable_memory_mut};
use std::cell::RefCell;

use crate::{stable::MemoryPartition, types::PublicKey};

use super::AnonymousUserData;

type AnonymousUsers = DefaultVMMap<PublicKey, AnonymousUserData>;

thread_local! {
    pub static ANONYMOUS_USERS: RefCell<AnonymousUsers> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("anonymous_users", MemoryPartition::AnonymousUsers.id()).unwrap()));
}

pub fn with_anonymous_users<F, R>(f: F) -> R
where
    F: FnOnce(&mut AnonymousUsers) -> R,
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
