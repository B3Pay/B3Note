import { useSelector } from "react-redux"
import { RootState } from "../store"

export default function useBackend(): RootState["backend"] {
  return useSelector((state: RootState) => state.backend)
}

export function useBackendIsInitialized(): boolean {
  return useSelector((state: RootState) => state.backend.initialized)
}

export function useDecryptionKeyIsSet(): boolean {
  return useSelector(
    (state: RootState) => state.backend.encrypted_decryption_key !== null
  )
}

export function useBackendActor() {
  const { backendActor } = useBackend()
  return backendActor
}

export function useBackendCanisterId() {
  const { canisterId } = useBackend()
  return canisterId
}

export function useUserIdentity() {
  const { userIdentity } = useBackend()
  return userIdentity
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
  return decryptedNotes[id.toString()]
}

export function useOneTimeKey() {
  return { code: "", signature: "" }
}
