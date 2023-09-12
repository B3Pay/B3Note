use crate::{
    anonymous::with_anonymous_users, identified::with_identified_users,
    one_time::with_one_time_keys, task::with_task_timer, text::with_encrypted_texts,
};

pub fn initialize_thread_locals() {
    with_anonymous_users(|_| {});
    with_encrypted_texts(|_| {});
    with_identified_users(|_| {});
    with_one_time_keys(|_| {});
    with_task_timer(|_| {});
}
