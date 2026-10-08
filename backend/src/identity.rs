//! Internet Identity check for the features that cost the canister cycles.
//!
//! vetKD derivations are paid for by this canister, so only Internet Identity
//! accounts may ask for a vetKey or create a share link (whose opens are
//! derivations too). Guests keep their notes private with a key their browser
//! derives from the guest key itself and need neither.
//!
//! An Internet Identity principal is self-authenticating: the SHA-224 hash of
//! a canister-signature public key that Internet Identity signs with. The
//! client sends that DER-encoded key, and the canister checks that it hashes
//! to the caller (who the IC already authenticated) and that its signing
//! canister is Internet Identity.

use candid::Principal;

use crate::types::Error;

/// Internet Identity's canister id, on mainnet and on icp-cli local networks.
pub const INTERNET_IDENTITY: Principal = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 7, 1, 1]);

/// `SEQUENCE { OID 1.3.6.1.4.1.56387.1.2 }`: the canister-signature algorithm.
const CANISTER_SIG_ALGORITHM: [u8; 14] = [
    0x30, 0x0c, 0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x83, 0xb8, 0x43, 0x01, 0x02,
];

/// Longer than any canister-signature key Internet Identity uses.
const MAX_KEY_BYTES: usize = 256;

pub const II_ONLY: &str =
    "this needs an Internet Identity account; guest accounts keep their notes \
                           private without it, but cannot use vetKeys or share links";

/// Splits `TAG LENGTH VALUE rest` (short or one-byte long-form length).
fn der_value(bytes: &[u8], tag: u8) -> Option<(&[u8], &[u8])> {
    let (&found, rest) = bytes.split_first()?;
    if found != tag {
        return None;
    }
    let (&first, rest) = rest.split_first()?;
    let (len, rest) = match first {
        0..=0x7f => (first as usize, rest),
        0x81 => {
            let (&len, rest) = rest.split_first()?;
            (len as usize, rest)
        }
        _ => return None,
    };
    (rest.len() >= len).then(|| rest.split_at(len))
}

/// The signing canister of a DER-encoded canister-signature public key: the
/// bit string holds `len(canister id) || canister id || seed`.
fn signing_canister(der: &[u8]) -> Option<Principal> {
    let (body, trailing) = der_value(der, 0x30)?;
    let (key, trailing_in_body) = der_value(body.strip_prefix(&CANISTER_SIG_ALGORITHM)?, 0x03)?;
    if !trailing.is_empty() || !trailing_in_body.is_empty() {
        return None;
    }
    let ([0, len], key) = key.split_first_chunk::<2>()? else {
        return None;
    };
    Principal::try_from_slice(key.get(..*len as usize)?).ok()
}

/// Checks that `public_key` is the caller's Internet Identity key.
pub fn require_internet_identity(
    caller: Principal,
    public_key: Option<&[u8]>,
) -> Result<(), Error> {
    let forbidden = || Error::Forbidden(II_ONLY.to_string());
    let key = public_key.ok_or_else(forbidden)?;
    if key.len() > MAX_KEY_BYTES || Principal::self_authenticating(key) != caller {
        return Err(Error::Forbidden(
            "internet_identity_key is not the caller's public key".to_string(),
        ));
    }
    match signing_canister(key) {
        Some(canister) if canister == INTERNET_IDENTITY => Ok(()),
        _ => Err(forbidden()),
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    /// A canister-signature public key of `canister` with `seed`.
    pub fn canister_sig_key(canister: Principal, seed: &[u8]) -> Vec<u8> {
        let id = canister.as_slice();
        let mut bits = vec![0, id.len() as u8];
        bits.extend_from_slice(id);
        bits.extend_from_slice(seed);
        let mut body = CANISTER_SIG_ALGORITHM.to_vec();
        body.push(0x03);
        body.push(bits.len() as u8);
        body.extend(bits);
        let mut der = vec![0x30, body.len() as u8];
        der.extend(body);
        der
    }

    #[test]
    fn the_constant_is_internet_identity() {
        assert_eq!(INTERNET_IDENTITY.to_text(), "rdmx6-jaaaa-aaaaa-aaadq-cai");
    }

    #[test]
    fn accepts_the_callers_internet_identity_key() {
        let key = canister_sig_key(INTERNET_IDENTITY, &[7; 32]);
        let caller = Principal::self_authenticating(&key);
        require_internet_identity(caller, Some(&key)).unwrap();
    }

    #[test]
    fn refuses_a_missing_key_or_someone_elses() {
        let key = canister_sig_key(INTERNET_IDENTITY, &[7; 32]);
        let other = Principal::self_authenticating(canister_sig_key(INTERNET_IDENTITY, &[8; 32]));
        assert!(matches!(
            require_internet_identity(other, None),
            Err(Error::Forbidden(_))
        ));
        assert!(matches!(
            require_internet_identity(other, Some(&key)),
            Err(Error::Forbidden(m)) if m.contains("not the caller's")
        ));
    }

    #[test]
    fn refuses_keys_that_are_not_internet_identitys() {
        // Another canister's signature key.
        let other_canister = Principal::from_slice(&[0, 0, 0, 0, 0, 0, 0, 8, 1, 1]);
        // A guest's Ed25519 key.
        let mut ed25519 = vec![
            0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
        ];
        ed25519.extend([9; 32]);
        let mut trailing = canister_sig_key(INTERNET_IDENTITY, &[7; 32]);
        trailing.push(0);
        let mut truncated = canister_sig_key(INTERNET_IDENTITY, &[7; 32]);
        truncated.truncate(20);
        let mut long_id = canister_sig_key(INTERNET_IDENTITY, &[7; 32]);
        long_id[19] = 200; // the canister id length points past the end
        for key in [
            canister_sig_key(other_canister, &[7; 32]),
            ed25519,
            trailing,
            truncated,
            long_id,
            vec![],
        ] {
            let caller = Principal::self_authenticating(&key);
            assert_eq!(
                require_internet_identity(caller, Some(&key)),
                Err(Error::Forbidden(II_ONLY.to_string())),
                "{}",
                hex::encode(&key)
            );
        }
    }
}
