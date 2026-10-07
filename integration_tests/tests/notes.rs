//! Notes: end-to-end encryption with vetKeys, ownership, quotas, expiry.

mod common;

use backend::types::*;
use candid::Principal;
use common::*;
use serde_bytes::ByteBuf;

#[test]
fn notes_round_trip_through_the_users_vetkey() {
    let env = TestEnv::new();
    let alice = user(1);

    let vetkey = env.user_vetkey(alice);
    let note = env.create_note(alice, &vetkey, "# Groceries\n- [ ] oat milk");
    assert_eq!(note.version, 1);

    // A later session fetches the key again with another transport key and
    // can still decrypt: the vetKey is deterministic per principal.
    let again = env.user_vetkey(alice);
    assert_eq!(again.serialize(), vetkey.serialize());
    let notes = env.list_notes(alice);
    assert_eq!(notes.len(), 1);
    assert_eq!(
        decrypt_note(&again, &notes[0]).unwrap(),
        "# Groceries\n- [ ] oat milk"
    );

    let account = env.account(alice);
    assert_eq!(account.note_count, 1);
    assert_eq!(account.storage_bytes, note.ciphertext.len() as u64);
}

#[test]
fn users_cannot_read_or_change_each_others_notes() {
    let env = TestEnv::new();
    let (alice, mallory) = (user(1), user(2));
    let alice_key = env.user_vetkey(alice);
    let mallory_key = env.user_vetkey(mallory);
    assert_ne!(alice_key.serialize(), mallory_key.serialize());

    let note = env.create_note(alice, &alice_key, "salary negotiation notes");

    // Mallory cannot see, fetch, overwrite or delete it...
    assert!(env.list_notes(mallory).is_empty());
    let fetched: Result<Note> = env.query(mallory, "get_note", (note.id.clone(),));
    assert_eq!(fetched, Err(Error::NotFound));
    let overwrite: Result<Note> = env.update(
        mallory,
        "update_note",
        (UpdateNoteArgs {
            id: note.id.clone(),
            ciphertext: ByteBuf::from(vec![0; 64]),
            expires_at: None,
            expected_version: None,
        },),
    );
    assert_eq!(overwrite, Err(Error::NotFound));
    let delete: Result<()> = env.update(mallory, "delete_note", (note.id.clone(),));
    assert_eq!(delete, Err(Error::NotFound));

    // ...and even with the ciphertext in hand, her key does not decrypt it.
    assert!(decrypt_note(&mallory_key, &note).is_err());

    let notes = env.list_notes(alice);
    assert_eq!(
        decrypt_note(&alice_key, &notes[0]).unwrap(),
        "salary negotiation notes"
    );
}

#[test]
fn a_ciphertext_is_bound_to_its_note_id() {
    let env = TestEnv::new();
    let alice = user(1);
    let key = env.user_vetkey(alice);
    let first = env.create_note(alice, &key, "first");
    let second = env.create_note(alice, &key, "second");
    // Moving a ciphertext under another id (what a malicious server could do)
    // makes it fail to decrypt instead of showing the wrong note.
    let swapped = Note {
        id: second.id.clone(),
        ..first
    };
    assert!(decrypt_note(&key, &swapped).is_err());
}

#[test]
fn anonymous_callers_must_sign_in() {
    let env = TestEnv::new();
    let anonymous = Principal::anonymous();

    let list: Result<NotePage> = env.query(anonymous, "list_notes", (ListNotesArgs::default(),));
    assert_eq!(list.unwrap_err(), Error::Unauthenticated);
    let account: Result<Account> = env.query(anonymous, "get_account", ());
    assert_eq!(account.unwrap_err(), Error::Unauthenticated);

    // Update calls are refused by inspect_message or by the method itself.
    for (method, args) in [
        (
            "create_note",
            candid::encode_one(CreateNoteArgs {
                id: random_id().0,
                ciphertext: ByteBuf::from(vec![1]),
                expires_at: None,
            })
            .unwrap(),
        ),
        (
            "get_encrypted_user_key",
            candid::encode_one(ByteBuf::from(vec![0u8; 48])).unwrap(),
        ),
    ] {
        match env.pic.update_call(env.backend, anonymous, method, args) {
            Err(_) => {}
            Ok(bytes) => {
                let reply: Result<candid::Reserved> = candid::decode_one(&bytes).unwrap();
                assert_eq!(reply.unwrap_err(), Error::Unauthenticated, "{method}");
            }
        }
    }
}

#[test]
fn updates_use_optimistic_concurrency() {
    let env = TestEnv::new();
    let alice = user(1);
    let key = env.user_vetkey(alice);
    let note = env.create_note(alice, &key, "v1");
    let id_bytes: [u8; 16] = hex::decode(&note.id).unwrap().try_into().unwrap();

    let update = |text: &str, expected: Option<u64>| -> Result<Note> {
        env.update(
            alice,
            "update_note",
            (UpdateNoteArgs {
                id: note.id.clone(),
                ciphertext: ByteBuf::from(encrypt_note(&key, &id_bytes, text)),
                expires_at: None,
                expected_version: expected,
            },),
        )
    };

    let v2 = update("v2 from laptop", Some(1)).unwrap();
    assert_eq!(v2.version, 2);
    assert!(v2.updated_at >= note.updated_at);
    // The phone still thinks the note is at version 1.
    assert_eq!(
        update("v2 from phone", Some(1)),
        Err(Error::Conflict { current_version: 2 })
    );
    let notes = env.list_notes(alice);
    assert_eq!(decrypt_note(&key, &notes[0]).unwrap(), "v2 from laptop");
    // Without an expected version the write is unconditional.
    assert_eq!(update("v3", None).unwrap().version, 3);
}

