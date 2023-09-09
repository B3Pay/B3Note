import { randomNumber } from "@dfinity/agent"
import { Principal } from "@dfinity/principal"
import { createModel } from "@rematch/core"
import { bigintToBuf } from "bigint-conversion"
import { fetchNotes, getBackendStates } from "contexts/helpers"
import type {
  BackendState,
  DecryptGCMNoteArgs,
  DecryptIBEArgs,
  DecryptIBENoteArgs,
  DecryptWithSignatureArgs,
  DisableArgs,
  FetchUserNotesArgs,
  GenerateOneTimeKeyArgs,
  InitializeArgs,
  RequestOneTimeKeyArgs,
  SaveGCMUserNoteArgs,
  SaveIBEUserNoteArgs,
  SetOneTimeSignatureArgs,
} from "contexts/types/backend"
import { generateSubaccount } from "helper/subaccount"
import { compileError, hex_decode, hex_encode } from "helper/utils"
import { createBackendActor } from "service"
import { RootModel } from "../store"

const state: BackendState = {
  backendActor: null,
  userIdentity: Principal.anonymous(),
  canisterId: null,
  oneTimeKey: null,
  transportSecretKey: null,
  ibeDeserialize: null,
  ibeEncrypt: null,
  rawKey: null,
  notes: [],
  encryptedKey: null,
  verificationKey: null,
  decryptedNotes: {},
  ibeEncryptionKey: null,
  initialized: false,
  loggedIn: false,
  logs: [],
  errors: {
    globalError: null,
    decryptionError: {},
  },
}

