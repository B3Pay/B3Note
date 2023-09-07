use b3_utils::{
    hex_string_to_vec, log,
    logs::{export_log, export_log_messages_page, LogEntry},
    memory::{
        base::{timer::TimerEntry, with_base_partition, with_base_partition_mut},
        types::DefaultVMMap,
        with_stable_memory_mut,
    },
    revert, vec_to_hex_string,
    vetkd::{verify_pairing, VetKD, VetKDManagement},
    NanoTimeStamp, Subaccount,
};
use ic_cdk::{init, query, update};
use std::cell::RefCell;

mod types;
use types::*;

thread_local! {
    static USERS: RefCell<DefaultVMMap<Subaccount, UserData>> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("users", 10).unwrap()));
    static USER_PASS: RefCell<DefaultVMMap<UserName, EncryptedHashedPassword>> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("password", 11).unwrap()));
    static ONE_TIME_KEY: RefCell<DefaultVMMap<TextId, OneTimePassword>> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("one_time_key", 12).unwrap()));
    static ENCRYPTED_TEXTS: RefCell<DefaultVMMap<TextId, EncryptedText>> = RefCell::new(with_stable_memory_mut(|pm| pm.init_btree_map("text", 13).unwrap()));
}

#[init]
fn init() {
    log_caller!("init");

    let caller = ic_cdk::caller().into();

    USERS.with(|users| {
        let mut users = users.borrow_mut();

        users.insert(caller, UserData::default());
    });
}

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

#[query]
fn get_user_data() -> UserData {
    log_caller!("get_user");

    let caller = ic_cdk::caller().into();

    let user = USERS.with(|users| {
        let users = users.borrow();

        users.get(&caller)
    });

    if let Some(user) = user {
        user.clone()
    } else {
        ic_cdk::trap("user not found");
    }
}

#[query]
fn user_notes() -> Vec<UserText> {
    log_caller!("user_notes");

    let caller = ic_cdk::caller().into();

    USERS.with(|users| {
        let users = users.borrow();

        users
            .get(&caller)
            .map(|ids| {
                ids.texts
                    .iter()
                    .filter_map(|id| {
                        ENCRYPTED_TEXTS.with(|texts| {
                            let texts = texts.borrow();

                            texts.get(id).map(|note| UserText {
                                id: id.to_owned(),
                                note: note.clone(),
                            })
                        })
                    })
                    .collect()
            })
            .unwrap_or_default()
    })
}

