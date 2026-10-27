import { Link } from "@tanstack/react-router"
import { FileText, Send, Square } from "lucide-react"
import { useClient } from "@ic-reactor/react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"
import { useAnyAi } from "../app/features"
import { useWorkspace } from "../app/workspace"
import { AiConsentDialog } from "../components/AiConsentDialog"
import { SheetMark } from "../components/brand"
import { AiBlock, AiMemo, LocalAiSetup } from "../components/LocalAi"
import { Markdown } from "../components/Markdown"
import { Button, Card, EmptyState, Textarea, cn } from "../components/ui"
import { backendOf } from "../reactor"
import { hasAiConsent } from "../lib/ai"
import { errorMessage } from "../lib/errors"
import { localAiError, runLocalAi } from "../lib/localAi"
import { cleanLocalResult, localAskPrompt } from "../lib/localAiPrompts"
import { displayTitle } from "../lib/note"
import { buildAskContext } from "../lib/search"

type Engine = "local" | "cloud"

interface Exchange {
  key: number
  question: string
  answer: string
  state: "drafting" | "ready" | "failed"
  error: string | null
  engine: Engine
  sources: { id: string; title: string }[]
}

const EXAMPLES = [
  "What did I plan for this week?",
  "List every open to-do across my notes",
  "Summarize what I wrote about the project",
]

// What fits the on-device model's context next to the instructions.
const LOCAL_CONTEXT_BYTES = 6_000

