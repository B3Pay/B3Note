//! Burn-after-reading share links: IBE encryption, the signed-link witness,
//! view counting, expiry and revocation.

mod common;

use backend::types::*;
use candid::Principal;
use common::*;

#[test]
fn a_one_time_link_reveals_the_note_once() {
    let env = TestEnv::new();
    let alice = user(1);
    let (id, link_key) = env
        .create_share(alice, None, "the wifi password is hunter2", 1, 3_600)
        .unwrap();

    // Before opening, a reader only learns what the link page shows.
    let info = env.share_info(&id).unwrap();
    assert_eq!(info.views_left, 1);
    assert!(info.expires_at > env.now());

    // Any reader, signed in or not, can open it with the link's key.
    let (plaintext, opened) = env
        .open_share(Principal::anonymous(), &id, &link_key)
        .unwrap();
    assert_eq!(plaintext, "the wifi password is hunter2");
    assert_eq!(opened.views_left, 0);

    // After that the ciphertext is gone and the link is dead.
    assert_eq!(env.share_info(&id), Err(Error::NotFound));
    assert_eq!(
        env.open_share(user(9), &id, &link_key).unwrap_err(),
        Error::NotFound
    );
    assert_eq!(env.stats().active_shares, 0);
    assert_eq!(env.account(alice).share_count, 0);
}

#[test]
fn opening_requires_the_link_secret() {
    let env = TestEnv::new();
    let (id, link_key) = env.create_share(user(1), None, "secret", 1, 3_600).unwrap();

    // Knowing the share id is not enough: the signature must come from the
    // key in the link fragment.
    let guessed_key = ed25519_dalek::SigningKey::from_bytes(&[42; 32]);
    let err = env
        .open_share(Principal::anonymous(), &id, &guessed_key)
        .unwrap_err();
    assert!(matches!(err, Error::Forbidden(_)), "{err:?}");
    assert_eq!(env.share_info(&id).unwrap().views_left, 1);

    let (plaintext, _) = env.open_share(user(2), &id, &link_key).unwrap();
    assert_eq!(plaintext, "secret");
}

#[test]
fn multi_view_links_count_views_and_refuse_replays() {
    let env = TestEnv::new();
    let (id, link_key) = env.create_share(user(1), None, "agenda", 2, 3_600).unwrap();

    let tsk = transport_key();
    let (_, first) = env.open_share_with(user(2), &id, &link_key, &tsk).unwrap();
    assert_eq!(first.views_left, 1);

    // Replaying the same signed request (same transport key) cannot burn
    // another view.
    let replay = env
        .open_share_with(user(3), &id, &link_key, &tsk)
        .unwrap_err();
    assert!(matches!(replay, Error::Forbidden(_)), "{replay:?}");
    assert_eq!(env.share_info(&id).unwrap().views_left, 1);

    let (plaintext, last) = env.open_share(user(4), &id, &link_key).unwrap();
    assert_eq!(plaintext, "agenda");
    assert_eq!(last.views_left, 0);
    assert_eq!(env.share_info(&id), Err(Error::NotFound));
}

#[test]
fn links_expire_and_are_collected() {
    let env = TestEnv::new();
    let (id, link_key) = env.create_share(user(1), None, "soon gone", 3, 60).unwrap();

    env.advance_secs(61);
    assert_eq!(env.share_info(&id), Err(Error::Expired));
    assert_eq!(
        env.open_share(user(2), &id, &link_key).unwrap_err(),
        Error::Expired
    );
    assert!(env
        .query::<Result<Vec<ShareInfo>>, _>(user(1), "list_shares", ())
        .unwrap()
        .is_empty());

    env.advance_secs(5 * 60);
    assert_eq!(env.share_info(&id), Err(Error::NotFound));
    assert_eq!(env.stats().active_shares, 0);
    assert_eq!(env.account(user(1)).share_count, 0);
}

