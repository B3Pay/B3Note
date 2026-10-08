//! Public Candid types of the B3Note backend.
//!
//! Everything a user writes (title, body, tags, ...) is encrypted in the
//! browser before it reaches this canister. The canister only stores opaque
//! ciphertext plus the metadata it needs to enforce ownership, quotas and
//! expiry.

use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;

/// Errors returned by every fallible endpoint.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum Error {
    /// The caller must sign in (anonymous callers are not allowed here).
    Unauthenticated,
    /// The caller is not allowed to perform this action.
    Forbidden(String),
    NotFound,
    AlreadyExists,
    InvalidArgument(String),
    /// A per-user or global quota would be exceeded.
    QuotaExceeded(String),
    /// Too many requests; retry after the given number of seconds.
    RateLimited {
        retry_after_secs: u64,
    },
    /// The note changed since the caller last read it.
    Conflict {
        current_version: u64,
    },
    /// The share link or note has expired.
    Expired,
    /// The share link has no views left.
    Exhausted,
    /// The public keys have not been fetched from the management canister yet.
    NotReady,
    /// A call to the vetKD system API failed.
    VetKd(String),
    /// AI features are disabled on this deployment.
    AiDisabled,
    /// The call to the LLM canister failed.
    Ai(String),
}

pub type Result<T> = std::result::Result<T, Error>;

/// Hard limits enforced by the canister. Controllers can change them.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Limits {
    pub max_notes_per_user: u32,
    /// Maximum size of one encrypted note, in bytes.
    pub max_note_bytes: u32,
    pub max_shares_per_user: u32,
    pub max_share_views: u32,
    pub max_share_ttl_secs: u64,
    /// vetKD derivations (user key + share opens) one principal may request per hour.
    pub key_requests_per_user_per_hour: u32,
    /// vetKD derivations the whole canister may request per hour (protects its cycles).
    pub global_key_requests_per_hour: u32,
    pub ai_requests_per_user_per_hour: u32,
    pub global_ai_requests_per_hour: u32,
    /// Maximum number of UTF-8 bytes sent to the LLM in one request.
    pub max_ai_input_bytes: u32,
}

/// The canister configuration.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Config {
    /// Name of the vetKD master key: `key_1` on mainnet, `test_key_1` or
    /// `dfx_test_key` on a local network.
    pub vetkd_key_name: String,
    pub ai_enabled: bool,
    /// The LLM canister. `None` resolves `PUBLIC_CANISTER_ID:llm` (set by
    /// `icp deploy`) and falls back to the mainnet LLM canister.
    pub llm_canister: Option<Principal>,
    pub llm_model: String,
    /// Cycles attached to each LLM call (0 for the free models).
    pub llm_cycles_per_call: u64,
    pub limits: Limits,
}

/// Install and upgrade arguments. Every field is optional; `None` keeps the
/// current (or default) value.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct InitArgs {
    pub vetkd_key_name: Option<String>,
    pub ai_enabled: Option<bool>,
    pub llm_canister: Option<Principal>,
    pub llm_model: Option<String>,
    pub llm_cycles_per_call: Option<u64>,
    pub limits: Option<Limits>,
}

