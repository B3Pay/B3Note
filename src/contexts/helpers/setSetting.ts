import store from "../store"
import { ColorKeys, SnackBarType, ThemeMode } from "../types/setting"

export const setModal = (modal: boolean) =>
  store.dispatch.setting.SET_MODAL(modal)

export const setThemeColor = (color: ColorKeys) =>
  store.dispatch.setting.SET_THEME_COLOR(color)

export const setThemeMode = (mode: ThemeMode) => {
  store.dispatch.setting.SET_THEME_MODE(mode)
}

export const setShowSnackbar = (snackbar: boolean) =>
  store.dispatch.setting.SHOW_SNACKBAR(snackbar)

export const setSnackbar = (props: SnackBarType) =>
  store.dispatch.setting.SET_SNACKBAR(props)
