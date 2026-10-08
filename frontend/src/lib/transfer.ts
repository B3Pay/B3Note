/** Export and import of decrypted notes (JSON backup and Markdown). */
import { displayTitle, normalizeTags, type NoteContent } from "./note"

export interface ExportedNote extends NoteContent {
  createdAt: string
  updatedAt: string
}

export interface NotesExport {
  format: "b3note-export"
  version: 1
  exportedAt: string
  notes: ExportedNote[]
}

export function buildExport(notes: ExportedNote[], now = new Date()): NotesExport {
  return { format: "b3note-export", version: 1, exportedAt: now.toISOString(), notes }
}

export function noteToMarkdown(note: NoteContent): string {
  const lines = [`# ${displayTitle(note)}`, ""]
  if (note.tags.length > 0) lines.push(note.tags.map((t) => `#${t}`).join(" "), "")
  lines.push(note.body.trim(), "")
  return lines.join("\n")
}

export function markdownFileName(note: NoteContent): string {
  const slug = displayTitle(note)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
  return `${slug || "note"}.md`
}

/** Reads a B3Note JSON export or a Markdown/text file into notes. */
export function parseImport(fileName: string, text: string): NoteContent[] {
  if (fileName.toLowerCase().endsWith(".json")) {
    const data = JSON.parse(text) as Partial<NotesExport>
    if (data.format !== "b3note-export" || !Array.isArray(data.notes)) {
      throw new Error("This JSON file is not a B3Note export.")
    }
    return data.notes.map((note) => ({
      title: String(note.title ?? ""),
      body: String(note.body ?? ""),
      tags: normalizeTags(Array.isArray(note.tags) ? note.tags.map(String) : []),
      pinned: note.pinned === true,
    }))
  }
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  let title = fileName.replace(/\.(md|markdown|txt)$/i, "")
  const heading = lines.findIndex((line) => line.trim() !== "")
  if (heading >= 0 && /^#\s+/.test(lines[heading])) {
    title = lines[heading].replace(/^#\s+/, "").trim()
    lines.splice(heading, 1)
  }
  let tags: string[] = []
  const tagLine = lines.findIndex((line) => line.trim() !== "")
  if (tagLine >= 0 && /^(#[\p{L}\p{N}_-]+\s*)+$/u.test(lines[tagLine].trim())) {
    tags = normalizeTags(lines[tagLine].trim().split(/\s+/))
    lines.splice(tagLine, 1)
  }
  return [{ title, body: lines.join("\n").trim(), tags, pinned: false }]
}

export function download(fileName: string, contents: string, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