/// An encrypted note as stored by the canister.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Note {
    /// 32 lowercase hex characters (16 random bytes chosen by the client).
    pub id: String,
    /// AES-GCM ciphertext produced with the owner's vetKey-derived key.
    pub ciphertext: ByteBuf,
    pub created_at: u64,
    pub updated_at: u64,
    /// The note deletes itself at this time (nanoseconds since the epoch).
    pub expires_at: Option<u64>,
    /// Incremented on every update, for optimistic concurrency control.
    pub version: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct ListNotesArgs {
    /// Return notes whose id sorts after this one.
    pub cursor: Option<String>,
    pub limit: Option<u32>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct NotePage {
    pub notes: Vec<Note>,
    pub next_cursor: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CreateNoteArgs {
    pub id: String,
    pub ciphertext: ByteBuf,
    pub expires_at: Option<u64>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UpdateNoteArgs {
    pub id: String,
    pub ciphertext: ByteBuf,
    /// Replaces the note's expiry (`None` removes it).
    pub expires_at: Option<u64>,
    /// Reject the update with `Conflict` unless the note is at this version.
    pub expected_version: Option<u64>,
}

/// The owner's encrypted vetKey and the public key to verify it with.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct EncryptedUserKey {
    pub encrypted_key: ByteBuf,
    pub verification_key: ByteBuf,
}

/// Derived public keys of this canister.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct PublicKeys {
    /// Verifies users' vetKeys (input: the user's principal).
    pub user_key: ByteBuf,
    /// IBE-encrypts share payloads (identity: the share id).
    pub share_key: ByteBuf,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct CreateShareArgs {
    /// 32 lowercase hex characters (16 random bytes chosen by the client).
    pub id: String,
    /// The note this share was created from, so deleting it revokes the share.
    pub note_id: Option<String>,
    /// IBE ciphertext for the identity `id`, under `PublicKeys.share_key`.
    pub ciphertext: ByteBuf,
    /// Ed25519 public key (32 bytes) whose secret key travels in the link.
    pub verifying_key: ByteBuf,
    pub max_views: u32,
    pub expires_in_secs: u64,
    /// The owner's DER-encoded Internet Identity public key: share links
    /// cost the canister a vetKD derivation per view, so guests cannot make
    /// them.
    pub internet_identity_key: Option<ByteBuf>,
}

/// A share as its owner sees it.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct ShareInfo {
    pub id: String,
    pub note_id: Option<String>,
    pub created_at: u64,
    pub expires_at: u64,
    pub max_views: u32,
    pub views_left: u32,
    pub size: u32,
}

/// What anyone holding a share id may learn before opening it.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct PublicShareInfo {
    pub created_at: u64,
    pub expires_at: u64,
    pub views_left: u32,
    pub size: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OpenShareArgs {
    pub id: String,
    /// A fresh BLS12-381 G1 transport public key (48 bytes).
    pub transport_public_key: ByteBuf,
    /// Ed25519 signature over `SHARE_OPEN_DOMAIN || id bytes || transport_public_key`.
    pub signature: ByteBuf,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct OpenedShare {
    pub ciphertext: ByteBuf,
    /// The vetKey for the share id, encrypted to the transport public key.
    pub encrypted_key: ByteBuf,
    pub verification_key: ByteBuf,
    pub views_left: u32,
    pub expires_at: u64,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Account {
    pub principal: Principal,
    pub created_at: u64,
    pub note_count: u32,
    pub storage_bytes: u64,
    pub share_count: u32,
    pub limits: Limits,
    pub ai_enabled: bool,
    pub ai_model: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct DeletedAccount {
    pub notes: u32,
    pub shares: u32,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct Stats {
    pub version: String,
    pub users: u64,
    pub notes: u64,
    pub active_shares: u64,
    pub vetkd_key_name: String,
    pub ai_enabled: bool,
    pub ai_model: String,
    pub cycles: u128,
}

/// What the AI assistant should do with the text.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum AiTask {
    /// A short summary.
    Summarize,
    /// A title of a few words.
    SuggestTitle,
    /// Comma-separated topic tags.
    SuggestTags,
    /// Clearer, better structured wording.
    Improve,
    /// Spelling and grammar only.
    FixGrammar,
    /// A shorter version.
    Shorten,
    /// A markdown checklist of the action items.
    ActionItems,
    /// A translation into the named language.
    Translate(String),
    /// More text in the same style.
    Continue,
    /// Answer a question using the text (the user's notes) as context.
    Ask(String),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct AiRequest {
    pub task: AiTask,
    pub text: String,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct AiResponse {
    pub text: String,
    pub model: String,
}
