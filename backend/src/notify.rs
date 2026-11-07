//! Tells a share's owner that someone opened their link.
//!
//! B3Note sends no notification itself: it asks the B3Pay hub, which sends
//! for every B3Pay app through Internet Identity. The hub hands Internet
//! Identity only an id; the owner's browser fetches the words below from the
//! hub. They name no note and nothing the reader sent, because the canister
//! never sees a note's title or text, only ciphertext.
//!
//! Two things must both say yes: the deployment (`Config.notifications`, a
//! controller's switch) and the owner (`UserRecord.notify_share_opened`,
//! which the Settings toggle sets after Internet Identity asked them).
//! Internet Identity keeps the third yes, the owner's consent, itself.

use std::time::Duration;

use candid::{CandidType, Deserialize, Principal};
use ic_cdk::call::Call;

use crate::ids::{format_id, Id};
use crate::state;

/// The app B3Note is registered as at the hub.
pub const HUB_APP_ID: &str = "b3note";
/// A notification about an opened link is worth delivering for a day.
const EXPIRY_NANOS: u64 = 24 * 3_600 * 1_000_000_000;
/// A bounded wait, so a slow hub never holds up stopping B3Note for an upgrade.
const CALL_TIMEOUT_SECS: u32 = 60;

/// The hub's `Urgency`.
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum Urgency {
    VeryLow,
    Low,
    Normal,
    High,
}

/// The hub's `NotificationInput`.
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct NotificationInput {
    pub title: String,
    pub body: String,
    pub url: Option<String>,
    pub key: Option<String>,
    pub urgency: Option<Urgency>,
    pub expires_at_ns: Option<u64>,
}

/// The hub's `HubError`.
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum HubError {
    NotAuthorized,
    NotSignedIn,
    UnknownApp,
    InvalidInput(String),
}

/// What the owner of share `id` is told when a reader opens it and
/// `views_left` remain. One notification per link: the hub replaces an
/// earlier one under the same key, so the latest count is the one shown.
pub fn share_opened(id: &Id, views_left: u32, url: Option<String>, now: u64) -> NotificationInput {
    let body = match views_left {
        0 => "That was its last view, so the link no longer works.".to_string(),
        1 => "It can be opened 1 more time.".to_string(),
        n => format!("It can be opened {n} more times."),
    };
    NotificationInput {
        title: "Someone opened a link you shared".to_string(),
        body,
        url,
        key: Some(format!("share-{}", format_id(id))),
        urgency: Some(Urgency::Normal),
        expires_at_ns: Some(now.saturating_add(EXPIRY_NANOS)),
    }
}

/// After a successful open: asks the hub to notify `owner`, if the
/// deployment and the owner both want it. The call runs in a timer of its
/// own, so the reader never waits for the hub and a hub that fails cannot
/// fail the open.
pub fn after_share_opened(owner: Principal, id: &Id, views_left: u32, now: u64) {
    let config = state::config();
    let Some(hub) = config.notification_hub() else {
        return;
    };
    let wants_it = state::user(&owner).and_then(|user| user.notify_share_opened);
    if wants_it != Some(true) {
        return;
    }
    let hub_canister = hub.hub_canister;
    let input = share_opened(id, views_left, hub.url.clone(), now);
    ic_cdk_timers::set_timer(Duration::ZERO, async move {
        let reply = Call::bounded_wait(hub_canister, "notify")
            .change_timeout(CALL_TIMEOUT_SECS)
            .with_args(&(HUB_APP_ID, owner, input))
            .await;
        match reply.map(|reply| reply.candid::<Result<u64, HubError>>()) {
            Ok(Ok(Ok(_))) => {}
            Ok(Ok(Err(e))) => ic_cdk::println!("the hub refused a notification: {e:?}"),
            Ok(Err(e)) => ic_cdk::println!("unexpected reply from the hub: {e}"),
            Err(e) => ic_cdk::println!("the hub did not answer: {e}"),
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: u64 = 1_700_000_000_000_000_000;

    #[test]
    fn says_how_many_views_are_left_and_nothing_about_the_note() {
        let id = [7u8; 16];
        let last = share_opened(&id, 0, None, NOW);
        assert_eq!(last.title, "Someone opened a link you shared");
        assert_eq!(
            last.body,
            "That was its last view, so the link no longer works."
        );
        assert_eq!(
            share_opened(&id, 1, None, NOW).body,
            "It can be opened 1 more time."
        );
        assert_eq!(
            share_opened(&id, 9, None, NOW).body,
            "It can be opened 9 more times."
        );
    }

    #[test]
    fn one_key_per_link_and_a_day_to_deliver() {
        let id = [0xab; 16];
        let input = share_opened(&id, 2, Some("https://note.b3pay.net/settings".into()), NOW);
        assert_eq!(
            input.key.as_deref(),
            Some(&*format!("share-{}", "ab".repeat(16)))
        );
        assert_eq!(
            input.url.as_deref(),
            Some("https://note.b3pay.net/settings")
        );
        assert_eq!(input.urgency, Some(Urgency::Normal));
        assert_eq!(input.expires_at_ns, Some(NOW + EXPIRY_NANOS));
        // Within the hub's limits: a key of at most 128 bytes, at most seven
        // days ahead.
        assert!(input.key.unwrap().len() <= 128);
        const { assert!(EXPIRY_NANOS <= 7 * 24 * 3_600 * 1_000_000_000) };
    }
}
