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

export const setOneTimeKey = async (id: string, key: string) => {
  store.dispatch.backend.set_one_time_key({ id, key })
}

export const decyptNote = async (
  signature: string,
  encryptedNote: string,
  key: string
) => {
  store.dispatch.backend.decrypt_user_note({ signature, encryptedNote, key })
}
