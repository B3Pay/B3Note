// @vitest-environment jsdom
import { createClient } from "@ic-reactor/core"
import type { Identity } from "@icp-sdk/core/agent"
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity"
import { describe, expect, it, vi } from "vitest"
import { toHex } from "./bytes"
import {
  formatRecoveryKey,
  guestIdentity,
  parseRecoveryKey,
  SessionAuth,
  type InternetIdentityLike,
  type KeyValueStorage,
} from "./sessionAuth"

type IiState = "signed-in" | "signed-out" | "expired" | "signed-in-elsewhere"

/** Stands in for `@icp-sdk/auth`'s AuthClient. */
class FakeInternetIdentity implements InternetIdentityLike {
  identity = Ed25519KeyIdentity.generate()
  state: IiState = "signed-out"
  /** What the next `signIn` does: complete, or the user closes the window. */
  outcome: "complete" | "cancel" = "complete"
  readonly listeners = new Set<() => void>()
  maxTimeToLive?: bigint

  getPrincipal() {
    return this.state === "signed-out" ? undefined : this.identity.getPrincipal()
  }
  getStatus() {
    return { state: this.state }
  }
  async getIdentity(): Promise<Identity> {
    return this.identity
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }
  async signIn(options?: { maxTimeToLive?: bigint }) {
    this.maxTimeToLive = options?.maxTimeToLive
    if (this.outcome === "cancel") throw new Error("UserInterrupt")
    this.set("signed-in")
  }
  async signOut() {
    this.set("signed-out")
  }
  set(state: IiState) {
    this.state = state
    for (const listener of this.listeners) listener()
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

function setup() {
  const ii = new FakeInternetIdentity()
  const storage = memoryStorage()
  const session = new SessionAuth(ii, storage)
  const changed = vi.fn()
  session.subscribe(changed)
  return { ii, storage, session, changed }
}

describe("recovery keys", () => {
  it("round-trip and accept plain hex", () => {
    const seed = new Uint8Array(32).map((_, i) => i)
    expect(parseRecoveryKey(formatRecoveryKey(seed))).toEqual(seed)
    expect(parseRecoveryKey(` ${formatRecoveryKey(seed)}\n`)).toEqual(seed)
    expect(parseRecoveryKey(toHex(seed))).toEqual(seed)
    expect(parseRecoveryKey("b3note-guest-v1:short")).toBeNull()
    expect(parseRecoveryKey("not a key")).toBeNull()
  })
})

describe("SessionAuth", () => {
  it("starts signed out", async () => {
    const { session } = setup()
    expect(session.getStatus().state).toBe("signed-out")
    expect(session.getPrincipal()).toBeUndefined()
    expect(session.kind).toBeNull()
    expect(session.hasGuestKey).toBe(false)
  })

  it("makes a guest key, keeps it, and restores the guest after a reload", async () => {
    const { ii, storage, session, changed } = setup()
    await session.signIn({ method: "guest" })
    expect(changed).toHaveBeenCalled()
    expect(session.kind).toBe("guest")
    expect(session.getStatus().state).toBe("signed-in")
    const principal = session.getPrincipal()!.toText()
    expect((await session.getIdentity()).getPrincipal().toText()).toBe(principal)

    const reloaded = new SessionAuth(ii, storage)
    expect(reloaded.kind).toBe("guest")
    expect(reloaded.getPrincipal()?.toText()).toBe(principal)
  })

  it("signs in with an imported recovery key", async () => {
    const { session } = setup()
    const seed = crypto.getRandomValues(new Uint8Array(32))
    await session.signIn({ method: "guest", seed })
    expect(session.getPrincipal()?.toText()).toBe(guestIdentity(seed).getPrincipal().toText())
    expect(session.guestSeed()).toEqual(seed)
  })

  it("signs a guest out but keeps the key until it is forgotten", async () => {
    const { ii, storage, session } = setup()
    await session.signIn({ method: "guest" })
    const principal = session.getPrincipal()!.toText()
    expect(() => session.forgetGuestKey()).toThrow(/Sign out/)

    await session.signOut()
    expect(session.getStatus().state).toBe("signed-out")
    expect(session.hasGuestKey).toBe(true)
    expect(new SessionAuth(ii, storage).kind).toBeNull()

    await session.signIn({ method: "guest" })
    expect(session.getPrincipal()?.toText()).toBe(principal)
    await session.signOut()
    session.forgetGuestKey()
    expect(session.hasGuestKey).toBe(false)
  })

  it("switches from a guest to Internet Identity", async () => {
    const { ii, session, changed } = setup()
    await session.signIn({ method: "guest" })
    changed.mockClear()
    await session.signIn({ method: "ii" })
    expect(session.kind).toBe("ii")
    expect(session.getPrincipal()?.toText()).toBe(ii.identity.getPrincipal().toText())
    expect(await session.getIdentity()).toBe(ii.identity)
    expect(ii.maxTimeToLive).toBe(7n * 24n * 3_600n * 1_000_000_000n)
    expect(changed).toHaveBeenCalled()
  })

  it("tells the client when an Internet Identity sign-in is cancelled after a guest session", async () => {
    const { ii, session, changed } = setup()
    await session.signIn({ method: "guest" })
    changed.mockClear()
    ii.outcome = "cancel"
    await expect(session.signIn({ method: "ii" })).rejects.toThrow("UserInterrupt")
    expect(session.getStatus().state).toBe("signed-out")
    expect(changed).toHaveBeenCalled()
  })

  it("signs Internet Identity out before a guest signs in", async () => {
    const { ii, session } = setup()
    await session.signIn({ method: "ii" })
    await session.signIn({ method: "guest" })
    expect(ii.state).toBe("signed-out")
    await session.signOut()
    // Nothing takes over when the guest leaves.
    expect(session.getStatus().state).toBe("signed-out")
  })

  it("passes Internet Identity's own changes on only while it is the active source", async () => {
    const { ii, session, changed } = setup()
    await session.signIn({ method: "ii" })
    changed.mockClear()
    ii.set("expired")
    expect(changed).toHaveBeenCalledTimes(1)
    expect(session.getStatus().state).toBe("expired")

    await session.signIn({ method: "guest" })
    changed.mockClear()
    ii.set("signed-in-elsewhere")
    expect(changed).not.toHaveBeenCalled()
    expect(session.getStatus().state).toBe("signed-in")
  })

  it("drives an ic-reactor client's caller", async () => {
    const { session } = setup()
    const client = createClient({ network: "local", auth: () => session })
    try {
      expect(client.authState().status).toBe("anonymous")
      await client.signIn({ method: "guest" })
      expect(client.authState().status).toBe("signed-in")
      expect(client.caller()).toBe(session.getPrincipal()?.toText())
      await client.signOut()
      expect(client.caller()).toBe("2vxsx-fae")
    } finally {
      client.dispose()
    }
  })
})
