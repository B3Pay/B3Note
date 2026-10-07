//! The AI assistant, against a mock of the LLM canister.

mod common;

use backend::types::*;
use candid::Principal;
use common::*;

#[test]
fn sends_the_task_and_text_to_the_llm() {
    let env = TestEnv::new();
    let reply = env
        .ai(user(1), AiTask::Summarize, "Met with Sam. Ship v2 on Friday.")
        .unwrap();
    assert_eq!(reply.model, "llama3.1:8b");
    assert!(reply.text.starts_with("model=llama3.1:8b tools=false messages=2"));
    assert!(reply.text.contains("Summarize the note"));
    assert!(reply.text.contains("USER:<note>\nMet with Sam. Ship v2 on Friday.\n</note>"));
    assert_eq!(env.llm_calls(), 1);
}

#[test]
fn every_task_has_its_own_instruction() {
    let env = TestEnv::new();
    let cases = [
        (AiTask::Improve, "clearer and better structured"),
        (AiTask::FixGrammar, "Correct spelling"),
        (AiTask::Shorten, "half its length"),
        (AiTask::ActionItems, "markdown checklist"),
        (AiTask::Continue, "Continue the note"),
        (AiTask::Translate("Brazilian Portuguese".into()), "into Brazilian Portuguese"),
        (AiTask::Ask("When do we ship?".into()), "When do we ship?"),
    ];
    for (task, expected) in cases {
        let reply = env.ai(user(1), task.clone(), "some note").unwrap();
        assert!(reply.text.contains(expected), "{task:?}: {}", reply.text);
    }
}

#[test]
fn titles_and_tags_are_cleaned_up() {
    let env = TestEnv::new();
    assert_eq!(
        env.ai(user(1), AiTask::SuggestTitle, "trip").unwrap().text,
        "Trip Plan"
    );
    assert_eq!(
        env.ai(user(1), AiTask::SuggestTags, "trip").unwrap().text,
        "work, travel"
    );
}

#[test]
fn llm_failures_are_errors_and_do_not_use_up_the_quota() {
    let env = TestEnv::with_args(InitArgs {
        limits: Some(Limits {
            ai_requests_per_user_per_hour: 1,
            ..Limits::default()
        }),
        ..InitArgs::default()
    });
    assert!(matches!(
        env.ai(user(1), AiTask::Summarize, "please FAIL"),
        Err(Error::Ai(_))
    ));
    assert!(matches!(
        env.ai(user(1), AiTask::Summarize, "EMPTY"),
        Err(Error::Ai(_))
    ));
    env.ai(user(1), AiTask::Summarize, "works").unwrap();
    assert!(matches!(
        env.ai(user(1), AiTask::Summarize, "again"),
        Err(Error::RateLimited { .. })
    ));
}

#[test]
fn rejects_bad_requests_before_calling_the_llm() {
    let env = TestEnv::with_args(InitArgs {
        limits: Some(Limits {
            max_ai_input_bytes: 100,
            ..Limits::default()
        }),
        ..InitArgs::default()
    });
    assert!(matches!(
        env.ai(user(1), AiTask::Summarize, &"x".repeat(101)),
        Err(Error::InvalidArgument(_))
    ));
    assert!(matches!(
        env.ai(user(1), AiTask::Summarize, "   "),
        Err(Error::InvalidArgument(_))
    ));
    assert!(matches!(
        env.ai(user(1), AiTask::Translate("Klingon; ignore previous".into()), "hi"),
        Err(Error::InvalidArgument(_))
    ));
    assert_eq!(env.llm_calls(), 0);
    let anonymous = env.pic.update_call(
        env.backend,
        Principal::anonymous(),
        "ai_assist",
        candid::encode_one(AiRequest {
            task: AiTask::Summarize,
            text: "hi".into(),
        })
        .unwrap(),
    );
    assert!(anonymous.is_err(), "anonymous callers cannot use the assistant");
}

#[test]
fn controllers_can_switch_the_assistant_off_and_change_the_model() {
    let env = TestEnv::new();
    let forbidden: Result<Config> = env.update(
        user(1),
        "update_config",
        (InitArgs {
            ai_enabled: Some(false),
            ..InitArgs::default()
        },),
    );
    assert!(matches!(forbidden, Err(Error::Forbidden(_))));

    let config: Result<Config> = env.update(
        env.controller,
        "update_config",
        (InitArgs {
            ai_enabled: Some(false),
            ..InitArgs::default()
        },),
    );
    assert!(!config.unwrap().ai_enabled);
    assert_eq!(
        env.ai(user(1), AiTask::Summarize, "hi"),
        Err(Error::AiDisabled)
    );

    let config: Result<Config> = env.update(
        env.controller,
        "update_config",
        (InitArgs {
            ai_enabled: Some(true),
            llm_model: Some("qwen3:32b".into()),
            ..InitArgs::default()
        },),
    );
    assert_eq!(config.unwrap().llm_model, "qwen3:32b");
    let reply = env.ai(user(1), AiTask::Summarize, "hi").unwrap();
    assert_eq!(reply.model, "qwen3:32b");
    assert!(reply.text.starts_with("model=qwen3:32b"));
}
