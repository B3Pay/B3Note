use std::mem;

use candid::Principal;

pub fn vec_to_fixed_array<T>(vec: &Vec<u8>) -> Result<T, String> {
    let required_size = mem::size_of::<T>();
    if vec.len() != required_size {
        return Err(format!(
            "Length of vector is not {}, its {}",
            required_size,
            vec.len()
        ));
    }

    let mut uninit: mem::MaybeUninit<T> = mem::MaybeUninit::uninit();
    unsafe {
        let p = uninit.as_mut_ptr() as *mut u8;
        std::ptr::copy_nonoverlapping(vec.as_ptr(), p, required_size);
        Ok(uninit.assume_init())
    }
}

pub fn caller_is_not_anonymous() -> Result<(), String> {
    let caller = ic_cdk::caller();
    if caller == Principal::anonymous() {
        return Err("Caller is anonymous".to_string());
    }

    Ok(())
}
