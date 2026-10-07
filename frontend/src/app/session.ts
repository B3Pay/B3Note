/** Who is signed in, in components: ic-reactor's `useAuth()` plus the source. */
import { useAuth } from "@ic-reactor/react"
import { client, sessionAuth } from "../reactor"
import type { SessionKind, SignInOptions } from "../lib/sessionAuth"
import { forgetVaultKey } from "./vault"

export interface Session {
  status: ReturnType<typeof useAuth>["status"]
  signedIn: boolean
  /** The caller's principal text (`2vxsx-fae` when nobody is signed in). */
  principal: string
  kind: SessionKind | null
}

export function useSession(): Session {
  const auth = useAuth()
  const signedIn = auth.status === "signed-in"
  return {
    status: auth.status,
    signedIn,
    principal: auth.principal,
    kind: signedIn ? sessionAuth().kind : null,
  }
}

/** Opens Internet Identity. Call it from a click handler. */
export function signInWithInternetIdentity(): Promise<void> {
  return client.signIn({ method: "ii" } satisfies SignInOptions)
}

/** Signs in with the stored guest key, an imported one (`seed`), or a new one. */
export function continueAsGuest(seed?: Uint8Array): Promise<void> {
  return client.signIn({ method: "guest", seed } satisfies SignInOptions)
}

/** Signs out and drops this account's cached note key from the browser. */
export async function signOut(): Promise<void> {
  const principal = client.caller()
  await forgetVaultKey(principal)
  await client.signOut()
}
