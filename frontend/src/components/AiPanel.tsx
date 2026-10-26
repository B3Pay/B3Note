import { Check, Copy, RotateCcw } from "lucide-react"
import { useClient } from "@ic-reactor/react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useAnyAi } from "../app/features"
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
import { localAiError, runLocalAi } from "../lib/localAi"
import { cleanLocalResult, localActionPrompt } from "../lib/localAiPrompts"
import { normalizeTags, type NoteContent } from "../lib/note"
import { AiConsentDialog } from "./AiConsentDialog"
import { Dialog } from "./Dialog"
import { AiBlock, AiMemo, LocalAiSetup } from "./LocalAi"
import { Markdown } from "./Markdown"
import { Button, Notice, Select, cn } from "./ui"
import { backendOf } from "../reactor"

export interface AiSelection {
  start: number
  end: number
  text: string
}

type Engine = "local" | "cloud"

interface Run {
  action: AiAction
  engine: Engine
  state: "drafting" | "ready" | "failed"
  text: string
  error?: string
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
  const { local, cloud } = useAnyAi()
  const localUsable = local.status !== "unavailable"
  const [engine, setEngine] = useState<Engine>(localUsable ? "local" : "cloud")
  const [language, setLanguage] = useState("English")
  const [run, setRun] = useState<Run | null>(null)
  const [consentFor, setConsentFor] = useState<AiAction | null>(null)
  const abort = useRef<AbortController | null>(null)
  const client = useClient()
  const backend = backendOf(client)
  const account = useQuery({ ...client.queryOptions(backend, "get_account"), enabled: open && cloud })
  // AI requests change nothing a read shows: invalidate nothing.
  const assist = useMutation(client.mutationOptions(backend, "ai_assist", { invalidates: [] }))

  // The on-device model is the default; the canister's is the choice when this browser can't run one.
  useEffect(() => {
    if (!localUsable && cloud) setEngine("cloud")
  }, [localUsable, cloud])
  useEffect(() => () => abort.current?.abort(), [])

  const maxBytes = engine === "cloud" ? (account.data?.limits.max_ai_input_bytes ?? 8_000) : 6_000
  const input = selection ? selection.text : noteAsPrompt(content.title, content.body)
  const tooLong = encoder.encode(input).length > maxBytes
  const localReady = local.status === "ready"

  const runCloud = async (chosen: AiAction) => {
    if (!hasAiConsent()) {
      setConsentFor(chosen)
      return
    }
    setRun({ action: chosen, engine: "cloud", state: "drafting", text: "" })
    try {
      const reply = await assist.mutateAsync({ task: toAiTask(chosen.id, language), text: input })
      setRun({ action: chosen, engine: "cloud", state: "ready", text: reply.text })
    } catch (error) {
      setRun({ action: chosen, engine: "cloud", state: "failed", text: "", error: errorMessage(error) })
    }
  }

  const runLocal = async (chosen: AiAction) => {
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    setRun({ action: chosen, engine: "local", state: "drafting", text: "" })
    try {
      const raw = await runLocalAi(
        localActionPrompt(chosen.id, input, language),
        controller.signal,
        (text) => {
          if (!controller.signal.aborted) setRun((r) => (r && r.state === "drafting" ? { ...r, text } : r))
        },
      )
      if (controller.signal.aborted) return
      const text = cleanLocalResult(chosen.id, raw)
      setRun((r) =>
        r
          ? text
            ? { ...r, state: "ready", text }
            : { ...r, state: "failed", error: "The model gave back nothing. Try again." }
          : r,
      )
    } catch (error) {
      if (controller.signal.aborted) return
      setRun((r) => (r ? { ...r, state: "failed", error: localAiError(error) } : r))
    }
  }

  const start = (chosen: AiAction) => void (engine === "cloud" ? runCloud(chosen) : runLocal(chosen))

  // Stopping keeps what was written so far, so it can still be used.
  const stop = () => {
    abort.current?.abort()
    setRun((r) => (r && r.state === "drafting" ? (r.text.trim() ? { ...r, state: "ready" } : null) : r))
  }

  const apply = () => {
    if (!run || run.state !== "ready") return
    const { action, text: result } = run
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
    abort.current?.abort()
    setRun(null)
    onClose()
  }

  const applyLabel = run
    ? {
        title: "Use as title",
        tags: "Add tags",
        replace: selection ? "Replace selection" : "Replace note",
        append: "Add to note",
      }[run.action.apply]
    : ""

