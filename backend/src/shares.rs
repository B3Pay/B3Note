//! Burn-after-reading share links.
//!
//! The owner IBE-encrypts a snapshot of a note to the identity `share id`
//! under the canister's share public key, and uploads it with the Ed25519
//! public key of a fresh signing key. The link carries the share id and that
//! signing key's secret (in the URL fragment, which browsers never send to a
//! server).
//!
//! To read, the holder signs `SHARE_OPEN_DOMAIN || share id || transport key`.
//! The canister checks the signature, spends one view and has the vetKD system
//! API derive the share's decryption key encrypted to that transport key.
//! When the last view is spent the ciphertext is deleted, and because only the
//! canister can ask for the share key, nobody can decrypt it again, even with
//! the link and a copy of the ciphertext.

use candid::Principal;
use ed25519_dalek::{Signature, VerifyingKey};
use serde_bytes::ByteBuf;

use crate::ids::{format_id, parse_id, Id};
use crate::state::{
    self, owner_range, StoredShare, NOTES_MAP, SHARES_BY_OWNER_MAP, SHARES_MAP, SHARE_EXPIRY_MAP,
};
use crate::types::{CreateShareArgs, Error, Limits, PublicShareInfo, ShareInfo};

pub const SHARE_OPEN_DOMAIN: &[u8] = b"b3note-open-share-v1";
pub const MIN_TTL_SECS: u64 = 60;
/// IBE header, seed and G2 point added to the plaintext, plus room for the
/// JSON envelope around the note.
const IBE_ALLOWANCE: usize = 4 * 1024;
const NANOS: u64 = 1_000_000_000;

fn info(id: &Id, share: &StoredShare) -> ShareInfo {
    ShareInfo {
        id: format_id(id),
        note_id: share.note_id.as_ref().map(format_id),
        created_at: share.created_at,
        expires_at: share.expires_at,
        max_views: share.max_views,
        views_left: share.views_left,
        size: share.ciphertext.len() as u32,
    }
}

/// The message a link holder signs to open a share.
pub fn open_message(id: &Id, transport_public_key: &[u8]) -> Vec<u8> {
    [SHARE_OPEN_DOMAIN, id.as_slice(), transport_public_key].concat()
}

pub fn create(
    owner: Principal,
    args: CreateShareArgs,
    now: u64,
    limits: &Limits,
) -> Result<ShareInfo, Error> {
    let id = parse_id(&args.id)?;
    let note_id = args.note_id.as_deref().map(parse_id).transpose()?;
    if let Some(note_id) = note_id {
        let owns_note = NOTES_MAP.with_borrow(|notes| notes.contains_key(&(owner, note_id)));
        if !owns_note {
            return Err(Error::NotFound);
        }
    }
    if args.ciphertext.is_empty() {
        return Err(Error::InvalidArgument("ciphertext is empty".to_string()));
    }
    if args.ciphertext.len() > limits.max_note_bytes as usize + IBE_ALLOWANCE {
        return Err(Error::QuotaExceeded(format!(
            "a shared note may be at most {} bytes",
            limits.max_note_bytes
        )));
    }
    let key_bytes: [u8; 32] = args
        .verifying_key
        .as_slice()
        .try_into()
        .map_err(|_| Error::InvalidArgument("verifying_key must be 32 bytes".to_string()))?;
    VerifyingKey::from_bytes(&key_bytes)
        .map_err(|_| Error::InvalidArgument("verifying_key is not an Ed25519 key".to_string()))?;
    if args.max_views == 0 || args.max_views > limits.max_share_views {
        return Err(Error::InvalidArgument(format!(
            "max_views must be between 1 and {}",
            limits.max_share_views
        )));
    }
    if args.expires_in_secs < MIN_TTL_SECS || args.expires_in_secs > limits.max_share_ttl_secs {
        return Err(Error::InvalidArgument(format!(
            "expires_in_secs must be between {MIN_TTL_SECS} and {}",
            limits.max_share_ttl_secs
        )));
    }
    if SHARES_MAP.with_borrow(|shares| shares.contains_key(&id)) {
        return Err(Error::AlreadyExists);
    }
    let used = state::user(&owner).unwrap_or_default();
    if used.share_count >= limits.max_shares_per_user {
        return Err(Error::QuotaExceeded(format!(
            "you can have at most {} active share links",
            limits.max_shares_per_user
        )));
    }

    let share = StoredShare {
        owner,
        note_id,
        ciphertext: args.ciphertext,
        verifying_key: args.verifying_key,
        created_at: now,
        expires_at: now + args.expires_in_secs * NANOS,
        max_views: args.max_views,
        views_left: args.max_views,
        used_transport_keys: Vec::new(),
    };
    let result = info(&id, &share);
    SHARE_EXPIRY_MAP.with_borrow_mut(|index| index.insert((share.expires_at, id), ()));
    SHARES_BY_OWNER_MAP.with_borrow_mut(|index| index.insert((owner, id), ()));
    SHARES_MAP.with_borrow_mut(|shares| shares.insert(id, share));
    state::update_user(owner, now, |user| user.share_count += 1);
    Ok(result)
}

