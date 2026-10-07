/**
 * The ic-reactor 4 client of this tab and the backend canister handle.
 *
 * B3Note is a client-only app, so one client lives at module scope:
 * `ReactorProvider` borrows it for components (which read it with
 * `useClient()`), and the vault and share code use it directly.
 */
import { createClient, type Client } from "@ic-reactor/core"
import { AuthClient } from "@icp-sdk/auth/client"
import { AnonymousIdentity } from "@icp-sdk/core/agent"
import { actor, type Actor } from "./canisters/backend"
import { SessionAuth, type KeyValueStorage } from "./lib/sessionAuth"

export type { Actor }

/** The page is served by an asset canister on the IC's own domains. */
const servedByTheIc =
  typeof window !== "undefined" && /\.(icp0\.io|ic0\.app|icp\.net)$/.test(window.location.hostname)

/**
 * A page of an icp-cli local network (`<name>.local.localhost:<port>`): its
 * Internet Identity is the gateway's built-in one, which the asset canister's
 * `ic_env` cookie does not name (ic-reactor reports this as a gap).
 */
function localInternetIdentity() {
  if (typeof window === "undefined" || !window.location.hostname.endsWith(".localhost")) return undefined
  const { protocol, port } = window.location
  return {
    authorizeUrl: `${protocol}//id.ai.localhost${port ? `:${port}` : ""}/authorize`,
    canisterId: "rdmx6-jaaaa-aaaaa-aaadq-cai",
  }
}

function browserStorage(): KeyValueStorage {
  try {
    const storage = window.localStorage
    storage.getItem("b3note:probe")
    return storage
  } catch {
    // Private mode without storage: keep the session in memory.
    const memory = new Map<string, string>()
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    }
  }
}

let session: SessionAuth | undefined

// The page's own network: the local replica in development, mainnet on the
// IC. On the IC's domains no other canister can set this page's cookie, so
// the `ic_env` cookie (canister ids) is trusted there too.
const pageNetwork = { network: "env", ...(servedByTheIc ? { allowEnvConfig: true } : {}) } as const

export function createAppClient(): Client {
  return createClient({
    ...pageNetwork,
    auth: (network) => {
      session = new SessionAuth(
        new AuthClient({
          ...network,
          identityProvider: network.identityProvider ?? localInternetIdentity(),
        }),
        browserStorage(),
      )
      return session
    },
  })
}

export const client = createAppClient()

/**
 * An anonymous client that may send updates, for opening share links. A
 * signed-out `client` refuses updates, and a signed-in reader should not tie
 * their principal to the share they open; the backend expects anonymous
 * readers (they share its global vetKD budget, not a per-user one).
 */
export function createReaderClient(): Client {
  return createClient({ ...pageNetwork, identity: new AnonymousIdentity() })
}

/** The app's sign-in sources (Internet Identity and the guest key). */
export function sessionAuth(): SessionAuth {
  client.authState() // builds the auth on first use
  if (!session) throw new Error("Sign-in is only available in a browser.")
  return session
}

const BACKEND_ID: string | undefined = import.meta.env.CANISTER_ID_BACKEND || undefined

/** Where the backend is: a build-time id, or the `ic_env` cookie's `backend`. */
export const backendTarget = BACKEND_ID ? { id: BACKEND_ID } : { name: "backend" }

/** The backend canister on `of` (the component's `useClient()`, or this tab's client). */
export function backendOf(of: Client = client) {
  return of.canister<Actor>(actor, backendTarget)
}

export type Backend = ReturnType<typeof backendOf>
