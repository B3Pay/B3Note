import type { Identity } from "@dfinity/agent"
import type { Principal } from "@dfinity/principal"
import type { UserNote } from "declarations/backend/backend.did"
import { NonNullableProperties } from "helper/utils"
import type { Backend } from "service"
import type { IBECiphertext, TransportSecretKey } from "vetkd-utils"

export type DecryptError = {
  [x: string]: string
}

export interface BackendState {
  backendActor: Backend | null
  canisterId: Principal | null
  notes: UserNote[]
  decryptedNotes: {
    [x: string]: string
  }
  pk_bytes_hex: string | null
  transportSecretKey: TransportSecretKey | null
  ibeCipherText: IBECiphertext | null
  ibeDeserializer: ((arg: Uint8Array) => IBECiphertext) | null
  ibeEncryptor:
    | ((
        derived_public_key_bytes: Uint8Array,
        derivation_id: Uint8Array,
        msg: Uint8Array,
        seed: Uint8Array
      ) => IBECiphertext)
    | null
  encryptedKey: string | null
  publicKey: string | null
  rawKey: Uint8Array | null
  oneTimeKey: string | null
  errors: {
    decryptionError: DecryptError
  }
  initialized: boolean
}

export type BackendStateAfterInitialization =
  NonNullableProperties<BackendState>

export interface InitializeArgs {
  identity?: Identity
}

export interface FetchUserNotesArgs {}

export interface SaveIBEUserNoteArgs {
  note: string
}

export interface SaveGCMUserNoteArgs {
  note: string
}

export interface DecryptGCMNoteArgs {
  encryptedNote: string
}

export interface DecryptIBENoteArgs {
  id: string
  encryptedNote: string
}

export interface SetOneTimeSignatureArgs {
  id: Uint8Array
}

export interface DecryptWithSignatureArgs {
  id: Uint8Array
  signature: string
}

export interface RequestOneTimeKeyArgs {}

export interface GenerateOneTimeKeyArgs {}

export interface DecryptIBEArgs {
  encryptedNote: string
  k_bytes: Uint8Array
}

export interface DisableArgs {}
