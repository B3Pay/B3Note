import { createContext, useContext, type ReactNode } from "react"
import type { Vault } from "../lib/vault"
import { useNotes, type DecryptedNote } from "./notes"

export interface Workspace {
  vault: Vault
  notes: DecryptedNote[]
  isLoading: boolean
  isRefreshing: boolean
  error: unknown
  refetch: () => void
}

const WorkspaceContext = createContext<Workspace | null>(null)

export function WorkspaceProvider({ vault, children }: { vault: Vault; children: ReactNode }) {
  const { notes, isLoading, isRefreshing, error, refetch } = useNotes(vault)
  return (
    <WorkspaceContext.Provider value={{ vault, notes, isLoading, isRefreshing, error, refetch }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext)
  if (!workspace) throw new Error("useWorkspace must be used inside the signed-in layout")
  return workspace
}
