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
  store.dispatch.setting.setShowSnackBar(snackbar)

export const setShowAddress = () => store.dispatch.setting.setShowAddress()

export const setShowDetails = () => store.dispatch.setting.setShowDetails()

export const setSnackbar = (props: SnackBarType) =>
  store.dispatch.setting.setSnackBar(props)
