//! B3Note backend canister.
//!
//! - Notes are encrypted in the browser with an AES-GCM key: for Internet
//!   Identity accounts, one derived from the user's vetKey
//!   (`get_encrypted_user_key`); for guests, one derived from the guest key
//!   in the browser. The canister stores ciphertext and enforces ownership,
//!   quotas and self-destruct timers.
//! - Burn-after-reading links (`create_share` / `open_share`) use identity
//!   based encryption: only the canister can have the share's decryption key
//!   derived, and it does so once per view for whoever proves they hold the
//!   link. Only Internet Identity accounts can create them, because every
//!   vetKD derivation costs this canister cycles.
//! - `ai_assist` sends text the user chose to the on-chain LLM canister.

use std::time::Duration;

use candid::Principal;
use ic_cdk::{init, inspect_message, post_upgrade, query, update};
use serde_bytes::ByteBuf;

mod ai;
mod config;
mod identity;
mod ids;
mod keys;
mod notes;
mod rate_limit;
mod shares;
mod state;
pub mod types;

pub use keys::{SHARE_KEY_CONTEXT, USER_KEY_CONTEXT};
pub use shares::SHARE_OPEN_DOMAIN;

use rate_limit::{Action, LIMITER};
use types::*;

const CLEANUP_INTERVAL: Duration = Duration::from_secs(5 * 60);
const CLEANUP_BATCH: usize = 500;
/// Ingress messages larger than this are rejected before they are executed.
const MAX_INGRESS_BYTES: usize = 1_200_000;

fn now() -> u64 {
    ic_cdk::api::time()
}

fn authenticated() -> Result<Principal> {
    let caller = ic_cdk::api::msg_caller();
    if caller == Principal::anonymous() {
        Err(Error::Unauthenticated)
    } else {
        Ok(caller)
    }
}

fn apply_args(args: Option<InitArgs>) {
    if let Some(args) = args {
        let next = state::config()
            .with_args(args)
            .unwrap_or_else(|e| ic_cdk::trap(format!("invalid install arguments: {e}")));
        state::set_config(next);
    }
}

fn cleanup() {
    let now = now();
    let notes = notes::delete_expired(now, CLEANUP_BATCH);
    let shares = shares::delete_expired(now, CLEANUP_BATCH);
    LIMITER.with_borrow_mut(|limiter| limiter.prune(now));
    if notes + shares > 0 {
        ic_cdk::println!("cleanup: removed {notes} expired notes and {shares} expired shares");
    }
}

fn start_timers() {
    ic_cdk_timers::set_timer(Duration::ZERO, async {
        if let Err(e) = keys::ensure_public_keys().await {
            ic_cdk::println!("could not fetch the vetKD public keys yet: {e:?}");
        }
    });
    ic_cdk_timers::set_timer_interval(CLEANUP_INTERVAL, || async { cleanup() });
}

#[init]
fn init(args: Option<InitArgs>) {
    apply_args(args);
    start_timers();
}

#[post_upgrade]
fn post_upgrade(args: Option<InitArgs>) {
    apply_args(args);
    start_timers();
}

/// Rejects ingress messages that would fail anyway, before they cost cycles.
#[inspect_message]
fn inspect_message() {
    let method = ic_cdk::api::msg_method_name();
    // Public reads (also callable as updates), opening a share link, and
    // `update_config`, which checks for a controller itself (a local
    // network's default identity is anonymous).
    let anonymous_allowed = matches!(
        method.as_str(),
        "open_share"
            | "load_public_keys"
            | "get_public_keys"
            | "get_share"
            | "get_stats"
            | "get_config"
            | "whoami"
            | "update_config"
    );
    if !anonymous_allowed && ic_cdk::api::msg_caller() == Principal::anonymous() {
        ic_cdk::trap("sign in first: anonymous callers cannot call this method");
    }
    if ic_cdk::api::msg_arg_data().len() > MAX_INGRESS_BYTES {
        ic_cdk::trap("the request is too large");
    }
    ic_cdk::api::accept_message();
}

fn consume(action: Action, caller: Principal, per_user: Option<u32>, global: u32) -> Result<()> {
    LIMITER.with_borrow_mut(|limiter| {
        limiter.check_and_consume(action, caller, per_user, global, now())
    })
}

fn refund(action: Action, caller: Principal, per_user: bool) {
    LIMITER.with_borrow_mut(|limiter| limiter.refund(action, caller, per_user));
}

