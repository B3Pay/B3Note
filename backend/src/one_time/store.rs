use b3_utils::{
    memory::{types::DefaultVMMap, with_stable_memory_mut},
    nonce::Nonce,
};
use std::cell::RefCell;

use crate::stable::MemoryPartition;

use super::OneTimeKey;

type OneTimeKeys = DefaultVMMap<Nonce, OneTimeKey>;

thread_local! {
    pub static ONE_TIME_KEYS: RefCell<OneTimeKeys> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("one_time_key", MemoryPartition::OneTimeKeys.id()).unwrap()));
}

pub fn with_one_time_keys<F, R>(f: F) -> R
where
    F: FnOnce(&mut OneTimeKeys) -> R,
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
