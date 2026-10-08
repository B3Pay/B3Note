import { useClient } from "@ic-reactor/react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate, useParams, useSearch } from "@tanstack/react-router"
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  Flame,
  Lock,
  MoreHorizontal,
  PenLine,
  Pin,
  PinOff,
  Share2,
  Sparkles,
  Trash2,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAiEnabled } from "../app/features"
import type { DecryptedNote } from "../app/notes"
import { useWorkspace } from "../app/workspace"
import { AiPanel, type AiSelection } from "../components/AiPanel"
import { Dialog } from "../components/Dialog"
import { Markdown } from "../components/Markdown"
import { ShareDialog } from "../components/ShareDialog"
import { TagEditor } from "../components/TagEditor"
import { Button, EmptyState, Notice, Spinner, cn } from "../components/ui"
import { backendErrorTag, errorMessage } from "../lib/errors"
import {
  DURATION_CHOICES,
  dateToNanos,
  formatBytes,
  formatDateTime,
  nanosToDate,
  relativeTime,
} from "../lib/format"
import { EMPTY_NOTE, displayTitle, normalizeTags, toggleTask, type NoteContent } from "../lib/note"
import { download, markdownFileName, noteToMarkdown } from "../lib/transfer"
import type { Vault } from "../lib/vault"
import { backendOf } from "../reactor"

const AUTOSAVE_DELAY_MS = 900

export function NoteEditorRoute() {
  const { noteId } = useParams({ strict: false }) as { noteId: string }
  const { draft } = useSearch({ strict: false }) as { draft?: boolean }
  const { notes, vault, isLoading } = useWorkspace()
  const note = notes.find((n) => n.id === noteId)

  // Wait for the list: a reload of a just-created note still has `?draft`.
  if (!note && isLoading) {
    return (
      <div className="p-10 text-center">
        <Spinner label="Loading…" />
      </div>
    )
  }
  if (!note && !draft) {
    return (
      <EmptyState icon={<Flame className="h-10 w-10" />} title="This note is gone">
        It may have been deleted, or it self-destructed.
      </EmptyState>
    )
  }
  if (note && note.content === null) {
    return (
      <EmptyState icon={<Lock className="h-10 w-10" />} title="This note cannot be decrypted">
        Its ciphertext does not authenticate with your key. It may have been written by an older version of
        B3Note or tampered with.
      </EmptyState>
    )
  }
  return <NoteEditor key={noteId} id={noteId} initial={note ?? null} vault={vault} />
}

type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict"

function isEmpty(content: NoteContent) {
  return !content.title.trim() && !content.body.trim() && content.tags.length === 0
}