// ---------------------------------------------------------------------------
// Account and configuration
// ---------------------------------------------------------------------------

#[query]
fn whoami() -> Principal {
    ic_cdk::api::msg_caller()
}

#[query]
fn get_config() -> Config {
    state::config()
}

/// Changes the configuration. Controllers only.
#[update]
fn update_config(args: InitArgs) -> Result<Config> {
    let caller = ic_cdk::api::msg_caller();
    if !ic_cdk::api::is_controller(&caller) {
        return Err(Error::Forbidden(
            "only controllers can change the configuration".into(),
        ));
    }
    let next = state::config()
        .with_args(args)
        .map_err(Error::InvalidArgument)?;
    state::set_config(next.clone());
    Ok(next)
}

#[query]
fn get_stats() -> Stats {
    let config = state::config();
    Stats {
        version: env!("CARGO_PKG_VERSION").to_string(),
        users: state::USERS_MAP.with_borrow(|users| users.len()),
        notes: state::NOTES_MAP.with_borrow(|notes| notes.len()),
        active_shares: state::SHARES_MAP.with_borrow(|shares| shares.len()),
        vetkd_key_name: config.vetkd_key_name,
        ai_enabled: config.ai_enabled,
        ai_model: config.llm_model,
        cycles: ic_cdk::api::canister_cycle_balance(),
    }
}

#[query]
fn get_account() -> Result<Account> {
    let caller = authenticated()?;
    let config = state::config();
    let user = state::user(&caller).unwrap_or_default();
    Ok(Account {
        principal: caller,
        created_at: user.created_at,
        note_count: user.note_count,
        storage_bytes: user.note_bytes,
        share_count: user.share_count,
        limits: config.limits,
        ai_enabled: config.ai_enabled,
        ai_model: config.llm_model,
    })
}

