import type { AiTask } from "../declarations/backend/declarations/backend"

export type AiActionId =
  | "Summarize"
  | "SuggestTitle"
  | "SuggestTags"
  | "Improve"
  | "FixGrammar"
  | "Shorten"
  | "ActionItems"
  | "Translate"
  | "Continue"

/** How a result is applied to the note. */
export type AiApply = "replace" | "append" | "title" | "tags"

export interface AiAction {
  id: AiActionId
  label: string
  hint: string
  apply: AiApply
}

export const AI_ACTIONS: AiAction[] = [
  { id: "Summarize", label: "Summarize", hint: "A short summary to put at the end", apply: "append" },
  { id: "SuggestTitle", label: "Suggest a title", hint: "A title from the content", apply: "title" },
  { id: "SuggestTags", label: "Suggest tags", hint: "Topic tags for organizing", apply: "tags" },
  { id: "Improve", label: "Improve writing", hint: "Clearer and better structured", apply: "replace" },
  { id: "FixGrammar", label: "Fix spelling & grammar", hint: "Corrections only", apply: "replace" },
  { id: "Shorten", label: "Make shorter", hint: "About half the length", apply: "replace" },
  { id: "ActionItems", label: "Extract action items", hint: "A checklist of to-dos", apply: "append" },
  { id: "Translate", label: "Translate", hint: "Into another language", apply: "replace" },
  { id: "Continue", label: "Continue writing", hint: "One or two more paragraphs", apply: "append" },
]

export const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Dutch",
  "Persian",
  "Arabic",
  "Turkish",
  "Russian",
  "Chinese",
  "Japanese",
  "Korean",
  "Hindi",
]

export function toAiTask(id: AiActionId, language = "English"): AiTask {
  switch (id) {
    case "Translate":
      return { Translate: language }
    case "Summarize":
      return { Summarize: null }
    case "SuggestTitle":
      return { SuggestTitle: null }
    case "SuggestTags":
      return { SuggestTags: null }
    case "Improve":
      return { Improve: null }
    case "FixGrammar":
      return { FixGrammar: null }
    case "Shorten":
      return { Shorten: null }
    case "ActionItems":
      return { ActionItems: null }
    case "Continue":
      return { Continue: null }
  }
}

/** The text sent to the assistant for a note: its title and body. */
export function noteAsPrompt(title: string, body: string): string {
  return title.trim() ? `# ${title.trim()}\n\n${body}` : body
}

export function parseTags(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

const CONSENT_KEY = "b3note:ai-consent"

export function hasAiConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "1"
  } catch {
    return false
  }
}

export function setAiConsent(granted: boolean): void {
  try {
    if (granted) localStorage.setItem(CONSENT_KEY, "1")
    else localStorage.removeItem(CONSENT_KEY)
  } catch {
    // Storage unavailable: ask again next time.
  }
}
