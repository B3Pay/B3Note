# Developing B3Note

## Repository layout

```
backend/            Rust canister (ic-cdk 0.20, ic-stable-structures 0.7, vetKD, ic-llm)
  backend.did       Candid interface (checked by a unit test, see below)
mock_llm/           Test double of the LLM canister's v1_chat endpoint
integration_tests/  PocketIC tests with real vetKD (keys verified with the ic-vetkeys crate)
frontend/           Vite + React 19 + Tailwind v4 app on ic-reactor 4 (beta) and @icp-sdk/*
  src/canisters/    Generated from backend.did by @ic-reactor/vite-plugin (candid-core)
  src/reactor.ts    The ic-reactor client, its sign-in, and the backend handle
  src/lib/          Crypto (vault, share links, key pinning), note format, search, sign-in
  tests/            Test-client tests and the PicJS suite against the real canister
icp.yaml            icp-cli project: backend, frontend, local network with Internet Identity
scripts/            build-canisters.sh, test-backend.sh, migrate-mainnet.sh
docs/               How it works, development, operations, v2
```

## Getting started

Prerequisites: Rust with the `wasm32-unknown-unknown` target, Node.js 22 with pnpm, and
[icp-cli](https://cli.internetcomputer.org) with `ic-wasm`
(`npm i -g @icp-sdk/icp-cli @icp-sdk/ic-wasm`).

```bash
rustup target add wasm32-unknown-unknown
icp network start -d   # a local network with Internet Identity and the vetKD test keys
icp deploy             # builds and deploys backend + frontend
```

Open the `frontend` URL that `icp deploy` prints. For hot reload, run `pnpm dev` in `frontend/`. The
ic-reactor Vite plugin reads canister ids and the root key from the local network.

**Without icp-cli** (UI work only): `./scripts/build-canisters.sh`, then `pnpm dev:pocketic` (starts
PocketIC with the backend and a mock LLM, `POCKET_IC_BIN` must point to a PocketIC 16 server binary named
`pocket-ic`, Node 22.18 or later), then `pnpm dev` in another terminal. Sign in as a guest; Internet Identity is not
installed there, so share links need an icp-cli network.

## The frontend on ic-reactor 4

- `src/canisters/backend.ts` is generated from `backend/backend.did` (the Vite plugin runs
  `candid-core-cli gen` on start and on every `.did` change). It exports the `actor` schema, `type Actor`
  and a type per Candid declaration: `opt T` is `T | null`, variants are `{ tag, value }`, blobs are
  `Uint8Array`. CI fails if the committed file does not match the `.did`.
- `src/reactor.ts` creates the tab's client (`createClient({ network: "env", auth })`), which
  `ReactorProvider` borrows. Components call `useQuery(client.queryOptions(backend, "list_shares"))` and
  `useMutation(client.mutationOptions(backend, "create_note"))`; other code calls the backend directly
  (`await backend.get_config()`). A `Result` is unwrapped: an `Err` rejects with a `canister_err`
  `ReactorError` whose `err` is the typed `Error` variant.
- `src/lib/sessionAuth.ts` is the app's sign-in: one `AuthLike` over Internet Identity and the guest key,
  so `useAuth()`, query keys and the agent all follow whichever is active.
- Share links are opened with a separate anonymous client (`createReaderClient`), so a signed-in reader's
  principal is not tied to the share, and the signed-out app client, which refuses updates, is not needed.

## AI locally

The assistant is off by default. A local network also has no LLM canister: deploy DFINITY's LLM canister
with [Ollama](https://ollama.com) (see the `ic-llm` examples), or any canister that implements `v1_chat`,
then switch it on:

```bash
icp canister call backend update_config '(record { ai_enabled = opt true; llm_canister = opt principal "<id>" })'
```

(`pnpm dev:pocketic` installs a mock LLM and switches the assistant on.)

When a canister named `llm` is part of the project, `icp deploy` injects `PUBLIC_CANISTER_ID:llm` and the
backend uses it automatically.

## Testing

```bash
./scripts/test-backend.sh                # Rust unit tests + PocketIC integration tests
cd frontend && pnpm test                 # unit, component and fake-replica tests (vitest)
cd frontend && pnpm test:pic             # the frontend's crypto + data layer vs. the real canister
```

- **Backend unit tests** cover quotas, rate limits, share burning and replay, expiry, config
  validation, the Internet Identity key check, AI prompt building, and a check that `backend.did` matches the code
  (`UPDATE_CANDID=1 cargo test -p backend` regenerates it).
- **PocketIC tests** (`integration_tests/`) run the real wasm with real vetKD. They decrypt and verify
  keys with the `ic-vetkeys` crate and check the canister's public keys against PocketIC's master keys.
  They also cover access control (guests get no vetKey or share links), optimistic concurrency,
  self-destruct timers, burn-after-reading, replay protection, rate limits, upgrades, install args and the
  AI endpoint with a mock LLM canister.
- **Frontend tests** run the real crypto against a fake vetKD with a known master key, the data layer
  and sign-in on ic-reactor's test client (a real client over a fake replica, with mocked canisters),
  and (`test:pic`) the browser code and ic-reactor clients against the real canister in PocketIC, for
  guests and for Internet Identity users.

The pocket-ic crate downloads its server automatically; set `POCKET_IC_BIN` to use your own (16.x). CI
runs all of the above (`.github/workflows/ci.yml`).
