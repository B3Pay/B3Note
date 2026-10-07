use crate::types::Error;

/// Note and share ids are 16 random bytes chosen by the client, written as 32
/// lowercase hex characters.
pub type Id = [u8; 16];

pub fn parse_id(text: &str) -> Result<Id, Error> {
    if text.len() != 32
        || !text
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err(Error::InvalidArgument(
            "id must be 32 lowercase hex characters".to_string(),
        ));
    }
    let mut id = [0u8; 16];
    hex::decode_to_slice(text, &mut id)
        .map_err(|e| Error::InvalidArgument(format!("invalid id: {e}")))?;
    Ok(id)
}

pub fn format_id(id: &Id) -> String {
    hex::encode(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trips() {
        let text = "00112233445566778899aabbccddeeff";
        assert_eq!(format_id(&parse_id(text).unwrap()), text);
    }

    #[test]
    fn rejects_bad_ids() {
        for bad in [
            "",
            "00112233445566778899aabbccddeef",
            "00112233445566778899AABBCCDDEEFF",
            "00112233445566778899aabbccddeefg",
            "00112233445566778899aabbccddeeff00",
        ] {
            assert!(parse_id(bad).is_err(), "{bad} should be rejected");
        }
    }
}
