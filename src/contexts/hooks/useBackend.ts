import { useSelector } from "react-redux"
import { RootState } from "../store"

export default function useBackend(): RootState["backend"] {
  return useSelector((state: RootState) => state.backend)
}

export function useBackendActor() {
  const { backend } = useBackend()
  return backend
}

export function useBackendNotes() {
  const { notes } = useBackend()
  return notes
}

export function useDecryptedNotes() {
  const { decryptedNotes } = useBackend()
  return decryptedNotes
}

export function useDecryptedNoteById(id: string) {
  const decryptedNotes = useDecryptedNotes()
  return decryptedNotes[id]
}

export function useOneTimeKey() {
  return { code: "", signature: "" }
}
