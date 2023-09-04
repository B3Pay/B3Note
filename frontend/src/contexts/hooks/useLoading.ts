import { useSelector } from "react-redux"
import { RootState } from "../store"

export function useLoading(): RootState["loading"] {
  return useSelector((state: RootState) => state.loading)
}

export function useGlobalLoading() {
  return useSelector((state: RootState) => state.loading.global)
}
