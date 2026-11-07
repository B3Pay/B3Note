//! A stand-in for the B3Pay hub's `notify`, so the PocketIC tests can see
//! exactly what the backend asks the hub to send. It sends nothing.
//!
//! `set_answer` makes it refuse (`InvalidInput`) or trap, to show that a hub
//! that fails cannot fail the call that asked it.

use std::cell::RefCell;

use candid::{CandidType, Principal};
use ic_cdk::{query, update};
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum Urgency {
    VeryLow,
    Low,
    Normal,
    High,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct NotificationInput {
    pub title: String,
    pub body: String,
    pub url: Option<String>,
    pub key: Option<String>,
    pub urgency: Option<Urgency>,
    pub expires_at_ns: Option<u64>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum HubError {
    NotAuthorized,
    NotSignedIn,
    UnknownApp,
    InvalidInput(String),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct Notified {
    pub caller: Principal,
    pub app_id: String,
    pub user: Principal,
    pub notification: NotificationInput,
}

#[derive(CandidType, Deserialize, Clone, Copy, Debug, Default)]
pub enum Answer {
    #[default]
    Accept,
    Refuse,
    Trap,
}

thread_local! {
    static NOTIFIED: RefCell<Vec<Notified>> = const { RefCell::new(Vec::new()) };
    static ANSWER: RefCell<Answer> = const { RefCell::new(Answer::Accept) };
}

#[update]
fn notify(
    app_id: String,
    user: Principal,
    notification: NotificationInput,
) -> Result<u64, HubError> {
    match ANSWER.with_borrow(|answer| *answer) {
        Answer::Trap => ic_cdk::trap("mock hub failure"),
        Answer::Refuse => Err(HubError::InvalidInput("refused by the mock hub".into())),
        Answer::Accept => NOTIFIED.with_borrow_mut(|notified| {
            notified.push(Notified {
                caller: ic_cdk::api::msg_caller(),
                app_id,
                user,
                notification,
            });
            Ok(notified.len() as u64)
        }),
    }
}

#[update]
fn set_answer(answer: Answer) {
    ANSWER.with_borrow_mut(|current| *current = answer);
}

#[query]
fn notified() -> Vec<Notified> {
    NOTIFIED.with_borrow(Clone::clone)
}

ic_cdk::export_candid!();
