#[query]
fn get_password(username: UserName) -> EncryptedHashedPassword {
    log_caller!("get_password");

    let password = USER_PASS.with(|users| {
        let users = users.borrow();

        users.get(&username)
    });

    if let Some(password) = password {
        password.clone()
    } else {
        ic_cdk::trap("user not found");
    }
}

#[update]
fn set_password(username: UserName, password: EncryptedHashedPassword) {
    log_caller!("set_password");

    USER_PASS.with(|users| {
        let mut users = users.borrow_mut();

        users.insert(username, password);
    });
}

#[update]
fn verify_password(username: UserName, _password: EncryptedHashedPassword) -> bool {
    log_caller!("verify_password");

    let _encrypted_hashed_password = get_password(username);

    // let decryptedHashedPassword = decrypt_text(
    //     hex::encode(encryptedHashedPassword),
    //     hex::encode(symmetric_key_verification_key()),
    // );

    // verify_pairing(username, decryptedHashedPassword, &password).unwrap()

    todo!("verify_password")
}
#[update]
fn set_signature(public_key: String, signature: String) -> NanoTimeStamp {
    log_caller!("set_signature");

    let signature = hex_string_to_vec(signature).unwrap_or_else(revert);
    let public_key = hex_string_to_vec(public_key).unwrap_or_else(revert);

    USERS.with(|users| {
        let mut users = users.borrow_mut();

        let caller = ic_cdk::caller().into();

        // get user or create new one
        let mut user_data = if let Some(user) = users.get(&caller) {
            user
        } else {
            users.insert(caller.clone(), UserData::default());
            users.get(&caller).unwrap()
        };

        let auth = AuthenticatedSignature::new(signature);

        user_data.signature = Some(auth.clone());
        user_data.public_key = public_key;

        auth.created_at
    })
}

#[update]
fn login_with_signature(auth_code: String) -> bool {
    log_caller!("login_with_signature");

    let auth_code = hex_string_to_vec(auth_code).unwrap_or_else(revert);

    let caller = ic_cdk::caller().into();

    USERS.with(|users| {
        let users = users.borrow_mut();

        let user = users.get(&caller).unwrap_or_else(|| {
            ic_cdk::trap("user not found");
        });

        if let Some(signature) = &user.signature {
            if signature.created_at.add_secs(30).has_passed() {
                ic_cdk::trap("signature expired");
            }

            let verified = verify_pairing(&user.public_key, &signature.signature, &auth_code);

            match verified {
                Ok(verified) => {
                    if !verified {
                        ic_cdk::trap("invalid signature");
                    }

                    return true;
                }
                Err(_) => {
                    ic_cdk::trap("invalid signature");
                }
            }
        } else {
            ic_cdk::trap("signature not set");
        }
    })
}

#[update]
async fn encrypted_ibe_decryption_key_for_caller_for_canister(
    encryption_public_key: Vec<u8>,
    derivation_id: Vec<u8>,
) -> String {
    log_caller!("encrypted_ibe_decryption_key_for_caller");

    let encrypted_key = VetKDManagement(None)
        .request_encrypted_key(
            derivation_id,
            vec![b"ibe_encryption".to_vec()],
            encryption_public_key,
        )
        .await
        .unwrap_or_else(revert);

    vec_to_hex_string(encrypted_key)
}
