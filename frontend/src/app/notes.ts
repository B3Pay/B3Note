/** The signed-in user's notes, decrypted. */
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"
import { queryClient } from "../clients"
import { notesQuery, type Note } from "../declarations/backend"
import type { NoteContent } from "../lib/note"
import type { Vault } from "../lib/vault"

export interface DecryptedNote {
  id: string
  version: bigint
  createdAt: bigint
  updatedAt: bigint
  expiresAt: bigint | null
  size: number
  /** `null` when the note could not be decrypted. */
  content: NoteContent | null
}

async function decryptAll(vault: Vault, notes: Note[]): Promise<DecryptedNote[]> {
  return Promise.all(
    notes.map(async (note) => {
      let content: NoteContent | null = null
      try {
        content = await vault.decrypt(note.id, note.version, note.ciphertext)
      } catch {
        content = null
      }
      return {
        id: note.id,
        version: note.version,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
        expiresAt: note.expires_at[0] ?? null,
        size: note.ciphertext.length,
        content,
      }
    }),
  )
}

export function useNotes(vault: Vault | null) {
  const list = notesQuery.useInfiniteQuery({ enabled: vault !== null })
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list
  const pageCount = list.data?.pages.length ?? 0

  // The app searches and sorts locally, so it loads every page. The page count
  // is a dependency because a fast reply can land before any render shows
  // `isFetchingNextPage`, leaving the other flags unchanged.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, pageCount])

  const raw = useMemo(() => list.data?.pages.flatMap((page) => page.notes) ?? [], [list.data])
  const signature = useMemo(() => raw.map((n) => `${n.id}:${n.version}`).join(","), [raw])

  const decrypted = useQuery(
    {
      queryKey: ["b3note", "decrypted-notes", vault?.principal ?? "", signature],
      queryFn: () => decryptAll(vault as Vault, raw),
      enabled: vault !== null && list.isSuccess,
      placeholderData: keepPreviousData,
      staleTime: Infinity,
      gcTime: 5 * 60_000,
    },
    queryClient,
  )

  return {
    notes: decrypted.data ?? [],
    isLoading: vault === null || list.isPending || (decrypted.isPending && raw.length > 0),
    isRefreshing: list.isFetching,
    loadingMore: hasNextPage === true,
    error: list.error ?? decrypted.error,
    refetch: () => list.refetch(),
  }
}
