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
import { hex_decode, hex_encode } from "helper/utils"
import { createBackendActor } from "service"
import { IBECiphertext, TransportSecretKey } from "vetkd-utils"
import { RootModel } from "../store"

const state: BackendState = {
  backendActor: null,
  canisterId: null,
  oneTimeKey: null,
  secretKey: null,
  rawKey: null,
  notes: [],
  encryptedKey: null,
  publicKey: null,
  decryptedNotes: {},
  initialized: false,
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
    SET_SECRET_KEY: (currentState, secretKey) => ({
      ...currentState,
      secretKey,
    }),
    SET_KEYS: (currentState, rawKey) => ({ ...currentState, rawKey }),
    SET_DECRYPTED_NOTES: (currentState, decryptedNotes) => ({
      ...currentState,
      decryptedNotes,
    }),
  },
  effects: (dispatch) => ({
    initialize: async (args: InitializeArgs, rootState) => {
      if (rootState.backend.initialized) return

      let { backendActor, canisterId } = await createBackendActor(args.identity)

      const seed = window.crypto.getRandomValues(new Uint8Array(32))
      const tsk = new TransportSecretKey(seed)

      const encryptedKey =
        await backendActor.encrypted_symmetric_key_for_caller(tsk.public_key())

      const publicKey = await backendActor.symmetric_key_verification_key()

      const rawKey = tsk.decrypt_and_hash(
        hex_decode(encryptedKey),
        hex_decode(publicKey),
        Principal.anonymous().toUint8Array(),
        32,
        new TextEncoder().encode("aes-256-gcm")
      )

      dispatch.backend.INIT({
        backendActor,
        canisterId,
        rawKey,
        encryptedKey,
        publicKey,
      })
    },
    fetch_user_notes: async (args: FetchUserNotesArgs) => {
      const { backendActor } = getBackendStates()

      const notes = await backendActor.user_notes()
      console.log(notes)

      dispatch.backend.SET_NOTES(notes)
    },
    save_ibe_user_note: async (args: SaveIBEUserNoteArgs) => {
      const { backendActor } = getBackendStates()

      const pk_bytes_hex = await backendActor.ibe_encryption_key()

      const message_encoded = new TextEncoder().encode(args.note)
      const seed = window.crypto.getRandomValues(new Uint8Array(32))

      const ibe_ciphertext = IBECiphertext.encrypt(
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
    decrypt_gcm_note: async (args: DecryptGCMNoteArgs) => {
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
    decrypt_ibe_note: async (args: DecryptIBENoteArgs) => {
      const { backendActor } = getBackendStates() //TODO: Save the key with one call

      const seed = window.crypto.getRandomValues(new Uint8Array(32))

      const tsk = new TransportSecretKey(seed)

      console.log({ public_key: hex_encode(tsk.public_key()) })

      const ek_bytes_hex =
        await backendActor.encrypted_ibe_decryption_key_for_caller(
          tsk.public_key()
        )

      const pk_bytes_hex = await backendActor.ibe_encryption_key()

      const k_bytes = tsk.decrypt(
        hex_decode(ek_bytes_hex),
        hex_decode(pk_bytes_hex),
        Principal.anonymous().toUint8Array()
      )

      let note = dispatch.backend.decrypt_ibe({
        encryptedNote: args.encryptedNote,
        k_bytes,
      })

      dispatch.backend.SET_DECRYPTED_NOTES({
        "00000000": note,
      })
    },
    set_one_time_signature: async (args: SetOneTimeSignatureArgs) => {
      const { backendActor } = getBackendStates()

      // Generate a random seed
      const seed = window.crypto.getRandomValues(new Uint8Array(32))

      // Create a TransportSecretKey object
      const tsk = new TransportSecretKey(seed)

      const publicKey = hex_encode(tsk.public_key())

      console.log({ publicKey })

      // Sign the id using the TransportSecretKey
      const signature = tsk.sign(args.id)

      console.log({ signature: hex_encode(signature), id: hex_encode(args.id) })

      await backendActor.set_one_time_key(args.id, publicKey)

      fetchNotes()
    },
    decrypt_with_signature: async (args: DecryptWithSignatureArgs) => {
      const { backendActor } = getBackendStates()

      const seed = window.crypto.getRandomValues(new Uint8Array(32))

      const tsk = new TransportSecretKey(seed)

      const [encryptedNote, ek_bytes_hex] =
        await backendActor.read_with_one_time_key(
          args.id,
          args.signature,
          hex_encode(tsk.public_key())
        )

      const pk_bytes_hex = await backendActor.ibe_encryption_key()

      const k_bytes = tsk.decrypt(
        hex_decode(ek_bytes_hex),
        hex_decode(pk_bytes_hex),
        Principal.anonymous().toUint8Array()
      )

      let note = dispatch.backend.decrypt_ibe({
        encryptedNote,
        k_bytes,
      })

      console.log({ note })
    },
    request_one_time_key: async (args: RequestOneTimeKeyArgs) => {
      const { backendActor } = getBackendStates()

      const seed = window.crypto.getRandomValues(new Uint8Array(32))
      const tsk = new TransportSecretKey(seed)

      try {
        const ek_bytes_hex =
          await backendActor.request_two_factor_authentication(tsk.public_key())

        console.log({ public_key: hex_encode(tsk.public_key()) })

        const pk_bytes_hex = await backendActor.two_factor_verification_key()

        console.log({ pk_bytes_hex })

        const verification_key = tsk.decrypt_and_hash(
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
      const { secretKey } = getBackendStates()

      const generate = () => {
        const randomRandom = randomNumber()

        const code = (randomRandom % 1000000).toString().padStart(6, "0")

        const signature = hex_encode(secretKey.sign(hex_decode(code)))

        console.log({ code, signature })
      }

      const interval = setInterval(generate, 30_000)
      generate()
    },
    decrypt_ibe: async (args: DecryptIBEArgs) => {
      const ibe_ciphertext = IBECiphertext.deserialize(
        hex_decode(args.encryptedNote)
      )
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
