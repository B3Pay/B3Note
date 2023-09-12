use b3_utils::memory::types::{BoundedStorable, Storable};
use ciborium::de::from_reader;
use ciborium::ser::into_writer;
use std::io::Cursor;

use super::OneTimeKey;

impl BoundedStorable for OneTimeKey {
    const IS_FIXED_SIZE: bool = false;
    const MAX_SIZE: u32 = 200;
}

impl Storable for OneTimeKey {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        let mut bytes = vec![];
        into_writer(&self, &mut bytes).unwrap();
        std::borrow::Cow::Owned(bytes)
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        from_reader(&mut Cursor::new(&bytes)).unwrap()
    }
}
