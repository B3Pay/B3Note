#!/usr/bin/env bash
# Builds the backend and the mock LLM and hub canisters used by the PocketIC tests.
set -euo pipefail
cd "$(dirname "$0")/.."
cargo build --locked --target wasm32-unknown-unknown --release -p backend -p mock_llm -p mock_hub
ls -lh target/wasm32-unknown-unknown/release/{backend,mock_llm,mock_hub}.wasm
