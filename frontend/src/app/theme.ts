import { useEffect, useSyncExternalStore } from "react"

export type Theme = "light" | "dark" | "system"

const KEY = "b3note:theme"
const listeners = new Set<() => void>()

function read(): Theme {
  try {
    const value = localStorage.getItem(KEY)
    return value === "light" || value === "dark" ? value : "system"
  } catch {
    return "system"
  }
}

let theme: Theme = typeof window === "undefined" ? "system" : read()

export function setTheme(next: Theme) {
  theme = next
  try {
    if (next === "system") localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch {
    // Not persisted.
  }
  applyTheme()
  for (const listener of listeners) listener()
}

export function applyTheme() {
  const dark =
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
  document.documentElement.style.colorScheme = dark ? "dark" : "light"
}

export function useTheme(): Theme {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => theme,
  )
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme()
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])
  return current
}
