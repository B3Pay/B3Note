/**
 * Unlocks the signed-in user's vault (their vetKey-derived note key) once per
 * principal and shares it with every component.
 */
import { Principal } from "@icp-sdk/core/principal"
import { del, get, set } from "idb-keyval"
import { useEffect, useSyncExternalStore } from "react"
import { errorMessage } from "../lib/errors"
import { expectedPublicKey, USER_KEY_CONTEXT } from "../lib/keys"
import { unlockVault, vaultCacheKey, type KeyCache, type Vault } from "../lib/vault"
import { backendOf, client } from "../reactor"
import { canisterIdOf, isMainnet } from "./canister"
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

/** Unlocks the vault of `principal`, who must be the current caller. */
export async function unlock(principal: string): Promise<void> {
  if ((state.status === "ready" || state.status === "unlocking") && state.principal === principal) return
  publish({ status: "unlocking", principal })
  try {
    const backend = backendOf(client)
    const canisterId = Principal.fromText(canisterIdOf(client, backend))
    const config = await backend.get_config()
    const vault = await unlockVault({
      principal: Principal.fromText(principal),
      canisterId,
      // A direct call: sent as the caller current when it runs.
      fetchEncryptedKey: (transportPublicKey) => backend.get_encrypted_user_key(transportPublicKey),
      expectedKey: expectedPublicKey(config.vetkd_key_name, canisterId, USER_KEY_CONTEXT, !isMainnet(client)),
      cache: keyCache,
    })
    if (state.status === "unlocking" && state.principal === principal) {
      publish({ status: "ready", principal, vault })
    }
  } catch (error) {
    if (state.status === "unlocking" && state.principal === principal) {
      publish({ status: "error", principal, error: errorMessage(error) })
    }
  }
}

/** Drops the in-memory key and the copy cached in this browser. */
export async function forgetVaultKey(principal: string): Promise<void> {
  if (state.status !== "locked" && state.principal === principal) publish({ status: "locked" })
  try {
    await keyCache.del(vaultCacheKey(canisterIdOf(client, backendOf(client)), principal))
  } catch {
    // Nothing cached.
  }
}

/** The vault of the signed-in user, unlocking it on first use. */
export function useVault(): VaultState {
  const { signedIn, principal } = useSession()
  const current = useSyncExternalStore(subscribe, () => state)
  const caller = signedIn ? principal : null

  useEffect(() => {
    if (caller) void unlock(caller)
  }, [caller])

  if (!caller) return { status: "locked" }
  if (current.status !== "locked" && current.principal !== caller) {
    return { status: "unlocking", principal: caller }
  }
  return current
}

export function retryUnlock(principal: string): void {
  publish({ status: "locked" })
  void unlock(principal)
}

/** Unlocks (if needed) and returns the vault of `principal`. */
export async function readyVault(principal: string): Promise<Vault> {
  await unlock(principal)
  const current = state
  if (current.status === "ready" && current.principal === principal) return current.vault
  if (current.status === "error") throw new Error(current.error)
  return new Promise((resolve, reject) => {
    const stop = subscribe(() => {
      if (state.status === "ready" && state.principal === principal) {
        stop()
        resolve(state.vault)
      } else if (state.status === "error" || state.status === "locked") {
        stop()
        reject(new Error(state.status === "error" ? state.error : "The vault was locked."))
      }
    })
  })
}
