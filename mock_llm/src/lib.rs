//! A deterministic stand-in for the LLM canister (`v1_chat`), so the AI
//! endpoints can be tested in PocketIC without a model.
//!
//! The reply echoes the model and the request, which lets tests assert on
//! exactly what the backend sent. A user message containing `FAIL` makes it
//! trap, and `EMPTY` makes it return no content.

use std::cell::RefCell;

use candid::CandidType;
use ic_cdk::{query, update};
use ic_llm::{AssistantMessage, ChatMessage, Response, Tool};
use serde::Deserialize;

#[derive(CandidType, Deserialize)]
struct Request {
    model: String,
    messages: Vec<ChatMessage>,
    tools: Option<Vec<Tool>>,
}

thread_local! {
    static CALLS: RefCell<u64> = const { RefCell::new(0) };
}

#[update]
fn v1_chat(request: Request) -> Response {
    CALLS.with_borrow_mut(|calls| *calls += 1);
    let mut system = String::new();
    let mut user = String::new();
    for message in &request.messages {
        match message {
            ChatMessage::System { content } => system = content.clone(),
            ChatMessage::User { content } => user = content.clone(),
            _ => {}
        }
    }
    if user.contains("FAIL") {
        ic_cdk::trap("mock LLM failure");
    }
    let content = if user.contains("EMPTY") {
        None
    } else if system.contains("topic tags") {
        Some("<think>tags</think>Work, #Travel, work".to_string())
    } else if system.contains("Write a title") {
        Some("\"Trip Plan.\"".to_string())
    } else {
        Some(format!(
            "model={} tools={} messages={}\nSYSTEM:{system}\nUSER:{user}",
            request.model,
            request.tools.is_some(),
            request.messages.len()
        ))
    };
    Response {
        message: AssistantMessage {
            content,
            tool_calls: vec![],
        },
    }
}

#[query]
fn calls() -> u64 {
    CALLS.with_borrow(|calls| *calls)
}

ic_cdk::export_candid!();
