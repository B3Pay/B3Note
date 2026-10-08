/**
 * The plaintext of a note. It is serialized to JSON and encrypted in the
 * browser; the canister never sees any of these fields.
 */
export interface NoteContent {
  title: string
  body: string
  tags: string[]
  pinned: boolean
}

export const EMPTY_NOTE: NoteContent = { title: "", body: "", tags: [], pinned: false }

const MAX_TAGS = 20
const MAX_TAG_LENGTH = 32

export function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/, "").toLowerCase().replace(/\s+/g, "-").slice(0, MAX_TAG_LENGTH)
}

export function normalizeTags(tags: string[]): string[] {
  const out: string[] = []
  for (const tag of tags.map(normalizeTag)) {
    if (tag && !out.includes(tag)) out.push(tag)
  }
  return out.slice(0, MAX_TAGS)
}

export function serializeNote(note: NoteContent): string {
  return JSON.stringify({
    v: 1,
    title: note.title,
    body: note.body,
    tags: normalizeTags(note.tags),
    pinned: note.pinned,
  })
}

export function parseNote(json: string): NoteContent {
  const value: unknown = JSON.parse(json)
  if (typeof value !== "object" || value === null) {
    throw new Error("Note is not an object")
  }
  const record = value as Record<string, unknown>
  return {
    title: typeof record.title === "string" ? record.title : "",
    body: typeof record.body === "string" ? record.body : "",
    tags: Array.isArray(record.tags)
      ? normalizeTags(record.tags.filter((t): t is string => typeof t === "string"))
      : [],
    pinned: record.pinned === true,
  }
}

/** The title to show, falling back to the first line of the body. */
export function displayTitle(note: NoteContent): string {
  const title = note.title.trim()
  if (title) return title
  const firstLine = note.body
    .split("\n")
    .map((line) => line.replace(/^[#>*\-\s[\]x]+/i, "").trim())
    .find(Boolean)
  return firstLine ? firstLine.slice(0, 80) : "Untitled"
}

/** A plain-text preview of the body for the note list. */
export function excerpt(note: NoteContent, length = 140): string {
  const text = note.body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~)(.+?)\1/g, "$2")
    .replace(/(^|\s)[*_](\S(?:.*?\S)?)[*_](?=$|[\s.,!?;:])/g, "$1$2")
    .replace(/`/g, "")
    .replace(/[#>]|[-*+] \[[ x]\]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > length ? `${text.slice(0, length - 1)}…` : text
}

/** Counts `- [ ]` / `- [x]` items in the body. */
export function taskProgress(body: string): { done: number; total: number } {
  const matches = body.match(/^\s*[-*+] \[( |x|X)\]/gm) ?? []
  const done = matches.filter((m) => /\[(x|X)\]/.test(m)).length
  return { done, total: matches.length }
}

/** Toggles the task checkbox on the given (1-based) line of a markdown body. */
export function toggleTask(body: string, line: number): string {
  const lines = body.split("\n")
  const index = line - 1
  if (index < 0 || index >= lines.length) return body
  lines[index] = lines[index].replace(
    /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\])/,
    (_match, open: string, mark: string, close: string) => `${open}${mark === " " ? "x" : " "}${close}`,
  )
  return lines.join("\n")
}
