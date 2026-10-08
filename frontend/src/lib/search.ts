/**
 * Client-side search. Notes are only readable in the browser, so search,
 * filtering and the context for "Ask your notes" all happen here.
 */
import { displayTitle, type NoteContent } from "./note"

export interface SearchableNote {
  id: string
  content: NoteContent
  updatedAt: bigint
}

const STOP_WORDS = new Set(
  "a an and are as at be but by for from has have i in is it its me my of on or our so that the their them they this to was we were what when where which who why will with you your".split(
    " ",
  ),
)

export function tokenize(text: string): string[] {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).filter((token) => token.length > 1 && !STOP_WORDS.has(token))
}

/** Every query word must appear in the title, body or tags. */
export function matchesQuery(note: NoteContent, query: string): boolean {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = `${note.title}\n${note.body}\n${note.tags.join(" ")}`.toLowerCase()
  return words.every((word) => haystack.includes(word.replace(/^#/, "")))
}

/** Pinned first, then most recently updated. */
export function sortNotes<T extends SearchableNote>(notes: T[]): T[] {
  return [...notes].sort((a, b) => {
    if (a.content.pinned !== b.content.pinned) return a.content.pinned ? -1 : 1
    return a.updatedAt === b.updatedAt ? 0 : a.updatedAt > b.updatedAt ? -1 : 1
  })
}

export function allTags(notes: SearchableNote[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const note of notes) {
    for (const tag of note.content.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

/**
 * Ranks notes by relevance to a question (BM25 over title, tags and body,
 * with title and tag matches weighted up).
 */
export function rankNotes<T extends SearchableNote>(
  notes: T[],
  question: string,
): { note: T; score: number }[] {
  const terms = [...new Set(tokenize(question))]
  if (terms.length === 0 || notes.length === 0) return []
  const docs = notes.map((note) => {
    const title = tokenize(`${displayTitle(note.content)} ${note.content.tags.join(" ")}`)
    const body = tokenize(note.content.body)
    const frequencies = new Map<string, number>()
    for (const token of body) frequencies.set(token, (frequencies.get(token) ?? 0) + 1)
    for (const token of title) frequencies.set(token, (frequencies.get(token) ?? 0) + 3)
    return { note, frequencies, length: title.length * 3 + body.length }
  })
  const averageLength = docs.reduce((sum, doc) => sum + doc.length, 0) / docs.length || 1
  const k1 = 1.2
  const b = 0.75
  const ranked = docs.map((doc) => {
    let score = 0
    for (const term of terms) {
      const tf = doc.frequencies.get(term) ?? 0
      if (tf === 0) continue
      const containing = docs.filter((d) => d.frequencies.has(term)).length
      const idf = Math.log(1 + (docs.length - containing + 0.5) / (containing + 0.5))
      score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.length) / averageLength))
    }
    return { note: doc.note, score }
  })
  return ranked.filter((r) => r.score > 0).sort((a, b) => b.score - a.score)
}

const textEncoder = new TextEncoder()

/**
 * Builds the context sent to the assistant for "Ask your notes": the most
 * relevant notes, each as `### title` plus its body, within `maxBytes`.
 * Falls back to the most recent notes when nothing matches the question.
 */
export function buildAskContext<T extends SearchableNote>(
  notes: T[],
  question: string,
  maxBytes: number,
  maxNotes = 8,
): { context: string; sources: T[] } {
  const ranked = rankNotes(notes, question).map((r) => r.note)
  const candidates = (ranked.length > 0 ? ranked : sortNotes(notes)).slice(0, maxNotes)
  const sections: string[] = []
  const sources: T[] = []
  let used = 0
  for (const note of candidates) {
    const header = `### ${displayTitle(note.content)}\n`
    const remaining = maxBytes - used - textEncoder.encode(header).length - 2
    if (remaining < 80) break
    let body = note.content.body.trim()
    while (textEncoder.encode(body).length > remaining) {
      body = `${body.slice(0, Math.floor(body.length * 0.8))}…`
    }
    const section = `${header}${body}`
    sections.push(section)
    sources.push(note)
    used += textEncoder.encode(section).length + 2
  }
  return { context: sections.join("\n\n"), sources }
}
