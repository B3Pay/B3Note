import type { Principal } from "@icp-sdk/core/principal"
import type { ActorMethod } from "@icp-sdk/core/agent"
import type { IDL } from "@icp-sdk/core/candid"

export interface Account {
  principal: Principal
  share_count: number
  ai_enabled: boolean
  created_at: bigint
  note_count: number
  storage_bytes: bigint
  ai_model: string
  limits: Limits
}
export interface AiRequest {
  task: AiTask
  text: string
}
export interface AiResponse {
  model: string
  text: string
}
/**
 * What the AI assistant should do with the text.
 */
export type AiTask =
  | {
      /**
       * Answer a question using the text (the user's notes) as context.
       */
      Ask: string
    }
  | {
      /**
       * More text in the same style.
       */
      Continue: null
    }
  | {
      /**
       * Spelling and grammar only.
       */
      FixGrammar: null
    }
  | {
      /**
       * Clearer, better structured wording.
       */
      Improve: null
    }
  | {
      /**
       * A shorter version.
       */
      Shorten: null
    }
  | {
      /**
       * A markdown checklist of the action items.
       */
      ActionItems: null
    }
  | {
      /**
       * A title of a few words.
       */
      SuggestTitle: null
    }
  | {
      /**
       * A translation into the named language.
       */
      Translate: string
    }
  | {
      /**
       * Comma-separated topic tags.
       */
      SuggestTags: null
    }
  | {
      /**
       * A short summary.
       */
      Summarize: null
    }
/**
 * The canister configuration.
 */
export interface Config {
  ai_enabled: boolean
  /**
   * Cycles attached to each LLM call (0 for the free models).
   */
  llm_cycles_per_call: bigint
  llm_model: string
  /**
   * The LLM canister. `None` resolves `PUBLIC_CANISTER_ID:llm` (set by
   * `icp deploy`) and falls back to the mainnet LLM canister.
   */
  llm_canister: [] | [Principal]
  limits: Limits
  /**
   * Name of the vetKD master key: `key_1` on mainnet, `test_key_1` or
   * `dfx_test_key` on a local network.
   */
  vetkd_key_name: string
}
export interface CreateNoteArgs {
  id: string
  ciphertext: Uint8Array | number[]
  expires_at: [] | [bigint]
}
export interface CreateShareArgs {
  /**
   * 32 lowercase hex characters (16 random bytes chosen by the client).
   */
  id: string
  /**
   * Ed25519 public key (32 bytes) whose secret key travels in the link.
   */
  verifying_key: Uint8Array | number[]
  /**
   * IBE ciphertext for the identity `id`, under `PublicKeys.share_key`.
   */
  ciphertext: Uint8Array | number[]
  max_views: number
  /**
   * The note this share was created from, so deleting it revokes the share.
   */
  note_id: [] | [string]
  expires_in_secs: bigint
}
export interface DeletedAccount {
  shares: number
  notes: number
}
/**
 * The owner's encrypted vetKey and the public key to verify it with.
 */
export interface EncryptedUserKey {
  encrypted_key: Uint8Array | number[]
  verification_key: Uint8Array | number[]
}
/**
 * Errors returned by every fallible endpoint.
 */
export type Error =
  | {
      /**
       * The call to the LLM canister failed.
       */
      Ai: string
    }
  | {
      /**
       * The share link has no views left.
       */
      Exhausted: null
    }
  | {
      /**
       * The public keys have not been fetched from the management canister yet.
       */
      NotReady: null
    }
  | { NotFound: null }
  | { AlreadyExists: null }
  | {
      /**
       * Too many requests; retry after the given number of seconds.
       */
      RateLimited: { retry_after_secs: bigint }
    }
  | {
      /**
       * AI features are disabled on this deployment.
       */
      AiDisabled: null
    }
  | { InvalidArgument: string }
  | {
      /**
       * A call to the vetKD system API failed.
       */
      VetKd: string
    }
  | {
      /**
       * The caller is not allowed to perform this action.
       */
      Forbidden: string
    }
  | {
      /**
       * The share link or note has expired.
       */
      Expired: null
    }
  | {
      /**
       * A per-user or global quota would be exceeded.
       */
      QuotaExceeded: string
    }
  | {
      /**
       * The caller must sign in (anonymous callers are not allowed here).
       */
      Unauthenticated: null
    }
  | {
      /**
       * The note changed since the caller last read it.
       */
      Conflict: { current_version: bigint }
    }
/**
 * Install and upgrade arguments. Every field is optional; `None` keeps the
 * current (or default) value.
 */
export interface InitArgs {
  ai_enabled: [] | [boolean]
  llm_cycles_per_call: [] | [bigint]
  llm_model: [] | [string]
  llm_canister: [] | [Principal]
  limits: [] | [Limits]
  vetkd_key_name: [] | [string]
}
/**
 * Hard limits enforced by the canister. Controllers can change them.
 */
export interface Limits {
  /**
   * Maximum size of one encrypted note, in bytes.
   */
  max_note_bytes: number
  /**
   * vetKD derivations (user key + share opens) one principal may request per hour.
   */
  key_requests_per_user_per_hour: number
  ai_requests_per_user_per_hour: number
  /**
   * vetKD derivations the whole canister may request per hour (protects its cycles).
   */
  global_key_requests_per_hour: number
  max_share_ttl_secs: bigint
  max_share_views: number
  max_notes_per_user: number
  /**
   * Maximum number of UTF-8 bytes sent to the LLM in one request.
   */
  max_ai_input_bytes: number
  max_shares_per_user: number
  global_ai_requests_per_hour: number
}
export interface ListNotesArgs {
  /**
   * Return notes whose id sorts after this one.
   */
  cursor: [] | [string]
  limit: [] | [number]
}
/**
 * An encrypted note as stored by the canister.
 */
