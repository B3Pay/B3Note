use b3_utils::{
    log,
    logs::{export_log, export_log_messages_page, LogEntry},
    memory::{
        base::{with_base_partition, with_base_partition_mut},
        timer::TaskTimerEntry,
        types::PartitionDetail,
    },
    nonce::Nonce,
    report, revert, vec_to_hex_string,
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
    log!("Pre_upgrade");

    let ibe_key = get_ibe_encrypted_key().to_vec();
    let sym_key = get_symmetric_encrypted_key().to_vec();
    let auth_key = get_two_factor_authentication_key().to_vec();

    let mut states_bytes = vec![];

    into_writer(&(ibe_key, sym_key, auth_key), &mut states_bytes).unwrap();

    with_base_partition_mut(|core_partition| core_partition.set_backup(states_bytes));
}

#[post_upgrade]
pub fn post_upgrade() {
    log!("Post_upgrade");

    let states_bytes = with_base_partition(|core_partition| core_partition.get_backup());

    let (ibe_key, sym_key, auth_key) =
        ciborium::de::from_reader(&*states_bytes).expect("failed to decode state");

    set_ibe_encryption_key(ibe_key);
    set_symmetric_encryption_key(sym_key);
    set_two_factor_authentication_key(auth_key);

    for detail in partition_details() {
        log!("{:?}", detail);
    }

    schedule_task(10, Task::Initialize);

    reschedule();
}

#[query(guard = "caller_is_not_anonymous")]
fn user_data() -> UserData {
    let caller = log_caller!("user_data");

    with_user(&caller.into(), |user| Ok(user.clone())).unwrap_or_else(revert)
}

#[query]
fn user_notes(public_key: Option<Vec<u8>>) -> (NanoTimeStamp, Vec<UserText>) {
    let caller = log_caller!("user_notes");

    if caller == Principal::anonymous() {
        match public_key {
            Some(public_key) => {
                let public_key = vec_to_fixed_array(&public_key).unwrap_or_else(revert);

                with_anonymous_user_or_add(&public_key, |user| {
                    let texts = user
                        .iter_texts()
                        .map(|text_id| {
                            with_encrypted_texts(|texts| {
                                let text = texts.get(text_id).unwrap();

                                UserText {
                                    id: text_id.to_string(),
                                    text: text.clone(),
                                }
                            })
                        })
                        .collect();

                    (user.get_created_at(), texts)
                })
            }
            None => return revert("Error::public key is required for anonymous user"),
        }
    } else {
        let time = NanoTimeStamp::default();
        with_user(&caller.into(), |user| {
            let texts = user
                .iter_texts()
                .map(|text_id| {
                    with_encrypted_texts(|texts| {
                        let text = texts.get(text_id).unwrap();

                        UserText {
                            id: text_id.to_string(),
                            text: text.clone(),
                        }
                    })
                })
                .collect();

            Ok((time.clone(), texts))
        })
        .unwrap_or((time, vec![]))
    }
}

#[query]
fn anonymous_users() -> Vec<(PublicKey, AnonymousUserData)> {
    log_caller!("anonymous_users");

    with_anonymous_users(|users| {
        users
            .iter()
            .map(|(key, user)| (key.clone(), user.clone()))
            .collect()
    })
}

#[query]
fn anonymous_user(public_key: Vec<u8>) -> AnonymousUserData {
    log_caller!("anonymous_user");

    let public_key = vec_to_fixed_array(&public_key).unwrap_or_else(revert);

    get_anonymous_user(&public_key).unwrap_or_else(revert)
}

#[query]
fn anonymous_user_notes(public_key: Vec<u8>) -> Vec<UserText> {
    log_caller!("anonymous_user_notes");

    let public_key = vec_to_fixed_array(&public_key).unwrap_or_else(revert);

    with_anonymous_user(&public_key, |user| {
        let texts = user
            .iter_texts()
            .map(|text_id| {
                with_encrypted_texts(|texts| {
                    let text = texts.get(text_id).unwrap();

                    UserText {
                        id: text_id.to_string(),
                        text: text.clone(),
                    }
                })
            })
            .collect();

        Ok(texts)
    })
    .unwrap_or(vec![])
}

