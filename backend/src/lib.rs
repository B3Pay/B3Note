use b3_utils::{
    hex_string_to_vec, log,
    logs::{export_log, export_log_messages_page, LogEntry},
    memory::{
        base::{with_base_partition, with_base_partition_mut},
        timer::TaskTimerEntry,
        types::PartitionDetail,
    },
    revert,
    vetkd::{verify_pairing, VetKD, VetKDManagement},
    NanoTimeStamp,
};
use candid::Principal;
use ciborium::into_writer;
use ic_cdk::{init, post_upgrade, pre_upgrade, query, update};

mod types;
use types::*;

mod store;
use store::*;

mod utils;
use utils::*;

#[init]
fn init() {
    log_caller!("init");

    schedule_task(10, Task::Initialize);

    reschedule();
}

#[pre_upgrade]
pub fn pre_upgrade() {
    log!("pre_upgrade");

    let nonce = get_nonce();
    let ibe_key = get_ibe_encrypted_key().to_vec();
    let sym_key = get_symmetric_encrypted_key().to_vec();

    let mut states_bytes = vec![];

    into_writer(&(nonce, ibe_key, sym_key), &mut states_bytes).unwrap();

    with_base_partition_mut(|core_partition| core_partition.set_backup(states_bytes));
}

#[post_upgrade]
pub fn post_upgrade() {
    log!("post_upgrade");

    let states_bytes = with_base_partition(|core_partition| core_partition.get_backup());

    log!("states_bytes: {}", states_bytes.len());

    let (nonce, ibe_key, sym_key) =
        ciborium::de::from_reader(&*states_bytes).expect("failed to decode state");

    set_nonce(nonce);
    set_ibe_encryption_key(ibe_key);
    set_symmetric_encryption_key(sym_key);

    reschedule();
}

#[query(guard = "caller_is_not_anonymous")]
fn get_user_data() -> UserData {
    let caller = log_caller!("get_user");

    with_user(&caller.into(), |user| Ok(user.clone())).unwrap_or_else(revert)
}

#[query]
fn user_notes(public_key: Option<Vec<u8>>) -> Vec<UserText> {
    let caller = log_caller!("user_notes");

    if caller == Principal::anonymous() {
        match public_key {
            Some(public_key) => {
                let public_key = vec_to_fixed_array(&public_key).unwrap_or_else(revert);

                with_anonymous_user(&public_key, |user| {
                    let texts = user
                        .iter_texts()
                        .map(|text_id| {
                            with_encrypted_texts(|texts| {
                                let text = texts.get(text_id).unwrap();

                                UserText {
                                    id: text_id.to_string(),
                                    text: text.to_string(),
                                }
                            })
                        })
                        .collect();

                    Ok(texts)
                })
                .unwrap_or(vec![])
            }
            None => return revert("public key is required for anonymous user"),
        }
    } else {
        with_user(&caller.into(), |user| {
            let texts = user
                .iter_texts()
                .map(|text_id| {
                    with_encrypted_texts(|texts| {
                        let text = texts.get(text_id).unwrap();

                        UserText {
                            id: text_id.to_string(),
                            text: text.to_string(),
                        }
                    })
                })
                .collect();

            Ok(texts)
        })
        .unwrap_or(vec![])
    }
}

#[query]
fn get_anonymous_users() -> Vec<(PublicKey, AnonymousUserData)> {
    log_caller!("get_anonymous_users");

    with_anonymous_users(|users| {
        users
            .iter()
            .map(|(key, user)| (key.clone(), user.clone()))
            .collect()
    })
}

#[query]
fn get_anonymous_user(public_key: Vec<u8>) -> AnonymousUserData {
    log_caller!("anonymous_user");

    let public_key = vec_to_fixed_array(&public_key).unwrap_or_else(revert);

    with_anonymous_user(&public_key, |user| Ok(user.clone())).unwrap_or_else(revert)
}

#[query]
fn get_anonymous_user_notes(public_key: Vec<u8>) -> Vec<UserText> {
    log_caller!("get_anonymous_users_notes");

    let public_key = vec_to_fixed_array(&public_key).unwrap_or_else(revert);

    with_anonymous_user(&public_key, |user| {
        let texts = user
            .iter_texts()
            .map(|text_id| {
                with_encrypted_texts(|texts| {
                    let text = texts.get(text_id).unwrap();

                    UserText {
                        id: text_id.to_string(),
                        text: text.to_string(),
                    }
                })
            })
            .collect();

        Ok(texts)
    })
    .unwrap_or(vec![])
}

#[query]
fn get_encrypted_texts() -> Vec<UserText> {
    log_caller!("get_encrypted_texts");

    with_encrypted_texts(|texts| {
        texts
            .iter()
            .map(|(id, text)| UserText {
                id: id.to_string(),
                text: text.to_string(),
            })
            .collect()
    })
}

