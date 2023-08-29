use ic_bls12_381::{
    hash_to_curve::{ExpandMsgXmd, HashToCurve},
    pairing, G1Affine, G1Projective, G2Affine,
};

const G1AFFINE_BYTES: usize = 48; // Size of compressed form
const G2AFFINE_BYTES: usize = 96; // Size of compressed form

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
    let public_key = deserialize_g2(public_key).unwrap();
    let signature = deserialize_g1(signature).unwrap();
    let hashed_input = augmented_hash_to_g1(&G2Affine::generator(), input);

    Ok(pairing(&signature, &G2Affine::generator()) == pairing(&hashed_input, &public_key))
}