function NoteEditor({ id, initial, vault }: { id: string; initial: DecryptedNote | null; vault: Vault }) {
  const navigate = useNavigate()
  const { notes } = useWorkspace()
  const client = useClient()
  const backend = backendOf(client)
  // Each write invalidates the backend's reads (the note list, the account).
  const createNote = useMutation(client.mutationOptions(backend, "create_note"))
  const updateNote = useMutation(client.mutationOptions(backend, "update_note"))
  const deleteNote = useMutation(client.mutationOptions(backend, "delete_note"))
  const { mutateAsync: createAsync } = createNote
  const { mutateAsync: updateAsync } = updateNote
  const [content, setContent] = useState<NoteContent>(initial?.content ?? EMPTY_NOTE)
  const [expiresAt, setExpiresAt] = useState<bigint | null>(initial?.expiresAt ?? null)
  const [status, setStatus] = useState<SaveStatus>("saved")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [mode, setMode] = useState<"edit" | "preview">(initial?.content?.body.trim() ? "preview" : "edit")
  const [shareOpen, setShareOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const aiEnabled = useAiEnabled()
  const [aiSelection, setAiSelection] = useState<AiSelection | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // The server version this editor's content is based on (null: not created yet).
  const version = useRef<bigint | null>(initial?.version ?? null)
  const latest = useRef({ content, expiresAt })
  latest.current = { content, expiresAt }
  const saving = useRef<Promise<void> | null>(null)
  const pending = useRef(false)
  const textarea = useRef<HTMLTextAreaElement>(null)

  const save = useCallback(
    async (force = false): Promise<void> => {
      if (saving.current) {
        pending.current = true
        return saving.current
      }
      const { content: current, expiresAt: expiry } = latest.current
      if (version.current === null && isEmpty(current)) {
        setStatus("saved")
        return
      }
      setStatus("saving")
      setSaveError(null)
      const run = (async () => {
        try {
          const ciphertext = await vault.encrypt(id, current)
          const saved =
            version.current === null
              ? await createAsync({ id, ciphertext, expires_at: expiry })
              : await updateAsync({
                  id,
                  ciphertext,
                  expires_at: expiry,
                  expected_version: force ? null : version.current,
                })
          const created = version.current === null
          version.current = saved.version
          setStatus(pending.current ? "dirty" : "saved")
          if (created) {
            // The note exists now: drop `?draft` so a reload opens it.
            void navigate({ to: "/notes/$noteId", params: { noteId: id }, search: {}, replace: true })
          }
        } catch (error) {
          if (backendErrorTag(error) === "Conflict") {
            setStatus("conflict")
          } else {
            setStatus("error")
            setSaveError(errorMessage(error))
          }
          pending.current = false
        } finally {
          saving.current = null
        }
      })()
      saving.current = run
      await run
      if (pending.current) {
        pending.current = false
        await save()
      }
    },
    [id, vault, navigate, createAsync, updateAsync],
  )

  // Autosave shortly after the last change.
  useEffect(() => {
    if (status !== "dirty") return
    const timer = setTimeout(() => void save(), AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [status, content, expiresAt, save])

  // Save what is left when the editor closes, and warn before leaving the page.
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (saving.current || pending.current) event.preventDefault()
    }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [])
  const statusRef = useRef(status)
  statusRef.current = status
  useEffect(
    () => () => {
      if (statusRef.current === "dirty") void save()
    },
    [save],
  )

  // Another device saved a newer version while this editor had no changes.
  const server = notes.find((n) => n.id === id)
  useEffect(() => {
    if (!server?.content || version.current === null) return
    if (server.version > version.current && status === "saved") {
      version.current = server.version
      setContent(server.content)
      setExpiresAt(server.expiresAt)
    }
  }, [server, status])

  const update = (patch: Partial<NoteContent>) => {
    setContent((current) => ({ ...current, ...patch }))
    setStatus("dirty")
  }

  const resolveConflictKeepServer = () => {
    if (server?.content) {
      version.current = server.version
      setContent(server.content)
      setExpiresAt(server.expiresAt)
    }
    setStatus("saved")
  }

  const openAi = () => {
    const area = textarea.current
    if (mode === "edit" && area && area.selectionEnd > area.selectionStart) {
      setAiSelection({
        start: area.selectionStart,
        end: area.selectionEnd,
        text: content.body.slice(area.selectionStart, area.selectionEnd),
      })
    } else {
      setAiSelection(null)
    }
    setAiOpen(true)
  }

  const remove = async () => {
    setDeleteOpen(false)
    if (version.current === null) {
      await navigate({ to: "/notes" })
      return
    }
    try {
      await deleteNote.mutateAsync(id)
      toast.success("Note deleted")
      await navigate({ to: "/notes" })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const created = initial ? nanosToDate(initial.createdAt) : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 px-2 py-2 sm:px-4 dark:border-zinc-800">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Back to notes"
          onClick={() => void navigate({ to: "/notes" })}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
          {(["edit", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
                mode === m ? "bg-white shadow-sm dark:bg-zinc-800" : "text-zinc-500",
              )}
            >
              {m === "edit" ? <PenLine className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {m === "edit" ? "Write" : "Read"}
            </button>
          ))}
        </div>
        <SaveIndicator status={status} />
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={content.pinned ? "Unpin" : "Pin"}
            title={content.pinned ? "Unpin" : "Pin to the top"}
            onClick={() => update({ pinned: !content.pinned })}
          >
            {content.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </Button>
          {aiEnabled ? (
            <Button
              variant="brand-soft"
              size="sm"
              aria-label="AI"
              onClick={openAi}
              disabled={isEmpty(content)}
            >
              <Sparkles className="h-4 w-4" /> <span className="hidden sm:inline">AI</span>
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={async () => {
              if (status === "dirty") await save()
              setShareOpen(true)
            }}
            disabled={isEmpty(content)}
            aria-label="Share"
          >
            <Share2 className="h-4 w-4" /> <span className="hidden sm:inline">Share</span>
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              aria-label="More actions"
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {menuOpen ? (
              <div
                className="absolute right-0 z-10 mt-1 w-52 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <MenuItem
                  icon={<Copy className="h-4 w-4" />}
                  label="Copy as Markdown"
                  onClick={async () => {
                    await navigator.clipboard.writeText(noteToMarkdown(content))
                    toast.success("Copied")
                    setMenuOpen(false)
                  }}
                />
                <MenuItem
                  icon={<Download className="h-4 w-4" />}
                  label="Download .md"
                  onClick={() => {
                    download(markdownFileName(content), noteToMarkdown(content), "text/markdown")
                    setMenuOpen(false)
                  }}
                />
                <MenuItem
                  icon={<Trash2 className="h-4 w-4" />}
                  label="Delete note"
                  danger
                  onClick={() => {
                    setMenuOpen(false)
                    setDeleteOpen(true)
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {status === "conflict" ? (
        <Notice tone="warning" className="m-3 flex flex-wrap items-center gap-2">
          <span className="flex-1">This note was changed on another device since you opened it.</span>
          <Button size="sm" onClick={resolveConflictKeepServer}>
            Use theirs
          </Button>
          <Button size="sm" variant="primary" onClick={() => void save(true)}>
            Keep mine
          </Button>
        </Notice>
      ) : null}
      {status === "error" && saveError ? (
        <Notice tone="danger" className="m-3 flex items-center gap-2">
          <span className="flex-1">Not saved: {saveError}</span>
          <Button size="sm" onClick={() => void save()}>
            Retry
          </Button>
        </Notice>
      ) : null}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8">
          <input
            value={content.title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder={content.body.trim() ? displayTitle(content) : "Title"}
            aria-label="Title"
            className="w-full bg-transparent text-2xl font-bold tracking-tight placeholder:text-zinc-300 focus:outline-none sm:text-3xl dark:placeholder:text-zinc-700"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TagEditor tags={content.tags} onChange={(tags) => update({ tags: normalizeTags(tags) })} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            <ExpiryControl
              expiresAt={expiresAt}
              onChange={(next) => {
                setExpiresAt(next)
                setStatus("dirty")
              }}
            />
            {created ? <span title={formatDateTime(created)}>Created {relativeTime(created)}</span> : null}
            {initial ? <span>{formatBytes(initial.size)} encrypted</span> : null}
          </div>

          <div className="mt-6">
            {mode === "edit" ? (
              <AutoGrowTextarea
                ref={textarea}
                value={content.body}
                onChange={(body) => update({ body })}
                autoFocus={!initial}
              />
            ) : content.body.trim() ? (
              <div onDoubleClick={() => setMode("edit")}>
                <Markdown
                  source={content.body}
                  onToggleTask={(line) => update({ body: toggleTask(content.body, line) })}
                />
              </div>
            ) : (
              <button type="button" className="text-zinc-400" onClick={() => setMode("edit")}>
                Nothing here yet. Click to write.
              </button>
            )}
          </div>
        </div>
      </div>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        noteId={version.current === null ? null : id}
        content={content}
      />
      <AiPanel
        open={aiEnabled && aiOpen}
        onClose={() => setAiOpen(false)}
        content={content}
        selection={aiSelection}
        onApply={(patch) => {
          update(patch)
          setMode("preview")
        }}
      />
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this note?"
        description="It is removed from the canister and its share links stop working. This cannot be undone."
      >
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void remove()}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </Dialog>
    </div>
  )
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const label = {
    saved: "Saved",
    dirty: "Unsaved changes",
    saving: "Encrypting & saving…",
    error: "Not saved",
    conflict: "Conflict",
  }[status]
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center gap-1 text-xs",
        status === "error" || status === "conflict" ? "text-red-600" : "text-zinc-500",
      )}
      aria-live="polite"
    >
      {status === "saved" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : null}
      {status === "saving" ? <Spinner className="text-xs" /> : null}
      {label}
    </span>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800",
        danger && "text-red-600",
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function ExpiryControl({
  expiresAt,
  onChange,
}: {
  expiresAt: bigint | null
  onChange: (next: bigint | null) => void
}) {
  const options = [
    {
      value: "keep",
      label: expiresAt ? `Self-destructs ${relativeTime(nanosToDate(expiresAt))}` : "Keeps forever",
    },
    ...(expiresAt ? [{ value: "never", label: "Keep forever" }] : []),
    ...DURATION_CHOICES.map((choice) => ({
      value: String(choice.seconds),
      label: `Self-destruct in ${choice.label}`,
    })),
  ]
  return (
    <span className={cn("inline-flex items-center gap-1", expiresAt !== null && "text-orange-600")}>
      <Flame className="h-3.5 w-3.5" />
      <select
        aria-label="Self-destruct timer"
        value="keep"
        className="h-7 cursor-pointer rounded-md bg-transparent pr-1 text-xs hover:bg-zinc-100 focus:outline-none dark:hover:bg-zinc-800"
        onChange={(e) => {
          const value = e.target.value
          if (value === "keep") return
          if (value === "never") onChange(null)
          else onChange(dateToNanos(new Date(Date.now() + Number(value) * 1000)))
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </span>
  )
}

const AutoGrowTextarea = ({
  ref,
  value,
  onChange,
  autoFocus,
}: {
  ref: React.Ref<HTMLTextAreaElement>
  value: string
  onChange: (value: string) => void
  autoFocus?: boolean
}) => {
  const inner = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    const area = inner.current
    if (!area) return
    area.style.height = "auto"
    area.style.height = `${Math.max(area.scrollHeight, 320)}px`
  }, [value])
  return (
    <textarea
      ref={(node) => {
        inner.current = node
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.RefObject<HTMLTextAreaElement | null>).current = node
      }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoFocus={autoFocus}
      placeholder={"Start writing… Markdown works: **bold**, # headings, - [ ] tasks"}
      aria-label="Note text"
      spellCheck
      className="min-h-80 w-full resize-none bg-transparent font-mono text-[15px] leading-7 placeholder:text-zinc-400 focus:outline-none"
    />
  )
}
