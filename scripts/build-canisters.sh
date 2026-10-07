#!/usr/bin/env bash
# Builds the backend and the mock LLM canister used by the PocketIC tests.
set -euo pipefail
cd "$(dirname "$0")/.."
cargo build --locked --target wasm32-unknown-unknown --release -p backend -p mock_llm
ls -lh target/wasm32-unknown-unknown/release/{backend,mock_llm}.wasm
