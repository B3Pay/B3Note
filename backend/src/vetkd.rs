use ic_bls12_381::{
    hash_to_curve::{ExpandMsgXmd, HashToCurve},
    pairing, G1Affine, G1Projective, G2Affine, G2Prepared, G2Projective, Gt, Scalar,
};
use std::array::TryFromSliceError;

use crate::ro::RandomOracle;

const G1AFFINE_BYTES: usize = 48; // Size of compressed form
const G2AFFINE_BYTES: usize = 96; // Size of compressed formconst IBE_SEED_BYTES: usize = 32;
const IBE_SEED_BYTES: usize = 32;

#[derive(Clone, Debug, Eq, PartialEq)]
/// An IBE (identity based encryption) ciphertext
#[cfg_attr(feature = "js", wasm_bindgen)]
pub struct IBECiphertext {
    c1: G2Affine,
    c2: [u8; IBE_SEED_BYTES],
    c3: Vec<u8>,
}

#[cfg_attr(feature = "js", wasm_bindgen)]
impl IBECiphertext {
    /// Serialize this IBE ciphertext
    pub fn serialize(&self) -> Vec<u8> {
        let mut output = Vec::with_capacity(G2AFFINE_BYTES + IBE_SEED_BYTES + self.c3.len());

        output.extend_from_slice(&self.c1.to_compressed());
        output.extend_from_slice(&self.c2);
        output.extend_from_slice(&self.c3);

        output
    }

    /// Deserialize an IBE ciphertext
    ///
    /// Returns Err if the encoding is not valid
    pub fn deserialize(bytes: &[u8]) -> Result<IBECiphertext, String> {
        if bytes.len() < G2AFFINE_BYTES + IBE_SEED_BYTES {
            return Err("IBECiphertext too short to be valid".to_string());
        }

        let c1 = deserialize_g2(&bytes[0..G2AFFINE_BYTES])?;

        let mut c2 = [0u8; IBE_SEED_BYTES];
        c2.copy_from_slice(&bytes[G2AFFINE_BYTES..(G2AFFINE_BYTES + IBE_SEED_BYTES)]);

        let c3 = bytes[G2AFFINE_BYTES + IBE_SEED_BYTES..].to_vec();

        Ok(Self { c1, c2, c3 })
    }

    fn hash_to_mask(seed: &[u8; IBE_SEED_BYTES], msg: &[u8]) -> Scalar {
        let mut ro = RandomOracle::new("ic-crypto-vetkd-bls12-381-ibe-hash-to-mask");
        ro.update_bin(seed);
        ro.update_bin(msg);
        ro.finalize_to_scalar()
    }

    fn mask_seed(seed: &[u8; IBE_SEED_BYTES], t: &Gt) -> [u8; IBE_SEED_BYTES] {
        let mut ro = RandomOracle::new("ic-crypto-vetkd-bls12-381-ibe-mask-seed");
        ro.update_bin(&t.to_bytes());

        let mask = ro.finalize_to_array::<IBE_SEED_BYTES>();
        let mut masked_seed = [0u8; IBE_SEED_BYTES];
        for i in 0..IBE_SEED_BYTES {
            masked_seed[i] = mask[i] ^ seed[i];
        }
        masked_seed
    }

    fn mask_msg(msg: &[u8], seed: &[u8; IBE_SEED_BYTES]) -> Vec<u8> {
        let mut ro = RandomOracle::new("ic-crypto-vetkd-bls12-381-ibe-mask-msg");
        ro.update_bin(seed);

        let mut mask = ro.finalize_to_vec(msg.len());

        for i in 0..msg.len() {
            mask[i] ^= msg[i];
        }

        mask
    }

    /// Encrypt a message using IBE
    ///
    /// The message can be of arbitrary length
    ///
    /// The seed must be exactly 256 bits (32 bytes) long and should be
    /// generated with a cryptographically secure random number generator. Do
    /// not reuse the seed for encrypting another message or any other purpose.
    pub fn encrypt(
        derived_public_key_bytes: &[u8],
        derivation_id: &[u8],
        msg: &[u8],
        seed: &[u8],
    ) -> Result<IBECiphertext, String> {
        let dpk = DerivedPublicKey::deserialize(derived_public_key_bytes)
            .map_err(|e| format!("failed to deserialize public key: {:?}", e))?;

        let seed: &[u8; IBE_SEED_BYTES] = seed
            .try_into()
            .map_err(|_e| format!("Provided seed must be {} bytes long ", IBE_SEED_BYTES))?;

        let t = Self::hash_to_mask(seed, msg);
        let pt = augmented_hash_to_g1(&dpk.point, derivation_id);
        let tsig = ic_bls12_381::pairing(&pt, &dpk.point) * t;

        let c1 = G2Affine::from(G2Affine::generator() * t);
        let c2 = Self::mask_seed(seed, &tsig);
        let c3 = Self::mask_msg(msg, seed);

        Ok(Self { c1, c2, c3 })
    }

    /// Decrypt an IBE ciphertext
    ///
    /// For proper operation k_bytes should be the result of calling
    /// TransportSecretKey::decrypt where the same `derived_public_key_bytes`
    /// and `derivation_id` were used when creating the ciphertext (with
    /// IBECiphertext::encrypt).
    ///
    /// Returns the plaintext, or Err if decryption failed
    pub fn decrypt(&self, k_bytes: &[u8]) -> Result<Vec<u8>, String> {
        let k = deserialize_g1(k_bytes)?;
        let t = ic_bls12_381::pairing(&k, &self.c1);

        let seed = Self::mask_seed(&self.c2, &t);

        let msg = Self::mask_msg(&self.c3, &seed);

        let t = Self::hash_to_mask(&seed, &msg);

        let g_t = G2Affine::from(G2Affine::generator() * t);

        if self.c1 == g_t {
            Ok(msg)
        } else {
            Err("decryption failed".to_string())
        }
    }
}

#[derive(Copy, Clone, Debug)]
/// Error indicating that deserializing an encrypted key failed
pub enum EncryptedKeyDeserializationError {
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
    pub fn deserialize_array(
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

/// A key derivation request
pub fn augmented_hash_to_g2(pk: &G1Affine, data: &[u8]) -> G2Affine {
    let domain_sep = b"BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_AUG_"; // Notice G2 in domain separator

    let mut signature_input = Vec::with_capacity(G1AFFINE_BYTES + data.len());
    signature_input.extend_from_slice(&pk.to_compressed());
    signature_input.extend_from_slice(data);

    let pt = <G2Projective as HashToCurve<ExpandMsgXmd<sha2::Sha256>>>::hash_to_curve(
        signature_input,
        domain_sep,
    );
    G2Affine::from(pt)
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

pub fn verify_pairing(public_key: &[u8], signature: &[u8], input: &[u8]) -> Result<bool, String> {
    // Deserialize the public key from G2 and signature from G1
    let public_key = deserialize_g1(public_key)?;
    let signature = deserialize_g2(signature)?;

    // Hash the input to a point on G2 using the public key in G1
    let hashed_input = augmented_hash_to_g2(&G1Affine::generator(), input);
    // Pairings
    let pairing_check_1 = pairing(&G1Affine::generator(), &signature);
    let pairing_check_2 = pairing(&public_key, &hashed_input);

    // Verify if the pairings are equal
    Ok(pairing_check_1 == pairing_check_2)
}
