import * as colors from "@mui/material/colors"
import { useSelector } from "react-redux"
import { RootState } from "../store"
import { ColorRanges } from "../types/setting"

export default function useSetting() {
  return useSelector((state: RootState) => state.setting)
}

export function useConnectModal() {
  return useSelector((state: RootState) => state.setting.connectModal)
}

export function useThemeColor() {
  return useSelector((state: RootState) => state.setting.theme.color)
}

export function useThemeMode() {
  return useSelector((state: RootState) => state.setting.theme.mode)
}

export function useMediaThemeMode() {
  const mode = useThemeMode()
  // const system = useMediaQuery("(prefers-color-scheme: dark)")

  return "light" as "light" | "dark"
}

export function useThemeColorPalette() {
  const color = useThemeColor()

  return colors[color] as ColorRanges
}
