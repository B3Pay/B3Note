//! Encrypted notes: ownership, quotas, optimistic concurrency and expiry.

use candid::Principal;

use crate::ids::{format_id, parse_id, Id};
use crate::shares;
use crate::state::{self, owner_range, StoredNote, NOTES_MAP, NOTE_EXPIRY_MAP};
use crate::types::{CreateNoteArgs, Error, Limits, ListNotesArgs, Note, NotePage, UpdateNoteArgs};

pub const DEFAULT_PAGE_SIZE: u32 = 100;
pub const MAX_PAGE_SIZE: u32 = 500;
/// Keeps a page well under the 2 MiB reply limit.
pub const PAGE_BYTE_BUDGET: usize = 1_500_000;
/// Self-destruct timers can be set at most this far ahead.
const MAX_EXPIRY_NANOS: u64 = 10 * 365 * 24 * 3_600 * 1_000_000_000;

fn to_note(id: &Id, note: StoredNote) -> Note {
    Note {
        id: format_id(id),
        ciphertext: note.ciphertext,
        created_at: note.created_at,
        updated_at: note.updated_at,
        expires_at: note.expires_at,
        version: note.version,
    }
}

fn is_live(note: &StoredNote, now: u64) -> bool {
    note.expires_at.is_none_or(|at| at > now)
}

fn validate_ciphertext(ciphertext: &[u8], limits: &Limits) -> Result<(), Error> {
    if ciphertext.is_empty() {
        return Err(Error::InvalidArgument("ciphertext is empty".to_string()));
    }
    if ciphertext.len() > limits.max_note_bytes as usize {
        return Err(Error::QuotaExceeded(format!(
            "a note may be at most {} bytes once encrypted",
            limits.max_note_bytes
        )));
    }
    Ok(())
}

fn validate_expiry(expires_at: Option<u64>, now: u64) -> Result<(), Error> {
    match expires_at {
        Some(at) if at <= now => Err(Error::InvalidArgument(
            "expires_at must be in the future".to_string(),
        )),
        Some(at) if at - now > MAX_EXPIRY_NANOS => Err(Error::InvalidArgument(
            "expires_at may be at most 10 years ahead".to_string(),
        )),
        _ => Ok(()),
    }
}

fn set_expiry_index(owner: Principal, id: Id, old: Option<u64>, new: Option<u64>) {
    if old == new {
        return;
    }
    NOTE_EXPIRY_MAP.with_borrow_mut(|index| {
        if let Some(at) = old {
            index.remove(&(at, owner, id));
        }
        if let Some(at) = new {
            index.insert((at, owner, id), ());
        }
    });
}

pub fn list(owner: Principal, args: ListNotesArgs, now: u64) -> Result<NotePage, Error> {
    let limit = args
        .limit
        .unwrap_or(DEFAULT_PAGE_SIZE)
        .clamp(1, MAX_PAGE_SIZE) as usize;
    let start = match args.cursor {
        Some(cursor) => {
            let id = parse_id(&cursor)?;
            std::ops::Bound::Excluded((owner, id))
        }
        None => std::ops::Bound::Included((owner, [0u8; 16])),
    };
    let end = std::ops::Bound::Included((owner, [0xffu8; 16]));

    NOTES_MAP.with_borrow(|notes| {
        let mut page = Vec::new();
        let mut bytes = 0usize;
        let mut next_cursor = None;
        for entry in notes.range((start, end)) {
            let (key, note) = entry.into_pair();
            if !is_live(&note, now) {
                continue;
            }
            let size = note.ciphertext.len() + 64;
            if page.len() == limit || (!page.is_empty() && bytes + size > PAGE_BYTE_BUDGET) {
                next_cursor = page.last().map(|n: &Note| n.id.clone());
                break;
            }
            bytes += size;
            page.push(to_note(&key.1, note));
        }
        Ok(NotePage {
            notes: page,
            next_cursor,
        })
    })
}

pub fn get(owner: Principal, id: &str, now: u64) -> Result<Note, Error> {
    let id = parse_id(id)?;
    let note = NOTES_MAP
        .with_borrow(|notes| notes.get(&(owner, id)))
        .ok_or(Error::NotFound)?;
    if !is_live(&note, now) {
        return Err(Error::NotFound);
    }
    Ok(to_note(&id, note))
}

