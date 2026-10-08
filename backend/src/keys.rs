//! vetKD: the canister's derived public keys and encrypted key derivation.
//!
//! Two derivation contexts keep the key spaces apart:
//! - `USER_KEY_CONTEXT` with the caller's principal as input: each user's
//!   symmetric note key. Only the user can ask for it.
//! - `SHARE_KEY_CONTEXT` with a share id as input: the IBE decryption key of
//!   one share. Released only to whoever proves they hold the share link.

use ic_cdk_management_canister::{
    vetkd_derive_key, vetkd_public_key, VetKDCurve, VetKDDeriveKeyArgs, VetKDKeyId,
    VetKDPublicKeyArgs,
};
use serde_bytes::ByteBuf;

use crate::state;
use crate::types::{Error, PublicKeys};

pub const USER_KEY_CONTEXT: &[u8] = b"b3note/user-key/v1";
pub const SHARE_KEY_CONTEXT: &[u8] = b"b3note/share/v1";

/// A compressed BLS12-381 G1 point.
pub const TRANSPORT_PUBLIC_KEY_BYTES: usize = 48;

fn key_id(name: String) -> VetKDKeyId {
    VetKDKeyId {
        curve: VetKDCurve::Bls12_381_G2,
        name,
    }
}

async fn fetch_public_key(key_name: &str, context: &[u8]) -> Result<Vec<u8>, Error> {
    vetkd_public_key(&VetKDPublicKeyArgs {
        canister_id: None,
        context: context.to_vec(),
        key_id: key_id(key_name.to_string()),
    })
    .await
    .map(|reply| reply.public_key)
    .map_err(|e| Error::VetKd(format!("vetkd_public_key failed: {e}")))
}

/// Returns the cached public keys, fetching them from the management canister
/// first if needed.
pub async fn ensure_public_keys() -> Result<PublicKeys, Error> {
    if let Some(keys) = state::public_keys() {
        return Ok(keys);
    }
    let key_name = state::config().vetkd_key_name;
    let user_key = fetch_public_key(&key_name, USER_KEY_CONTEXT).await?;
    let share_key = fetch_public_key(&key_name, SHARE_KEY_CONTEXT).await?;
    let keys = PublicKeys {
        user_key: ByteBuf::from(user_key),
        share_key: ByteBuf::from(share_key),
    };
    // The config may have changed while we were waiting.
    if state::config().vetkd_key_name == key_name {
        state::set_public_keys(key_name, keys.clone());
    }
    Ok(keys)
}

pub fn validate_transport_public_key(key: &[u8]) -> Result<(), Error> {
    if key.len() != TRANSPORT_PUBLIC_KEY_BYTES {
        return Err(Error::InvalidArgument(format!(
            "transport public key must be {TRANSPORT_PUBLIC_KEY_BYTES} bytes"
        )));
    }
    Ok(())
}

/// Derives the vetKey for `input` in `context`, encrypted to `transport_public_key`.
pub async fn derive_encrypted_key(
    input: Vec<u8>,
    context: &[u8],
    transport_public_key: Vec<u8>,
) -> Result<Vec<u8>, Error> {
    let key_name = state::config().vetkd_key_name;
    vetkd_derive_key(&VetKDDeriveKeyArgs {
        input,
        context: context.to_vec(),
        transport_public_key,
        key_id: key_id(key_name),
    })
    .await
    .map(|reply| reply.encrypted_key)
    .map_err(|e| Error::VetKd(format!("vetkd_derive_key failed: {e}")))
}
