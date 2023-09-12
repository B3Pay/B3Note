use b3_utils::{
    log,
    memory::{
        timer::TaskTimerEntry,
        types::{BoundedStorable, Storable},
    },
    nonce::Nonce,
    revert, NanoTimeStamp,
};
use candid::CandidType;
use ciborium::de::from_reader;
use ciborium::ser::into_writer;
use serde::{Deserialize, Serialize};
use std::io::Cursor;

mod store;
pub use store::*;

use crate::{
    anonymous::with_anonymous_users,
    constants::{ANONYMOUS_USER_DATA_EXPIRATION, ONE_TIME_KEY_EXPIRATION},
    keys::fetch_encryption_keys,
    log_caller,
    one_time::with_one_time_keys,
    types::PublicKey,
};

#[derive(CandidType, Debug, PartialEq, Eq, PartialOrd, Ord, Clone, Serialize, Deserialize)]
pub enum Task {
    Initialize,
    CleanUpAnonymousUsers,
    CleanUpKeys,
    SendEmail {
        email: String,
        subject: String,
        body: String,
    },
    SendText {
        phone_number: String,
        body: String,
    },
}

impl Storable for Task {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        let mut bytes = vec![];
        into_writer(&self, &mut bytes).unwrap();
        std::borrow::Cow::Owned(bytes)
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        from_reader(&mut Cursor::new(&bytes)).unwrap()
    }
}

impl BoundedStorable for Task {
    const MAX_SIZE: u32 = 24;
    const IS_FIXED_SIZE: bool = true;
}

pub fn schedule_task(after_sec: u64, task: Task) {
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

pub async fn execute_task(timer: TaskTimerEntry<Task>) {
    log!("Execute_task: {:?}", timer);

    match timer.task {
        Task::Initialize => {
            log!("Initializing...");

            let now = NanoTimeStamp::now();

            fetch_encryption_keys().await;

            log!("Initializing done! Took: {}ms", now.elapsed().to_millis());

            schedule_task(ONE_TIME_KEY_EXPIRATION, Task::CleanUpKeys);
            schedule_task(ANONYMOUS_USER_DATA_EXPIRATION, Task::CleanUpAnonymousUsers);

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
            schedule_task(ONE_TIME_KEY_EXPIRATION, Task::CleanUpKeys);

            reschedule();
        }
        Task::CleanUpAnonymousUsers => {
            log!("Cleaning up anonymous users...");

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
            schedule_task(ANONYMOUS_USER_DATA_EXPIRATION, Task::CleanUpAnonymousUsers);

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

pub fn reschedule() {
    if let Some(task_time) = TASK_TIMER.with(|tt| {
        let tt = tt.borrow();

        tt.peek_timer()
    }) {
        unsafe {
            ic0::global_timer_set(task_time.time.into());
        }
    }
}