pub fn create(
    owner: Principal,
    args: CreateNoteArgs,
    now: u64,
    limits: &Limits,
) -> Result<Note, Error> {
    let id = parse_id(&args.id)?;
    validate_ciphertext(&args.ciphertext, limits)?;
    validate_expiry(args.expires_at, now)?;

    let key = (owner, id);
    if let Some(existing) = NOTES_MAP.with_borrow(|notes| notes.get(&key)) {
        if is_live(&existing, now) {
            return Err(Error::AlreadyExists);
        }
        // An expired note the timer has not collected yet: free its slot.
        remove(owner, id);
    }
    let used = state::user(&owner).unwrap_or_default();
    if used.note_count >= limits.max_notes_per_user {
        return Err(Error::QuotaExceeded(format!(
            "you can keep at most {} notes",
            limits.max_notes_per_user
        )));
    }

    let size = args.ciphertext.len() as u64;
    let note = StoredNote {
        ciphertext: args.ciphertext,
        created_at: now,
        updated_at: now,
        expires_at: args.expires_at,
        version: 1,
    };
    NOTES_MAP.with_borrow_mut(|notes| notes.insert(key, note.clone()));
    set_expiry_index(owner, id, None, note.expires_at);
    state::update_user(owner, now, |user| {
        user.note_count += 1;
        user.note_bytes += size;
    });
    Ok(to_note(&id, note))
}

pub fn update(
    owner: Principal,
    args: UpdateNoteArgs,
    now: u64,
    limits: &Limits,
) -> Result<Note, Error> {
    let id = parse_id(&args.id)?;
    validate_ciphertext(&args.ciphertext, limits)?;
    validate_expiry(args.expires_at, now)?;

    let key = (owner, id);
    let current = NOTES_MAP
        .with_borrow(|notes| notes.get(&key))
        .filter(|note| is_live(note, now))
        .ok_or(Error::NotFound)?;
    if let Some(expected) = args.expected_version {
        if expected != current.version {
            return Err(Error::Conflict {
                current_version: current.version,
            });
        }
    }

    let old_size = current.ciphertext.len() as u64;
    let new_size = args.ciphertext.len() as u64;
    let note = StoredNote {
        ciphertext: args.ciphertext,
        created_at: current.created_at,
        updated_at: now,
        expires_at: args.expires_at,
        version: current.version + 1,
    };
    NOTES_MAP.with_borrow_mut(|notes| notes.insert(key, note.clone()));
    set_expiry_index(owner, id, current.expires_at, note.expires_at);
    state::update_user(owner, now, |user| {
        user.note_bytes = user.note_bytes.saturating_sub(old_size) + new_size;
    });
    Ok(to_note(&id, note))
}

pub fn delete(owner: Principal, id: &str, now: u64) -> Result<(), Error> {
    let id = parse_id(id)?;
    let note = NOTES_MAP
        .with_borrow(|notes| notes.get(&(owner, id)))
        .ok_or(Error::NotFound)?;
    if !is_live(&note, now) {
        remove(owner, id);
        return Err(Error::NotFound);
    }
    remove(owner, id);
    Ok(())
}

/// Removes a note, its expiry entry and the shares made from it, and updates
/// the owner's counters. Returns whether a note was removed.
pub fn remove(owner: Principal, id: Id) -> bool {
    let Some(note) = NOTES_MAP.with_borrow_mut(|notes| notes.remove(&(owner, id))) else {
        return false;
    };
    set_expiry_index(owner, id, note.expires_at, None);
    if state::user(&owner).is_some() {
        state::update_user(owner, note.created_at, |user| {
            user.note_count = user.note_count.saturating_sub(1);
            user.note_bytes = user.note_bytes.saturating_sub(note.ciphertext.len() as u64);
        });
    }
    shares::revoke_for_note(owner, id);
    true
}

/// Deletes up to `max` notes whose self-destruct time has passed.
pub fn delete_expired(now: u64, max: usize) -> usize {
    let due: Vec<(u64, Principal, Id)> = NOTE_EXPIRY_MAP.with_borrow(|index| {
        index
            .keys_range(..(now + 1, Principal::management_canister(), [0u8; 16]))
            .take(max)
            .collect()
    });
    let mut removed = 0;
    for (at, owner, id) in due {
        if at > now {
            break;
        }
        // `remove` also drops the index entry.
        if remove(owner, id) {
            removed += 1;
        } else {
            NOTE_EXPIRY_MAP.with_borrow_mut(|index| index.remove(&(at, owner, id)));
        }
    }
    removed
}

