import { randomNumber } from "@dfinity/agent"
import { Principal } from "@dfinity/principal"
import { createModel } from "@rematch/core"
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
  ibeDeserializer: null,
  ibeEncryptor: null,
  rawKey: null,
  notes: [],
  encryptedKey: null,
  publicKey: null,
  decryptedNotes: {},
  pk_bytes_hex: null,
  initialized: false,
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
    SET_KEYS: (currentState, rawKey) => ({ ...currentState, rawKey }),
    ADD_DECRYPTED_NOTE: (currentState, decryptedNote) => ({
      ...currentState,
      decryptedNotes: { ...currentState.decryptedNotes, ...decryptedNote },
    }),
  },
  effects: (dispatch) => ({
    initialize: async (args: InitializeArgs, rootState) => {
      if (rootState.backend.initialized) return

      const userIdentity =
        args.identity?.getPrincipal() || Principal.anonymous()

      const { backendActor, canisterId } = await createBackendActor(
        args.identity
      )

      try {
        await import("vetkd-utils").then(
          async ({ TransportSecretKey, IBECiphertext }) => {
            const seed = window.crypto.getRandomValues(new Uint8Array(32))
            const transportSecretKey = new TransportSecretKey(seed)
            console.log({
              publicKey: hex_encode(transportSecretKey.public_key()),
            })

            const encryptedKey =
              await backendActor.encrypted_symmetric_key_for_caller(
                transportSecretKey.public_key()
              )

            const publicKey =
              await backendActor.symmetric_key_verification_key()

            const pk_bytes_hex = await backendActor.ibe_encryption_key()
            const rawKey = transportSecretKey.decrypt_and_hash(
              hex_decode(encryptedKey),
              hex_decode(publicKey),
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
              pk_bytes_hex,
              publicKey,
            })
            dispatch.backend.INIT({
              userIdentity,
              canisterId,
              backendActor,
              transportSecretKey,
              ibeDeserializer: (arg) => IBECiphertext.deserialize(arg),
              ibeEncryptor: (...args) => IBECiphertext.encrypt(...args),
              rawKey,
              encryptedKey,
              pk_bytes_hex,
              publicKey,
            })
          }
        )
      } catch (e) {
        console.log(e)

        dispatch.backend.SET_ERROR({
          globalError: e,
        })
      }
    },
    fetch_user_notes: async (args: FetchUserNotesArgs) => {
      const { backendActor } = getBackendStates()

      const notes = await backendActor.user_notes()
      console.log(notes)

      dispatch.backend.SET_NOTES(notes)
    },
    save_ibe_user_note: async (args: SaveIBEUserNoteArgs) => {
      const { backendActor, pk_bytes_hex, ibeEncryptor } = getBackendStates()

      const message_encoded = new TextEncoder().encode(args.note)
      const seed = window.crypto.getRandomValues(new Uint8Array(32))

      const ibe_ciphertext = ibeEncryptor(
        hex_decode(pk_bytes_hex),
        Principal.anonymous().toUint8Array(),
        message_encoded,
        seed
      )

      let result = hex_encode(ibe_ciphertext.serialize())
      console.log(result)
      await backendActor.save_encrypted_text(result)

      fetchNotes()
    },
    save_gcm_user_note: async (args: SaveGCMUserNoteArgs) => {
      const { rawKey, backendActor } = getBackendStates()

      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const aes_key = await window.crypto.subtle.importKey(
        "raw",
        rawKey,
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
      let result = hex_encode(iv_and_ciphertext)

      console.log({ encryptedNote: result })

      await backendActor.save_encrypted_text(result)

      fetchNotes()
    },
    decrypt_gcm_user_note: async (args: DecryptGCMNoteArgs) => {
      const { rawKey } = getBackendStates()

      const iv_and_ciphertext = hex_decode(args.encryptedNote)
      const iv = iv_and_ciphertext.subarray(0, 12) // 96-bits; unique per message
      const ciphertext = iv_and_ciphertext.subarray(12)
      const aes_key = await window.crypto.subtle.importKey(
        "raw",
        rawKey,
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
      const { backendActor, pk_bytes_hex, transportSecretKey } =
        getBackendStates()

      console.log({ public_key: hex_encode(transportSecretKey.public_key()) })

      const ek_bytes_hex =
        await backendActor.encrypted_ibe_decryption_key_for_caller(
          transportSecretKey.public_key()
        )

      const k_bytes = transportSecretKey.decrypt(
        hex_decode(ek_bytes_hex),
        hex_decode(pk_bytes_hex),
        Principal.anonymous().toUint8Array()
      )

      let note = await dispatch.backend.decrypt_ibe({
        encryptedNote: args.encryptedNote,
        k_bytes,
      })

      dispatch.backend.ADD_DECRYPTED_NOTE({ [args.id]: note })
    },
    generate_one_time_link: async (args: SetOneTimeSignatureArgs) => {
      const { backendActor, transportSecretKey } = getBackendStates()

      const publicKey = hex_encode(transportSecretKey.public_key())

      console.log({ publicKey })

      // Sign the id using the TransportSecretKey
      const signature = transportSecretKey.sign(args.id)

      console.log({ signature: hex_encode(signature), id: hex_encode(args.id) })

      await backendActor.set_one_time_key(args.id, publicKey)

      return signature
    },
    decrypt_with_signature: async (args: DecryptWithSignatureArgs) => {
      const {
        backendActor,
        pk_bytes_hex,
        ibeDeserializer,
        transportSecretKey,
      } = getBackendStates()

      try {
        const [encryptedNote, ek_bytes_hex] =
          await backendActor.read_with_one_time_key(
            args.id,
            args.signature,
            hex_encode(transportSecretKey.public_key())
          )

        const k_bytes = transportSecretKey.decrypt(
          hex_decode(ek_bytes_hex),
          hex_decode(pk_bytes_hex),
          Principal.anonymous().toUint8Array()
        )

        const ibe_ciphertext = ibeDeserializer(hex_decode(encryptedNote))
        const ibe_plaintext = ibe_ciphertext.decrypt(k_bytes)

        let decrypted = new TextDecoder().decode(ibe_plaintext)

        return decrypted
      } catch (e) {
        dispatch.backend.SET_ERROR({
          decryptionError: {
            [hex_encode(args.id)]: compileError(e),
          },
        })
        console.log(e)
      }
    },
    request_one_time_key: async (args: RequestOneTimeKeyArgs) => {
      const { backendActor, pk_bytes_hex, transportSecretKey } =
        getBackendStates()

      try {
        const ek_bytes_hex =
          await backendActor.request_two_factor_authentication(
            transportSecretKey.public_key()
          )

        const verification_key = transportSecretKey.decrypt_and_hash(
          hex_decode(ek_bytes_hex),
          hex_decode(pk_bytes_hex),
          Principal.anonymous().toUint8Array(),
          32,
          new TextEncoder().encode("aes-256-gcm")
        )

        console.log({ verification_key: hex_encode(verification_key) })
      } catch (e) {
        console.log(e)
      }
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
      const { ibeDeserializer } = getBackendStates()

      const ibe_ciphertext = ibeDeserializer(hex_decode(args.encryptedNote))
      const ibe_plaintext = ibe_ciphertext.decrypt(args.k_bytes)

      let decrypted = new TextDecoder().decode(ibe_plaintext)

      return decrypted
    },
    disable: async (args: DisableArgs) => {
      dispatch.backend.UNSET()
    },
  }),
})

export default backend
