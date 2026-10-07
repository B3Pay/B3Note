import { Outlet, useNavigate, useParams } from "@tanstack/react-router"
import { FilePlus2, NotebookPen, RefreshCw, Search, X } from "lucide-react"
import { useMemo, useState } from "react"
import { useWorkspace } from "../app/workspace"
import { NoteListItem } from "../components/NoteList"
import { Button, EmptyState, Input, Notice, Spinner, TagChip, cn } from "../components/ui"
import { newId } from "../lib/bytes"
import { errorMessage } from "../lib/errors"
import { allTags, matchesQuery, sortNotes } from "../lib/search"

export function NotesLayout() {
  const { notes, isLoading, isRefreshing, error, refetch } = useWorkspace()
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { noteId?: string }
  const [query, setQuery] = useState("")
  const [tag, setTag] = useState<string | null>(null)

  const readable = useMemo(
    () => notes.flatMap((n) => (n.content ? [{ ...n, content: n.content }] : [])),
    [notes],
  )
  const tags = useMemo(() => allTags(readable), [readable])
  const visible = useMemo(() => {
    const filtering = Boolean(query.trim() || tag)
    const unreadable = filtering ? [] : notes.filter((n) => n.content === null)
    const matching = sortNotes(
      readable.filter((n) => (!tag || n.content.tags.includes(tag)) && matchesQuery(n.content, query)),
    )
    return [...matching, ...unreadable]
  }, [notes, readable, tag, query])

  const newNote = () => {
    const { id } = newId()
    void navigate({ to: "/notes/$noteId", params: { noteId: id }, search: { draft: true } })
  }

  const editorOpen = Boolean(params.noteId)

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem)] max-w-7xl">
      <aside
        className={cn(
          "flex w-full flex-col border-zinc-200 md:w-80 md:shrink-0 md:border-r lg:w-96 dark:border-zinc-800",
          editorOpen && "hidden md:flex",
        )}
      >
        <div className="space-y-3 border-b border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your notes"
                className="pl-9"
                aria-label="Search notes"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <Button variant="primary" size="icon" onClick={newNote} aria-label="New note" title="New note">
              <FilePlus2 className="h-4 w-4" />
            </Button>
          </div>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.slice(0, 16).map(({ tag: t, count }) => (
                <TagChip
                  key={t}
                  tag={t}
                  count={count}
                  active={tag === t}
                  onClick={() => setTag(tag === t ? null : t)}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between px-4 pt-2 text-xs text-zinc-500">
          <span>
            {visible.length} {visible.length === 1 ? "note" : "notes"}
            {query || tag ? ` of ${notes.length}` : ""}
          </span>
          <button
            type="button"
            onClick={refetch}
            className="inline-flex items-center gap-1 rounded px-1 hover:text-zinc-800 dark:hover:text-zinc-200"
            aria-label="Refresh notes"
          >
            <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
          </button>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {error ? <Notice tone="danger">{errorMessage(error)}</Notice> : null}
          {isLoading ? (
            <div className="p-6 text-center">
              <Spinner label="Decrypting your notes…" />
            </div>
          ) : notes.length === 0 ? (
            <EmptyState
              icon={<NotebookPen className="h-10 w-10" />}
              title="No notes yet"
              action={
                <Button variant="primary" onClick={newNote}>
                  <FilePlus2 className="h-4 w-4" /> Write your first note
                </Button>
              }
            >
              Everything you write is encrypted in this browser before it is stored.
            </EmptyState>
          ) : visible.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">No notes match.</p>
          ) : (
            visible.map((note) => (
              <NoteListItem key={note.id} note={note} active={note.id === params.noteId} />
            ))
          )}
        </div>
      </aside>

      <main className={cn("min-w-0 flex-1", !editorOpen && "hidden md:block")}>
        <Outlet />
      </main>
    </div>
  )
}

export function NotesIndex() {
  const navigate = useNavigate()
  return (
    <EmptyState
      icon={<NotebookPen className="h-10 w-10" />}
      title="Select a note or start a new one"
      action={
        <Button
          variant="primary"
          onClick={() =>
            void navigate({ to: "/notes/$noteId", params: { noteId: newId().id }, search: { draft: true } })
          }
        >
          <FilePlus2 className="h-4 w-4" /> New note
        </Button>
      }
    >
      Tip: write <code>- [ ] task</code> for checklists, and use the AI assistant to summarize, retitle, tag
      or translate.
    </EmptyState>
  )
}