/// Deletes all of `owner`'s notes. Returns how many were removed.
pub fn delete_all(owner: Principal) -> u32 {
    let ids: Vec<Id> = NOTES_MAP.with_borrow(|notes| {
        notes
            .keys_range(owner_range(owner))
            .map(|(_, id)| id)
            .collect()
    });
    ids.into_iter().filter(|id| remove(owner, *id)).count() as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_bytes::ByteBuf;

    const SEC: u64 = 1_000_000_000;

    fn owner(n: u8) -> Principal {
        Principal::from_slice(&[n; 29])
    }

    fn id(n: u8) -> String {
        format_id(&[n; 16])
    }

    fn create_args(n: u8, bytes: usize) -> CreateNoteArgs {
        CreateNoteArgs {
            id: id(n),
            ciphertext: ByteBuf::from(vec![n; bytes]),
            expires_at: None,
        }
    }

    #[test]
    fn crud_and_counters() {
        let limits = Limits::default();
        let alice = owner(10);
        let note = create(alice, create_args(1, 10), 5, &limits).unwrap();
        assert_eq!(note.version, 1);
        assert_eq!(
            create(alice, create_args(1, 10), 6, &limits),
            Err(Error::AlreadyExists)
        );

        let updated = update(
            alice,
            UpdateNoteArgs {
                id: id(1),
                ciphertext: ByteBuf::from(vec![9; 30]),
                expires_at: None,
                expected_version: Some(1),
            },
            7,
            &limits,
        )
        .unwrap();
        assert_eq!(updated.version, 2);
        assert_eq!(updated.created_at, 5);
        assert_eq!(updated.updated_at, 7);
        let user = state::user(&alice).unwrap();
        assert_eq!((user.note_count, user.note_bytes), (1, 30));

        let stale = update(
            alice,
            UpdateNoteArgs {
                id: id(1),
                ciphertext: ByteBuf::from(vec![1]),
                expires_at: None,
                expected_version: Some(1),
            },
            8,
            &limits,
        );
        assert_eq!(stale, Err(Error::Conflict { current_version: 2 }));

        delete(alice, &id(1), 9).unwrap();
        assert_eq!(get(alice, &id(1), 9), Err(Error::NotFound));
        let user = state::user(&alice).unwrap();
        assert_eq!((user.note_count, user.note_bytes), (0, 0));
    }

    #[test]
    fn owners_are_isolated() {
        let limits = Limits::default();
        let (alice, mallory) = (owner(20), owner(21));
        create(alice, create_args(2, 4), 1, &limits).unwrap();
        assert_eq!(get(mallory, &id(2), 2), Err(Error::NotFound));
        assert_eq!(delete(mallory, &id(2), 2), Err(Error::NotFound));
        let overwrite = update(
            mallory,
            UpdateNoteArgs {
                id: id(2),
                ciphertext: ByteBuf::from(vec![0]),
                expires_at: None,
                expected_version: None,
            },
            2,
            &limits,
        );
        assert_eq!(overwrite, Err(Error::NotFound));
        assert!(get(alice, &id(2), 2).is_ok());
        // The same id is free for another owner.
        create(mallory, create_args(2, 4), 3, &limits).unwrap();
    }

    #[test]
    fn enforces_quotas() {
        let limits = Limits {
            max_notes_per_user: 2,
            max_note_bytes: 8,
            ..Limits::default()
        };
        let carol = owner(30);
        assert!(matches!(
            create(carol, create_args(1, 9), 1, &limits),
            Err(Error::QuotaExceeded(_))
        ));
        create(carol, create_args(1, 8), 1, &limits).unwrap();
        create(carol, create_args(2, 8), 1, &limits).unwrap();
        assert!(matches!(
            create(carol, create_args(3, 1), 1, &limits),
            Err(Error::QuotaExceeded(_))
        ));
    }

    #[test]
    fn pages_through_notes() {
        let limits = Limits::default();
        let dave = owner(40);
        for n in 1..=5 {
            create(dave, create_args(n, 3), 1, &limits).unwrap();
        }
        let first = list(
            dave,
            ListNotesArgs {
                cursor: None,
                limit: Some(2),
            },
            2,
        )
        .unwrap();
        assert_eq!(first.notes.len(), 2);
        let second = list(
            dave,
            ListNotesArgs {
                cursor: first.next_cursor.clone(),
                limit: Some(10),
            },
            2,
        )
        .unwrap();
        assert_eq!(second.notes.len(), 3);
        assert_eq!(second.next_cursor, None);
        assert_eq!(second.notes[0].id, id(3));
    }

    #[test]
    fn expired_notes_disappear() {
        let limits = Limits::default();
        let erin = owner(50);
        let mut args = create_args(1, 3);
        args.expires_at = Some(100 * SEC);
        create(erin, args, 1, &limits).unwrap();
        create(erin, create_args(2, 3), 1, &limits).unwrap();
        assert_eq!(
            list(erin, ListNotesArgs::default(), 100 * SEC)
                .unwrap()
                .notes
                .len(),
            1
        );
        assert_eq!(get(erin, &id(1), 100 * SEC), Err(Error::NotFound));
        assert_eq!(delete_expired(99 * SEC, 10), 0);
        assert_eq!(delete_expired(100 * SEC, 10), 1);
        let user = state::user(&erin).unwrap();
        assert_eq!(user.note_count, 1);
    }

    #[test]
    fn rejects_past_expiry() {
        let mut args = create_args(1, 3);
        args.expires_at = Some(5);
        assert!(matches!(
            create(owner(60), args, 5, &Limits::default()),
            Err(Error::InvalidArgument(_))
        ));
    }
}