fn live_share(id: &Id, now: u64) -> Result<StoredShare, Error> {
    let share = SHARES_MAP
        .with_borrow(|shares| shares.get(id))
        .ok_or(Error::NotFound)?;
    if share.expires_at <= now {
        return Err(Error::Expired);
    }
    if share.views_left == 0 {
        return Err(Error::Exhausted);
    }
    Ok(share)
}

pub fn public_info(id: &str, now: u64) -> Result<PublicShareInfo, Error> {
    let id = parse_id(id)?;
    let share = live_share(&id, now)?;
    Ok(PublicShareInfo {
        created_at: share.created_at,
        expires_at: share.expires_at,
        views_left: share.views_left,
        size: share.ciphertext.len() as u32,
    })
}

pub fn list(owner: Principal, now: u64) -> Vec<ShareInfo> {
    let ids: Vec<Id> = SHARES_BY_OWNER_MAP.with_borrow(|index| {
        index
            .keys_range(owner_range(owner))
            .map(|(_, id)| id)
            .collect()
    });
    SHARES_MAP.with_borrow(|shares| {
        ids.iter()
            .filter_map(|id| shares.get(id).map(|share| (id, share)))
            .filter(|(_, share)| share.expires_at > now && share.views_left > 0)
            .map(|(id, share)| info(id, &share))
            .collect()
    })
}

pub fn revoke(owner: Principal, id: &str) -> Result<(), Error> {
    let id = parse_id(id)?;
    let owned = SHARES_BY_OWNER_MAP.with_borrow(|index| index.contains_key(&(owner, id)));
    if !owned {
        return Err(Error::NotFound);
    }
    remove(&id);
    Ok(())
}

/// A share open that passed every check and spent a view, waiting for the
/// vetKD derivation.
pub struct PendingOpen {
    pub id: Id,
    pub ciphertext: ByteBuf,
    pub views_left: u32,
    pub expires_at: u64,
}

/// Checks the signature and spends one view. Call [`finish_open`] once the
/// key derivation has completed (or failed).
pub fn begin_open(
    id: &str,
    transport_public_key: &[u8],
    signature: &[u8],
    now: u64,
) -> Result<PendingOpen, Error> {
    let id = parse_id(id)?;
    let mut share = live_share(&id, now)?;

    let signature: [u8; 64] = signature
        .try_into()
        .map_err(|_| Error::InvalidArgument("signature must be 64 bytes".to_string()))?;
    let key_bytes: [u8; 32] = share
        .verifying_key
        .as_slice()
        .try_into()
        .map_err(|_| Error::Forbidden("share has a malformed key".to_string()))?;
    let verifying_key = VerifyingKey::from_bytes(&key_bytes)
        .map_err(|_| Error::Forbidden("share has a malformed key".to_string()))?;
    verifying_key
        .verify_strict(
            &open_message(&id, transport_public_key),
            &Signature::from_bytes(&signature),
        )
        .map_err(|_| Error::Forbidden("invalid share signature".to_string()))?;

    if share
        .used_transport_keys
        .iter()
        .any(|used| used.as_slice() == transport_public_key)
    {
        return Err(Error::Forbidden(
            "this transport key was already used to open the share".to_string(),
        ));
    }

    share.views_left -= 1;
    share
        .used_transport_keys
        .push(ByteBuf::from(transport_public_key.to_vec()));
    let pending = PendingOpen {
        id,
        ciphertext: share.ciphertext.clone(),
        views_left: share.views_left,
        expires_at: share.expires_at,
    };
    SHARES_MAP.with_borrow_mut(|shares| shares.insert(id, share));
    Ok(pending)
}