const backend = createModel<RootModel>()({
  name: "backend",
  state,
  reducers: {
    INIT: (currentState, newState: Partial<BackendState>) => ({
      ...currentState,
      ...newState,
      initialized: true,
    }),
    LOGIN: (currentState, newState: Partial<BackendState>) => ({
      ...currentState,
      ...newState,
      loggedIn: true,
    }),
    UNSET: () => ({ ...state, backend: null, initialized: false }),
    SET_NOTES: (currentState, notes) => ({ ...currentState, notes }),
    SET_SECRET_KEY: (currentState, transportSecretKey) => ({
      ...currentState,
      transportSecretKey,
    }),
    SET_ERROR: (currentState, error) => ({
      ...currentState,
      errors: {
        ...currentState.errors,
        ...error,
      },
    }),
    SET_LOGS: (currentState, logs) => ({ ...currentState, logs }),
    SET_KEYS: (currentState, rawKey) => ({ ...currentState, rawKey }),
    ADD_DECRYPTED_NOTE: (currentState, decryptedNote) => ({
      ...currentState,
      decryptedNotes: { ...currentState.decryptedNotes, ...decryptedNote },
    }),
  },
  effects: (dispatch) => ({
    initialize: async (args: InitializeArgs, rootState) => {
      if (rootState.backend.initialized) return

      try {
        let { TransportSecretKey, IBECiphertext } = await import("vetkd-utils")

        let seed: Uint8Array
        if (localStorage.getItem("random-seed") !== null) {
          seed = hex_decode(localStorage.getItem("random-seed")!)
        } else {
          seed = window.crypto.getRandomValues(new Uint8Array(32))
          localStorage.setItem("random-seed", hex_encode(seed))
        }

        const transportSecretKey = new TransportSecretKey(seed)
        console.log({ public_key: hex_encode(transportSecretKey.public_key()) })

        const userIdentity =
          args.identity?.getPrincipal() || Principal.anonymous()

        const { backendActor, canisterId } = await createBackendActor(
          args.identity
        )

        const verificationKey =
          await backendActor.symmetric_key_verification_key()

        const ibeEncryptionKey = await backendActor.ibe_encryption_key()

        dispatch.backend.INIT({
          userIdentity,
          canisterId,
          verificationKey,
          ibeEncryptionKey,
          transportSecretKey,
          backendActor,
          ibeDeserialize: (arg) => IBECiphertext.deserialize(arg as Uint8Array),
          ibeEncrypt: (...args) => IBECiphertext.encrypt(...args),
        })
      } catch (e) {
        console.log(e)
        dispatch.backend.SET_ERROR({
          globalError: e,
        })
      }
    },
    login: async () => {
      const {
        backendActor,
        verificationKey,
        canisterId,
        transportSecretKey,
        userIdentity,
      } = getBackendStates()

      try {
        console.log({
          publicKey: hex_encode(transportSecretKey.public_key()),
        })

        const encryptedKey =
          await backendActor.encrypted_symmetric_key_for_caller(
            transportSecretKey.public_key()
          )

        const rawKey = transportSecretKey.decrypt_and_hash(
          encryptedKey as Uint8Array,
          verificationKey as Uint8Array,
          generateSubaccount(userIdentity),
          32,
          new TextEncoder().encode("aes-256-gcm")
        )
        console.log({
          userIdentity,
          canisterId,
          backendActor,
          transportSecretKey,
          rawKey,
          encryptedKey,
          verificationKey,
        })
        dispatch.backend.LOGIN({
          userIdentity,
          canisterId,
          backendActor,
          transportSecretKey,
          rawKey,
          encryptedKey,
          verificationKey,
        })
      } catch (e) {
        console.log(e)

        dispatch.backend.SET_ERROR({
          globalError: e,
        })
      }
    },
    fetch_user_notes: async (args: FetchUserNotesArgs) => {
      const { backendActor, userIdentity, transportSecretKey } =
        getBackendStates()

      const notes = await backendActor.user_notes(
        userIdentity.isAnonymous() ? [transportSecretKey.public_key()] : []
      )
      console.log(notes)

      dispatch.backend.SET_NOTES(notes)
    },
    save_ibe_user_note: async (args: SaveIBEUserNoteArgs) => {
      const {
        backendActor,
        userIdentity,
        transportSecretKey,
        ibeEncryptionKey,
        ibeEncrypt,
      } = getBackendStates()

      const message_encoded = new TextEncoder().encode(args.note)
      const seed = window.crypto.getRandomValues(new Uint8Array(32))

      const ibe_ciphertext = ibeEncrypt(
        ibeEncryptionKey as Uint8Array,
        Principal.anonymous().toUint8Array(),
        message_encoded,
        seed
      )

      await backendActor.save_encrypted_text(
        ibe_ciphertext.serialize(),
        userIdentity.isAnonymous() ? [transportSecretKey.public_key()] : []
      )

      fetchNotes()
    },
    save_gcm_user_note: async (args: SaveGCMUserNoteArgs) => {
      const { rawKey, userIdentity, transportSecretKey, backendActor } =
        getBackendStates()

      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const aes_key = await window.crypto.subtle.importKey(
        "raw",
        rawKey as Uint8Array,
        "AES-GCM",
        false,
        ["encrypt"]
      )
      const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aes_key,
        new TextEncoder().encode(args.note)
      )

      const iv_and_ciphertext = new Uint8Array(
        iv.byteLength + ciphertext.byteLength
      )
      iv_and_ciphertext.set(iv)
      iv_and_ciphertext.set(new Uint8Array(ciphertext), iv.byteLength)

      await backendActor.save_encrypted_text(
        iv_and_ciphertext,
        userIdentity.isAnonymous() ? [transportSecretKey.public_key()] : []
      )

      fetchNotes()
    },
    decrypt_gcm_user_note: async (args: DecryptGCMNoteArgs) => {
      const { rawKey } = getBackendStates()

      const iv_and_ciphertext = hex_decode(args.encryptedNote)
      const iv = iv_and_ciphertext.subarray(0, 12) // 96-bits; unique per message
      const ciphertext = iv_and_ciphertext.subarray(12)
      const aes_key = await window.crypto.subtle.importKey(
        "raw",
        rawKey as Uint8Array,
        "AES-GCM",
        false,
        ["decrypt"]
      )
      let decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        aes_key,
        ciphertext
      )
      new TextDecoder().decode(decrypted)

      console.log({ decrypted })
    },
    decrypt_ibe_user_note: async (args: DecryptIBENoteArgs) => {
      const { backendActor, ibeEncryptionKey, transportSecretKey } =
        getBackendStates()

      console.log({ public_key: transportSecretKey.public_key() })

      const ek_bytes =
        await backendActor.encrypted_ibe_decryption_key_for_caller(
          transportSecretKey.public_key()
        )
      console.log({ ek_bytes: hex_encode(ek_bytes) })

      const k_bytes = transportSecretKey.decrypt(
        ek_bytes as Uint8Array,
        ibeEncryptionKey as Uint8Array,
        Principal.anonymous().toUint8Array()
      )

      console.log({ k_bytes: hex_encode(k_bytes) })

      let note = await dispatch.backend.decrypt_ibe({
        encryptedNote: args.encryptedNote,
        k_bytes,
      })

      console.log({ note })

      dispatch.backend.ADD_DECRYPTED_NOTE({ [args.id.toString()]: note })
    },
    generate_one_time_link: async (args: SetOneTimeSignatureArgs) => {
      const { backendActor, transportSecretKey } = getBackendStates()

      const publicKey = transportSecretKey.public_key()

      const id = BigInt(args.id)

      const input = new Uint8Array(bigintToBuf(id))
      // Sign the id using the TransportSecretKey
      const signature = transportSecretKey.sign(input)

      console.log({ signature: hex_encode(signature), id })

      await backendActor.set_one_time_key(id, publicKey)

      return signature
    },
    decrypt_with_signature: async (args: DecryptWithSignatureArgs) => {
      const {
        backendActor,
        ibeEncryptionKey,
        ibeDeserialize,
        transportSecretKey,
      } = getBackendStates()

      try {
        const id = BigInt(args.id)
        const signature = hex_decode(args.signature)

        const [encryptedNote, ibeDecryptionKey] =
          await backendActor.read_with_one_time_key(
            id,
            signature,
            transportSecretKey.public_key()
          )

        const k_bytes = transportSecretKey.decrypt(
          ibeDecryptionKey as Uint8Array,
          ibeEncryptionKey as Uint8Array,
          Principal.anonymous().toUint8Array()
        )

        const ibe_ciphertext = ibeDeserialize(encryptedNote as Uint8Array)
        const ibe_plaintext = ibe_ciphertext.decrypt(k_bytes)

        let decrypted = new TextDecoder().decode(ibe_plaintext)

        return decrypted
      } catch (e) {
        dispatch.backend.SET_ERROR({
          decryptionError: {
            [args.id.toString()]: compileError(e),
          },
        })
        console.log(e)
      }
    },
    request_one_time_key: async (args: RequestOneTimeKeyArgs) => {
      const { backendActor, ibeEncryptionKey, transportSecretKey } =
        getBackendStates()

      // try {
      //   const ek_bytes_hex =
      //     await backendActor.request_two_factor_authentication(
      //       transportSecretKey.public_key()
      //     )

      //   const verification_key = transportSecretKey.decrypt_and_hash(
      //     hex_decode(ek_bytes_hex),
      //     hex_decode(pk_bytes_hex),
      //     Principal.anonymous().toUint8Array(),
      //     32,
      //     new TextEncoder().encode("aes-256-gcm")
      //   )

      //   console.log({ verification_key: hex_encode(verification_key) })
      // } catch (e) {
      //   console.log(e)
      // }
    },
    generate_one_time_key: async (args: GenerateOneTimeKeyArgs) => {
      const { transportSecretKey } = getBackendStates()

      const generate = () => {
        const randomRandom = randomNumber()

        const code = (randomRandom % 1000000).toString().padStart(6, "0")

        const signature = hex_encode(transportSecretKey.sign(hex_decode(code)))

        console.log({ code, signature })
      }

      const interval = setInterval(generate, 30_000)
      generate()
    },
    decrypt_ibe: async (args: DecryptIBEArgs) => {
      const { ibeDeserialize } = getBackendStates()

      const ibe_ciphertext = ibeDeserialize(hex_decode(args.encryptedNote))
      const ibe_plaintext = ibe_ciphertext.decrypt(args.k_bytes)

      let decrypted = new TextDecoder().decode(ibe_plaintext)

      return decrypted
    },
    fetch_logs: async () => {
      const { backendActor } = getBackendStates()

      const logs = await backendActor.print_log_entries()

      dispatch.backend.SET_LOGS(logs)
    },
    fetch_log_page: async (args: { page: number; pageSize?: number }) => {
      const { backendActor } = getBackendStates()

      const logs = await backendActor.print_log_entries_page(
        BigInt(args.page),
        args.pageSize ? [BigInt(args.pageSize)] : []
      )

      dispatch.backend.SET_LOGS(logs)
    },
    disable: async (args: DisableArgs) => {
      dispatch.backend.UNSET()
    },
  }),
})

export default backend
