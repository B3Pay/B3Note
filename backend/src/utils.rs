use candid::Principal;

use crate::{
    store::with_anonymous_user,
    types::{AnonymousUserData, PublicKey},
};

pub fn vec_to_fixed_array<const N: usize>(slice: &[u8]) -> Result<[u8; N], String> {
    if slice.len() != N {
        return Err(format!("Expected length {}, found {}", N, slice.len()));
    }
    let mut array = [0u8; N];
    array.copy_from_slice(slice);
    Ok(array)
}

pub fn caller_is_not_anonymous() -> Result<(), String> {
    let caller = ic_cdk::caller();
    if caller == Principal::anonymous() {
        return Err("Caller is anonymous".to_string());
    }

    Ok(())
}

pub fn caller_is_controller() -> Result<(), String> {
    let caller = ic_cdk::caller();

    if !ic_cdk::api::is_controller(&caller) {
        return Err("Caller is not the controller".to_string());
    }

    Ok(())
}

pub fn get_anonymous_user(public_key: &PublicKey) -> Result<AnonymousUserData, String> {
    with_anonymous_user(public_key, |anonymous_user| Ok(anonymous_user.clone()))
}
