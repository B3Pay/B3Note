use b3_utils::NanoTimeStamp;
use candid::CandidType;
use serde::{Deserialize, Serialize};

mod store;
pub use store::*;

mod stable;
pub use stable::*;

use crate::{constants::ONE_TIME_KEY_EXPIRATION, types::PublicKey};

#[derive(Default, Debug, Serialize, Clone, CandidType, Deserialize)]
pub struct OneTimeKey {
    expiration: NanoTimeStamp,
    public_key: Vec<u8>,
}

impl OneTimeKey {
    pub fn new(public_key: PublicKey) -> Self {
        let public_key = public_key.to_vec();

        Self {
            expiration: NanoTimeStamp::now().add_secs(ONE_TIME_KEY_EXPIRATION),
            public_key,
        }
    }

    pub fn is_expired(&self) -> bool {
        self.expiration.has_passed()
    }

    pub fn public_key(&self) -> &[u8] {
        &self.public_key
    }
}
