import { useSelector } from "react-redux"
import { RootState } from "../store"

export function useBackendError(): RootState["backend"]["errors"] {
  return useSelector((state: RootState) => state.backend.errors)
}

export function useDecryptionError(
  id: string
): RootState["backend"]["errors"]["decryptionError"][string] {
  return useSelector(
    (state: RootState) => state.backend.errors.decryptionError[id]
  )
}
