//! Install arguments, upgrades and stable state.

mod common;

use backend::types::*;
use candid::{encode_one, Principal};
use common::*;
use pocket_ic::PocketIcBuilder;

#[test]
fn state_survives_an_upgrade() {
    let env = TestEnv::new();
    let alice = user(1);
    let key = env.user_vetkey(alice);
    let note = env.create_note(alice, &key, "before the upgrade");
    let (share, link_key) = env.create_share(alice, None, "shared", 2, 3_600).unwrap();
    let keys_before = env.public_keys();

    env.upgrade(None).unwrap();

    // Notes, shares, counters and cached keys are all still there.
    let notes = env.list_notes(alice);
    assert_eq!(notes, vec![note]);
    assert_eq!(decrypt_note(&env.user_vetkey(alice), &notes[0]).unwrap(), "before the upgrade");
    let cached: Result<PublicKeys> = env.query(Principal::anonymous(), "get_public_keys", ());
    assert_eq!(cached.unwrap(), keys_before);
    assert_eq!(env.account(alice).note_count, 1);
    let (plaintext, opened) = env.open_share(user(2), &share, &link_key).unwrap();
    assert_eq!((plaintext.as_str(), opened.views_left), ("shared", 1));

    // The cleanup timer is registered again after the upgrade.
    env.advance_secs(3_600 + 5 * 60);
    assert_eq!(env.share_info(&share), Err(Error::NotFound));
    assert_eq!(env.stats().active_shares, 0);
}

#[test]
fn upgrade_arguments_change_only_what_they_name() {
    let env = TestEnv::new();
    env.upgrade(Some(InitArgs {
        llm_model: Some("llama4-scout".into()),
        ..InitArgs::default()
    }))
    .unwrap();
    let config: Config = env.query(Principal::anonymous(), "get_config", ());
    assert_eq!(config.llm_model, "llama4-scout");
    assert_eq!(config.vetkd_key_name, VETKD_KEY);
    assert_eq!(config.llm_canister, Some(env.llm));
    assert_eq!(config.limits, Limits::default());
}

#[test]
fn invalid_install_arguments_are_refused() {
    let env = TestEnv::new();
    let refused = env.upgrade(Some(InitArgs {
        vetkd_key_name: Some("my_own_insecure_key".into()),
        ..InitArgs::default()
    }));
    assert!(refused.is_err());
    // The failed upgrade left the canister running the old configuration.
    let config: Config = env.query(Principal::anonymous(), "get_config", ());
    assert_eq!(config.vetkd_key_name, VETKD_KEY);
}

#[test]
fn works_with_the_local_development_key() {
    // `icp network start` has a subnet with `test_key_1` and `dfx_test_key`.
    let pic = PocketIcBuilder::new()
        .with_test_threshold_keys_subnet()
        .with_application_subnet()
        .build();
    let controller = Principal::self_authenticating(b"controller");
    let app_subnet = pic.topology().get_app_subnets()[0];
    let backend = pic.create_canister_on_subnet(Some(controller), None, app_subnet);
    pic.add_cycles(backend, 100_000_000_000_000);
    pic.install_canister(
        backend,
        backend_wasm(),
        encode_one(Some(InitArgs {
            vetkd_key_name: Some("dfx_test_key".into()),
            ..InitArgs::default()
        }))
        .unwrap(),
        Some(controller),
    );
    let tsk = transport_key();
    let bytes = pic
        .update_call(
            backend,
            user(1),
            "get_encrypted_user_key",
            encode_one(serde_bytes::ByteBuf::from(tsk.public_key())).unwrap(),
        )
        .unwrap();
    let reply: Result<EncryptedUserKey> = candid::decode_one(&bytes).unwrap();
    let reply = reply.unwrap();
    let expected = ic_vetkeys::MasterPublicKey::for_pocketic_key(&key_id("dfx_test_key"))
        .unwrap()
        .derive_canister_key(backend.as_slice())
        .derive_sub_key(backend::USER_KEY_CONTEXT);
    let dpk = ic_vetkeys::DerivedPublicKey::deserialize(&reply.verification_key).unwrap();
    assert_eq!(dpk, expected);
    ic_vetkeys::EncryptedVetKey::deserialize(&reply.encrypted_key)
        .unwrap()
        .decrypt_and_verify(&tsk, &dpk, user(1).as_slice())
        .unwrap();
}

#[test]
fn public_stats_and_whoami() {
    let env = TestEnv::new();
    let alice = user(1);
    let me: Principal = env.query(alice, "whoami", ());
    assert_eq!(me, alice);
    env.create_note(alice, &env.user_vetkey(alice), "x");
    let stats = env.stats();
    assert_eq!(stats.version, "2.0.0");
    assert_eq!((stats.users, stats.notes, stats.active_shares), (1, 1, 0));
    assert_eq!(stats.vetkd_key_name, VETKD_KEY);
    assert!(stats.cycles > 0);
}