#[query]
fn encrypted_texts() -> Vec<UserText> {
    log_caller!("encrypted_texts");

    with_encrypted_texts(|texts| {
        texts
            .iter()
            .map(|(id, text)| UserText {
                id: id.to_string(),
                text: text.clone(),
            })
            .collect()
    })
}

#[update]
async fn save_encrypted_text(encrypted_text: Vec<u8>, public_key: Option<Vec<u8>>) -> Nonce {
    let caller = log_caller!("save_encrypted_text");
    // public key for anonymous users is required
    if caller == Principal::anonymous() && public_key.is_none() {
        return revert("Error::public key is required for anonymous user!");
    }

    let text_id = increment_nonce().unwrap_or_else(revert);

    with_encrypted_texts(|texts| {
        texts.insert(text_id, EncryptedText::new(encrypted_text));
    });

    if caller == Principal::anonymous() {
        // this is safe because we checked for None above
        let public_key = vec_to_fixed_array(&public_key.unwrap()).unwrap_or_else(revert);

        log!("Adding text id to anonymous user!");
        with_anonymous_user_or_add(&public_key, |user| {
            user.add_text_id(text_id.clone()).unwrap_or_else(revert);

            text_id
        })
    } else {
        with_user_or_add(&caller.into(), |user| {
            user.add_text_id(text_id.clone()).unwrap_or_else(revert);

            text_id
        })
    }
}

#[update]
fn edit_encrypted_text(text_id: Nonce, encrypted_text: Vec<u8>, public_key: Option<Vec<u8>>) {
    let caller = log_caller!("edit_encrypted_text");

    if caller == Principal::anonymous() {
        match public_key {
            Some(public_key) => {
                let public_key = vec_to_fixed_array(&public_key).unwrap_or_else(revert);

                with_anonymous_user(&public_key, |data| {
                    data.remove_text_id(&text_id).unwrap_or_else(revert);

                    with_encrypted_texts(|texts| {
                        texts.insert(text_id.clone(), EncryptedText::new(encrypted_text));
                    });

                    data.add_text_id(text_id).unwrap_or_else(revert);

                    Ok(())
                })
                .unwrap_or_else(revert)
            }
            None => revert("Error::public key is required!"),
        }
    } else {
        with_user(&caller.into(), |user| {
            user.remove_text_id(&text_id).unwrap_or_else(revert);

            with_encrypted_texts(|texts| {
                texts.insert(text_id.clone(), EncryptedText::new(encrypted_text));
            });

            user.add_text_id(text_id).unwrap_or_else(revert);

            Ok(())
        })
        .unwrap_or_else(revert)
    }
}

#[query]
fn get_one_time_key(text_id: Nonce) -> Vec<u8> {
    log_caller!("get_one_time_key");

    with_one_time_key(&text_id, |key| Ok(key.public_key().to_vec())).unwrap_or_else(revert)
}

#[query]
fn get_one_time_key_details(text_id: Nonce) -> OneTimeKey {
    log_caller!("get_one_time_key");

    with_one_time_key(&text_id, |key| Ok(key.clone())).unwrap_or_else(revert)
}

#[update]
fn set_one_time_key(text_id: Nonce, public_key: Vec<u8>) {
    log_caller!("set_one_time_key");

    let public_key = vec_to_fixed_array(&public_key).unwrap_or_else(revert);

    // check if user own the text_id want to share
    let user_data = get_anonymous_user(&public_key).unwrap_or_else(revert);

    if !user_data.has_text_id(&text_id) {
        return revert("Error::User does not own the text_id!");
    }

    with_one_time_keys(|keys| {
        keys.insert(text_id, OneTimeKey::new(public_key));
    });
}

