import { Identity } from "@dfinity/agent"
import store from "../store"

export const initBackend = (identity?: Identity) => {
  store.dispatch.backend.initialize({ identity })
}

export const unsetBackend = () => store.dispatch.backend.UNSET()

export const fetchNotes = async () => {
  store.dispatch.backend.fetch_user_notes({})
}

export const saveNoteIBE = async (note: string) => {
  store.dispatch.backend.save_ibe_user_note({ note })
}

export const saveNoteGCM = async (note: string) => {
  store.dispatch.backend.save_gcm_user_note({ note })
}

export const generateOneTimeLink = async (id: bigint) => {
  return store.dispatch.backend.generate_one_time_link({ id })
}

export const decyptIBENote = async (id: string, encryptedNote: string) => {
  store.dispatch.backend.decrypt_ibe_user_note({ id, encryptedNote })
}

export const gcmDecrypt = async (encryptedNote: string) => {
  store.dispatch.backend.decrypt_gcm_user_note({ encryptedNote })
}

export const decyptWithSignature = async (id: string, signature: string) => {
  return store.dispatch.backend.decrypt_with_signature({ id, signature })
}

export const requestOneTimeKey = async () => {
  store.dispatch.backend.request_one_time_key({})
}