#[update]
async fn save_encrypted_text(encrypted_text: Vec<u8>, public_key: Option<Vec<u8>>) -> u64 {
    let caller = log_caller!("save_encrypted_text");
    // public key for anonymous users is required
    if caller == Principal::anonymous() && public_key.is_none() {
        return revert("public key is required for anonymous user");
    }

    let text_id = with_encrypted_texts(|texts| {
        let text_id = increment_nonce();

        texts.insert(text_id, EncryptedText(encrypted_text));

        text_id
    });

    if caller == Principal::anonymous() {
        // this is safe because we checked for None above
        let public_key = vec_to_fixed_array(&public_key.unwrap()).unwrap_or_else(revert);

        with_anonymous_user_or_add(&public_key, |user| {
            user.add_text_id(text_id.clone()).unwrap_or_else(revert);

            text_id
        })
    } else {
        with_user(&caller.into(), |user| {
            user.add_text_id(text_id.clone()).unwrap_or_else(revert);

            Ok(text_id)
        })
        .unwrap_or_else(revert)
    }
}

#[update]
fn edit_encrypted_text(text_id: u64, encrypted_text: Vec<u8>, public_key: Option<Vec<u8>>) {
    let caller = log_caller!("edit_encrypted_text");

    if caller == Principal::anonymous() {
        match public_key {
            Some(public_key) => {
                let public_key = vec_to_fixed_array(&public_key).unwrap_or_else(revert);

                with_anonymous_user(&public_key, |data| {
                    data.remove_text_id(&text_id).unwrap_or_else(revert);

                    with_encrypted_texts(|texts| {
                        texts.insert(text_id.clone(), EncryptedText(encrypted_text));
                    });

                    data.add_text_id(text_id).unwrap_or_else(revert);

                    Ok(())
                })
                .unwrap_or_else(revert)
            }
            None => revert("public key is required"),
        }
    } else {
        with_user(&caller.into(), |user| {
            user.remove_text_id(&text_id).unwrap_or_else(revert);

            with_encrypted_texts(|texts| {
                texts.insert(text_id.clone(), EncryptedText(encrypted_text));
            });

            user.add_text_id(text_id).unwrap_or_else(revert);

            Ok(())
        })
        .unwrap_or_else(revert)
    }
}

