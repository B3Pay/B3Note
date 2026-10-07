/** The signed-in user's notes, decrypted. */
import { useClient } from "@ic-reactor/react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo } from "react"
import type { Note } from "../canisters/backend"
import type { NoteContent } from "../lib/note"
import type { Vault } from "../lib/vault"
import { backendOf } from "../reactor"

const PAGE_SIZE = 200

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
        expiresAt: note.expires_at,
        size: note.ciphertext.length,
        content,
      }
    }),
  )
}

export function useNotes(vault: Vault | null) {
  const client = useClient()
  const backend = backendOf(client)

  // ic-reactor 4 builds no infinite query, so each page is a read the client
  // builds (caller-scoped key, cancellation on a change of caller), and the
  // list lives under the same caller-scoped prefix. A write to the backend
  // invalidates both.
  const list = useInfiniteQuery({
    queryKey: [...client.queryKey(backend, "list_notes"), "pages"],
    queryFn: ({ pageParam }) =>
      client.queryClient.fetchQuery(
        client.queryOptions(backend, "list_notes", { cursor: pageParam, limit: PAGE_SIZE }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.next_cursor,
    enabled: vault !== null,
    staleTime: 15_000,
  })
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
  const caller = client.caller()

  const decrypted = useQuery({
    queryKey: [...client.queryKey(backend, "list_notes"), "decrypted", signature],
    queryFn: () => decryptAll(vault as Vault, raw),
    enabled: vault !== null && list.isSuccess,
    // Keep showing the list while a changed note decrypts, but never across
    // callers (the key's third segment).
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === caller ? previous : undefined,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  })

  return {
    notes: decrypted.data ?? [],
    isLoading: vault === null || list.isPending || (decrypted.isPending && raw.length > 0),
    isRefreshing: list.isFetching,
    loadingMore: hasNextPage === true,
    error: list.error ?? decrypted.error,
    refetch: () => void list.refetch(),
  }
}
