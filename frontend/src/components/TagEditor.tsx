import { Plus } from "lucide-react"
import { useState } from "react"
import { normalizeTag } from "../lib/note"
import { TagChip } from "./ui"

export function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState("")

  const commit = () => {
    const tag = normalizeTag(draft)
    if (tag && !tags.includes(tag)) onChange([...tags, tag])
    setDraft("")
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <TagChip key={tag} tag={tag} onRemove={() => onChange(tags.filter((t) => t !== tag))} />
      ))}
      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault()
              commit()
            }
            if (e.key === "Escape") {
              setDraft("")
              setAdding(false)
            }
          }}
          placeholder="tag"
          aria-label="New tag"
          className="h-6 w-24 rounded-full border border-zinc-300 bg-transparent px-2 text-xs focus:border-brand-500 focus:outline-none dark:border-zinc-700"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-6 items-center gap-0.5 rounded-full px-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          <Plus className="h-3 w-3" /> tag
        </button>
      )}
    </div>
  )
}
