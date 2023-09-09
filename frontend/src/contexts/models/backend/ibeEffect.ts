import { Principal } from "@dfinity/principal"
import { RematchDispatch } from "@rematch/core"
import { fetchNotes, getBackendStates } from "contexts/helpers"
import { RootModel } from "contexts/store"
import {
  DecryptIBEArgs,
  DecryptIBENoteArgs,
  EditIBEUserNoteArgs,
  SaveIBEUserNoteArgs,
} from "contexts/types/backend"
import { generateSubaccount } from "helper/subaccount"
import { compileError, hex_encode } from "helper/utils"

const ibeEffect = (dispatch: RematchDispatch<RootModel>) => ({
  encrypt_ibe_user_note: (args: SaveIBEUserNoteArgs) => {
    const { ibeEncrypt } = getBackendStates()

    const message_encoded = new TextEncoder().encode(args.note)
    const seed = window.crypto.getRandomValues(new Uint8Array(32))

    return ibeEncrypt(message_encoded, seed)
  },
  edit_ibe_user_note: async (args: EditIBEUserNoteArgs) => {
    const { backendActor, userIdentity, transportSecretKey } =
      getBackendStates()

    const ibe_ciphertext = dispatch.backend.encrypt_ibe_user_note({
      note: args.note,
    })

    await backendActor.edit_encrypted_text(
      args.id,
      ibe_ciphertext.serialize(),
      userIdentity.isAnonymous() ? [transportSecretKey.public_key()] : []
    )

    fetchNotes()
  },
  save_ibe_user_note: async (args: SaveIBEUserNoteArgs) => {
    const { backendActor, userIdentity, transportSecretKey } =
      getBackendStates()

    let ibe_ciphertext = dispatch.backend.encrypt_ibe_user_note({
      note: args.note,
    })

    await backendActor.save_encrypted_text(
      ibe_ciphertext.serialize(),
      userIdentity.isAnonymous() ? [transportSecretKey.public_key()] : []
    )

    fetchNotes()
  },
  fetch_decryption_key: async () => {
    const { backendActor, transportSecretKey } = getBackendStates()

    const encrypted_decryption_key =
      await backendActor.encrypted_ibe_decryption_key_for_caller(
        transportSecretKey.public_key()
      )

    dispatch.backend.SET_KEYS({
      encrypted_decryption_key,
    })
  },
  decrypt_ibe_user_note: async (args: DecryptIBENoteArgs) => {
    const { encrypted_decryption_key, ibeEncryptionKey, transportSecretKey } =
      getBackendStates()

    if (!encrypted_decryption_key) return
    try {
      const k_bytes = transportSecretKey.decrypt(
        encrypted_decryption_key as Uint8Array,
        ibeEncryptionKey as Uint8Array,
        generateSubaccount(Principal.anonymous())
      )

      console.log({ k_bytes: hex_encode(k_bytes) })

      let note = dispatch.backend.decrypt_ibe({
        encryptedNote: args.encryptedNote,
        k_bytes,
      })

      console.log({ note })

      dispatch.backend.ADD_DECRYPTED_NOTE({ [args.id.toString()]: note })
    } catch (e) {
      dispatch.backend.SET_ERROR({
        decryptionError: {
          [args.id.toString()]: compileError(e),
        },
      })
      console.log(e)
    }
  },
  decrypt_ibe: (args: DecryptIBEArgs) => {
    const { ibeDeserialize } = getBackendStates()

    const ibe_ciphertext = ibeDeserialize(args.encryptedNote as Uint8Array)

    const ibe_plaintext = ibe_ciphertext.decrypt(args.k_bytes)

    let decrypted = new TextDecoder().decode(ibe_plaintext)

    return decrypted
  },
})

export default ibeEffect
