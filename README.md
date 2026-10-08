# B3Note

![B3Note](./frontend/public/logo-long.svg)

**Private notes on the Internet Computer.** Notes are encrypted in your browser, so the canister only ever
stores ciphertext. With Internet Identity the key is derived from your identity by the IC's
[vetKeys](https://internetcomputer.org/docs/building-apps/network-features/vetkeys/introduction); as a
guest it is derived from your guest key. Internet Identity users can also share a note through a link
that **burns after reading**.

## Features

- **End-to-end encrypted notes.** Markdown with checklists, tags, pinning, search, autosave and
  conflict detection across devices.
- **Self-destructing notes.** Give a note a timer and the canister deletes it when it runs out.
- **Burn-after-reading links** (Internet Identity accounts). Share a snapshot that can be opened once
  (or up to N times) before it expires. After the last view the ciphertext is deleted. Nobody can decrypt
  it again, even someone who holds the link and an old copy of the ciphertext, because only the canister
  can request the share's key, and it does so once per view. Readers do not need to sign in.
- **Sign in your way.** Use Internet Identity, or a *guest key*: a private key kept in your browser, with a
  recovery key you can save and import on another device.
- **Optional AI assistant** on the IC's [LLM canister](https://github.com/dfinity/llm), **off by
  default**: summarize, suggest a title or tags, improve the writing, translate, and ask questions
  across your notes. Text sent to it leaves the end-to-end encryption, so a controller has to switch it on
  (`ai_enabled`); until then the app shows no AI features. When on, nothing is sent until you choose an
  action, and the app asks for consent first.
- **Your data stays yours.** Export to JSON or Markdown, import Markdown files, and delete your account.

## How the encryption works

```
            browser                                     backend canister                vetKD (IC)
 ┌──────────────────────────────┐   get_encrypted_user_key(tpk)  ┌──────────────┐   vetkd_derive_key
 │ transport key pair (tsk, tpk)│ ─────────────────────────────▶ │ input =      │ ───────────────────▶
 │                              │ ◀───────────────────────────── │ caller       │ ◀─── key encrypted
 │ decrypt + verify the vetKey  │   encrypted vetKey + public key│ principal    │      to tpk
 │ → AES-GCM key (non-extract.) │                                └──────────────┘
 │ encrypt(note, AD = note id)  │ ── create_note(ciphertext) ──▶ stores ciphertext only
 └──────────────────────────────┘
```

- **Notes (Internet Identity).** Each user's vetKey is derived from their principal (context
  `b3note/user-key/v1`). Only that principal can request it, and it reaches the browser encrypted to a
  one-time transport key. The browser verifies it, turns it into a non-extractable AES-GCM key (cached in
  IndexedDB) and encrypts each note with the note id as associated data. A server that swaps ciphertexts
  between notes therefore gets a decryption error, not the wrong note.
- **Notes (guests).** A guest key is already a secret only its holder has, so the browser derives the
  note key from it (HKDF-SHA-256, salt `b3note/guest-key/v1`, info = the canister id) and encrypts the
  same way. It costs the canister nothing, and the recovery key restores it on any device.
- **Who gets vetKD.** Every derivation costs the canister cycles, so `get_encrypted_user_key` and
  `create_share` are for Internet Identity accounts only. The client sends the root public key of its
  delegation chain; the canister checks that it hashes to the caller's principal and that it is a
  canister-signature key of Internet Identity (`rdmx6-jaaaa-aaaaa-aaadq-cai`). Opening a share needs no
  account, and is bounded by the share's views and the global hourly budget.
- **Key pinning.** On mainnet the app derives the canister's vetKD public keys from the IC's published
  master key and refuses keys that do not match.
- **Share links.** The browser IBE-encrypts a snapshot to the identity *share id* under the canister's
  share key (context `b3note/share/v1`). It also makes a fresh Ed25519 key, uploads the public half, and
  puts the secret in the link's `#fragment`, which browsers never send to a server. To open, the reader
  signs `(domain, share id, transport key)`. The canister checks the signature, spends a view, and has the
  share key derived and encrypted to the reader. A transport key can be used once per share, so a
  replayed request cannot burn another view.
- **AI (when switched on).** The assistant needs plaintext. Only the text you pick for an action (or,
  for *Ask your notes*, the few notes your browser ranks as relevant) goes to the LLM canister.
  Everything else stays encrypted.

