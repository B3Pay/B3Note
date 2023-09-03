import { Identity } from "@dfinity/agent"
import store from "../store"

export const setBackend = (identity?: Identity) => {
  store.dispatch.backend.initialize({ identity })
}

export const unsetBackend = () => store.dispatch.backend.UNSET()

export const fetchNotes = async () => {
  store.dispatch.backend.fetch_user_notes({})
}

export const saveNote = async (note: string) => {
  store.dispatch.backend.save_user_note({ note })
}

export const setOneTimeKey = async (id: Uint8Array) => {
  store.dispatch.backend.set_one_time_signature({ id })
}

export const decyptNote = async (encryptedNote: string) => {
  store.dispatch.backend.decrypt_user_note({ encryptedNote })
}

export const gcmDecrypt = async (encryptedNote: string) => {
  store.dispatch.backend.gcm_decrypt({ encryptedNote })
}

export const decyptWithOneTimeKey = async (
  id: Uint8Array,
  signature: string
) => {
  store.dispatch.backend.decrypt_with_signature({ id, signature })
}

export const requestOneTimeKey = async () => {
  store.dispatch.backend.request_one_time_key({})
}
