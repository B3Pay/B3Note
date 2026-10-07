/**
 * Unlocks the signed-in user's vault (their vetKey-derived note key) once per
 * principal and shares it with every component.
 */
import type { Principal } from "@icp-sdk/core/principal"
import { del, get, set } from "idb-keyval"
import { useEffect, useSyncExternalStore } from "react"
import { clientManager } from "../clients"
import { backendReactor, getConfigQuery, getEncryptedUserKeyMutation } from "../declarations/backend"
import { errorMessage } from "../lib/errors"
import { expectedPublicKey, USER_KEY_CONTEXT } from "../lib/keys"
import { unlockVault, vaultCacheKey, type KeyCache, type Vault } from "../lib/vault"
import { useSession } from "./session"

export type VaultState =
  | { status: "locked" }
  | { status: "unlocking"; principal: string }
  | { status: "ready"; principal: string; vault: Vault }
  | { status: "error"; principal: string; error: string }

const keyCache: KeyCache = {
  get: (key) => get<CryptoKey>(key),
  set: (key, value) => set(key, value),
  del: (key) => del(key),
}

let state: VaultState = { status: "locked" }
const listeners = new Set<() => void>()

function publish(next: VaultState) {
  state = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function unlock(principal: Principal): Promise<void> {
  const id = principal.toText()
  if ((state.status === "ready" || state.status === "unlocking") && state.principal === id) return
  publish({ status: "unlocking", principal: id })
  try {
    const config = await getConfigQuery.fetch()
    const vault = await unlockVault({
      principal,
      canisterId: backendReactor.canisterId,
      fetchEncryptedKey: (transportPublicKey) => getEncryptedUserKeyMutation.execute([transportPublicKey]),
      expectedKey: expectedPublicKey(
        config.vetkd_key_name,
        backendReactor.canisterId,
        USER_KEY_CONTEXT,
        clientManager.isLocal,
      ),
      cache: keyCache,
    })
    if (state.status === "unlocking" && state.principal === id) {
      publish({ status: "ready", principal: id, vault })
    }
  } catch (error) {
    if (state.status === "unlocking" && state.principal === id) {
      publish({ status: "error", principal: id, error: errorMessage(error) })
    }
  }
}

/** Drops the in-memory key and the copy cached in this browser. */
export async function forgetVaultKey(principal: Principal): Promise<void> {
  if (state.status !== "locked" && state.principal === principal.toText()) {
    publish({ status: "locked" })
  }
  try {
    await keyCache.del(vaultCacheKey(backendReactor.canisterId.toText(), principal.toText()))
  } catch {
    // Nothing cached.
  }
}

/** The vault of the signed-in user, unlocking it on first use. */
export function useVault(): VaultState {
  const { session } = useSession()
  const current = useSyncExternalStore(subscribe, () => state)
  const principal = session.status === "signedIn" ? session.principal : null

  useEffect(() => {
    if (principal) void unlock(principal)
  }, [principal])

  if (!principal) return { status: "locked" }
  if (current.status !== "locked" && current.principal !== principal.toText()) {
    return { status: "unlocking", principal: principal.toText() }
  }
  return current
}

export function retryUnlock(principal: Principal): void {
  publish({ status: "locked" })
  void unlock(principal)
}

/** Unlocks (if needed) and returns the vault of `principal`. */
export async function readyVault(principal: Principal): Promise<Vault> {
  await unlock(principal)
  const current = state
  if (current.status === "ready" && current.principal === principal.toText()) return current.vault
  if (current.status === "error") throw new Error(current.error)
  return new Promise((resolve, reject) => {
    const stop = subscribe(() => {
      if (state.status === "ready" && state.principal === principal.toText()) {
        stop()
        resolve(state.vault)
      } else if (state.status === "error" || state.status === "locked") {
        stop()
        reject(new Error(state.status === "error" ? state.error : "The vault was locked."))
      }
    })
  })
}