export interface Note {
  /**
   * 32 lowercase hex characters (16 random bytes chosen by the client).
   */
  id: string
  updated_at: bigint
  /**
   * AES-GCM ciphertext produced with the owner's vetKey-derived key.
   */
  ciphertext: Uint8Array | number[]
  created_at: bigint
  /**
   * Incremented on every update, for optimistic concurrency control.
   */
  version: bigint
  /**
   * The note deletes itself at this time (nanoseconds since the epoch).
   */
  expires_at: [] | [bigint]
}
export interface NotePage {
  notes: Array<Note>
  next_cursor: [] | [string]
}
export interface OpenShareArgs {
  id: string
  /**
   * Ed25519 signature over `SHARE_OPEN_DOMAIN || id bytes || transport_public_key`.
   */
  signature: Uint8Array | number[]
  /**
   * A fresh BLS12-381 G1 transport public key (48 bytes).
   */
  transport_public_key: Uint8Array | number[]
}
export interface OpenedShare {
  views_left: number
  /**
   * The vetKey for the share id, encrypted to the transport public key.
   */
  encrypted_key: Uint8Array | number[]
  ciphertext: Uint8Array | number[]
  verification_key: Uint8Array | number[]
  expires_at: bigint
}
/**
 * Derived public keys of this canister.
 */
export interface PublicKeys {
  /**
   * Verifies users' vetKeys (input: the user's principal).
   */
  user_key: Uint8Array | number[]
  /**
   * IBE-encrypts share payloads (identity: the share id).
   */
  share_key: Uint8Array | number[]
}
/**
 * What anyone holding a share id may learn before opening it.
 */
export interface PublicShareInfo {
  views_left: number
  size: number
  created_at: bigint
  expires_at: bigint
}
export type Result = { Ok: AiResponse } | { Err: Error }
export type Result_1 = { Ok: Note } | { Err: Error }
export type Result_10 = { Ok: Array<ShareInfo> } | { Err: Error }
export type Result_11 = { Ok: OpenedShare } | { Err: Error }
export type Result_12 = { Ok: Config } | { Err: Error }
export type Result_2 = { Ok: ShareInfo } | { Err: Error }
export type Result_3 = { Ok: DeletedAccount } | { Err: Error }
export type Result_4 = { Ok: null } | { Err: Error }
export type Result_5 = { Ok: Account } | { Err: Error }
export type Result_6 = { Ok: EncryptedUserKey } | { Err: Error }
export type Result_7 = { Ok: PublicKeys } | { Err: Error }
export type Result_8 = { Ok: PublicShareInfo } | { Err: Error }
export type Result_9 = { Ok: NotePage } | { Err: Error }
/**
 * A share as its owner sees it.
 */
export interface ShareInfo {
  id: string
  views_left: number
  max_views: number
  size: number
  note_id: [] | [string]
  created_at: bigint
  expires_at: bigint
}
export interface Stats {
  ai_enabled: boolean
  active_shares: bigint
  version: string
  cycles: bigint
  notes: bigint
  users: bigint
  ai_model: string
  vetkd_key_name: string
}
export interface UpdateNoteArgs {
  id: string
  ciphertext: Uint8Array | number[]
  /**
   * Replaces the note's expiry (`None` removes it).
   */
  expires_at: [] | [bigint]
  /**
   * Reject the update with `Conflict` unless the note is at this version.
   */
  expected_version: [] | [bigint]
}
export interface _SERVICE {
  /**
   * Runs one writing-assistant task on text the user chose to send.
   */
  ai_assist: ActorMethod<[AiRequest], Result>
  create_note: ActorMethod<[CreateNoteArgs], Result_1>
  create_share: ActorMethod<[CreateShareArgs], Result_2>
  /**
   * Deletes every note and share of the caller.
   */
  delete_account: ActorMethod<[], Result_3>
  /**
   * Deletes a note and revokes the share links made from it.
   */
  delete_note: ActorMethod<[string], Result_4>
  get_account: ActorMethod<[], Result_5>
  get_config: ActorMethod<[], Config>
  /**
   * The caller's vetKey, encrypted to `transport_public_key`, and the public
   * key that verifies it. The vetKey's input is the caller's principal.
   */
  get_encrypted_user_key: ActorMethod<[Uint8Array | number[]], Result_6>
  get_note: ActorMethod<[string], Result_1>
  /**
   * The derived public keys, once the canister has fetched them.
   */
  get_public_keys: ActorMethod<[], Result_7>
  /**
   * What a link holder sees before deciding to open (and burn) a share.
   */
  get_share: ActorMethod<[string], Result_8>
  get_stats: ActorMethod<[], Stats>
  list_notes: ActorMethod<[ListNotesArgs], Result_9>
  list_shares: ActorMethod<[], Result_10>
  /**
   * Like `get_public_keys`, but fetches the keys if they are not cached yet.
   */
  load_public_keys: ActorMethod<[], Result_7>
  /**
   * Spends one view of a share and returns its ciphertext with the share's
   * vetKey encrypted to the reader's transport key. Anyone holding the link
   * may call this; signing in is not required.
   */
  open_share: ActorMethod<[OpenShareArgs], Result_11>
  revoke_share: ActorMethod<[string], Result_4>
  /**
   * Changes the configuration. Controllers only.
   */
  update_config: ActorMethod<[InitArgs], Result_12>
  update_note: ActorMethod<[UpdateNoteArgs], Result_1>
  whoami: ActorMethod<[], Principal>
}
export declare const idlFactory: IDL.InterfaceFactory
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[]
