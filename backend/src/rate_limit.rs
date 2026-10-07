//! Hourly request budgets for the calls that cost the canister cycles
//! (vetKD derivations and LLM requests).
//!
//! Counters live on the heap: an upgrade resets them, which is harmless.

use std::cell::RefCell;
use std::collections::BTreeMap;

use candid::Principal;

use crate::types::Error;

const WINDOW_NANOS: u64 = 3_600 * 1_000_000_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Action {
    VetKey,
    Ai,
}

#[derive(Clone, Copy, Debug)]
struct Window {
    start: u64,
    count: u32,
}

impl Window {
    fn current(self, now: u64) -> Window {
        if now.saturating_sub(self.start) >= WINDOW_NANOS {
            Window {
                start: now,
                count: 0,
            }
        } else {
            self
        }
    }

    fn retry_after_secs(&self, now: u64) -> u64 {
        let reset = self.start.saturating_add(WINDOW_NANOS);
        reset.saturating_sub(now).div_ceil(1_000_000_000).max(1)
    }
}

#[derive(Default)]
pub struct RateLimiter {
    global: BTreeMap<Action, Window>,
    per_user: BTreeMap<(Action, Principal), Window>,
}

impl RateLimiter {
    /// Consumes one unit of `action` for `caller`, or explains when to retry.
    /// `user_limit` of `None` skips the per-user budget (anonymous readers of a
    /// share all share one principal, so only the global budget applies).
    pub fn check_and_consume(
        &mut self,
        action: Action,
        caller: Principal,
        user_limit: Option<u32>,
        global_limit: u32,
        now: u64,
    ) -> Result<(), Error> {
        let fresh = Window {
            start: now,
            count: 0,
        };
        let global = self
            .global
            .get(&action)
            .copied()
            .unwrap_or(fresh)
            .current(now);
        if global.count >= global_limit {
            return Err(Error::RateLimited {
                retry_after_secs: global.retry_after_secs(now),
            });
        }
        let user = match user_limit {
            Some(limit) => {
                let window = self
                    .per_user
                    .get(&(action, caller))
                    .copied()
                    .unwrap_or(fresh)
                    .current(now);
                if window.count >= limit {
                    return Err(Error::RateLimited {
                        retry_after_secs: window.retry_after_secs(now),
                    });
                }
                Some(window)
            }
            None => None,
        };
        self.global.insert(
            action,
            Window {
                count: global.count + 1,
                ..global
            },
        );
        if let Some(window) = user {
            self.per_user.insert(
                (action, caller),
                Window {
                    count: window.count + 1,
                    ..window
                },
            );
        }
        Ok(())
    }

    /// Gives back a unit consumed by a call that then failed.
    pub fn refund(&mut self, action: Action, caller: Principal, per_user: bool) {
        if let Some(window) = self.global.get_mut(&action) {
            window.count = window.count.saturating_sub(1);
        }
        if per_user {
            if let Some(window) = self.per_user.get_mut(&(action, caller)) {
                window.count = window.count.saturating_sub(1);
            }
        }
    }

    /// Drops windows that have ended, so the map does not grow without bound.
    pub fn prune(&mut self, now: u64) {
        self.per_user
            .retain(|_, window| now.saturating_sub(window.start) < WINDOW_NANOS);
    }

    #[cfg(test)]
    pub fn tracked_users(&self) -> usize {
        self.per_user.len()
    }
}

thread_local! {
    pub static LIMITER: RefCell<RateLimiter> = RefCell::new(RateLimiter::default());
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOUR: u64 = WINDOW_NANOS;

    fn alice() -> Principal {
        Principal::from_slice(&[1; 29])
    }

    fn bob() -> Principal {
        Principal::from_slice(&[2; 29])
    }

    #[test]
    fn enforces_per_user_budget() {
        let mut limiter = RateLimiter::default();
        for _ in 0..3 {
            limiter
                .check_and_consume(Action::Ai, alice(), Some(3), 100, 0)
                .unwrap();
        }
        let err = limiter
            .check_and_consume(Action::Ai, alice(), Some(3), 100, 10 * 1_000_000_000)
            .unwrap_err();
        assert_eq!(
            err,
            Error::RateLimited {
                retry_after_secs: 3_590
            }
        );
        // Another user and another action are unaffected.
        limiter
            .check_and_consume(Action::Ai, bob(), Some(3), 100, 0)
            .unwrap();
        limiter
            .check_and_consume(Action::VetKey, alice(), Some(3), 100, 0)
            .unwrap();
    }

    #[test]
    fn enforces_global_budget() {
        let mut limiter = RateLimiter::default();
        limiter
            .check_and_consume(Action::VetKey, alice(), None, 2, 0)
            .unwrap();
        limiter
            .check_and_consume(Action::VetKey, bob(), None, 2, 0)
            .unwrap();
        assert!(limiter
            .check_and_consume(Action::VetKey, alice(), Some(10), 2, 0)
            .is_err());
    }

    #[test]
    fn window_resets_after_an_hour() {
        let mut limiter = RateLimiter::default();
        limiter
            .check_and_consume(Action::Ai, alice(), Some(1), 10, 0)
            .unwrap();
        assert!(limiter
            .check_and_consume(Action::Ai, alice(), Some(1), 10, HOUR - 1)
            .is_err());
        limiter
            .check_and_consume(Action::Ai, alice(), Some(1), 10, HOUR)
            .unwrap();
    }

    #[test]
    fn refund_returns_the_unit() {
        let mut limiter = RateLimiter::default();
        limiter
            .check_and_consume(Action::Ai, alice(), Some(1), 10, 0)
            .unwrap();
        limiter.refund(Action::Ai, alice(), true);
        limiter
            .check_and_consume(Action::Ai, alice(), Some(1), 10, 0)
            .unwrap();
    }

    #[test]
    fn prune_drops_finished_windows() {
        let mut limiter = RateLimiter::default();
        limiter
            .check_and_consume(Action::Ai, alice(), Some(1), 10, 0)
            .unwrap();
        limiter.prune(HOUR / 2);
        assert_eq!(limiter.tracked_users(), 1);
        limiter.prune(HOUR);
        assert_eq!(limiter.tracked_users(), 0);
    }
}
