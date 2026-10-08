import { describe, expect, it } from "vitest"
import { AI_ACTIONS, noteAsPrompt, parseTags, toAiTask } from "./ai"
import { fromBase64Url, fromHex, idBytes, newId, toBase64Url, toHex } from "./bytes"
import { formatBytes, relativeTime } from "./format"
import {
  displayTitle,
  excerpt,
  normalizeTags,
  parseNote,
  serializeNote,
  taskProgress,
  toggleTask,
} from "./note"
import { allTags, buildAskContext, matchesQuery, rankNotes, sortNotes } from "./search"
import { buildExport, markdownFileName, noteToMarkdown, parseImport } from "./transfer"

const note = (title: string, body: string, tags: string[] = [], pinned = false) => ({
  title,
  body,
  tags,
  pinned,
})

describe("bytes", () => {
  it("round-trips hex and base64url", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 254, 255])
    expect(fromHex(toHex(bytes))).toEqual(bytes)
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes)
    expect(toBase64Url(new Uint8Array([251, 255]))).toBe("-_8")
  })

  it("makes 128-bit hex ids", () => {
    const { id, bytes } = newId()
    expect(id).toMatch(/^[0-9a-f]{32}$/)
    expect(idBytes(id)).toEqual(bytes)
    expect(() => idBytes("ABC")).toThrow()
  })
})

describe("note format", () => {
  it("serializes and parses notes defensively", () => {
    const original = note("Hello", "World", ["Work", "#work", "Deep Work"], true)
    expect(parseNote(serializeNote(original))).toEqual(note("Hello", "World", ["work", "deep-work"], true))
    expect(parseNote('{"title": 3, "tags": ["a", 1]}')).toEqual(note("", "", ["a"]))
    expect(() => parseNote("null")).toThrow()
  })

  it("derives titles, excerpts and task progress", () => {
    expect(displayTitle(note("", "\n# Groceries\nmilk"))).toBe("Groceries")
    expect(displayTitle(note("", ""))).toBe("Untitled")
    expect(excerpt(note("", "**Bold** [link](https://x) `code`"))).toBe("Bold link code")
    expect(excerpt(note("", "Booked for **May 3**. Done"))).toBe("Booked for May 3. Done")
    expect(excerpt(note("", "Uses dfx_test_key and _this_ ~~old~~"))).toBe("Uses dfx_test_key and this old")
    const body = "- [ ] one\n- [x] two\n* [X] three"
    expect(taskProgress(body)).toEqual({ done: 2, total: 3 })
    expect(toggleTask(body, 1)).toBe("- [x] one\n- [x] two\n* [X] three")
    expect(toggleTask(body, 3)).toBe("- [ ] one\n- [x] two\n* [ ] three")
    expect(toggleTask("> 1. [ ] quoted", 1)).toBe("> 1. [x] quoted")
    expect(toggleTask("plain line", 1)).toBe("plain line")
    expect(toggleTask(body, 9)).toBe(body)
  })

  it("normalizes tags", () => {
    expect(normalizeTags([" Foo ", "foo", "", "#Bar Baz"])).toEqual(["foo", "bar-baz"])
  })
})

describe("search", () => {
  const notes = [
    { id: "1", updatedAt: 1n, content: note("Budget 2026", "rent, food, travel costs", ["money"]) },
    {
      id: "2",
      updatedAt: 3n,
      content: note("Trip to Lisbon", "flights and hotel; travel budget 900", ["travel"]),
    },
    { id: "3", updatedAt: 2n, content: note("Recipes", "pasta with tomato", [], true) },
  ]

  it("filters, sorts and counts tags", () => {
    expect(notes.filter((n) => matchesQuery(n.content, "travel budget")).map((n) => n.id)).toEqual(["1", "2"])
    expect(notes.filter((n) => matchesQuery(n.content, "#money")).map((n) => n.id)).toEqual(["1"])
    expect(sortNotes(notes).map((n) => n.id)).toEqual(["3", "2", "1"])
    expect(allTags(notes)).toEqual([
      { tag: "money", count: 1 },
      { tag: "travel", count: 1 },
    ])
  })

  it("ranks by relevance and builds a bounded context", () => {
    expect(rankNotes(notes, "What is my travel budget for Lisbon?")[0].note.id).toBe("2")
    const { context, sources } = buildAskContext(notes, "lisbon hotel", 120)
    expect(sources.map((s) => s.id)).toEqual(["2"])
    expect(context.startsWith("### Trip to Lisbon\n")).toBe(true)
    expect(new TextEncoder().encode(context).length).toBeLessThanOrEqual(120)
    // Nothing relevant: fall back to the most recent notes.
    expect(buildAskContext(notes, "zzz", 4_000).sources[0].id).toBe("3")
  })
})

describe("transfer", () => {
  it("exports markdown and imports it back", () => {
    const original = note("Plan", "- [ ] ship", ["work", "q3"])
    const markdown = noteToMarkdown(original)
    expect(markdown).toBe("# Plan\n\n#work #q3\n\n- [ ] ship\n")
    expect(parseImport("plan.md", markdown)).toEqual([original])
    expect(parseImport("Untitled thoughts.txt", "just text")).toEqual([
      note("Untitled thoughts", "just text"),
    ])
    expect(markdownFileName(note("Café plans!", ""))).toBe("café-plans.md")
  })

  it("imports a JSON export", () => {
    const data = buildExport([{ ...note("A", "b", ["c"], true), createdAt: "x", updatedAt: "y" }])
    expect(parseImport("backup.json", JSON.stringify(data))).toEqual([note("A", "b", ["c"], true)])
    expect(() => parseImport("other.json", "{}")).toThrow(/not a B3Note export/)
  })
})

describe("ai helpers", () => {
  it("maps actions to backend tasks", () => {
    expect(toAiTask("Translate", "German")).toEqual({ tag: "Translate", value: "German" })
    expect(toAiTask("Summarize")).toEqual({ tag: "Summarize" })
    expect(AI_ACTIONS.map((a) => a.id)).toContain("ActionItems")
    expect(noteAsPrompt("Title", "Body")).toBe("# Title\n\nBody")
    expect(noteAsPrompt(" ", "Body")).toBe("Body")
    expect(parseTags("work, travel\nbudget")).toEqual(["work", "travel", "budget"])
  })
})

describe("format", () => {
  it("formats sizes and relative times", () => {
    expect(formatBytes(512)).toBe("512 B")
    expect(formatBytes(2048n)).toBe("2.0 KB")
    const now = Date.UTC(2026, 0, 1)
    expect(relativeTime(new Date(now - 10_000), now)).toBe("just now")
    expect(relativeTime(new Date(now + 3 * 3_600_000), now)).toBe("in 3 hours")
  })
})
