mod anonymous;
mod constants;
mod identified;
mod keys;
mod one_time;
mod partition;
mod stable;
mod task;
mod text;
mod types;
mod utils;

use std::collections::HashMap;

use b3_utils::{
    log,
    logs::{export_log, export_log_messages_page, LogEntry},
    memory::{
        base::{with_base_partition, with_base_partition_mut},
        timer::TaskTimerEntry,
        with_stable_memory,
    },
    nonce::Nonce,
    report, revert, vec_to_hex_string,
    vetkd::{verify_pairing, VetKD},
    NanoTimeStamp,
};
use candid::Principal;
use ciborium::into_writer;
use ic_cdk::{init, post_upgrade, pre_upgrade, query, update};

use anonymous::*;
use identified::*;
use keys::*;
use one_time::*;
use partition::*;
use task::*;
use text::*;
use types::*;
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

    let ibe_key = get_ibe_encrypted_key().to_vec();
    let sym_key = get_symmetric_encrypted_key().to_vec();
    let auth_key = get_two_factor_authentication_key().to_vec();

    let mut states_bytes = vec![];

    into_writer(&(ibe_key, sym_key, auth_key), &mut states_bytes).unwrap();

    with_base_partition_mut(|core_partition| core_partition.set_backup(states_bytes));
}

#[post_upgrade]
pub fn post_upgrade() {
    log!("post_upgrade");

    let states_bytes = with_base_partition(|core_partition| core_partition.get_backup());

    let (ibe_key, sym_key, auth_key) =
        ciborium::de::from_reader(&*states_bytes).expect("failed to decode state");

    set_ibe_encryption_key(ibe_key);
    set_symmetric_encryption_key(sym_key);
    set_two_factor_authentication_key(auth_key);

    for detail in partition_details() {
        log!("{:?}", detail);
    }

    reschedule();
}

#[query]
pub fn version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[query]
pub fn canister_cycle_balance() -> u128 {
    ic_cdk::api::canister_balance128()
}

#[query(guard = "caller_is_not_anonymous")]
fn user_data() -> IdentifiedUserData {
    let caller = log_caller!("user_data");

    with_identified_user(&caller.into(), |user| Ok(user.clone())).unwrap_or_else(revert)
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
                        text: text.into_inner(),
                    }
                })
            })
            .collect();

        Ok(texts)
    })
    .unwrap_or(vec![])
}

#[query]
fn user_notes(public_key: Option<Vec<u8>>) -> (NanoTimeStamp, Vec<UserText>) {
    let caller = log_caller!("user_notes");
    // public key for anonymous users is required
    if caller == Principal::anonymous() && public_key.is_none() {
        return revert("Error::public key is required for anonymous user!");
    }

    if caller == Principal::anonymous() {
        // this is safe because we checked for None above
        let public_key = vec_to_fixed_array(&public_key.unwrap()).unwrap_or_else(revert);

        with_anonymous_user_or_add(&public_key, |user| {
            let texts = user
                .iter_texts()
                .map(|text_id| {
                    with_encrypted_texts(|texts| {
                        let text = texts.get(text_id).unwrap();

                        UserText {
                            id: text_id.to_string(),
                            text: text.into_inner(),
                        }
                    })
                })
                .collect();

            (user.get_created_at(), texts)
        })
    } else {
        let time = NanoTimeStamp::default();
        with_identified_user(&caller.into(), |user| {
            let texts = user
                .iter_texts()
                .map(|text_id| {
                    with_encrypted_texts(|texts| {
                        let text = texts.get(text_id).unwrap();

                        UserText {
                            id: text_id.to_string(),
                            text: text.into_inner(),
                        }
                    })
                })
                .collect();

            Ok((time.clone(), texts))
        })
        .unwrap_or((time, vec![]))
    }
}

