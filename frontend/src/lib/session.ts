/**
 * Who the user is: an Internet Identity session or a guest key.
 *
 * A guest key is a random 32-byte seed for an Ed25519 identity, kept in this
 * browser's localStorage. It gives a full, private account without any
 * sign-in provider; whoever holds the key owns the notes, so the app asks
 * guests to save it as a recovery key.
 *
 * Internet Identity goes through ic-reactor's AuthenticationManager. A guest
 * identity is installed on the shared ClientManager directly, and the
 * Internet Identity session restore is skipped while a guest is signed in,
 * since restoring "no session" would reset the agent to anonymous.
 */
import type { AuthState } from "@ic-reactor/react"
import { AnonymousIdentity, type Identity } from "@icp-sdk/core/agent"
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity"
import type { Principal } from "@icp-sdk/core/principal"
import { useSyncExternalStore } from "react"
import { fromBase64Url, fromHex, randomBytes, toBase64Url, type Bytes } from "./bytes"

export type SessionKind = "ii" | "guest"

export type Session =
  | { status: "restoring" }
  | { status: "signedOut" }
  | { status: "signedIn"; kind: SessionKind; principal: Principal; identity: Identity }

export interface SessionSnapshot {
  session: Session
  /** A sign-in or sign-out in progress. */
  busy: boolean
  error: string | null
}

/** The parts of ic-reactor's AuthenticationManager and ClientManager used here. */
export interface AuthenticationLike {
  authState: AuthState
  authenticate(): Promise<Identity | undefined>
  login(options?: { maxTimeToLive?: bigint }): Promise<void>
  logout(): Promise<void>
  subscribeAuthState(callback: (state: AuthState) => void): () => void
}

export interface ClientManagerLike {
  updateAgent(identity: Identity): void
}

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const MODE_KEY = "b3note:session-mode"
const GUEST_KEY = "b3note:guest-key"
const RECOVERY_PREFIX = "b3note-guest-v1:"
/** Internet Identity delegations last a week. */
const II_SESSION_NANOS = 7n * 24n * 3_600n * 1_000_000_000n

export function formatRecoveryKey(seed: Uint8Array): string {
  return `${RECOVERY_PREFIX}${toBase64Url(seed)}`
}

/** Accepts `b3note-guest-v1:<base64url>` or 64 hex characters. */
export function parseRecoveryKey(text: string): Bytes | null {
  const value = text.trim()
  try {
    const seed = value.startsWith(RECOVERY_PREFIX)
      ? fromBase64Url(value.slice(RECOVERY_PREFIX.length))
      : /^[0-9a-fA-F]{64}$/.test(value)
        ? fromHex(value)
        : null
    return seed && seed.length === 32 ? seed : null
  } catch {
    return null
  }
}

export function guestIdentity(seed: Uint8Array): Ed25519KeyIdentity {
  return Ed25519KeyIdentity.generate(seed)
}

export class SessionStore {
  #snapshot: SessionSnapshot = { session: { status: "restoring" }, busy: false, error: null }
  readonly #listeners = new Set<() => void>()
  #initialized = false
  #signingOut = false
  readonly #authentication: AuthenticationLike
  readonly #clientManager: ClientManagerLike
  readonly #storage: KeyValueStorage
  /** Called with the principal that signs out, e.g. to drop its cached key. */
  onSignOut?: (principal: Principal) => void | Promise<void>

  constructor(
    authentication: AuthenticationLike,
    clientManager: ClientManagerLike,
    storage: KeyValueStorage,
  ) {
    this.#authentication = authentication
    this.#clientManager = clientManager
    this.#storage = storage
  }