  const where =
    run?.engine === "cloud"
      ? "sent to the Internet Computer's LLM canister"
      : "read on this device, nothing left it"
  const model = run?.engine === "cloud" ? account.data?.ai_model : "model" in local ? local.model : undefined

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
        <div className="space-y-3">
          {cloud && localUsable ? (
            <div
              className="flex rounded-lg bg-zinc-100 p-0.5 text-xs font-semibold dark:bg-zinc-800"
              role="group"
              aria-label="Where the assistant runs"
            >
              {(
                [
                  ["local", "On this device"],
                  ["cloud", "Internet Computer"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={engine === value}
                  disabled={run?.state === "drafting"}
                  onClick={() => {
                    setEngine(value)
                    setRun(null)
                  }}
                  className={cn(
                    "h-8 flex-1 rounded-md px-3",
                    engine === value ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}

          {engine === "cloud" && account.data?.ai_enabled === false ? (
            <Notice tone="warning">The canister's AI assistant is turned off on this deployment.</Notice>
          ) : engine === "local" && !localReady ? (
            <LocalAiSetup status={local} />
          ) : tooLong ? (
            <Notice tone="warning">
              This is too long for the assistant (more than {Math.round(maxBytes / 1000)} KB). Select a part
              of the note in Write mode and try again.
            </Notice>
          ) : run ? (
            <AiBlock
              route={`Note › ${run.action.label}`}
              state={run.state}
              actions={
                run.state === "drafting" ? (
                  run.engine === "local" ? (
                    <Button variant="ghost" onClick={stop}>
                      Stop
                    </Button>
                  ) : null
                ) : run.state === "failed" ? (
                  <>
                    <Button variant="ghost" onClick={() => setRun(null)}>
                      Back
                    </Button>
                    <Button onClick={() => start(run.action)}>
                      <RotateCcw className="h-4 w-4" /> Try again
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => start(run.action)}>
                      <RotateCcw className="h-4 w-4" /> Try again
                    </Button>
                    <Button
                      onClick={async () => {
                        await navigator.clipboard.writeText(run.text)
                        toast.success("Copied")
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copy
                    </Button>
                    <Button variant="primary" onClick={apply}>
                      <Check className="h-4 w-4" /> {applyLabel}
                    </Button>
                  </>
                )
              }
              memo={<AiMemo words={run.action.label.toLowerCase()} where={where} model={model} />}
            >
              {run.state === "failed" ? (
                <p className="text-sm font-semibold text-red-600">{run.error}</p>
              ) : (
                <div
                  className="max-h-[50vh] overflow-y-auto rounded-lg px-4 py-3"
                  data-paper="butter"
                  style={{ background: "var(--paper)" }}
                >
                  {run.action.apply === "tags" && run.state === "ready" ? (
                    <p className="text-sm">
                      {parseTags(run.text)
                        .map((t) => `#${t}`)
                        .join("  ")}
                    </p>
                  ) : run.text ? (
                    <Markdown source={run.text} />
                  ) : (
                    <p className="text-sm text-[var(--ink-muted)]">
                      {run.engine === "cloud"
                        ? "The on-chain model can take a few seconds…"
                        : "Writing on this device…"}
                    </p>
                  )}
                  {run.state === "drafting" ? <span className="bn-caret" aria-hidden /> : null}
                </div>
              )}
            </AiBlock>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {AI_ACTIONS.filter((a) => a.id !== "Translate").map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => start(a)}
                    className="rounded-xl border border-zinc-200 p-3 text-left transition-colors hover:border-brand-600 hover:bg-brand-50 dark:border-zinc-800 dark:hover:border-brand-500 dark:hover:bg-brand-950"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span className="bn-dot" aria-hidden /> {a.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">{a.hint}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <span className="text-sm font-semibold">Translate into</span>
                <Select
                  aria-label="Language"
                  value={language}
                  onChange={setLanguage}
                  options={LANGUAGES.map((l) => ({ value: l, label: l }))}
                  className="flex-1"
                />
                <Button
                  variant="brand-soft"
                  onClick={() => start(AI_ACTIONS.find((a) => a.id === "Translate")!)}
                >
                  Translate
                </Button>
              </div>
              <AiMemo
                where={
                  engine === "cloud"
                    ? "Runs on the Internet Computer's LLM canister. Only this text is sent; your other notes stay encrypted"
                    : "Runs in this browser. Your notes are decrypted here and never sent anywhere"
                }
                model={
                  engine === "cloud" ? account.data?.ai_model : "model" in local ? local.model : undefined
                }
              />
            </>
          )}
        </div>
      </Dialog>
      <AiConsentDialog
        open={consentFor !== null}
        model={account.data?.ai_model}
        onClose={() => setConsentFor(null)}
        onAccept={() => {
          const chosen = consentFor
          setConsentFor(null)
          if (chosen) void runCloud(chosen)
        }}
      />
    </>
  )
}
