//! Stable-memory state. Everything here survives upgrades.

use std::borrow::Cow;
use std::cell::RefCell;

use candid::{CandidType, Decode, Encode, Principal};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, StableCell, Storable};
use serde::Deserialize;
use serde_bytes::ByteBuf;

use crate::ids::Id;
use crate::types::{Config, PublicKeys};

type Memory = VirtualMemory<DefaultMemoryImpl>;

/// An encrypted note. The key is `(owner, note id)`.
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct StoredNote {
    pub ciphertext: ByteBuf,
    pub created_at: u64,
    pub updated_at: u64,
    pub expires_at: Option<u64>,
    pub version: u64,
}

/// A burn-after-reading share. The key is the share id.
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct StoredShare {
    pub owner: Principal,
    pub note_id: Option<Id>,
    pub ciphertext: ByteBuf,
    pub verifying_key: ByteBuf,
    pub created_at: u64,
    pub expires_at: u64,
    pub max_views: u32,
    pub views_left: u32,
    /// Transport public keys already used to open this share, so a replayed
    /// `open_share` message cannot burn another view.
    pub used_transport_keys: Vec<ByteBuf>,
}

/// Per-user counters, so quotas never need a scan.
#[derive(CandidType, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct UserRecord {
    pub created_at: u64,
    pub note_count: u32,
    pub note_bytes: u64,
    pub share_count: u32,
    /// Tell the user when someone opens a link they shared. `None` (every
    /// record stored before this existed) is no.
    pub notify_share_opened: Option<bool>,
}

/// Values that do not fit the user maps: the config and the cached public keys.
#[derive(CandidType, Deserialize, Clone, Debug, Default)]
pub struct Settings {
    pub config: Config,
    pub public_keys: Option<CachedPublicKeys>,
}

/// Public keys are only valid for the key name they were fetched for.
#[derive(CandidType, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct CachedPublicKeys {
    pub key_name: String,
    pub keys: PublicKeys,
}

macro_rules! candid_storable {
    ($t:ty) => {
        impl Storable for $t {
            fn to_bytes(&self) -> Cow<'_, [u8]> {
                Cow::Owned(Encode!(self).expect(concat!("failed to encode ", stringify!($t))))
            }

            fn into_bytes(self) -> Vec<u8> {
                Encode!(&self).expect(concat!("failed to encode ", stringify!($t)))
            }

            fn from_bytes(bytes: Cow<[u8]>) -> Self {
                Decode!(bytes.as_ref(), $t).expect(concat!("failed to decode ", stringify!($t)))
            }

            const BOUND: Bound = Bound::Unbounded;
        }
    };
}

candid_storable!(StoredNote);
candid_storable!(StoredShare);
candid_storable!(UserRecord);
candid_storable!(Settings);

const SETTINGS: MemoryId = MemoryId::new(0);
const NOTES: MemoryId = MemoryId::new(1);
const USERS: MemoryId = MemoryId::new(2);
const SHARES: MemoryId = MemoryId::new(3);
const SHARES_BY_OWNER: MemoryId = MemoryId::new(4);
const NOTE_EXPIRY: MemoryId = MemoryId::new(5);
const SHARE_EXPIRY: MemoryId = MemoryId::new(6);

pub type NoteKey = (Principal, Id);

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static SETTINGS_CELL: RefCell<StableCell<Settings, Memory>> = RefCell::new(
        StableCell::init(memory(SETTINGS), Settings::default())
    );

    pub static NOTES_MAP: RefCell<StableBTreeMap<NoteKey, StoredNote, Memory>> =
        RefCell::new(StableBTreeMap::init(memory(NOTES)));

    pub static USERS_MAP: RefCell<StableBTreeMap<Principal, UserRecord, Memory>> =
        RefCell::new(StableBTreeMap::init(memory(USERS)));

    pub static SHARES_MAP: RefCell<StableBTreeMap<Id, StoredShare, Memory>> =
        RefCell::new(StableBTreeMap::init(memory(SHARES)));

    /// `(owner, share id)` index for listing and revoking a user's shares.
    pub static SHARES_BY_OWNER_MAP: RefCell<StableBTreeMap<(Principal, Id), (), Memory>> =
        RefCell::new(StableBTreeMap::init(memory(SHARES_BY_OWNER)));

    /// `(expires_at, owner, note id)` index for the cleanup timer.
    pub static NOTE_EXPIRY_MAP: RefCell<StableBTreeMap<(u64, Principal, Id), (), Memory>> =
        RefCell::new(StableBTreeMap::init(memory(NOTE_EXPIRY)));

    /// `(expires_at, share id)` index for the cleanup timer.
    pub static SHARE_EXPIRY_MAP: RefCell<StableBTreeMap<(u64, Id), (), Memory>> =
        RefCell::new(StableBTreeMap::init(memory(SHARE_EXPIRY)));
}