#[update]
async fn save_encrypted_text(encrypted_text: Vec<u8>, public_key: Option<Vec<u8>>) -> Nonce {
    let caller = log_caller!("save_encrypted_text");
    // public key for anonymous users is required
    if caller == Principal::anonymous() && public_key.is_none() {
        return revert("Error::public key is required for anonymous user!");
    }

    let text_id = increment_nonce().unwrap_or_else(revert);

    with_encrypted_text_or_create(&text_id, |texts| {
        texts.set_text(encrypted_text);
    });

    if caller == Principal::anonymous() {
        // this is safe because we checked for None above
        let public_key = vec_to_fixed_array(&public_key.unwrap()).unwrap_or_else(revert);

        log!("Adding encrypted text to anonymous user!");
        with_anonymous_user_or_add(&public_key, |user| {
            user.add_text_id(text_id.clone()).unwrap_or_else(revert);

            text_id
        })
    } else {
        log!("Adding encrypted text to identified user!");
        with_identified_user_or_add(&caller.into(), |user| {
            user.add_text_id(text_id.clone()).unwrap_or_else(revert);

            text_id
        })
    }
}

#[update]
fn edit_encrypted_text(text_id: Nonce, encrypted_text: Vec<u8>, public_key: Option<Vec<u8>>) {
    let caller = log_caller!("edit_encrypted_text");
    // public key for anonymous users is required
    if caller == Principal::anonymous() && public_key.is_none() {
        return revert("Error::public key is required for anonymous user!");
    }

    if caller == Principal::anonymous() {
        // this is safe because we checked for None above
        let public_key = vec_to_fixed_array(&public_key.unwrap()).unwrap_or_else(revert);

        with_anonymous_user(&public_key, |data| {
            data.remove_text_id(&text_id).unwrap_or_else(revert);

            with_encrypted_text_or_create(&text_id, |texts| {
                texts.set_text(encrypted_text.clone());
            });

            data.add_text_id(text_id).unwrap_or_else(revert);

            Ok(())
        })
        .unwrap_or_else(revert)
    } else {
        with_identified_user(&caller.into(), |user| {
            user.remove_text_id(&text_id).unwrap_or_else(revert);

            with_encrypted_text_or_create(&text_id, |texts| {
                texts.set_text(encrypted_text.clone());
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

    let one_time_key = with_one_time_key(&text_id, |key| Ok(key.clone())).unwrap_or_else(revert);

    if one_time_key.is_expired() {
        return report("Error::One time key is expired!");
    }

    let encrypted_text =
        with_encrypted_text(&text_id, |text| Ok(text.into_inner())).unwrap_or_else(revert);

    let verified = verify_pairing(
        &one_time_key.public_key(),
        &signature,
        &text_id.to_le_bytes(),
    );

    match verified {
        Ok(_) => {
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
async fn request_two_factor_authentication_for_caller(encryption_public_key: Vec<u8>) -> String {
    let caller = log_caller!("request_two_factor_authentication");

    let encrypted_key = VetKD::new(caller.into())
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
    if caller == Principal::anonymous() {
        with_anonymous_user_or_add(&public_key, |user| {
            user.set_decryption_key(encrypted_key.clone());
        });
    } else {
        with_identified_users(|keys| {
            let user_data = IdentifiedUserData::new(encrypted_key.clone(), None);

            keys.insert(caller.into(), user_data);
        });
    }

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
        with_identified_users(|keys| {
            let user_data = IdentifiedUserData::new(encrypted_key.clone(), None);

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
fn partition_details() -> HashMap<String, u8> {
    initialize_thread_locals();
    with_stable_memory(|pm| pm.partitions().clone())
}

#[query]
fn timers() -> Vec<TaskTimerEntry<Task>> {
    with_task_timer(|tt| tt.get_timers())
}

#[export_name = "canister_global_timer"]
fn global_timer() {
    while let Some(task_timer) = with_task_timer(|tt| tt.peek_timer()) {
        if task_timer.time.in_future() {
            reschedule();
            return;
        }
        with_task_timer(|tt| tt.pop_timer());

        ic_cdk::spawn(execute_task(task_timer));
        reschedule();
    }
}

ic_cdk::export_candid!();
