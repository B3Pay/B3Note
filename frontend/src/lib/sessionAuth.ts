/**
 * The app's sign-in for ic-reactor 4: one `AuthLike` over two sources.
 *
 * - Internet Identity, through `@icp-sdk/auth`'s `AuthClient`.
 * - A guest key: a random 32-byte seed for an Ed25519 identity, kept in this
 *   browser's localStorage. It is a full, private account without any sign-in
 *   provider; whoever holds the key owns the notes, so the app asks guests to
 *   save it as a recovery key.
 *
 * The client calls as whichever is active, and `useAuth()` follows it.
 * `signIn({ method: "ii" })` opens Internet Identity (call it from a click),
 * and `signIn({ method: "guest", seed? })` signs in with the stored guest key,
 * an imported recovery key, or a new one.
 */
import type { AuthLike } from "@ic-reactor/core"
import type { Identity } from "@icp-sdk/core/agent"
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity"
import { fromBase64Url, fromHex, randomBytes, toBase64Url, type Bytes } from "./bytes"

export type SessionKind = "ii" | "guest"

export type SignInOptions = { method: "ii" } | { method: "guest"; seed?: Uint8Array }

/** The parts of `@icp-sdk/auth`'s `AuthClient` this uses. */
export type InternetIdentityLike = Pick<
  AuthLike,
  "getPrincipal" | "getStatus" | "getIdentity" | "subscribe" | "dispose"
> & {
  signIn(options?: { maxTimeToLive?: bigint }): Promise<unknown>
  signOut(): Promise<unknown>
}

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const MODE_KEY = "b3note:session-mode"
const GUEST_KEY = "b3note:guest-key"
const RECOVERY_PREFIX = "b3note-guest-v1:"
/** Internet Identity sessions last a week. */
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

export class SessionAuth implements AuthLike {
  readonly #ii: InternetIdentityLike
  readonly #storage: KeyValueStorage
  readonly #listeners = new Set<() => void>()
  readonly #stopIi: () => void
  #guest: Ed25519KeyIdentity | null = null

  constructor(ii: InternetIdentityLike, storage: KeyValueStorage) {
    this.#ii = ii
    this.#storage = storage
    const seed = this.guestSeed()
    if (storage.getItem(MODE_KEY) === "guest" && seed) this.#guest = guestIdentity(seed)
    // Internet Identity's own changes (expiry, another tab) reach the client
    // only while it is the active source.
    this.#stopIi = ii.subscribe(() => {
      if (!this.#guest) this.#notify()
    })
  }

  /** Which source is signed in, or `null`. */
  get kind(): SessionKind | null {
    if (this.#guest) return "guest"
    return this.#ii.getStatus().state === "signed-in" ? "ii" : null
  }

  getPrincipal() {
    return this.#guest ? this.#guest.getPrincipal() : this.#ii.getPrincipal()
  }

  getStatus() {
    return this.#guest ? { state: "signed-in" as const } : this.#ii.getStatus()
  }

  async getIdentity(): Promise<Identity> {
    return this.#guest ?? this.#ii.getIdentity()
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #notify() {
    for (const listener of [...this.#listeners]) listener()
  }

  async signIn(options?: unknown): Promise<void> {
    const request = (options ?? { method: "ii" }) as SignInOptions
    if (request.method === "guest") {
      // A lingering Internet Identity session would take over again when the
      // guest signs out.
      if (this.#ii.getStatus().state === "signed-in") await this.#ii.signOut()
      const seed = request.seed ?? this.guestSeed() ?? randomBytes(32)
      this.#storage.setItem(GUEST_KEY, formatRecoveryKey(seed))
      this.#storage.setItem(MODE_KEY, "guest")
      this.#guest = guestIdentity(seed)
      this.#notify()
      return
    }
    const wasGuest = this.#guest !== null
    this.#guest = null
    this.#storage.setItem(MODE_KEY, "ii")
    try {
      await this.#ii.signIn({ maxTimeToLive: II_SESSION_NANOS })
    } finally {
      // Covers a cancelled sign-in, which leaves the user signed out.
      if (wasGuest || this.#ii.getStatus().state !== "signed-in") this.#notify()
    }
  }

  async signOut(): Promise<void> {
    this.#storage.removeItem(MODE_KEY)
    if (this.#guest) {
      this.#guest = null
      this.#notify()
      return
    }
    await this.#ii.signOut()
  }

  dispose(): void {
    this.#stopIi()
    this.#listeners.clear()
    this.#ii.dispose?.()
  }

  /** The guest seed stored in this browser, if any. */
  guestSeed(): Bytes | null {
    const stored = this.#storage.getItem(GUEST_KEY)
    return stored ? parseRecoveryKey(stored) : null
  }

  get hasGuestKey(): boolean {
    return this.#storage.getItem(GUEST_KEY) !== null
  }

  /** Removes the guest key from this browser. Only for a signed-out guest. */
  forgetGuestKey(): void {
    if (this.#guest) throw new Error("Sign out before removing the guest key.")
    this.#storage.removeItem(GUEST_KEY)
  }
}