/// Deletes every note and share of the caller.
#[update]
fn delete_account() -> Result<DeletedAccount> {
    let caller = authenticated()?;
    let shares = shares::delete_all(caller);
    let notes = notes::delete_all(caller);
    state::USERS_MAP.with_borrow_mut(|users| users.remove(&caller));
    Ok(DeletedAccount { notes, shares })
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

/// The derived public keys, once the canister has fetched them.
#[query]
fn get_public_keys() -> Result<PublicKeys> {
    state::public_keys().ok_or(Error::NotReady)
}

/// Like `get_public_keys`, but fetches the keys if they are not cached yet.
#[update]
async fn load_public_keys() -> Result<PublicKeys> {
    keys::ensure_public_keys().await
}

/// The caller's vetKey, encrypted to `transport_public_key`, and the public
/// key that verifies it. The vetKey's input is the caller's principal.
/// Internet Identity accounts only: `internet_identity_key` is the caller's
/// DER-encoded public key (the root of their delegation chain).
#[update]
async fn get_encrypted_user_key(
    transport_public_key: ByteBuf,
    internet_identity_key: Option<ByteBuf>,
) -> Result<EncryptedUserKey> {
    let caller = authenticated()?;
    identity::require_internet_identity(
        caller,
        internet_identity_key.as_deref().map(Vec::as_slice),
    )?;
    keys::validate_transport_public_key(&transport_public_key)?;
    let limits = state::config().limits;
    consume(
        Action::VetKey,
        caller,
        Some(limits.key_requests_per_user_per_hour),
        limits.global_key_requests_per_hour,
    )?;
    let result = async {
        let public_keys = keys::ensure_public_keys().await?;
        let encrypted_key = keys::derive_encrypted_key(
            caller.as_slice().to_vec(),
            USER_KEY_CONTEXT,
            transport_public_key.into_vec(),
        )
        .await?;
        Ok(EncryptedUserKey {
            encrypted_key: ByteBuf::from(encrypted_key),
            verification_key: public_keys.user_key,
        })
    }
    .await;
    if result.is_err() {
        refund(Action::VetKey, caller, true);
    }
    result
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

#[query]
fn list_notes(args: ListNotesArgs) -> Result<NotePage> {
    notes::list(authenticated()?, args, now())
}

#[query]
fn get_note(id: String) -> Result<Note> {
    notes::get(authenticated()?, &id, now())
}

#[update]
fn create_note(args: CreateNoteArgs) -> Result<Note> {
    notes::create(authenticated()?, args, now(), &state::config().limits)
}

#[update]
fn update_note(args: UpdateNoteArgs) -> Result<Note> {
    notes::update(authenticated()?, args, now(), &state::config().limits)
}

/// Deletes a note and revokes the share links made from it.
#[update]
fn delete_note(id: String) -> Result<()> {
    notes::delete(authenticated()?, &id, now())
}

// ---------------------------------------------------------------------------
// Burn-after-reading shares
// ---------------------------------------------------------------------------

/// Internet Identity accounts only (see `CreateShareArgs.internet_identity_key`).
#[update]
fn create_share(args: CreateShareArgs) -> Result<ShareInfo> {
    let caller = authenticated()?;
    identity::require_internet_identity(
        caller,
        args.internet_identity_key.as_deref().map(Vec::as_slice),
    )?;
    shares::create(caller, args, now(), &state::config().limits)
}

#[query]
fn list_shares() -> Result<Vec<ShareInfo>> {
    Ok(shares::list(authenticated()?, now()))
}

#[update]
fn revoke_share(id: String) -> Result<()> {
    shares::revoke(authenticated()?, &id)
}

/// What a link holder sees before deciding to open (and burn) a share.
#[query]
fn get_share(id: String) -> Result<PublicShareInfo> {
    shares::public_info(&id, now())
}

/// Spends one view of a share and returns its ciphertext with the share's
/// vetKey encrypted to the reader's transport key. Anyone holding the link
/// may call this; signing in is not required.
#[update]
async fn open_share(args: OpenShareArgs) -> Result<OpenedShare> {
    let caller = ic_cdk::api::msg_caller();
    keys::validate_transport_public_key(&args.transport_public_key)?;
    let public_keys = keys::ensure_public_keys().await?;
    let pending = shares::begin_open(&args.id, &args.transport_public_key, &args.signature, now())?;
    let limits = state::config().limits;
    let per_user =
        (caller != Principal::anonymous()).then_some(limits.key_requests_per_user_per_hour);
    if let Err(e) = consume(
        Action::VetKey,
        caller,
        per_user,
        limits.global_key_requests_per_hour,
    ) {
        shares::finish_open(&pending.id, &args.transport_public_key, false);
        return Err(e);
    }
    let derived = keys::derive_encrypted_key(
        pending.id.to_vec(),
        SHARE_KEY_CONTEXT,
        args.transport_public_key.to_vec(),
    )
    .await;
    match derived {
        Ok(encrypted_key) => {
            shares::finish_open(&pending.id, &args.transport_public_key, true);
            Ok(OpenedShare {
                ciphertext: pending.ciphertext,
                encrypted_key: ByteBuf::from(encrypted_key),
                verification_key: public_keys.share_key,
                views_left: pending.views_left,
                expires_at: pending.expires_at,
            })
        }
        Err(e) => {
            shares::finish_open(&pending.id, &args.transport_public_key, false);
            refund(Action::VetKey, caller, per_user.is_some());
            Err(e)
        }
    }
}

// ---------------------------------------------------------------------------
// AI assistant
// ---------------------------------------------------------------------------

/// Runs one writing-assistant task on text the user chose to send.
#[update]
async fn ai_assist(request: AiRequest) -> Result<AiResponse> {
    let caller = authenticated()?;
    let config = state::config();
    if !config.ai_enabled {
        return Err(Error::AiDisabled);
    }
    let messages = ai::build_messages(&request, config.limits.max_ai_input_bytes)?;
    consume(
        Action::Ai,
        caller,
        Some(config.limits.ai_requests_per_user_per_hour),
        config.limits.global_ai_requests_per_hour,
    )?;
    let reply = ai::chat(&config, messages).await.and_then(|reply| {
        let text = ai::clean_reply(&request.task, &reply);
        if text.is_empty() {
            Err(Error::Ai("the model returned an empty reply".into()))
        } else {
            Ok(text)
        }
    });
    match reply {
        Ok(text) => Ok(AiResponse {
            text,
            model: config.llm_model,
        }),
        Err(e) => {
            refund(Action::Ai, caller, true);
            Err(e)
        }
    }
}

ic_cdk::export_candid!();

#[cfg(test)]
mod candid_tests {
    #[test]
    fn candid_interface_is_up_to_date() {
        let generated = super::__export_service();
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/backend.did");
        if std::env::var_os("UPDATE_CANDID").is_some() {
            std::fs::write(path, &generated).expect("failed to write backend.did");
        }
        let current = std::fs::read_to_string(path).unwrap_or_default();
        assert!(
            current == generated,
            "backend/backend.did is out of date; run `UPDATE_CANDID=1 cargo test -p backend`"
        );
    }
}
