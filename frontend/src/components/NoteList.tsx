import { Link } from "@tanstack/react-router"
import { CheckSquare, Flame, Lock, Pin } from "lucide-react"
import type { CSSProperties } from "react"
import type { DecryptedNote } from "../app/notes"
import { nanosToDate, relativeTime } from "../lib/format"
import { displayTitle, excerpt, taskProgress } from "../lib/note"
import { paperFor } from "./brand"

/** One note in the list: a small sheet of its own paper, folded at the corner. */
export function NoteListItem({ note, active }: { note: DecryptedNote; active: boolean }) {
  const content = note.content
  const tasks = content ? taskProgress(content.body) : { done: 0, total: 0 }
  const { paper, tilt } = paperFor(note.id)
  return (
    <Link
      to="/notes/$noteId"
      params={{ noteId: note.id }}
      data-paper={paper}
      aria-current={active ? "page" : undefined}
      style={{ "--tilt": tilt } as CSSProperties}
      className="bn-folded bn-note px-3.5 py-3"
    >
      <div className="flex items-center gap-1.5 pr-4">
        {content?.pinned ? <Pin className="h-3.5 w-3.5 shrink-0" aria-label="Pinned" /> : null}
        <span className="truncate text-[15px] leading-[22px] font-semibold">
          {content ? displayTitle(content) : "Unreadable note"}
        </span>
        {note.expiresAt ? (
          <Flame
            className="ml-auto h-3.5 w-3.5 shrink-0"
            aria-label={`Self-destructs ${relativeTime(nanosToDate(note.expiresAt))}`}
          />
        ) : null}
      </div>
      {content ? (
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-5 text-[var(--ink-muted)]">
          {excerpt(content) || "No content"}
        </p>
      ) : (
        <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-red-600">
          <Lock className="h-3 w-3" /> Could not be decrypted with your key
        </p>
      )}
      <div className="b3-meta mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 normal-case">
        <span>{relativeTime(nanosToDate(note.updatedAt))}</span>
        {tasks.total > 0 ? (
          <span className="inline-flex items-center gap-0.5">
            <CheckSquare className="h-3 w-3" /> {tasks.done}/{tasks.total}
          </span>
        ) : null}
        {content?.tags.slice(0, 3).map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </div>
    </Link>
  )
}
