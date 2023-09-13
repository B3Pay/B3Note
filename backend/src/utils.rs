use candid::Principal;

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

#[macro_export]
macro_rules! log_caller {
    ($method:expr) => {{
        let caller = ic_cdk::caller();
        log!("Method: {}, Caller: {}", $method, caller.to_text());
        caller
    }};
}
