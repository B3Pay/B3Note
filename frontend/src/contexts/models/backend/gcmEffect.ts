import { RematchDispatch } from "@rematch/core"
import { fetchNotes, getBackendStates } from "contexts/helpers"
import { RootModel } from "contexts/store"
import { DecryptGCMNoteArgs, SaveGCMUserNoteArgs } from "contexts/types/backend"
import { hex_decode } from "helper/utils"

const ibeEffect = (dispatch: RematchDispatch<RootModel>) => ({
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
})

export default ibeEffect
