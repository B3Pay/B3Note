import { Check, Copy, RotateCcw, Sparkles } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { aiAssistMutation, getAccountQuery } from "../declarations/backend"
import {
  AI_ACTIONS,
  LANGUAGES,
  hasAiConsent,
  noteAsPrompt,
  parseTags,
  toAiTask,
  type AiAction,
} from "../lib/ai"
import { errorMessage } from "../lib/errors"
import { normalizeTags, type NoteContent } from "../lib/note"
import { AiConsentDialog } from "./AiConsentDialog"
import { Dialog } from "./Dialog"
import { Markdown } from "./Markdown"
import { Button, Notice, Select, Spinner, cn } from "./ui"

export interface AiSelection {
  start: number
  end: number
  text: string
}

const HEADINGS: Partial<Record<AiAction["id"], string>> = {
  Summarize: "Summary",
  ActionItems: "Action items",
}

const encoder = new TextEncoder()

export function AiPanel({
  open,
  onClose,
  content,
  selection,
  onApply,
}: {
  open: boolean
  onClose: () => void
  content: NoteContent
  selection: AiSelection | null
  onApply: (patch: Partial<NoteContent>) => void
}) {
  const [action, setAction] = useState<AiAction | null>(null)
  const [language, setLanguage] = useState("English")
  const [result, setResult] = useState<string | null>(null)
  const [consentFor, setConsentFor] = useState<AiAction | null>(null)
  const account = getAccountQuery.useQuery({ enabled: open })
  const assist = aiAssistMutation.useMutation()

  const maxBytes = account.data?.limits.max_ai_input_bytes ?? 8_000
  const input = selection ? selection.text : noteAsPrompt(content.title, content.body)
  const tooLong = encoder.encode(input).length > maxBytes
  const aiDisabled = account.data?.ai_enabled === false

  const run = async (chosen: AiAction) => {
    if (!hasAiConsent()) {
      setConsentFor(chosen)
      return
    }
    setAction(chosen)
    setResult(null)
    try {
      const reply = await assist.mutateAsync([{ task: toAiTask(chosen.id, language), text: input }])
      setResult(reply.text)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const apply = () => {
    if (!action || !result) return
    if (action.apply === "title") onApply({ title: result.split("\n")[0] })
    else if (action.apply === "tags")
      onApply({ tags: normalizeTags([...content.tags, ...parseTags(result)]) })
    else if (action.apply === "replace") {
      onApply({
        body: selection
          ? content.body.slice(0, selection.start) + result + content.body.slice(selection.end)
          : result,
      })
    } else {
      const heading = HEADINGS[action.id]
      const addition = heading ? `## ${heading}\n\n${result}` : result
      onApply({ body: `${content.body.trimEnd()}\n\n${addition}\n` })
    }
    toast.success("Applied. Saving…")
    close()
  }

  const close = () => {
    setAction(null)
    setResult(null)
    onClose()
  }

  const applyLabel = action
    ? {
        title: "Use as title",
        tags: "Add tags",
        replace: selection ? "Replace selection" : "Replace note",
        append: "Add to note",
      }[action.apply]
    : ""

  return (
    <>
      <Dialog
        open={open && consentFor === null}
        onClose={close}
        title="AI assistant"
        description={
          selection
            ? `Working on your selection (${selection.text.length} characters).`
            : "Working on the whole note. Select text in Write mode to work on part of it."
        }
        className="w-[min(40rem,calc(100vw-2rem))]"
      >
        {aiDisabled ? (
          <Notice tone="warning">The AI assistant is turned off on this deployment.</Notice>
        ) : tooLong ? (
          <Notice tone="warning">
            This is too long for the assistant (more than {Math.round(maxBytes / 1000)} KB). Select a part of
            the note in Write mode and try again.
          </Notice>
        ) : result !== null && action ? (
          <div className="space-y-3">
            <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              {action.apply === "tags" ? (
                <p className="text-sm">
                  {parseTags(result)
                    .map((t) => `#${t}`)
                    .join("  ")}
                </p>
              ) : (
                <Markdown source={result} />
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => void run(action)} loading={assist.isPending}>
                <RotateCcw className="h-4 w-4" /> Try again
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(result)
                  toast.success("Copied")
                }}
              >
                <Copy className="h-4 w-4" /> Copy
              </Button>
              <Button variant="primary" onClick={apply}>
                <Check className="h-4 w-4" /> {applyLabel}
              </Button>
            </div>
          </div>
        ) : assist.isPending ? (
          <div className="py-10 text-center">
            <Spinner label={`${action?.label ?? "Thinking"}… the on-chain model can take a few seconds`} />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {AI_ACTIONS.filter((a) => a.id !== "Translate").map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => void run(a)}
                  className={cn(
                    "rounded-xl border border-zinc-200 p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 dark:border-zinc-800 dark:hover:border-brand-700 dark:hover:bg-brand-950/40",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-brand-500" /> {a.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{a.hint}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <span className="text-sm font-medium">Translate into</span>
              <Select
                aria-label="Language"
                value={language}
                onChange={setLanguage}
                options={LANGUAGES.map((l) => ({ value: l, label: l }))}
                className="flex-1"
              />
              <Button
                variant="brand-soft"
                onClick={() => void run(AI_ACTIONS.find((a) => a.id === "Translate")!)}
              >
                Translate
              </Button>
            </div>
            <p className="text-xs text-zinc-500">
              Runs on the Internet Computer's LLM canister{account.data ? ` (${account.data.ai_model})` : ""}.
              Only this text is sent; your other notes stay encrypted.
            </p>
          </div>
        )}
      </Dialog>
      <AiConsentDialog
        open={consentFor !== null}
        model={account.data?.ai_model}
        onClose={() => setConsentFor(null)}
        onAccept={() => {
          const chosen = consentFor
          setConsentFor(null)
          if (chosen) void run(chosen)
        }}
      />
    </>
  )
}
