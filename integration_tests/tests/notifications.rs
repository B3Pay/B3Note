//! Telling a share's owner that someone opened their link, through the B3Pay
//! hub (a stand-in here that records what it was asked to send).

mod common;

use backend::types::*;
use candid::Principal;
use common::*;

const DAY: u64 = 24 * 3_600 * SEC;

#[test]
fn an_owner_who_asked_is_told_each_time_their_link_is_opened() {
    let env = TestEnv::new();
    env.notifications_on();
    let alice = user(1);
    env.set_notify_share_opened(alice, true).unwrap();
    let account = env.account(alice);
    assert!(account.notifications_available);
    assert!(account.notify_share_opened);

    let (id, link_key) = env
        .create_share(alice, None, "the wifi password is hunter2", 2, 3_600)
        .unwrap();
    let opened_at = env.now();
    env.open_share(Principal::anonymous(), &id, &link_key)
        .unwrap();
    env.tick(3);

    let notified = env.notified();
    assert_eq!(notified.len(), 1);
    let first = &notified[0];
    assert_eq!(first.caller, env.backend);
    assert_eq!(first.app_id, "b3note");
    assert_eq!(first.user, alice);
    assert_eq!(first.notification.title, "Someone opened a link you shared");
    assert_eq!(first.notification.body, "It can be opened 1 more time.");
    assert_eq!(first.notification.key, Some(format!("share-{id}")));
    assert_eq!(
        first.notification.url.as_deref(),
        Some(TestEnv::NOTIFICATION_URL)
    );
    assert_eq!(first.notification.urgency, Some(HubUrgency::Normal));
    let expires = first.notification.expires_at_ns.unwrap();
    assert!(expires >= opened_at + DAY && expires <= env.now() + DAY);
    // Nothing of the note: the canister only ever had its ciphertext.
    for text in [&first.notification.title, &first.notification.body] {
        assert!(!text.contains("hunter2"));
    }

    // The last view says so, under the same key, so the hub replaces the
    // first notification.
    env.open_share(user(9), &id, &link_key).unwrap();
    env.tick(3);
    let notified = env.notified();
    assert_eq!(notified.len(), 2);
    assert_eq!(
        notified[1].notification.body,
        "That was its last view, so the link no longer works."
    );
    assert_eq!(notified[1].notification.key, notified[0].notification.key);
}

#[test]
fn nobody_is_told_unless_the_deployment_and_the_owner_both_said_yes() {
    let env = TestEnv::new();
    let alice = user(1);

    // Off by default, for the deployment and for every owner.
    let account = env.account(alice);
    assert!(!account.notifications_available);
    assert!(!account.notify_share_opened);

    // The owner said yes, the deployment has not.
    env.set_notify_share_opened(alice, true).unwrap();
    let (id, key) = env.create_share(alice, None, "a", 3, 3_600).unwrap();
    env.open_share(Principal::anonymous(), &id, &key).unwrap();
    env.tick(3);
    assert!(env.notified().is_empty());

    // The deployment says yes, the owner has not.
    env.notifications_on();
    let bob = user(2);
    let (bob_id, bob_key) = env.create_share(bob, None, "b", 3, 3_600).unwrap();
    env.open_share(Principal::anonymous(), &bob_id, &bob_key)
        .unwrap();
    env.tick(3);
    assert!(env.notified().is_empty());

    // Both: told.
    env.open_share(Principal::anonymous(), &id, &key).unwrap();
    env.tick(3);
    assert_eq!(env.notified().len(), 1);

    // The owner changes their mind.
    env.set_notify_share_opened(alice, false).unwrap();
    assert!(!env.account(alice).notify_share_opened);
    env.open_share(Principal::anonymous(), &id, &key).unwrap();
    env.tick(3);
    assert_eq!(env.notified().len(), 1);

    // A controller switches the deployment off, which keeps the hub's id.
    env.set_notify_share_opened(bob, true).unwrap();
    let config = env.set_notifications(false);
    assert_eq!(config.notifications.unwrap().hub_canister, env.hub);
    assert!(!env.account(bob).notifications_available);
    env.open_share(Principal::anonymous(), &bob_id, &bob_key)
        .unwrap();
    env.tick(3);
    assert_eq!(env.notified().len(), 1);
}

#[test]
fn a_hub_that_refuses_or_fails_never_fails_the_open() {
    let env = TestEnv::new();
    env.notifications_on();
    let alice = user(1);
    env.set_notify_share_opened(alice, true).unwrap();
    let (id, key) = env
        .create_share(alice, None, "still readable", 3, 3_600)
        .unwrap();

    for (answer, views_left) in [(HubAnswer::Refuse, 2), (HubAnswer::Trap, 1)] {
        env.set_hub_answer(answer);
        let (plaintext, opened) = env.open_share(Principal::anonymous(), &id, &key).unwrap();
        env.tick(3);
        assert_eq!(plaintext, "still readable");
        assert_eq!(opened.views_left, views_left);
        assert_eq!(env.share_info(&id).unwrap().views_left, views_left);
    }
    assert!(env.notified().is_empty());

    env.set_hub_answer(HubAnswer::Accept);
    env.open_share(Principal::anonymous(), &id, &key).unwrap();
    env.tick(3);
    assert_eq!(env.notified().len(), 1);
}

#[test]
fn the_choice_needs_a_signed_in_caller_and_goes_with_the_account() {
    let env = TestEnv::new();
    env.notifications_on();

    // inspect_message turns anonymous ingress away before it runs.
    assert!(env
        .update_raw(Principal::anonymous(), "set_notify_share_opened", (true,))
        .is_err());

    let alice = user(1);
    env.set_notify_share_opened(alice, true).unwrap();
    let deleted: Result<DeletedAccount> = env.update(alice, "delete_account", ());
    deleted.unwrap();
    assert!(!env.account(alice).notify_share_opened);
}

#[test]
fn the_choice_and_the_config_survive_an_upgrade() {
    let env = TestEnv::new();
    env.notifications_on();
    let alice = user(1);
    env.set_notify_share_opened(alice, true).unwrap();
    env.upgrade(None).unwrap();

    let account = env.account(alice);
    assert!(account.notifications_available);
    assert!(account.notify_share_opened);
    let (id, key) = env.create_share(alice, None, "after", 1, 3_600).unwrap();
    env.open_share(Principal::anonymous(), &id, &key).unwrap();
    env.tick(3);
    assert_eq!(env.notified().len(), 1);
}

#[test]
fn a_config_that_cannot_work_is_refused() {
    let env = TestEnv::new();
    let refused: Result<Config> = env.update(
        env.controller,
        "update_config",
        (InitArgs {
            notifications: Some(NotificationConfig {
                enabled: true,
                hub_canister: env.hub,
                url: Some("http://note.b3pay.net/".into()),
            }),
            ..Default::default()
        },),
    );
    assert!(
        matches!(refused, Err(Error::InvalidArgument(_))),
        "{refused:?}"
    );

    // Only controllers may name the hub.
    let forbidden: Result<Config> = env.update(
        user(1),
        "update_config",
        (InitArgs {
            notifications: Some(NotificationConfig {
                enabled: true,
                hub_canister: user(1),
                url: None,
            }),
            ..Default::default()
        },),
    );
    assert!(
        matches!(forbidden, Err(Error::Forbidden(_))),
        "{forbidden:?}"
    );
}