#[update]
async fn read_with_one_time_key(
    text_id: Nonce,
    signature: Vec<u8>,
    reader_public_key: Vec<u8>,
) -> Result<(Vec<u8>, Vec<u8>), String> {
    let caller = log_caller!("read_with_one_time_key");

    let one_time_key =
        with_one_time_key_and_try(&text_id, |key| Ok(key.clone())).unwrap_or_else(revert);

    if one_time_key.out_of_tries() {
        return report("Error::One time key is out of tries!");
    }

    if one_time_key.is_expired() {
        return report("Error::One time key is expired!");
    }

    let verified = verify_pairing(
        &one_time_key.public_key(),
        &signature,
        &text_id.to_le_bytes(),
    );

    match verified {
        Ok(_) => {
            let encrypted_text =
                with_encrypted_text(&text_id, |text| Ok(text.clone())).unwrap_or_else(revert);

            let encrypted_key = VetKD::new(caller.into())
                .request_encrypted_key(vec![b"ibe_encryption".to_vec()], reader_public_key)
                .await
                .unwrap_or_else(revert);

            with_one_time_keys(|keys| {
                keys.remove(&text_id).unwrap();
            });

            Ok((encrypted_text, encrypted_key))
        }
        Err(_) => report("Error::Invalid signature!"),
    }
}

#[query]
async fn ibe_encryption_key() -> Vec<u8> {
    get_ibe_encrypted_key().to_vec()
}

#[query]
async fn symmetric_key_verification_key() -> Vec<u8> {
    get_symmetric_encrypted_key().to_vec()
}

#[update(guard = "caller_is_not_anonymous")]
async fn two_factor_verification_key() -> Vec<u8> {
    get_two_factor_authentication_key().to_vec()
}

#[update(guard = "caller_is_not_anonymous")]
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
async fn encrypted_ibe_decryption_key_for_caller(encryption_public_key: Vec<u8>) -> Vec<u8> {
    let caller = log_caller!("encrypted_ibe_decryption_key_for_caller");

    let public_key = vec_to_fixed_array(&encryption_public_key).unwrap_or_else(revert);

    // check for cached key
    if let Ok(user_data) = get_anonymous_user(&public_key) {
        if let Some(decryption_key) = user_data.get_decryption_key().ok() {
            return decryption_key;
        }
    }

    // request key from VetKD Api
    let encrypted_key = VetKD::new(caller.into())
        .request_encrypted_key(vec![b"ibe_encryption".to_vec()], encryption_public_key)
        .await
        .unwrap_or_else(revert);

    // cache key
    with_anonymous_user_or_add(&public_key, |user| {
        user.set_decryption_key(encrypted_key.clone());
    });

    encrypted_key
}

