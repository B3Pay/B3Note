---
title: How B3Note keeps your notes private
description: Notes are encrypted in your browser before they are sent, so the canister only ever stores ciphertext. With Internet Identity the key is derived from your…
editUrl: https://github.com/B3Pay/B3Note/edit/main/docs/how-it-works.md
---

Notes are encrypted in your browser before they are sent, so the canister only ever stores ciphertext.
With Internet Identity the key is derived from your identity by the IC's
[vetKeys](https://internetcomputer.org/docs/building-apps/network-features/vetkeys/introduction); as a
guest it is derived from your guest key. This page describes each part.

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
- **On-device AI.** The model reads the note in the browser that decrypted it. The only network traffic
  is the model's files on first use (Hugging Face and the MLC model library on GitHub), which is why the
  page's CSP allows those hosts and `'wasm-unsafe-eval'` for the model's WebAssembly. Both are pinned to a
  commit, and WebLLM checks the model's config, its tokenizer and its WebAssembly library against hashes
  before it runs them (`frontend/src/lib/localAi.ts`), so a push to either repository cannot change the
  code that reads your notes.
- **No remote images.** Fetching an image sends its URL to its host, so a note's Markdown or an AI answer
  (which a prompt hidden in a note could steer) could carry text out that way, and an image in a shared
  note would tell its sender when it was opened. Markdown shows images as links instead, and the CSP's
  `img-src` allows only the app itself.
- **AI on the canister (when switched on).** The assistant needs plaintext. Only the text you pick for an action (or,
  for *Ask your notes*, the few notes your browser ranks as relevant) goes to the LLM canister.
  Everything else stays encrypted.

## What the canister sees

What the canister does see: note sizes, timestamps, versions and expiry times, the number of notes, and
which principal owns them.