What the canister does see: note sizes, timestamps, versions and expiry times, the number of notes, and
which principal owns them.

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
scripts/            build-canisters.sh, test-backend.sh
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
PocketIC with the backend and a mock LLM, `POCKET_IC_BIN` must point to a PocketIC 16 server, Node
22.18 or later), then `pnpm dev` in another terminal. Sign in as a guest; Internet Identity is not
installed there, so share links need an icp-cli network.

### The frontend on ic-reactor 4

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

### AI locally

The assistant is off by default. A local network also has no LLM canister: deploy DFINITY's LLM canister
with [Ollama](https://ollama.com) (see the `ic-llm` examples), or any canister that implements `v1_chat`,
then switch it on:

```bash
icp canister call backend update_config '(record { ai_enabled = opt true; llm_canister = opt principal "<id>" })'
```

(`pnpm dev:pocketic` installs a mock LLM and switches the assistant on.)

When a canister named `llm` is part of the project, `icp deploy` injects `PUBLIC_CANISTER_ID:llm` and the
backend uses it automatically.

## Deploying to mainnet

```bash
icp deploy -e production
```

The `production` environment uses the vetKD key `key_1`, keeps the AI assistant off and sets strict
limits (`icp.yaml`). The frontend reads the backend's id from the asset canister's `ic_env` cookie on
`*.icp0.io`. To serve it from a custom domain, build with `CANISTER_ID_BACKEND=<id>` set so the id is
baked into the bundle.

Operating notes:

- vetKD derivations cost about 0.026 T cycles each on `key_1`. The app derives one key per Internet
  Identity user per browser (then caches it), plus one per share view; guests cost nothing. Production
  allows 5 derivations per user and 20 in total per hour, so the worst case is about 0.5 T an hour.
  Raise the limits as real use grows.
- Controllers can change limits, models and the AI switch at runtime. `limits` replaces the whole
  record:

  ```bash
  icp canister call backend get_config '()' -e production
  icp canister call backend update_config '(record { ai_enabled = opt true; llm_model = opt "llama4-scout" })' -e production
  ```

- The LLM's free models need no cycles. Set `llm_cycles_per_call` for paid models.

- **Upgrading from B3Note v1:** v2 has a new stable-memory layout, so install it as a new canister or
  reinstall; an in-place upgrade cannot read v1's state. v1 notes cannot be migrated: they were
  encrypted with keys from an insecure demo vetKD canister (see below). `scripts/migrate-mainnet.sh`
  reinstalls v1's mainnet canisters with v2, keeping their IDs and URL, without taking a snapshot
  (there is no way back to v1). Run it with an identity that controls them:

  ```bash
  ./scripts/migrate-mainnet.sh preflight          # read-only: identity, controllers, cycles (≥ 1 T)
  ./scripts/migrate-mainnet.sh migrate            # reinstalls backend + frontend with v2, then verifies
  ./scripts/migrate-mainnet.sh retire-system-api  # deletes v1's insecure vetKD canister, recovering its cycles
  ```

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

## What v2 fixes

B3Note v1 had security and correctness problems serious enough that v2 is a rewrite:

- **Notes were not private.** v1 used DFINITY's *unsafe example* vetKD system-API canister, whose master
  secret key is in its source. It also encrypted every note to the anonymous principal's identity and
  gave that decryption key to any anonymous caller, while `encrypted_texts()` returned everyone's
  ciphertext.
- **Anyone could overwrite any note.** `edit_encrypted_text` never checked ownership.
- **Internet Identity users could not read their notes.** They were encrypted to one identity and
  decrypted with another. Signing in also replaced the user's record and lost their note list, and share
  links never worked for them.
- **Writes were silently dropped.** Updates to stable-map entries were made on copies and never written
  back, so the "3 tries" limit on links never applied. Writes inside query methods were discarded.
- **Cleanup stopped after upgrades.** Timers were not rescheduled. Expired anonymous users left their
  ciphertext behind forever, and `add_simple_note` let anyone grow an unbounded heap map.
- **Other defects:** fixed-size storable bounds that trapped on larger values, an off-by-one note limit,
  an un-awaited `fetchRootKey`, a hard-coded host, and an empty LICENSE file.

v2 uses the IC's native vetKD, ic-cdk 0.20, ic-stable-structures 0.7, icp-cli, ic-reactor 4 (beta) and
`@icp-sdk/*`.

## License

[MIT](./LICENSE)