#[update]
async fn encrypted_symmetric_key_for_caller(encryption_public_key: Vec<u8>) -> Vec<u8> {
    let caller = log_caller!("encrypted_symmetric_key_for_caller");

    let public_key = vec_to_fixed_array(&encryption_public_key).unwrap_or_else(revert);

    // check for cached key
    if let Ok(user_data) = get_anonymous_user(&public_key) {
        if let Some(decryption_key) = user_data.get_decryption_key().ok() {
            return decryption_key;
        }
    }

    // request key from VetKD Api
    let encrypted_key = VetKD::new(caller.into())
        .request_encrypted_key(vec![b"symmetric_key".to_vec()], encryption_public_key)
        .await
        .unwrap_or_else(revert);

    // cache key
    if caller == Principal::anonymous() {
        with_anonymous_user_or_add(&public_key, |user| {
            user.set_decryption_key(encrypted_key.clone());
        });
    } else {
        with_users(|keys| {
            let user_data = UserData::new(encrypted_key.clone(), None);

            keys.insert(caller.into(), user_data);
        });
    }

    encrypted_key
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
fn partition_details() -> Vec<PartitionDetail> {
    let mut details = Vec::new();

    details.push(PartitionDetail {
        name: "text counter".to_string(),
        len: get_nonce().into(),
    });

    details.push(PartitionDetail {
        name: "users".to_string(),
        len: USERS.with(|m| m.borrow().len()) as u64,
    });

    details.push(PartitionDetail {
        name: "anonymous users".to_string(),
        len: ANONYMOUS_USERS.with(|s| s.borrow().len()) as u64,
    });

    details.push(PartitionDetail {
        name: "password".to_string(),
        len: USER_PASS.with(|v| v.borrow().len()) as u64,
    });

    details.push(PartitionDetail {
        name: "one time keys".to_string(),
        len: ONE_TIME_KEYS.with(|u| u.borrow().len()) as u64,
    });

    details.push(PartitionDetail {
        name: "encrypted text".to_string(),
        len: ENCRYPTED_TEXTS.with(|s| s.borrow().len()) as u64,
    });

    TASK_TIMER.with(|tt| {
        let tt = tt.borrow();

        details.push(tt.details());
    });

    details
}

#[query]
fn timers() -> Vec<TaskTimerEntry<Task>> {
    TASK_TIMER.with(|s| {
        let state = s.borrow();

        state.get_timer()
    })
}

fn schedule_task(after_sec: u64, task: Task) {
    log_caller!(format!(
        "schedule_task: {:?} after {} secs",
        task, after_sec
    ));

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
    log!("Fetching keys...");
    let symmetric_key = VetKDManagement(None)
        .request_public_key(vec![b"symmetric_key".to_vec()])
        .await;

    let ibe_encryption_key = VetKDManagement(None)
        .request_public_key(vec![b"ibe_encryption".to_vec()])
        .await;

    let authentication_key = VetKDManagement(None)
        .request_public_key(vec![b"two_factor_authentication".to_vec()])
        .await;

    log!("Caching keys...");
    if let Ok(symmetric_key) = symmetric_key {
        set_symmetric_encryption_key(symmetric_key);
    } else {
        log!("Failed to fetch symmetric key!");
    }

    if let Ok(ibe_encryption_key) = ibe_encryption_key {
        set_ibe_encryption_key(ibe_encryption_key);
    } else {
        log!("Failed to fetch ibe encryption key!");
    }

    if let Ok(authentication_key) = authentication_key {
        set_two_factor_authentication_key(authentication_key);
    } else {
        log!("Failed to fetch two factor authentication key!");
    }
}

async fn execute_task(timer: TaskTimerEntry<Task>) {
    log!("Execute_task: {:?}", timer);

    match timer.task {
        Task::Initialize => {
            log!("Initializing...");

            let now = NanoTimeStamp::now();

            fetch_encryption_keys().await;

            log!("Initializing done! Took: {}ms", now.elapsed().to_millis());

            schedule_task(3600, Task::CleanUpKeys);
            schedule_task(3600, Task::CleanUpAnonymousUsers);

            reschedule();
        }
        Task::CleanUpKeys => {
            log!("Cleaning up keys...");

            let now = NanoTimeStamp::now();

            with_one_time_keys(|keys| {
                let expired_keys: Vec<Nonce> = keys
                    .iter()
                    .filter(|(_, key)| key.is_expired())
                    .map(|(id, _)| id.clone())
                    .collect();

                expired_keys.iter().for_each(|id| {
                    log!("Removing expired key: {:?}", keys.get(id));
                    keys.remove(id);
                });
            });

            log!(
                "Cleaning up keys done! Took: {}ms",
                now.elapsed().to_millis()
            );

            // schedule next clean up
            schedule_task(3600, Task::CleanUpKeys);

            reschedule();
        }
        Task::CleanUpAnonymousUsers => {
            log!("Cleaning up users...");

            let now = NanoTimeStamp::now();

            with_anonymous_users(|users| {
                let expired_users: Vec<PublicKey> = users
                    .iter()
                    .filter(|(_, user)| user.is_expired())
                    .map(|(id, _)| id.clone())
                    .collect();

                expired_users.iter().for_each(|id| {
                    log!("Removing expired user: {:?}", users.get(id));
                    users.remove(id);
                });
            });

            log!(
                "Cleaning up users done! Took: {}ms",
                now.elapsed().to_millis()
            );

            // schedule next clean up
            schedule_task(3600, Task::CleanUpAnonymousUsers);

            reschedule();
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
            log!("Send text to: {} with body: {}", phone_number, body);
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