#[test]
fn owners_list_and_revoke_their_links() {
    let env = TestEnv::new();
    let (alice, bob) = (user(1), user(2));
    let (first, _) = env.create_share(alice, None, "one", 1, 3_600).unwrap();
    let (second, link_key) = env.create_share(alice, None, "two", 5, 7_200).unwrap();

    let mut listed: Vec<String> = env
        .query::<Result<Vec<ShareInfo>>, _>(alice, "list_shares", ())
        .unwrap()
        .into_iter()
        .map(|share| share.id)
        .collect();
    listed.sort();
    let mut expected = vec![first.clone(), second.clone()];
    expected.sort();
    assert_eq!(listed, expected);
    assert!(env
        .query::<Result<Vec<ShareInfo>>, _>(bob, "list_shares", ())
        .unwrap()
        .is_empty());

    let not_yours: Result<()> = env.update(bob, "revoke_share", (second.clone(),));
    assert_eq!(not_yours, Err(Error::NotFound));
    let revoked: Result<()> = env.update(alice, "revoke_share", (second.clone(),));
    assert_eq!(revoked, Ok(()));
    assert_eq!(
        env.open_share(bob, &second, &link_key).unwrap_err(),
        Error::NotFound
    );
    assert_eq!(env.account(alice).share_count, 1);
}

#[test]
fn deleting_a_note_revokes_its_links() {
    let env = TestEnv::new();
    let alice = user(1);
    let key = env.user_vetkey(alice);
    let note = env.create_note(alice, &key, "draft");
    let (linked, _) = env
        .create_share(alice, Some(note.id.clone()), "draft", 1, 3_600)
        .unwrap();
    let (unlinked, _) = env.create_share(alice, None, "other", 1, 3_600).unwrap();

    let deleted: Result<()> = env.update(alice, "delete_note", (note.id,));
    assert_eq!(deleted, Ok(()));
    assert_eq!(env.share_info(&linked), Err(Error::NotFound));
    assert!(env.share_info(&unlinked).is_ok());
}

#[test]
fn share_arguments_and_quotas_are_checked() {
    let env = TestEnv::with_args(InitArgs {
        limits: Some(Limits {
            max_shares_per_user: 1,
            max_share_views: 3,
            max_share_ttl_secs: 3_600,
            ..Limits::default()
        }),
        ..InitArgs::default()
    });
    let alice = user(1);
    assert!(matches!(
        env.create_share(alice, None, "x", 4, 600),
        Err(Error::InvalidArgument(_))
    ));
    assert!(matches!(
        env.create_share(alice, None, "x", 1, 3_601),
        Err(Error::InvalidArgument(_))
    ));
    // A share cannot claim to come from someone else's note.
    let bob = user(2);
    let bob_note = env.create_note(bob, &env.user_vetkey(bob), "bob");
    assert_eq!(
        env.create_share(alice, Some(bob_note.id), "x", 1, 600)
            .unwrap_err(),
        Error::NotFound
    );
    env.create_share(alice, None, "x", 3, 600).unwrap();
    assert!(matches!(
        env.create_share(alice, None, "y", 1, 600),
        Err(Error::QuotaExceeded(_))
    ));
    let anonymous = env.pic.update_call(
        env.backend,
        Principal::anonymous(),
        "create_share",
        candid::encode_one(CreateShareArgs {
            id: random_id().0,
            note_id: None,
            ciphertext: serde_bytes::ByteBuf::from(vec![1]),
            verifying_key: serde_bytes::ByteBuf::from(vec![0; 32]),
            max_views: 1,
            expires_in_secs: 600,
            internet_identity_key: None,
        })
        .unwrap(),
    );
    assert!(anonymous.is_err(), "anonymous callers cannot create shares");
}

#[test]
fn share_opens_are_rate_limited_globally() {
    let env = TestEnv::with_args(InitArgs {
        limits: Some(Limits {
            global_key_requests_per_hour: 1,
            ..Limits::default()
        }),
        ..InitArgs::default()
    });
    let (first, first_key) = env.create_share(user(1), None, "a", 1, 3_600).unwrap();
    let (second, second_key) = env.create_share(user(1), None, "b", 1, 3_600).unwrap();
    env.open_share(Principal::anonymous(), &first, &first_key)
        .unwrap();
    let limited = env
        .open_share(Principal::anonymous(), &second, &second_key)
        .unwrap_err();
    assert!(matches!(limited, Error::RateLimited { .. }), "{limited:?}");
    // The refused open did not burn the link.
    assert_eq!(env.share_info(&second).unwrap().views_left, 1);
}
