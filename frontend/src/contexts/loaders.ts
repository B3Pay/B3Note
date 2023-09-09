import { AuthClient } from "@dfinity/auth-client"
import { useEffect } from "react"
import { initBackend } from "./helpers"
import store from "./store"
import { ColorKeys, ThemeMode } from "./types/setting"

export function LocalStorageLoader() {
  useEffect(() => {
    const savedMode = localStorage.getItem("themeMode")
    const savedColor = localStorage.getItem("themeColor")

    if (savedMode) {
      store.dispatch.setting.SET_THEME_MODE(savedMode as ThemeMode)
    }
    if (savedColor) {
      store.dispatch.setting.SET_THEME_COLOR(savedColor as ColorKeys)
    }

    AuthClient.create().then(async (client) => {
      const isAuthenticated = await client.isAuthenticated()
      if (isAuthenticated) {
        initBackend(client.getIdentity())
      }

      initBackend()
    })
  }, [])

  return null
}
