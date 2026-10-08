import { Link } from "@tanstack/react-router"
import { CheckSquare, Flame, Lock, Pin } from "lucide-react"
import type { DecryptedNote } from "../app/notes"
import { nanosToDate, relativeTime } from "../lib/format"
import { displayTitle, excerpt, taskProgress } from "../lib/note"
import { cn } from "./ui"

export function NoteListItem({ note, active }: { note: DecryptedNote; active: boolean }) {
  const content = note.content
  const tasks = content ? taskProgress(content.body) : { done: 0, total: 0 }
  return (
    <Link
      to="/notes/$noteId"
      params={{ noteId: note.id }}
      className={cn(
        "block rounded-xl border px-3 py-2.5 transition-colors",
        active
          ? "border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/40"
          : "border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900",
      )}
    >
      <div className="flex items-center gap-1.5">
        {content?.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" /> : null}
        <span className="truncate text-sm font-medium">
          {content ? displayTitle(content) : "Unreadable note"}
        </span>
        {note.expiresAt ? (
          <Flame
            className="ml-auto h-3.5 w-3.5 shrink-0 text-orange-500"
            aria-label={`Self-destructs ${relativeTime(nanosToDate(note.expiresAt))}`}
          />
        ) : null}
      </div>
      {content ? (
        <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {excerpt(content) || "No content"}
        </p>
      ) : (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-red-600">
          <Lock className="h-3 w-3" /> Could not be decrypted with your key
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-400">
        <span>{relativeTime(nanosToDate(note.updatedAt))}</span>
        {tasks.total > 0 ? (
          <span className="inline-flex items-center gap-0.5">
            <CheckSquare className="h-3 w-3" /> {tasks.done}/{tasks.total}
          </span>
        ) : null}
        {content?.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="text-brand-600 dark:text-brand-400">
            #{tag}
          </span>
        ))}
      </div>
    </Link>
  )
}