#[test]
fn quotas_and_validation_are_enforced() {
    let env = TestEnv::with_args(InitArgs {
        limits: Some(Limits {
            max_notes_per_user: 2,
            max_note_bytes: 200,
            ..Limits::default()
        }),
        ..InitArgs::default()
    });
    let alice = user(1);
    let key = env.user_vetkey(alice);
    env.create_note(alice, &key, "one");
    env.create_note(alice, &key, "two");

    let create = |id: String, bytes: usize| -> Result<Note> {
        env.update(
            alice,
            "create_note",
            (CreateNoteArgs {
                id,
                ciphertext: ByteBuf::from(vec![7u8; bytes]),
                expires_at: None,
            },),
        )
    };
    assert!(matches!(
        create(random_id().0, 10),
        Err(Error::QuotaExceeded(_))
    ));

    let bob = user(2);
    let create_bob = |id: String, bytes: usize| -> Result<Note> {
        env.update(
            bob,
            "create_note",
            (CreateNoteArgs {
                id,
                ciphertext: ByteBuf::from(vec![7u8; bytes]),
                expires_at: None,
            },),
        )
    };
    assert!(matches!(
        create_bob(random_id().0, 201),
        Err(Error::QuotaExceeded(_))
    ));
    assert!(matches!(
        create_bob("not-a-valid-id".into(), 10),
        Err(Error::InvalidArgument(_))
    ));
    assert!(matches!(
        create_bob(random_id().0, 0),
        Err(Error::InvalidArgument(_))
    ));
    let id = random_id().0;
    create_bob(id.clone(), 10).unwrap();
    assert_eq!(create_bob(id, 10), Err(Error::AlreadyExists));
}

#[test]
fn self_destructing_notes_are_deleted_by_the_timer() {
    let env = TestEnv::new();
    let alice = user(1);
    let key = env.user_vetkey(alice);
    let keep = env.create_note(alice, &key, "keep me");

    let (id, bytes) = random_id();
    let expires_at = env.now() + 120 * SEC;
    let note: Result<Note> = env.update(
        alice,
        "create_note",
        (CreateNoteArgs {
            id: id.clone(),
            ciphertext: ByteBuf::from(encrypt_note(&key, &bytes, "burn me")),
            expires_at: Some(expires_at),
        },),
    );
    assert_eq!(note.unwrap().expires_at, Some(expires_at));
    assert_eq!(env.account(alice).note_count, 2);

    // Hidden as soon as it expires...
    env.advance_secs(121);
    let notes = env.list_notes(alice);
    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].id, keep.id);
    let fetched: Result<Note> = env.query(alice, "get_note", (id,));
    assert_eq!(fetched, Err(Error::NotFound));

    // ...and physically deleted by the next cleanup run.
    env.advance_secs(5 * 60);
    assert_eq!(env.stats().notes, 1);
    assert_eq!(env.account(alice).note_count, 1);
}

#[test]
fn deleting_the_account_removes_everything() {
    let env = TestEnv::new();
    let (alice, bob) = (user(1), user(2));
    let alice_key = env.user_vetkey(alice);
    let bob_key = env.user_vetkey(bob);
    let note = env.create_note(alice, &alice_key, "a");
    env.create_note(alice, &alice_key, "b");
    env.create_note(bob, &bob_key, "bob's");
    env.create_share(alice, Some(note.id), "a", 1, 3_600)
        .unwrap();

    let deleted: Result<DeletedAccount> = env.update(alice, "delete_account", ());
    assert_eq!(
        deleted,
        Ok(DeletedAccount {
            notes: 2,
            shares: 1
        })
    );
    assert!(env.list_notes(alice).is_empty());
    assert_eq!(env.account(alice).note_count, 0);
    let stats = env.stats();
    assert_eq!((stats.notes, stats.active_shares, stats.users), (1, 0, 1));
    assert_eq!(env.list_notes(bob).len(), 1);
}

#[test]
fn user_key_requests_are_rate_limited() {
    let env = TestEnv::with_args(InitArgs {
        limits: Some(Limits {
            key_requests_per_user_per_hour: 2,
            ..Limits::default()
        }),
        ..InitArgs::default()
    });
    let alice = user(1);
    env.user_vetkey(alice);
    env.user_vetkey(alice);
    assert!(matches!(
        env.try_user_vetkey(alice),
        Err(Error::RateLimited { retry_after_secs }) if retry_after_secs > 0 && retry_after_secs <= 3_600
    ));
    // Other users have their own budget, and the window resets.
    env.user_vetkey(user(2));
    env.advance_secs(3_600);
    env.user_vetkey(alice);
}

#[test]
fn invalid_transport_keys_are_rejected_without_spending_budget() {
    let env = TestEnv::with_args(InitArgs {
        limits: Some(Limits {
            key_requests_per_user_per_hour: 1,
            ..Limits::default()
        }),
        ..InitArgs::default()
    });
    let alice = user(1);
    let short: Result<EncryptedUserKey> = env.update(
        alice,
        "get_encrypted_user_key",
        (ByteBuf::from(vec![1u8; 47]),),
    );
    assert!(matches!(short, Err(Error::InvalidArgument(_))));
    // 48 bytes that are not a curve point: the management canister rejects it
    // and the canister gives the budget back.
    let bogus: Result<EncryptedUserKey> = env.update(
        alice,
        "get_encrypted_user_key",
        (ByteBuf::from(vec![0xffu8; 48]),),
    );
    assert!(matches!(bogus, Err(Error::VetKd(_))), "{bogus:?}");
    env.user_vetkey(alice);
}
