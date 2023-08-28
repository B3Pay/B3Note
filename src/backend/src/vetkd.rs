use ic_bls12_381::{
    hash_to_curve::{ExpandMsgXmd, HashToCurve},
    G1Affine, G1Projective, G2Affine, G2Prepared, Gt,
};
use std::array::TryFromSliceError;

const G1AFFINE_BYTES: usize = 48; // Size of compressed form
const G2AFFINE_BYTES: usize = 96; // Size of compressed form

#[derive(Debug)]
/// Error indicating that deserializing an encrypted key failed
enum EncryptedKeyDeserializationError {
    /// Error indicating one or more of the points was invalid
    InvalidEncryptedKey,
}

#[derive(Clone, Debug, Eq, PartialEq)]
/// An encrypted key
pub struct EncryptedKey {
    c1: G1Affine,
    c2: G2Affine,
    c3: G1Affine,
}

impl EncryptedKey {
    /// The length of the serialized encoding of this type
    const BYTES: usize = 2 * G1AFFINE_BYTES + G2AFFINE_BYTES;

    /// Deserializes an encrypted key from a byte vector
    pub fn deserialize(bytes: &[u8]) -> Result<EncryptedKey, String> {
        let ek_bytes: &[u8; Self::BYTES] = bytes.try_into().map_err(|_e: TryFromSliceError| {
            format!("key not {} bytes but {}", Self::BYTES, bytes.len())
        })?;
        Self::deserialize_array(ek_bytes).map_err(|e| format!("{:?}", e))
    }

    /// Deserializes an encrypted key from a byte array
    fn deserialize_array(
        val: &[u8; Self::BYTES],
    ) -> Result<Self, EncryptedKeyDeserializationError> {
        let c2_start = G1AFFINE_BYTES;
        let c3_start = G1AFFINE_BYTES + G2AFFINE_BYTES;

        let c1_bytes: &[u8; G1AFFINE_BYTES] = &val[..c2_start]
            .try_into()
            .map_err(|_e| EncryptedKeyDeserializationError::InvalidEncryptedKey)?;
        let c2_bytes: &[u8; G2AFFINE_BYTES] = &val[c2_start..c3_start]
            .try_into()
            .map_err(|_e| EncryptedKeyDeserializationError::InvalidEncryptedKey)?;
        let c3_bytes: &[u8; G1AFFINE_BYTES] = &val[c3_start..]
            .try_into()
            .map_err(|_e| EncryptedKeyDeserializationError::InvalidEncryptedKey)?;

        let c1 = option_from_ctoption(G1Affine::from_compressed(c1_bytes));
        let c2 = option_from_ctoption(G2Affine::from_compressed(c2_bytes));
        let c3 = option_from_ctoption(G1Affine::from_compressed(c3_bytes));

        match (c1, c2, c3) {
            (Some(c1), Some(c2), Some(c3)) => Ok(Self { c1, c2, c3 }),
            (_, _, _) => Err(EncryptedKeyDeserializationError::InvalidEncryptedKey),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
/// A derived public key
pub struct DerivedPublicKey {
    pub point: G2Affine,
}

impl From<DerivedPublicKey> for G2Affine {
    fn from(public_key: DerivedPublicKey) -> Self {
        public_key.point
    }
}

#[derive(Copy, Clone, Debug)]
/// Error indicating deserializing a derived public key failed
pub enum DerivedPublicKeyDeserializationError {
    /// The public key was invalid
    InvalidPublicKey,
}

impl DerivedPublicKey {
    const BYTES: usize = G2AFFINE_BYTES;

    /// Deserialize a derived public key
    pub fn deserialize(bytes: &[u8]) -> Result<Self, DerivedPublicKeyDeserializationError> {
        let dpk_bytes: &[u8; Self::BYTES] = bytes.try_into().map_err(|_e: TryFromSliceError| {
            DerivedPublicKeyDeserializationError::InvalidPublicKey
        })?;
        let dpk = option_from_ctoption(G2Affine::from_compressed(dpk_bytes))
            .ok_or(DerivedPublicKeyDeserializationError::InvalidPublicKey)?;
        Ok(Self { point: dpk })
    }

    /// Serialize this derived public key
    pub fn serialize(&self) -> [u8; Self::BYTES] {
        self.point.to_compressed()
    }
}

pub fn augmented_hash_to_g1(pk: &G2Affine, data: &[u8]) -> G1Affine {
    let domain_sep = b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_AUG_";

    let mut signature_input = Vec::with_capacity(G2AFFINE_BYTES + data.len());
    signature_input.extend_from_slice(&pk.to_compressed());
    signature_input.extend_from_slice(data);

    let pt = <G1Projective as HashToCurve<ExpandMsgXmd<sha2::Sha256>>>::hash_to_curve(
        signature_input,
        domain_sep,
    );
    G1Affine::from(pt)
}

pub fn augmented_hash_from_g1_to_g1(pk: &G1Affine, data: &[u8]) -> G1Affine {
    // Adjust the domain separator to indicate that you're using G1
    let domain_sep = b"BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_AUG_";

    // Prepare the input for the hash-to-curve function
    let mut signature_input = Vec::with_capacity(G1AFFINE_BYTES + data.len());
    signature_input.extend_from_slice(&pk.to_compressed());
    signature_input.extend_from_slice(data);

    // Hash to G1
    let pt = <G1Projective as HashToCurve<ExpandMsgXmd<sha2::Sha256>>>::hash_to_curve(
        signature_input,
        domain_sep,
    );

    G1Affine::from(pt)
}

fn gt_multipairing(terms: &[(&G1Affine, &G2Prepared)]) -> Gt {
    ic_bls12_381::multi_miller_loop(terms).final_exponentiation()
}

fn option_from_ctoption<T>(ctoption: subtle::CtOption<T>) -> Option<T> {
    if bool::from(ctoption.is_some()) {
        Some(ctoption.unwrap())
    } else {
        None
    }
}

pub fn deserialize_g1(bytes: &[u8]) -> Result<G1Affine, String> {
    let bytes: &[u8; G1AFFINE_BYTES] = bytes
        .try_into()
        .map_err(|_| "Invalid length for G1".to_string())?;

    let pt = G1Affine::from_compressed(bytes);
    if bool::from(pt.is_some()) {
        Ok(pt.unwrap())
    } else {
        Err("Invalid G1 elliptic curve point".to_string())
    }
}

pub fn deserialize_g2(bytes: &[u8]) -> Result<G2Affine, String> {
    let bytes: &[u8; G2AFFINE_BYTES] = bytes
        .try_into()
        .map_err(|_| "Invalid length for G2".to_string())?;

    let pt = G2Affine::from_compressed(bytes);
    if bool::from(pt.is_some()) {
        Ok(pt.unwrap())
    } else {
        Err("Invalid G2 elliptic curve point".to_string())
    }
}
