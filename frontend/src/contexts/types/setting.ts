import * as colors from "@mui/material/colors/"

export type ColorKeys = Exclude<keyof typeof colors, "common">

export type ColorPalette = typeof colors[ColorKeys]

export type ColorPaletteKeys = keyof ColorPalette

export type ColorRanges = {
  [key in ColorPaletteKeys]: string
}

export type ThemeMode = "dark" | "light" | "system"

export type ConnectModalType = {
  open: boolean
  tab: string | undefined
}

export type DefaultSettingState = {
  showSnackBar: boolean
  showDetails: boolean
  showAddress: boolean
  modal: boolean
  connectModal: ConnectModalType
  snackbar: SnackBarType
  theme: {
    mode: ThemeMode
    color: ColorKeys
  }
  version: string
}

export type SnackBarType = {
  title?: string
  severity?: "error" | "warning" | "info" | "success"
  message: string
}