fn memory(id: MemoryId) -> Memory {
    MEMORY_MANAGER.with_borrow(|m| m.get(id))
}

pub fn config() -> Config {
    SETTINGS_CELL.with_borrow(|cell| cell.get().config.clone())
}

pub fn set_config(config: Config) {
    SETTINGS_CELL.with_borrow_mut(|cell| {
        let mut settings = cell.get().clone();
        if settings.config.vetkd_key_name != config.vetkd_key_name {
            // Keys derived from another master key cannot verify the new ones.
            settings.public_keys = None;
        }
        settings.config = config;
        cell.set(settings);
    });
}

/// The cached public keys, if they were fetched for the configured key name.
pub fn public_keys() -> Option<PublicKeys> {
    SETTINGS_CELL.with_borrow(|cell| {
        let settings = cell.get();
        settings
            .public_keys
            .as_ref()
            .filter(|cached| cached.key_name == settings.config.vetkd_key_name)
            .map(|cached| cached.keys.clone())
    })
}

pub fn set_public_keys(key_name: String, keys: PublicKeys) {
    SETTINGS_CELL.with_borrow_mut(|cell| {
        let mut settings = cell.get().clone();
        settings.public_keys = Some(CachedPublicKeys { key_name, keys });
        cell.set(settings);
    });
}

pub fn user(principal: &Principal) -> Option<UserRecord> {
    USERS_MAP.with_borrow(|users| users.get(principal))
}

/// Applies `f` to the user's record (created on first use) and stores it.
pub fn update_user<R>(principal: Principal, now: u64, f: impl FnOnce(&mut UserRecord) -> R) -> R {
    USERS_MAP.with_borrow_mut(|users| {
        let mut record = users.get(&principal).unwrap_or(UserRecord {
            created_at: now,
            ..UserRecord::default()
        });
        let result = f(&mut record);
        users.insert(principal, record);
        result
    })
}

/// Inclusive key range covering every id of one principal.
pub fn owner_range(owner: Principal) -> std::ops::RangeInclusive<(Principal, Id)> {
    (owner, [0u8; 16])..=(owner, [0xffu8; 16])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{Limits, NotificationConfig};

    /// `Config` and `UserRecord` as the release before notifications stored them.
    #[derive(CandidType)]
    struct ConfigBefore {
        vetkd_key_name: String,
        ai_enabled: bool,
        llm_canister: Option<Principal>,
        llm_model: String,
        llm_cycles_per_call: u64,
        limits: Limits,
    }

    #[derive(CandidType)]
    struct SettingsBefore {
        config: ConfigBefore,
        public_keys: Option<CachedPublicKeys>,
    }

    #[derive(CandidType)]
    struct UserRecordBefore {
        created_at: u64,
        note_count: u32,
        note_bytes: u64,
        share_count: u32,
    }

    #[test]
    fn records_stored_before_notifications_still_decode() {
        let before = SettingsBefore {
            config: ConfigBefore {
                vetkd_key_name: "key_1".into(),
                ai_enabled: true,
                llm_canister: None,
                llm_model: "llama3.1:8b".into(),
                llm_cycles_per_call: 0,
                limits: Limits::default(),
            },
            public_keys: None,
        };
        let settings = Settings::from_bytes(Cow::Owned(Encode!(&before).unwrap()));
        assert!(settings.config.ai_enabled);
        assert_eq!(settings.config.notifications, None);

        let user = UserRecord::from_bytes(Cow::Owned(
            Encode!(&UserRecordBefore {
                created_at: 5,
                note_count: 2,
                note_bytes: 300,
                share_count: 1,
            })
            .unwrap(),
        ));
        assert_eq!(user.share_count, 1);
        assert_eq!(user.notify_share_opened, None);
    }

    #[test]
    fn notification_settings_round_trip() {
        let mut settings = Settings::default();
        settings.config.notifications = Some(NotificationConfig {
            enabled: true,
            hub_canister: Principal::from_text("vi4fr-7aaaa-aaaay-aadwq-cai").unwrap(),
            url: Some("https://note.b3pay.net/settings".into()),
        });
        let decoded = Settings::from_bytes(settings.to_bytes());
        assert_eq!(decoded.config, settings.config);
    }
}
