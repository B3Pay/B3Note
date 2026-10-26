/** What B3Note asks the on-device model for each assistant action, and for "Ask your notes". */
import type { AiActionId } from "./ai"
import type { LocalPrompt } from "./localAi"

const SYSTEM =
  "You help with notes in a private notes app. Work only with the text you are given. " +
  "Reply with the result only: no greeting, no preamble, no quotes around it, no explanation. " +
  "Keep the note's language and its Markdown."

const ASKS: Record<AiActionId, (text: string, language: string) => string> = {
  Summarize: (t) =>
    `Summarize this note in two to four short bullet points, each starting with "- ".\n\nNote:\n${t}`,
  SuggestTitle: (t) =>
    `Write a title for this note: six words at most, no quotes, no full stop at the end.\n\nNote:\n${t}`,
  SuggestTags: (t) =>
    `Suggest up to five short topic tags for this note: lowercase, comma-separated, no # signs.\n\nNote:\n${t}`,
  Improve: (t) =>
    `Rewrite this note to be clearer and better structured. Keep every fact, name, number, date and task.\n\nNote:\n${t}`,
  FixGrammar: (t) =>
    `Fix the spelling, grammar and punctuation of this note. Change nothing else: keep its words, meaning and line breaks.\n\nNote:\n${t}`,
  Shorten: (t) =>
    `Rewrite this note at about half its length. Keep every name, number, date and task.\n\nNote:\n${t}`,
  ActionItems: (t) =>
    `List the tasks in this note as a checklist, one per line, each starting with "- [ ] ". If there are none, reply exactly: No action items.\n\nNote:\n${t}`,
  Translate: (t, language) => `Translate this note into ${language}. Keep its Markdown.\n\nNote:\n${t}`,
  Continue: (t) =>
    `Continue this note with one or two short paragraphs in the same voice. Reply with the new text only.\n\nNote:\n${t}`,
}

const SHORT: AiActionId[] = ["SuggestTitle", "SuggestTags", "Summarize"]

export function localActionPrompt(id: AiActionId, text: string, language = "English"): LocalPrompt {
  return {
    system: SYSTEM,
    user: ASKS[id](text, language),
    maxTokens: SHORT.includes(id) ? 160 : 700,
    temperature: id === "FixGrammar" ? 0.1 : id === "Continue" ? 0.7 : 0.3,
  }
}

export function localAskPrompt(question: string, context: string): LocalPrompt {
  return {
    system:
      "You answer questions using only the user's notes below. Answer briefly, in Markdown. " +
      "Name the note you used by its title. If the notes don't contain the answer, reply exactly: Your notes don't say.",
    user: `${context}\n\nQuestion: ${question}`,
    maxTokens: 400,
    temperature: 0.1,
  }
}

/** Tidies what the model wrote before it is shown as ready. */
export function cleanLocalResult(id: AiActionId | "Ask", raw: string): string {
  let text = raw.trim().replace(/^(here(’|')?s|here is)[^\n]*:\s*\n+/i, "")
  if (id === "SuggestTitle") {
    text = text
      .split("\n")[0]
      .replace(/^(title:\s*)/i, "")
      .replace(/^#+\s*/, "")
    text = text.replace(/^["“'«*]+|["”'»*]+$/g, "").replace(/[.。]$/, "")
  }
  return text.trim()
}