#[query]
fn get_time() -> u64 {
    log_caller!("get_time");

    ic_cdk::api::time()
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
fn set_one_time_key(text_id: TextId, public_key: String) {
    log_caller!("set_one_time_key");

    let public_key = hex_string_to_vec(public_key).unwrap_or_else(revert);

    ONE_TIME_KEY.with(|otp| {
        let mut otp = otp.borrow_mut();

        otp.insert(
            text_id,
            OneTimePassword {
                time_lock: ic_cdk::api::time() + 5 * 60 * 1_000_000_000,
                public_key,
            },
        );
    });
}

#[update]
async fn read_with_one_time_key(
    text_id: TextId,
    signature: String,
    public_key: String,
) -> (String, String) {
    log_caller!("login_with_one_time_key");

    let one_time_key = ONE_TIME_KEY
        .with(|otp| {
            let mut otp = otp.borrow_mut();

            otp.remove(&text_id)
        })
        .expect("Error::One time link not exists!");

    if one_time_key.time_lock < ic_cdk::api::time() {
        ic_cdk::trap("one time password is expired!");
    }

    let signature = hex_string_to_vec(&signature).unwrap_or_else(revert);
    let encryption_public_key = hex_string_to_vec(&public_key).unwrap_or_else(revert);

    let verified = verify_pairing(&one_time_key.public_key, &signature, &text_id.0);

    if !verified.unwrap() {
        ic_cdk::trap("invalid signature");
    }

    let encrypted_text = ENCRYPTED_TEXTS
        .with(|texts| {
            let texts = texts.borrow();

            texts.get(&text_id)
        })
        .expect("Error::Text not found");

    let encrypted_key = VetKD::new(ic_cdk::caller().into())
        .request_encrypted_key(vec![b"ibe_encryption".to_vec()], encryption_public_key)
        .await
        .unwrap_or_else(revert);

    let encrypted_text = vec_to_hex_string(encrypted_text.0);
    let encrypted_key = vec_to_hex_string(encrypted_key);

    (encrypted_text, encrypted_key)
}

#[update]
async fn symmetric_key_verification_key() -> String {
    log_caller!("symmetric_key_verification_key");

    let response = VetKDManagement(None)
        .request_public_key(vec![b"symmetric_key".to_vec()])
        .await
        .unwrap_or_else(revert);

    vec_to_hex_string(response)
}

#[update]
async fn encrypted_symmetric_key_for_caller(encryption_public_key: Vec<u8>) -> String {
    log_caller!("encrypted_symmetric_key_for_caller");

    let encrypted_key = VetKD::new(ic_cdk::caller().into())
        .request_encrypted_key(vec![b"symmetric_key".to_vec()], encryption_public_key)
        .await
        .unwrap_or_else(revert);

    vec_to_hex_string(encrypted_key)
}

#[update]
async fn two_factor_verification_key() -> String {
    log_caller!("two_factor_verification_key");

    let reponse = VetKDManagement(None)
        .request_public_key(vec![b"two_factor_authentication".to_vec()])
        .await
        .unwrap_or_else(revert);

    vec_to_hex_string(reponse)
}

#[update]
async fn request_two_factor_authentication(encryption_public_key: Vec<u8>) -> String {
    log_caller!("request_two_factor_authentication");

    let encrypted_key = VetKD::new(ic_cdk::caller().into())
        .request_encrypted_key(
            vec![b"two_factor_authentication".to_vec()],
            encryption_public_key,
        )
        .await
        .unwrap_or_else(revert);

    vec_to_hex_string(encrypted_key)
}

#[update]
async fn ibe_encryption_key() -> String {
    log_caller!("ibe_encryption_key");

    let reponse = VetKDManagement(None)
        .request_public_key(vec![b"ibe_encryption".to_vec()])
        .await
        .unwrap_or_else(revert);

    vec_to_hex_string(reponse)
}

#[update]
async fn encrypted_ibe_decryption_key_for_caller(encryption_public_key: Vec<u8>) -> String {
    log_caller!("encrypted_ibe_decryption_key_for_caller");

    let encrypted_key = VetKD::new(ic_cdk::caller().into())
        .request_encrypted_key(vec![b"ibe_encryption".to_vec()], encryption_public_key)
        .await
        .unwrap_or_else(revert);

    vec_to_hex_string(encrypted_key)
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

#[query]
fn get_encrypted_texts() -> Vec<(TextId, String)> {
    log_caller!("get_encrypted_texts");

    ENCRYPTED_TEXTS.with(|texts| {
        let texts = texts.borrow();

        texts
            .iter()
            .map(|(id, text)| (id.to_owned(), vec_to_hex_string(text.0)))
            .collect()
    })
}

#[update]
async fn save_encrypted_text(encrypted_text: String) -> TextId {
    log_caller!("save_encrypted_text");

    let encrypted_text = hex_string_to_vec(encrypted_text).unwrap_or_else(revert);

    let text_id = ENCRYPTED_TEXTS.with(|texts| {
        let mut texts = texts.borrow_mut();

        let id = TextId(texts.len().to_be_bytes());

        texts.insert(id.clone(), EncryptedText(encrypted_text));

        id
    });

    USERS.with(|users| {
        let mut users = users.borrow_mut();

        let caller = ic_cdk::caller().into();

        let mut user_data = if let Some(user) = users.get(&caller) {
            user
        } else {
            users.insert(caller.clone(), UserData::default());
            users.get(&caller).unwrap()
        };

        user_data.texts.push(text_id.clone());
    });

    text_id
}

#[update]
fn edit_encrypted_text(text_id: TextId, encrypted_text: String) {
    log_caller!("edit_encrypted_text");

    let encrypted_text = hex_string_to_vec(encrypted_text).unwrap_or_else(revert);

    let caller = ic_cdk::caller().into();

    USERS.with(|users| {
        let users = users.borrow_mut();

        let user = users.get(&caller).unwrap_or_else(|| {
            ic_cdk::trap("user not found");
        });

        if !user.texts.contains(&text_id) {
            ic_cdk::trap("text not found");
        }
    });

    ENCRYPTED_TEXTS.with(|texts| {
        let mut texts = texts.borrow_mut();

        let id = TextId(texts.len().to_be_bytes());

        texts.insert(id.clone(), EncryptedText(encrypted_text));
    });
}

#[update]
fn verify_caller(auth_code: String, public_key_hex: String, signature_hex: String) -> bool {
    log_caller!("get_caller");

    // Convert hex to bytes
    let auth_code = hex_string_to_vec(auth_code).unwrap_or_else(revert);
    let public_key_bytes = hex_string_to_vec(public_key_hex).unwrap_or_else(revert);
    let signature_bytes = hex_string_to_vec(signature_hex).unwrap_or_else(revert);

    // Verify the signature
    verify_pairing(&public_key_bytes, &signature_bytes, &auth_code).unwrap()
}

#[query]
fn print_log_entries() -> Vec<LogEntry> {
    export_log()
}

#[query]
fn print_log_entries_page(page: usize, page_size: Option<usize>) -> Vec<String> {
    export_log_messages_page(page, page_size)
}

#[macro_export]
macro_rules! log_caller {
    ($method:expr) => {
        log!(
            "Method: {}, Caller: {}",
            $method,
            ic_cdk::caller().to_text()
        )
    };
}

#[update]
fn schedule_task(after_sec: u64, id: u64) {
    let time = NanoTimeStamp::now().add_secs(after_sec);

    let timer = TimerEntry { id, time };

    with_base_partition_mut(|core_partition| core_partition.push_timer(&timer)).unwrap();

    reschedule();
}

#[export_name = "canister_global_timer"]
fn global_timer() {
    while let Some(task_time) = with_base_partition(|core_partition| core_partition.peek_timer()) {
        if task_time.time.in_future() {
            reschedule();
            return;
        }
        with_base_partition_mut(|core_partition| core_partition.pop_timer());

        execute_task(task_time);
        reschedule();
    }
}

fn execute_task(timer: TimerEntry) {
    log!("execute_task: {}", timer.id);
    log!("execute_task in : {}", timer.time);
}

fn reschedule() {
    if let Some(task_time) = with_base_partition(|core_partition| core_partition.peek_timer()) {
        unsafe {
            ic0::global_timer_set(task_time.time.into());
        }
    }
}

ic_cdk::export_candid!();