  get snapshot(): SessionSnapshot {
    return this.#snapshot
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #set(next: Partial<SessionSnapshot>) {
    this.#snapshot = { ...this.#snapshot, ...next }
    for (const listener of this.#listeners) listener()
  }

  get hasGuestKey(): boolean {
    return this.#storage.getItem(GUEST_KEY) !== null
  }

  /** The stored guest seed, if any. */
  guestSeed(): Bytes | null {
    const stored = this.#storage.getItem(GUEST_KEY)
    return stored ? parseRecoveryKey(stored) : null
  }

  async init(): Promise<void> {
    if (this.#initialized) return
    this.#initialized = true
    this.#authentication.subscribeAuthState((state) => this.#onAuthState(state))

    const seed = this.guestSeed()
    if (this.#storage.getItem(MODE_KEY) === "guest" && seed) {
      this.#signInGuest(seed)
      return
    }
    try {
      await this.#authentication.authenticate()
    } catch {
      // No usable session: signed out.
    }
    if (this.#snapshot.session.status === "restoring") {
      this.#fromAuthState(this.#authentication.authState)
    }
  }

  #fromAuthState(state: AuthState) {
    if (state.isAuthenticated && state.identity) {
      this.#storage.setItem(MODE_KEY, "ii")
      this.#set({
        session: {
          status: "signedIn",
          kind: "ii",
          identity: state.identity,
          principal: state.identity.getPrincipal(),
        },
      })
    } else {
      this.#set({ session: { status: "signedOut" } })
    }
  }

  #onAuthState(state: AuthState) {
    const { session } = this.#snapshot
    if (session.status === "restoring" || state.isAuthenticating || this.#signingOut) return
    if (session.status === "signedIn" && session.kind === "guest") {
      // Another tab signed in with Internet Identity: that session now owns
      // the shared agent.
      if (state.isAuthenticated) this.#fromAuthState(state)
      return
    }
    // Internet Identity sign-in, expiry, or sign-out in another tab.
    if (session.status === "signedIn" && !state.isAuthenticated) {
      void this.onSignOut?.(session.principal)
    }
    this.#fromAuthState(state)
  }

  #signInGuest(seed: Uint8Array) {
    const identity = guestIdentity(seed)
    this.#clientManager.updateAgent(identity)
    this.#storage.setItem(MODE_KEY, "guest")
    this.#set({
      session: { status: "signedIn", kind: "guest", identity, principal: identity.getPrincipal() },
      error: null,
    })
  }

  /** Opens the Internet Identity window. Call it from a click handler. */
  async signInWithInternetIdentity(): Promise<void> {
    this.#set({ busy: true, error: null })
    try {
      await this.#authentication.login({ maxTimeToLive: II_SESSION_NANOS })
      const state = this.#authentication.authState
      if (!state.isAuthenticated) {
        throw state.error ?? new Error("Sign-in was cancelled.")
      }
      this.#fromAuthState(state)
    } catch (error) {
      this.#set({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      this.#set({ busy: false })
    }
  }

  /**
   * Signs in with the guest key stored in this browser, or with `seed` (an
   * imported recovery key), creating a new key when there is neither.
   */
  continueAsGuest(seed?: Uint8Array): void {
    const key = seed ?? this.guestSeed() ?? randomBytes(32)
    this.#storage.setItem(GUEST_KEY, formatRecoveryKey(key))
    this.#signInGuest(key)
  }

  async signOut(): Promise<void> {
    const { session } = this.#snapshot
    if (session.status !== "signedIn") return
    this.#set({ busy: true })
    this.#signingOut = true
    try {
      await this.onSignOut?.(session.principal)
      if (session.kind === "ii") {
        await this.#authentication.logout()
      } else {
        this.#clientManager.updateAgent(new AnonymousIdentity())
      }
    } finally {
      this.#signingOut = false
      this.#storage.removeItem(MODE_KEY)
      this.#set({ session: { status: "signedOut" }, busy: false, error: null })
    }
  }

  /** Removes the guest key from this browser. Only for a signed-out guest. */
  forgetGuestKey(): void {
    this.#storage.removeItem(GUEST_KEY)
  }

  clearError(): void {
    this.#set({ error: null })
  }
}

export function useSessionSnapshot(store: SessionStore): SessionSnapshot {
  return useSyncExternalStore(store.subscribe, () => store.snapshot)
}
