import { useSelector } from "react-redux"
import { RootState } from "../store"

export default function useBackend(): RootState["backend"] {
  return useSelector((state: RootState) => state.backend)
}

export function useBackendIsInitialized(): boolean {
  return useSelector((state: RootState) => state.backend.initialized)
}

export function useBackendActor() {
  const { backendActor: backend } = useBackend()
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