#[update]
fn set_one_time_key(text_id: u64, public_key: Vec<u8>) {
    log_caller!("set_one_time_key");

    ONE_TIME_KEYS.with(|otp| {
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
    text_id: u64,
    signature: Vec<u8>,
    public_key: Vec<u8>,
) -> (Vec<u8>, Vec<u8>) {
    let caller = log_caller!("login_with_one_time_key");

    let one_time_key =
        with_one_time_key_and_remove(&text_id, |key| Ok(key.clone())).unwrap_or_else(revert);

    if one_time_key.time_lock < ic_cdk::api::time() {
        ic_cdk::trap("one time password is expired!");
    }

    let verified = verify_pairing(&one_time_key.public_key, &signature, &text_id.to_le_bytes());

    if !verified.unwrap() {
        ic_cdk::trap("invalid signature");
    }

    let encrypted_text =
        with_encrypted_text(&text_id, |text| Ok(text.0.clone())).unwrap_or_else(revert);

    let encrypted_key = VetKD::new(caller.into())
        .request_encrypted_key(vec![b"ibe_encryption".to_vec()], public_key)
        .await
        .unwrap_or_else(revert);

    (encrypted_text, encrypted_key)
}

#[query]
async fn ibe_encryption_key() -> Vec<u8> {
    get_ibe_encrypted_key().to_vec()
}

#[query]
async fn symmetric_key_verification_key() -> Vec<u8> {
    get_symmetric_encrypted_key().to_vec()
}

#[update]
async fn encrypted_ibe_decryption_key_for_caller(encryption_public_key: Vec<u8>) -> Vec<u8> {
    let caller = log_caller!("encrypted_ibe_decryption_key_for_caller");

    let public_key = vec_to_fixed_array(&encryption_public_key).unwrap_or_else(revert);

    // check for cached key
    if let Ok(key) = with_anonymous_user_decryption_key(&public_key) {
        log!("cached key found");
        return key;
    }

    // request key from VetKD Api
    let encrypted_key = VetKD::new(caller.into())
        .request_encrypted_key(vec![b"ibe_encryption".to_vec()], encryption_public_key)
        .await
        .unwrap_or_else(revert);

    // cache key
    with_anonymous_users(|keys| {
        let user_data = AnonymousUserData::new(encrypted_key.clone(), None);

        keys.insert(public_key, user_data);
    });

    encrypted_key
}

#[update]
async fn encrypted_symmetric_key_for_caller(encryption_public_key: Vec<u8>) -> Vec<u8> {
    let caller = log_caller!("encrypted_symmetric_key_for_caller");

    let public_key = vec_to_fixed_array(&encryption_public_key).unwrap_or_else(revert);

    // check for cached key
    if let Ok(key) = with_anonymous_user_decryption_key(&public_key) {
        return key;
    }

    // request key from VetKD Api
    let encrypted_key = VetKD::new(caller.into())
        .request_encrypted_key(vec![b"symmetric_key".to_vec()], encryption_public_key)
        .await
        .unwrap_or_else(revert);

    // cache key
    if caller == Principal::anonymous() {
        with_anonymous_users(|keys| {
            let user_data = AnonymousUserData::new(encrypted_key.clone(), None);

            keys.insert(public_key, user_data);
        });
    } else {
        with_users(|keys| {
            let user_data = UserData::new(encrypted_key.clone(), None);

            keys.insert(caller.into(), user_data);
        });
    }

    encrypted_key
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

#[query]
fn get_partition_details() -> Vec<PartitionDetail> {
    let mut details = Vec::new();

    details.push(PartitionDetail {
        name: "users".to_string(),
        len: USERS.with(|m| m.borrow().len()) as u64,
    });

    details.push(PartitionDetail {
        name: "anonymous_users".to_string(),
        len: ANONYMOUS_USERS.with(|s| s.borrow().len()) as u64,
    });

    details.push(PartitionDetail {
        name: "password".to_string(),
        len: USER_PASS.with(|v| v.borrow().len()) as u64,
    });

    details.push(PartitionDetail {
        name: "one_time_key".to_string(),
        len: ONE_TIME_KEYS.with(|u| u.borrow().len()) as u64,
    });

    details.push(PartitionDetail {
        name: "text".to_string(),
        len: ENCRYPTED_TEXTS.with(|s| s.borrow().len()) as u64,
    });

    TASK_TIMER.with(|tt| {
        let tt = tt.borrow();

        details.push(tt.details());
    });

    details
}

#[query]
fn get_timers() -> Vec<TaskTimerEntry<Task>> {
    TASK_TIMER.with(|s| {
        let state = s.borrow();

        state.get_timer()
    })
}

#[update]
fn schedule_task(after_sec: u64, task: Task) {
    log_caller!("schedule_task");

    let time = NanoTimeStamp::now().add_secs(after_sec);

    let timer = TaskTimerEntry { task, time };

    with_task_timer(|tt| {
        tt.push_timer(&timer)
            .unwrap_or_else(|_| revert("Error::Failed to push timer!"))
    });

    reschedule();
}

#[export_name = "canister_global_timer"]
fn global_timer() {
    while let Some(task_timer) = TASK_TIMER.with(|tt| {
        let tt = tt.borrow();

        tt.peek_timer()
    }) {
        if task_timer.time.in_future() {
            reschedule();
            return;
        }
        with_task_timer(|tt| tt.pop_timer());

        ic_cdk::spawn(execute_task(task_timer));
        reschedule();
    }
}

async fn fetch_encryption_keys() {
    log!("fetching keys...");
    let symmetric_key = VetKDManagement(None)
        .request_public_key(vec![b"symmetric_key".to_vec()])
        .await;

    let ibe_encryption_key = VetKDManagement(None)
        .request_public_key(vec![b"ibe_encryption".to_vec()])
        .await;

    log!("caching keys...");
    if let Ok(symmetric_key) = symmetric_key {
        set_symmetric_encryption_key(symmetric_key);
    } else {
        log!("failed to fetch symmetric key");
    }

    if let Ok(ibe_encryption_key) = ibe_encryption_key {
        set_ibe_encryption_key(ibe_encryption_key);
    } else {
        log!("failed to fetch ibe encryption key");
    }
}

async fn execute_task(timer: TaskTimerEntry<Task>) {
    log!("execute_task: {:?}", timer);

    match timer.task {
        Task::Initialize => {
            log!("initializing...");

            fetch_encryption_keys().await;

            log!("initializing done!");
        }
        Task::Reinialize => {
            log!("reinitializing...");

            fetch_encryption_keys().await;

            log!("reinitializing done!");
        }
        Task::SendEmail {
            email,
            body,
            subject,
        } => {
            log!(
                "sending email to: {} with subject: {}, and body: {}",
                email,
                subject,
                body
            );
        }
        Task::SendText { phone_number, body } => {
            log!("send text to: {} with body: {}", phone_number, body);
        }
    }
}

fn reschedule() {
    if let Some(task_time) = TASK_TIMER.with(|tt| {
        let tt = tt.borrow();

        tt.peek_timer()
    }) {
        unsafe {
            ic0::global_timer_set(task_time.time.into());
        }
    }
}

ic_cdk::export_candid!();

#[macro_export]
macro_rules! log_caller {
    ($method:expr) => {{
        let caller = ic_cdk::caller();
        log!("Method: {}, Caller: {}", $method, caller.to_text());
        caller
    }};
}
