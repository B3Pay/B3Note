import { useSelector } from "react-redux"
import { RootState } from "../store"

export default function useUser(): RootState["user"] {
  return useSelector((state: RootState) => state.user)
}

export function useNotes() {
  const { notes } = useUser()
  return notes
}
