use b3_utils::{
    memory::{types::DefaultVMMap, with_stable_memory_mut},
    Subaccount,
};
use std::cell::RefCell;

use crate::stable::MemoryPartition;

use super::IdentifiedUserData;

type IdentifiedUsers = DefaultVMMap<Subaccount, IdentifiedUserData>;

thread_local! {
    pub static IDENTIFIED_USERS: RefCell<IdentifiedUsers> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("users", MemoryPartition::IdentifiedUsers.id()).unwrap()));
}

pub fn with_identified_users<F, R>(f: F) -> R
where
    F: FnOnce(&mut IdentifiedUsers) -> R,
{
    IDENTIFIED_USERS.with(|users| f(&mut *users.borrow_mut()))
}

pub fn with_identified_user<F, R>(user: &Subaccount, f: F) -> Result<R, String>
where
    F: FnOnce(&mut IdentifiedUserData) -> Result<R, String>,
{
    with_identified_users(|users| {
        f(&mut users
            .get(user)
            .ok_or("Error::User not found!".to_string())?)
    })
}

pub fn with_identified_user_or_add<F, R>(user: &Subaccount, f: F) -> R
where
    F: FnOnce(&mut IdentifiedUserData) -> R,
{
    with_identified_users(|users| {
        let mut user_data = users
            .get(user)
            .unwrap_or_else(|| IdentifiedUserData::default());

        let result = f(&mut user_data);

        users.insert(user.clone(), user_data);

        result
    })
}
