#!/usr/bin/env bash
# Runs the backend unit tests and the PocketIC integration tests.
#
# The pocket-ic crate downloads a matching PocketIC server on first use; set
# POCKET_IC_BIN to use one you already have.
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/build-canisters.sh
cargo test --locked -p backend
cargo test --locked -p integration_tests
