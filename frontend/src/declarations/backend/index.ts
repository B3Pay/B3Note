/**
 * Canister entrypoint.
 *
 * Created once by @ic-reactor/codegen and safe to customize.
 * Keep the re-exports below if you want generated exports and types to stay in sync.
 *
 * Do not edit `index.generated.ts` or `index.factories.generated.ts`; they
 * are regenerated on each codegen run.
 * AI guide: https://ic-reactor.b3pay.net/llms-full.txt
 */
import { createInfiniteQuery, createMutation, reactorUpdateRetry } from "@ic-reactor/react"
import { getAccountQuery, getNoteQuery, listSharesQuery } from "./index.factories.generated"
import type { ListNotesArgs } from "./declarations/backend"
import { backendReactor } from "./index.generated"

export * from "./index.generated"
export * from "./index.factories.generated"
export type * from "./declarations/backend"

const NOTES_PAGE_SIZE = 200

/** Every note of the signed-in user, a page at a time. */
export const notesQuery = createInfiniteQuery(backendReactor, {
  functionName: "list_notes",
  initialPageParam: null as string | null,
  getArgs: (cursor: string | null): [ListNotesArgs] => [
    { cursor: cursor ? [cursor] : [], limit: [NOTES_PAGE_SIZE] },
  ],
  getNextPageParam: (page) => page.next_cursor[0] ?? null,
  staleTime: 15_000,
})

// The objects below replace the generated ones of the same name: they add
// cache invalidation and the safe retry for update calls.

export const createNoteMutation = createMutation(backendReactor, {
  functionName: "create_note",
  retry: reactorUpdateRetry,
  invalidateQueries: [notesQuery, getAccountQuery],
})

export const updateNoteMutation = createMutation(backendReactor, {
  functionName: "update_note",
  retry: reactorUpdateRetry,
  invalidateQueries: [notesQuery, getNoteQuery, getAccountQuery],
})

export const deleteNoteMutation = createMutation(backendReactor, {
  functionName: "delete_note",
  retry: reactorUpdateRetry,
  invalidateQueries: [notesQuery, getNoteQuery, getAccountQuery, listSharesQuery],
})

export const createShareMutation = createMutation(backendReactor, {
  functionName: "create_share",
  retry: reactorUpdateRetry,
  invalidateQueries: [listSharesQuery, getAccountQuery],
})

export const revokeShareMutation = createMutation(backendReactor, {
  functionName: "revoke_share",
  retry: reactorUpdateRetry,
  invalidateQueries: [listSharesQuery, getAccountQuery],
})

export const deleteAccountMutation = createMutation(backendReactor, {
  functionName: "delete_account",
  invalidateQueries: [notesQuery, getAccountQuery, listSharesQuery],
})

/** Each call derives a vetKey and costs the canister cycles: no blind retries. */
export const getEncryptedUserKeyMutation = createMutation(backendReactor, {
  functionName: "get_encrypted_user_key",
  retry: reactorUpdateRetry,
})

/** Opening spends a view of the link, so it is never retried. */
export const openShareMutation = createMutation(backendReactor, {
  functionName: "open_share",
})
