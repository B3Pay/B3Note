import { Identity } from "@dfinity/agent"
import { Principal } from "@dfinity/principal"
import { createModel } from "@rematch/core"
import { fetchNotes } from "contexts/helpers"
import { UserNote } from "declarations/backend/backend.did"
import { hex_decode, hex_encode } from "helper/utils"
import { Backend, createBackendActor } from "service"
import { IBECiphertext, TransportSecretKey } from "vetkd-utils"
import { RootModel } from "../store"

interface BackendState {
  backend: Backend | null
  principal: Principal | null
  notes: UserNote[]
  initialized: boolean
}

const state: BackendState = {
  backend: null,
  principal: null,
  notes: [],
  initialized: false,
}

const backend = createModel<RootModel>()({
  name: "backend",
  state,
  reducers: {
    CREATE: (_, backend: Backend, principal: Principal) => ({
      backend,
      principal,
      notes: [],
      initialized: true,
    }),
    UNSET: () => ({ ...state, backend: null, initialized: false }),
    SET_NOTES: (state, notes) => ({ ...state, notes }),
    DONE: (state) => ({ ...state }),
  },
  effects: (dispatch) => ({
    async initialize({ identity }: { identity?: Identity }, rootState) {
      if (rootState.backend.initialized) return

      let { actor, canisterId } = createBackendActor(identity)

      dispatch.backend.CREATE(actor, canisterId)
    },
    fetch_user_notes: async ({}, rootState) => {
      const backend = rootState.backend.backend

      if (!backend) {
        return
      }

      const notes = await backend.user_notes()
      console.log(notes)

      dispatch.backend.SET_NOTES(notes)
    },
    save_user_note: async ({ note }, rootState) => {
      const { backend, principal } = rootState.backend

      if (!backend || !principal) {
        return
      }

      const pk_bytes_hex = await backend.ibe_encryption_key()

      const message_encoded = new TextEncoder().encode(note)
      const seed = window.crypto.getRandomValues(new Uint8Array(32))

      const ibe_ciphertext = IBECiphertext.encrypt(
        hex_decode(pk_bytes_hex),
        principal.toUint8Array(),
        message_encoded,
        seed
      )

      let result = hex_encode(ibe_ciphertext.serialize())

      await backend.save_encrypted_text(result)

      fetchNotes()
    },
    set_one_time_key: async ({ id, key }, rootState) => {
      const { backend, principal } = rootState.backend

      if (!backend || !principal) {
        return
      }

      const pk_bytes_hex = await backend.ibe_encryption_key()

      const seed = window.crypto.getRandomValues(new Uint8Array(32))

      const tsk = new TransportSecretKey(seed)

      console.log({
        publicKey: hex_encode(tsk.public_key()),
      })

      const signature = tsk.sign(hex_decode(key))

      console.log({ signature: hex_encode(signature) })

      const ibe_ciphertext = IBECiphertext.encrypt(
        hex_decode(pk_bytes_hex),
        signature,
        hex_decode(id),
        seed
      )

      let result = hex_encode(ibe_ciphertext.serialize())
      console.log(result)
      await backend.set_one_time_password(id, result)

      fetchNotes()
    },
    decrypt_user_note: async ({ signature, encryptedNote }, rootState) => {
      const { backend, principal } = rootState.backend

      if (!backend || !principal) {
        return
      }

      if (!backend) return

      const seed = window.crypto.getRandomValues(new Uint8Array(32))

      const tsk = new TransportSecretKey(seed)

      console.log({ public_key: hex_encode(tsk.public_key()) })

      const _signature = hex_decode(signature)

      console.log({ signature: hex_encode(_signature) })

      const ek_bytes_hex =
        await backend.encrypted_ibe_decryption_key_for_caller_with_derivation(
          tsk.public_key(),
          _signature
        )
      console.log(ek_bytes_hex)

      const pk_bytes_hex = await backend.ibe_encryption_key()

      const k_bytes = tsk.decrypt(
        hex_decode(ek_bytes_hex),
        hex_decode(pk_bytes_hex),
        _signature
      )

      console.log({ k_bytes })
      const ibe_ciphertext = IBECiphertext.deserialize(
        hex_decode(encryptedNote)
      )
      const ibe_plaintext = ibe_ciphertext.decrypt(k_bytes)
      console.log(ibe_plaintext)
      let decrypted = new TextDecoder().decode(ibe_plaintext)

      console.log(decrypted)
    },
    disconnect: (_, rootState) => {},
  }),
})

export default backend