/// Burns the share after its last view, or gives the view back if the key
/// derivation failed.
pub fn finish_open(id: &Id, transport_public_key: &[u8], succeeded: bool) {
    let Some(mut share) = SHARES_MAP.with_borrow(|shares| shares.get(id)) else {
        // Revoked or expired meanwhile.
        return;
    };
    if succeeded {
        if share.views_left == 0 {
            remove(id);
        }
        return;
    }
    share.views_left = (share.views_left + 1).min(share.max_views);
    share
        .used_transport_keys
        .retain(|used| used.as_slice() != transport_public_key);
    SHARES_MAP.with_borrow_mut(|shares| shares.insert(*id, share));
}

/// Removes a share and its index entries. Returns the removed share.
pub fn remove(id: &Id) -> Option<StoredShare> {
    let share = SHARES_MAP.with_borrow_mut(|shares| shares.remove(id))?;
    SHARES_BY_OWNER_MAP.with_borrow_mut(|index| index.remove(&(share.owner, *id)));
    SHARE_EXPIRY_MAP.with_borrow_mut(|index| index.remove(&(share.expires_at, *id)));
    if state::user(&share.owner).is_some() {
        state::update_user(share.owner, share.created_at, |user| {
            user.share_count = user.share_count.saturating_sub(1);
        });
    }
    Some(share)
}

/// Revokes every share created from one note.
pub fn revoke_for_note(owner: Principal, note_id: Id) {
    let ids: Vec<Id> = SHARES_BY_OWNER_MAP.with_borrow(|index| {
        index
            .keys_range(owner_range(owner))
            .map(|(_, id)| id)
            .collect()
    });
    let doomed: Vec<Id> = SHARES_MAP.with_borrow(|shares| {
        ids.into_iter()
            .filter(|id| {
                shares
                    .get(id)
                    .is_some_and(|share| share.note_id == Some(note_id))
            })
            .collect()
    });
    for id in doomed {
        remove(&id);
    }
}

/// Deletes up to `max` shares that have expired.
pub fn delete_expired(now: u64, max: usize) -> usize {
    let due: Vec<(u64, Id)> = SHARE_EXPIRY_MAP
        .with_borrow(|index| index.keys_range(..(now + 1, [0u8; 16])).take(max).collect());
    let mut removed = 0;
    for (at, id) in due {
        if remove(&id).is_some() {
            removed += 1;
        } else {
            SHARE_EXPIRY_MAP.with_borrow_mut(|index| index.remove(&(at, id)));
        }
    }
    removed
}

