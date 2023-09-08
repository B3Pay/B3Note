import type { Identity } from "@dfinity/agent"
import type { Principal } from "@dfinity/principal"
import type { UserData } from "declarations/backend/backend.did"
import { NonNullableProperties } from "helper/utils"
import type { Backend } from "service"
import type { IBECiphertext, TransportSecretKey } from "vetkd-utils"

export type DecryptError = {
  [x: string]: string
}

export interface BackendState {
  backendActor: Backend | null
  canisterId: Principal | null
  userIdentity: Principal
  notes: UserData[]
  decryptedNotes: {
    [x: string]: string
  }
  ibe_encryption_key: Uint8Array | number[] | null
  transportSecretKey: TransportSecretKey | null
  ibeDeserializer: ((arg: Uint8Array) => IBECiphertext) | null
  ibeEncryptor:
    | ((
        derived_public_key_bytes: Uint8Array,
        derivation_id: Uint8Array,
        msg: Uint8Array,
        seed: Uint8Array
      ) => IBECiphertext)
    | null
  encryptedKey: Uint8Array | number[] | null
  verificationKey: Uint8Array | number[] | null
  rawKey: Uint8Array | number[] | null
  oneTimeKey: Uint8Array | number[] | null
  errors: {
    globalError: Error | null
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
  id: bigint
}

export interface DecryptWithSignatureArgs {
  id: string
  signature: string
}

export interface RequestOneTimeKeyArgs {}

export interface GenerateOneTimeKeyArgs {}

export interface DecryptIBEArgs {
  encryptedNote: string
  k_bytes: Uint8Array
}

export interface DisableArgs {}
