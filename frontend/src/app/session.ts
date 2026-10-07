import { useSyncExternalStore } from "react"
import { authentication, clientManager } from "../clients"
import { SessionStore, type SessionSnapshot } from "../lib/session"
import { forgetVaultKey } from "./vault"

function storage(): Storage {
  try {
    return window.localStorage
  } catch {
    // Private mode without storage: keep the session in memory.
    const memory = new Map<string, string>()
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    } as Storage
  }
}

export const session = new SessionStore(authentication, clientManager, storage())
session.onSignOut = (principal) => forgetVaultKey(principal)

export function useSession(): SessionSnapshot {
  return useSyncExternalStore(session.subscribe, () => session.snapshot)
}
