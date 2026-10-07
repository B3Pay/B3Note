import type { AuthState } from "@ic-reactor/react"
import type { Identity } from "@icp-sdk/core/agent"
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity"
import { describe, expect, it, vi } from "vitest"
import {
  SessionStore,
  formatRecoveryKey,
  guestIdentity,
  parseRecoveryKey,
  type AuthenticationLike,
  type KeyValueStorage,
} from "./session"

class FakeAuthentication implements AuthenticationLike {
  authState: AuthState = { identity: null, isAuthenticated: false, isAuthenticating: false, error: undefined }
  readonly listeners = new Set<(state: AuthState) => void>()
  stored: Identity | null = null
  loginResult: Identity | Error = Ed25519KeyIdentity.generate()
  authenticate = vi.fn(async () => {
    if (this.stored) this.publish({ identity: this.stored, isAuthenticated: true })
    return this.stored ?? undefined
  })
  login = vi.fn(async () => {
    if (this.loginResult instanceof Error) {
      this.publish({ error: this.loginResult })
      return
    }
    this.stored = this.loginResult
    this.publish({ identity: this.loginResult, isAuthenticated: true })
  })
  logout = vi.fn(async () => {
    this.stored = null
    this.publish({ identity: null, isAuthenticated: false })
  })
  subscribeAuthState(callback: (state: AuthState) => void) {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }
  publish(next: Partial<AuthState>) {
    this.authState = { ...this.authState, isAuthenticating: false, error: undefined, ...next }
    for (const listener of this.listeners) listener(this.authState)
  }
}

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  }
}

function setup(storage = memoryStorage(), auth = new FakeAuthentication()) {
  const agent = {
    identities: [] as Identity[],
    updateAgent: (identity: Identity) => agent.identities.push(identity),
  }
  const store = new SessionStore(auth, agent, storage)
  return { store, auth, agent, storage }
}

describe("SessionStore", () => {
  it("restores an Internet Identity session", async () => {
    const auth = new FakeAuthentication()
    auth.stored = Ed25519KeyIdentity.generate()
    const { store } = setup(memoryStorage(), auth)
    expect(store.snapshot.session.status).toBe("restoring")
    await store.init()
    const { session } = store.snapshot
    expect(session.status === "signedIn" && session.kind).toBe("ii")
  })

  it("is signed out without a session", async () => {
    const { store } = setup()
    await store.init()
    expect(store.snapshot.session.status).toBe("signedOut")
  })

  it("signs in as a guest and restores the guest without touching Internet Identity", async () => {
    const storage = memoryStorage()
    const first = setup(storage)
    await first.store.init()
    first.store.continueAsGuest()
    const session = first.store.snapshot.session
    if (session.status !== "signedIn") throw new Error("expected a session")
    expect(session.kind).toBe("guest")
    expect(first.agent.identities.at(-1)?.getPrincipal().toText()).toBe(session.principal.toText())

    // A reload: the guest comes back, and the II restore (which would reset
    // the agent to anonymous) is never started.
    const second = setup(storage)
    await second.store.init()
    const restored = second.store.snapshot.session
    expect(restored.status === "signedIn" && restored.principal.toText()).toBe(session.principal.toText())
    expect(second.auth.authenticate).not.toHaveBeenCalled()
  })

  it("keeps the guest key on sign-out until it is forgotten", async () => {
    const { store, agent } = setup()
    await store.init()
    store.continueAsGuest()
    const seed = store.guestSeed()!
    await store.signOut()
    expect(store.snapshot.session.status).toBe("signedOut")
    expect(agent.identities.at(-1)?.getPrincipal().isAnonymous()).toBe(true)
    expect(store.guestSeed()).toEqual(seed)
    store.continueAsGuest()
    const again = store.snapshot.session
    expect(again.status === "signedIn" && again.principal.toText()).toBe(
      guestIdentity(seed).getPrincipal().toText(),
    )
    await store.signOut()
    store.forgetGuestKey()
    expect(store.hasGuestKey).toBe(false)
  })

  it("imports a recovery key", async () => {
    const seed = crypto.getRandomValues(new Uint8Array(32))
    const key = formatRecoveryKey(seed)
    expect(parseRecoveryKey(key)).toEqual(seed)
    expect(parseRecoveryKey(` ${key}\n`)).toEqual(seed)
    expect(parseRecoveryKey("b3note-guest-v1:short")).toBeNull()
    expect(parseRecoveryKey("not a key")).toBeNull()

    const { store } = setup()
    await store.init()
    store.continueAsGuest(seed)
    const session = store.snapshot.session
    expect(session.status === "signedIn" && session.principal.toText()).toBe(
      guestIdentity(seed).getPrincipal().toText(),
    )
  })

  it("signs in and out with Internet Identity and reports failures", async () => {
    const { store, auth } = setup()
    const signedOut = vi.fn()
    store.onSignOut = signedOut
    await store.init()

    auth.loginResult = new Error("User interrupted")
    await store.signInWithInternetIdentity()
    expect(store.snapshot.error).toBe("User interrupted")
    expect(store.snapshot.busy).toBe(false)

    auth.loginResult = Ed25519KeyIdentity.generate()
    await store.signInWithInternetIdentity()
    const session = store.snapshot.session
    expect(session.status === "signedIn" && session.kind).toBe("ii")
    expect(store.snapshot.error).toBeNull()

    await store.signOut()
    expect(auth.logout).toHaveBeenCalled()
    expect(signedOut).toHaveBeenCalledTimes(1)
    expect(store.snapshot.session.status).toBe("signedOut")
  })

  it("follows an Internet Identity sign-in from another tab", async () => {
    const { store, auth } = setup()
    await store.init()
    store.continueAsGuest()
    auth.publish({ identity: Ed25519KeyIdentity.generate(), isAuthenticated: true })
    const session = store.snapshot.session
    expect(session.status === "signedIn" && session.kind).toBe("ii")
  })
})