export function AskPage() {
  const { notes } = useWorkspace()
  const client = useClient()
  const backend = backendOf(client)
  const { local, cloud, any } = useAnyAi()
  const localUsable = local.status !== "unavailable"
  const [engine, setEngine] = useState<Engine>(localUsable ? "local" : "cloud")
  const account = useQuery({ ...client.queryOptions(backend, "get_account"), enabled: cloud })
  const assist = useMutation(client.mutationOptions(backend, "ai_assist", { invalidates: [] }))
  const [question, setQuestion] = useState("")
  const [history, setHistory] = useState<Exchange[]>([])
  const [consentOpen, setConsentOpen] = useState(false)
  const abort = useRef<AbortController | null>(null)
  const counter = useRef(0)
  const readable = useMemo(
    () => notes.flatMap((n) => (n.content ? [{ id: n.id, content: n.content, updatedAt: n.updatedAt }] : [])),
    [notes],
  )

  useEffect(() => {
    if (!localUsable && cloud) setEngine("cloud")
  }, [localUsable, cloud])
  useEffect(() => () => abort.current?.abort(), [])

  const busy = history.some((e) => e.state === "drafting")
  const localReady = local.status === "ready"
  const model = engine === "cloud" ? account.data?.ai_model : "model" in local ? local.model : undefined
  const patch = (key: number, change: Partial<Exchange>) =>
    setHistory((h) => h.map((e) => (e.key === key ? { ...e, ...change } : e)))

  const ask = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    if (engine === "cloud" && !hasAiConsent()) {
      setConsentOpen(true)
      return
    }
    // Leave room for the question and the instructions in the budget.
    const budget =
      engine === "cloud"
        ? Number(account.data?.limits.max_ai_input_bytes ?? 8_000) - 200
        : LOCAL_CONTEXT_BYTES
    const { context, sources } = buildAskContext(readable, q, budget)
    const key = ++counter.current
    setHistory((h) => [
      {
        key,
        question: q,
        answer: "",
        state: "drafting",
        error: null,
        engine,
        sources: sources.map((s) => ({ id: s.id, title: displayTitle(s.content) })),
      },
      ...h,
    ])
    setQuestion("")
    if (engine === "cloud") {
      try {
        const reply = await assist.mutateAsync({ task: { tag: "Ask", value: q }, text: context })
        patch(key, { answer: reply.text, state: "ready" })
      } catch (error) {
        patch(key, { state: "failed", error: errorMessage(error) })
      }
      return
    }
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    try {
      const raw = await runLocalAi(localAskPrompt(q, context), controller.signal, (answer) => {
        if (!controller.signal.aborted) patch(key, { answer })
      })
      if (!controller.signal.aborted) patch(key, { answer: cleanLocalResult("Ask", raw), state: "ready" })
    } catch (error) {
      if (!controller.signal.aborted) patch(key, { state: "failed", error: localAiError(error) })
    }
  }

  const stop = () => {
    abort.current?.abort()
    setHistory((h) => h.map((e) => (e.state === "drafting" ? { ...e, state: "ready" } : e)))
  }

  if (!any) {
    return (
      <EmptyState paper title="The assistant can't run here">
        {local.status === "unavailable" ? local.reason : "Checking what this browser can run…"}
      </EmptyState>
    )
  }

  if (readable.length === 0) {
    return (
      <EmptyState paper title="Ask questions about your notes">
        Write a few notes first. The assistant answers using the notes most relevant to your question.
      </EmptyState>
    )
  }

  const ready = engine === "cloud" || localReady

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-[28px] leading-[34px] font-semibold tracking-tight">
        <SheetMark size={22} /> Ask your notes
      </h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {engine === "cloud"
          ? `Your browser picks the notes most relevant to the question and sends only those to the on-chain LLM${
              account.data ? ` (${account.data.ai_model})` : ""
            }. Everything else stays encrypted.`
          : "Your browser picks the notes most relevant to the question and reads them with a model on this device. Nothing is sent anywhere."}
      </p>

      {cloud && localUsable ? (
        <div
          className="mt-4 inline-flex rounded-lg bg-zinc-100 p-0.5 text-xs font-semibold dark:bg-zinc-800"
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
              disabled={busy}
              onClick={() => setEngine(value)}
              className={cn(
                "h-8 rounded-md px-3",
                engine === value ? "bg-white shadow-sm dark:bg-zinc-900" : "text-zinc-500",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {engine === "local" && !localReady ? <LocalAiSetup status={local} className="mt-6" /> : null}

      <Card className="mt-6 p-3">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void ask(question)
          }}
        >
          <Textarea
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void ask(question)
              }
            }}
            placeholder="Ask anything about your notes…"
            aria-label="Question"
            maxLength={500}
            disabled={!ready}
            className="resize-none border-none focus:ring-0"
          />
          {busy && engine === "local" ? (
            <Button variant="secondary" size="icon" aria-label="Stop" onClick={stop}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              size="icon"
              loading={busy}
              disabled={!ready}
              aria-label="Ask"
            >
              {busy ? null : <Send className="h-4 w-4" />}
            </Button>
          )}
        </form>
      </Card>

      {history.length === 0 && ready ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => void ask(example)}
              className="inline-flex items-center gap-2 rounded border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:border-brand-600 hover:bg-brand-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-brand-500 dark:hover:bg-brand-950"
            >
              <span className="bn-dot" aria-hidden /> {example}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {history.map((exchange) => (
          <AiBlock
            key={exchange.key}
            route="Notes › Ask"
            state={exchange.state}
            memo={
              <AiMemo
                words={exchange.question}
                where={
                  exchange.engine === "cloud"
                    ? `sent ${exchange.sources.length} notes to the Internet Computer's LLM canister`
                    : `read ${exchange.sources.length} ${exchange.sources.length === 1 ? "note" : "notes"} on this device`
                }
                model={exchange.engine === engine ? model : undefined}
              />
            }
          >
            {exchange.state === "failed" ? (
              <p className="text-sm font-semibold text-red-600">{exchange.error}</p>
            ) : exchange.answer ? (
              <div>
                <Markdown source={exchange.answer} />
                {exchange.state === "drafting" ? <span className="bn-caret" aria-hidden /> : null}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Reading your notes…</p>
            )}
            {exchange.sources.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="b3-label">{exchange.engine === "cloud" ? "Sent" : "Read"}</span>
                {exchange.sources.map((source) => (
                  <Link
                    key={source.id}
                    to="/notes/$noteId"
                    params={{ noteId: source.id }}
                    className="inline-flex items-center gap-1 rounded bg-zinc-100 px-2 py-0.5 text-zinc-700 hover:bg-brand-100 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-brand-900"
                  >
                    <FileText className="h-3 w-3" /> {source.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </AiBlock>
        ))}
      </div>

      <AiConsentDialog
        open={consentOpen}
        model={account.data?.ai_model}
        onClose={() => setConsentOpen(false)}
        onAccept={() => {
          setConsentOpen(false)
          void ask(question)
        }}
      />
    </div>
  )
}
