import { useSelector } from "react-redux"
import { RootState } from "../store"

export function useLoading(): RootState["loading"] {
  return useSelector((state: RootState) => state.loading)
}

export function useGlobalLoading() {
  return useSelector((state: RootState) => state.loading.global)
}

export function useLoadingByAction(action: string) {
  return useSelector((state: RootState) => state.loading[action])
}

export function useBackendLoading(
  action: keyof RootState["loading"]["effects"]["backend"]
) {
  return useSelector(
    (state: RootState) => state.loading.effects.backend[action]
  )
}

export function useSettingLoading() {
  return useSelector((state: RootState) => state.loading.effects.setting)
}

export function useWalletLoading() {
  return useSelector((state: RootState) => state.loading.effects.wallet)
}
