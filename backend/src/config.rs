use crate::types::{Config, InitArgs, Limits};

pub const DEFAULT_VETKD_KEY_NAME: &str = "key_1";
pub const DEFAULT_LLM_MODEL: &str = "llama3.1:8b";
pub const MAINNET_LLM_CANISTER: &str = "w36hm-eqaaa-aaaal-qr76a-cai";
/// Set by `icp deploy` on every canister of a project that has an `llm` canister.
pub const LLM_CANISTER_ENV: &str = "PUBLIC_CANISTER_ID:llm";

const VALID_KEY_NAMES: [&str; 3] = ["key_1", "test_key_1", "dfx_test_key"];

/// Ceiling for `max_note_bytes`: one note must fit in an ingress message (2 MiB)
/// with room to spare, and a page of `list_notes` must fit in a reply.
const MAX_NOTE_BYTES_CEILING: u32 = 1024 * 1024;

/// Deliberately tight: every vetKD derivation (an Internet Identity user's
/// key, or one share view) costs this canister about 0.026 T cycles on
/// mainnet. Controllers can raise them with `update_config`.
impl Default for Limits {
    fn default() -> Self {
        Self {
            max_notes_per_user: 1_000,
            max_note_bytes: 128 * 1024,
            max_shares_per_user: 20,
            max_share_views: 10,
            max_share_ttl_secs: 30 * 24 * 60 * 60,
            key_requests_per_user_per_hour: 10,
            global_key_requests_per_hour: 100,
            ai_requests_per_user_per_hour: 20,
            global_ai_requests_per_hour: 500,
            max_ai_input_bytes: 8_000,
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            vetkd_key_name: DEFAULT_VETKD_KEY_NAME.to_string(),
            // Off until a controller turns it on: notes sent to the LLM leave
            // the end-to-end encryption.
            ai_enabled: false,
            llm_canister: None,
            llm_model: DEFAULT_LLM_MODEL.to_string(),
            llm_cycles_per_call: 0,
            limits: Limits::default(),
        }
    }
}

impl Config {
    /// Returns a copy of `self` with every field set in `args` replaced.
    pub fn with_args(&self, args: InitArgs) -> Result<Config, String> {
        let mut next = self.clone();
        if let Some(name) = args.vetkd_key_name {
            next.vetkd_key_name = name;
        }
        if let Some(enabled) = args.ai_enabled {
            next.ai_enabled = enabled;
        }
        if let Some(canister) = args.llm_canister {
            next.llm_canister = Some(canister);
        }
        if let Some(model) = args.llm_model {
            next.llm_model = model;
        }
        if let Some(cycles) = args.llm_cycles_per_call {
            next.llm_cycles_per_call = cycles;
        }
        if let Some(limits) = args.limits {
            next.limits = limits;
        }
        next.validate()?;
        Ok(next)
    }

    pub fn validate(&self) -> Result<(), String> {
        if !VALID_KEY_NAMES.contains(&self.vetkd_key_name.as_str()) {
            return Err(format!(
                "unknown vetKD key name `{}` (expected one of {VALID_KEY_NAMES:?})",
                self.vetkd_key_name
            ));
        }
        if self.llm_model.trim().is_empty() || self.llm_model.len() > 64 {
            return Err("llm_model must be 1 to 64 characters".to_string());
        }
        let l = &self.limits;
        if l.max_note_bytes == 0 || l.max_note_bytes > MAX_NOTE_BYTES_CEILING {
            return Err(format!(
                "max_note_bytes must be between 1 and {MAX_NOTE_BYTES_CEILING}"
            ));
        }
        if l.max_share_views == 0 || l.max_share_ttl_secs == 0 {
            return Err("max_share_views and max_share_ttl_secs must be positive".to_string());
        }
        if l.max_ai_input_bytes == 0 || l.max_ai_input_bytes > 64 * 1024 {
            return Err("max_ai_input_bytes must be between 1 and 65536".to_string());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_valid() {
        Config::default().validate().unwrap();
    }

    #[test]
    fn args_override_only_given_fields() {
        let base = Config::default();
        let next = base
            .with_args(InitArgs {
                vetkd_key_name: Some("dfx_test_key".into()),
                ..Default::default()
            })
            .unwrap();
        assert_eq!(next.vetkd_key_name, "dfx_test_key");
        assert_eq!(next.llm_model, base.llm_model);
        assert_eq!(next.limits, base.limits);
    }

    #[test]
    fn rejects_unknown_key_name() {
        let err = Config::default()
            .with_args(InitArgs {
                vetkd_key_name: Some("insecure_test_key".into()),
                ..Default::default()
            })
            .unwrap_err();
        assert!(err.contains("unknown vetKD key name"));
    }

    #[test]
    fn rejects_oversized_notes() {
        let limits = Limits {
            max_note_bytes: MAX_NOTE_BYTES_CEILING + 1,
            ..Limits::default()
        };
        assert!(Config::default()
            .with_args(InitArgs {
                limits: Some(limits),
                ..Default::default()
            })
            .is_err());
    }
}
