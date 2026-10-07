import { Navigate, Outlet } from "@tanstack/react-router"
import { KeyRound, ShieldAlert } from "lucide-react"
import { useSession } from "../app/session"
import { retryUnlock, useVault } from "../app/vault"
import { WorkspaceProvider } from "../app/workspace"
import { Button, EmptyState, Spinner } from "../components/ui"

/** Requires a signed-in user and an unlocked vault for every child route. */
export function SignedInLayout() {
  const { session } = useSession()
  const vault = useVault()

  if (session.status === "restoring") {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner label="Checking your session…" />
      </div>
    )
  }
  if (session.status === "signedOut") return <Navigate to="/" />

  if (vault.status === "error") {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-10 w-10" />}
        title="Could not unlock your notes"
        action={
          <Button variant="primary" onClick={() => retryUnlock(session.principal)}>
            Try again
          </Button>
        }
      >
        {vault.error}
      </EmptyState>
    )
  }
  if (vault.status !== "ready") {
    return (
      <EmptyState icon={<KeyRound className="h-10 w-10 animate-pulse" />} title="Unlocking your notes">
        Your browser is asking the Internet Computer for your vetKey. It arrives encrypted to a one-time key
        that only this tab knows, and is verified before use.
      </EmptyState>
    )
  }
  return (
    <WorkspaceProvider vault={vault.vault}>
      <Outlet />
    </WorkspaceProvider>
  )
}