/// Deletes all of `owner`'s shares. Returns how many were removed.
pub fn delete_all(owner: Principal) -> u32 {
    let ids: Vec<Id> = SHARES_BY_OWNER_MAP.with_borrow(|index| {
        index
            .keys_range(owner_range(owner))
            .map(|(_, id)| id)
            .collect()
    });
    ids.iter().filter(|id| remove(id).is_some()).count() as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};

    const SEC: u64 = NANOS;

    fn owner(n: u8) -> Principal {
        Principal::from_slice(&[n; 29])
    }

    fn signing_key(n: u8) -> SigningKey {
        SigningKey::from_bytes(&[n; 32])
    }

    fn args(id: u8, key: &SigningKey, views: u32) -> CreateShareArgs {
        CreateShareArgs {
            id: format_id(&[id; 16]),
            note_id: None,
            ciphertext: ByteBuf::from(vec![7; 100]),
            verifying_key: ByteBuf::from(key.verifying_key().to_bytes().to_vec()),
            max_views: views,
            expires_in_secs: 3_600,
        }
    }

    fn sign(key: &SigningKey, id: u8, tpk: &[u8]) -> Vec<u8> {
        key.sign(&open_message(&[id; 16], tpk)).to_bytes().to_vec()
    }

    #[test]
    fn burns_after_last_view() {
        let key = signing_key(1);
        let limits = Limits::default();
        create(owner(1), args(1, &key, 1), 0, &limits).unwrap();
        let id = format_id(&[1; 16]);
        let tpk = [3u8; 48];

        let pending = begin_open(&id, &tpk, &sign(&key, 1, &tpk), SEC).unwrap();
        assert_eq!(pending.views_left, 0);
        // A concurrent open sees no views left.
        let tpk2 = [4u8; 48];
        assert_eq!(
            begin_open(&id, &tpk2, &sign(&key, 1, &tpk2), SEC).err(),
            Some(Error::Exhausted)
        );
        finish_open(&pending.id, &tpk, true);
        assert_eq!(public_info(&id, SEC), Err(Error::NotFound));
        assert_eq!(state::user(&owner(1)).unwrap().share_count, 0);
    }

    #[test]
    fn failed_derivation_returns_the_view() {
        let key = signing_key(2);
        create(owner(2), args(2, &key, 1), 0, &Limits::default()).unwrap();
        let id = format_id(&[2; 16]);
        let tpk = [5u8; 48];
        let pending = begin_open(&id, &tpk, &sign(&key, 2, &tpk), SEC).unwrap();
        finish_open(&pending.id, &tpk, false);
        assert_eq!(public_info(&id, SEC).unwrap().views_left, 1);
        // The same transport key may be used again after a failure.
        begin_open(&id, &tpk, &sign(&key, 2, &tpk), SEC).unwrap();
    }

    #[test]
    fn rejects_bad_signatures_and_replays() {
        let key = signing_key(3);
        create(owner(3), args(3, &key, 3), 0, &Limits::default()).unwrap();
        let id = format_id(&[3; 16]);
        let tpk = [6u8; 48];
        let wrong_key = signing_key(4);
        assert!(matches!(
            begin_open(&id, &tpk, &sign(&wrong_key, 3, &tpk), SEC),
            Err(Error::Forbidden(_))
        ));
        // A signature for another transport key does not transfer.
        let other_tpk = [7u8; 48];
        assert!(matches!(
            begin_open(&id, &tpk, &sign(&key, 3, &other_tpk), SEC),
            Err(Error::Forbidden(_))
        ));
        let pending = begin_open(&id, &tpk, &sign(&key, 3, &tpk), SEC).unwrap();
        finish_open(&pending.id, &tpk, true);
        assert!(matches!(
            begin_open(&id, &tpk, &sign(&key, 3, &tpk), SEC),
            Err(Error::Forbidden(_))
        ));
        assert_eq!(public_info(&id, SEC).unwrap().views_left, 2);
    }

    #[test]
    fn expires_and_is_collected() {
        let key = signing_key(5);
        create(owner(5), args(5, &key, 1), 0, &Limits::default()).unwrap();
        let id = format_id(&[5; 16]);
        assert_eq!(public_info(&id, 3_600 * SEC), Err(Error::Expired));
        assert_eq!(delete_expired(3_599 * SEC, 10), 0);
        assert_eq!(delete_expired(3_600 * SEC, 10), 1);
        assert_eq!(public_info(&id, 0), Err(Error::NotFound));
    }

    #[test]
    fn only_the_owner_revokes() {
        let key = signing_key(6);
        create(owner(6), args(6, &key, 1), 0, &Limits::default()).unwrap();
        let id = format_id(&[6; 16]);
        assert_eq!(revoke(owner(7), &id), Err(Error::NotFound));
        assert_eq!(list(owner(6), 0).len(), 1);
        revoke(owner(6), &id).unwrap();
        assert!(list(owner(6), 0).is_empty());
    }

    #[test]
    fn validates_arguments() {
        let key = signing_key(8);
        let limits = Limits::default();
        let mut too_many_views = args(8, &key, limits.max_share_views + 1);
        too_many_views.id = format_id(&[80; 16]);
        assert!(matches!(
            create(owner(8), too_many_views, 0, &limits),
            Err(Error::InvalidArgument(_))
        ));
        let mut short_ttl = args(8, &key, 1);
        short_ttl.expires_in_secs = 1;
        assert!(matches!(
            create(owner(8), short_ttl, 0, &limits),
            Err(Error::InvalidArgument(_))
        ));
        let mut bad_key = args(8, &key, 1);
        bad_key.verifying_key = ByteBuf::from(vec![1; 31]);
        assert!(matches!(
            create(owner(8), bad_key, 0, &limits),
            Err(Error::InvalidArgument(_))
        ));
        let mut foreign_note = args(8, &key, 1);
        foreign_note.note_id = Some(format_id(&[99; 16]));
        assert_eq!(
            create(owner(8), foreign_note, 0, &limits),
            Err(Error::NotFound)
        );
    }
}
