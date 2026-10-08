import { Link } from "@tanstack/react-router"
import { FileText, Send, Sparkles } from "lucide-react"
import { useClient } from "@ic-reactor/react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { useWorkspace } from "../app/workspace"
import { AiConsentDialog } from "../components/AiConsentDialog"
import { Markdown } from "../components/Markdown"
import { Button, Card, EmptyState, Notice, Spinner, Textarea } from "../components/ui"
import { backendOf } from "../reactor"
import { hasAiConsent } from "../lib/ai"
import { errorMessage } from "../lib/errors"
import { displayTitle } from "../lib/note"
import { buildAskContext } from "../lib/search"

interface Exchange {
  question: string
  answer: string | null
  error: string | null
  sources: { id: string; title: string }[]
}

const EXAMPLES = [
  "What did I plan for this week?",
  "List every open to-do across my notes",
  "Summarize what I wrote about the project",
]

export function AskPage() {
  const { notes } = useWorkspace()
  const client = useClient()
  const backend = backendOf(client)
  const account = useQuery(client.queryOptions(backend, "get_account"))
  const assist = useMutation(client.mutationOptions(backend, "ai_assist", { invalidates: [] }))
  const [question, setQuestion] = useState("")
  const [history, setHistory] = useState<Exchange[]>([])
  const [consentOpen, setConsentOpen] = useState(false)
  const readable = useMemo(
    () => notes.flatMap((n) => (n.content ? [{ id: n.id, content: n.content, updatedAt: n.updatedAt }] : [])),
    [notes],
  )
  // Leave room for the question and the instructions in the budget.
  const budget = Number(account.data?.limits.max_ai_input_bytes ?? 8_000) - 200

  const ask = async (text: string) => {
    const q = text.trim()
    if (!q) return
    if (!hasAiConsent()) {
      setConsentOpen(true)
      return
    }
    const { context, sources } = buildAskContext(readable, q, budget)
    const exchange: Exchange = {
      question: q,
      answer: null,
      error: null,
      sources: sources.map((s) => ({ id: s.id, title: displayTitle(s.content) })),
    }
    setHistory((h) => [exchange, ...h])
    setQuestion("")
    try {
      const reply = await assist.mutateAsync({ task: { tag: "Ask", value: q }, text: context })
      setHistory((h) => h.map((e) => (e === exchange ? { ...e, answer: reply.text } : e)))
    } catch (error) {
      setHistory((h) => h.map((e) => (e === exchange ? { ...e, error: errorMessage(error) } : e)))
    }
  }

  if (readable.length === 0) {
    return (
      <EmptyState icon={<Sparkles className="h-10 w-10" />} title="Ask questions about your notes">
        Write a few notes first. The assistant answers using the notes most relevant to your question.
      </EmptyState>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Sparkles className="h-6 w-6 text-brand-500" /> Ask your notes
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Your browser picks the notes most relevant to the question and sends only those to the on-chain LLM
        {account.data ? ` (${account.data.ai_model})` : ""}. Everything else stays encrypted.
      </p>

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
            className="resize-none border-none focus:ring-0"
          />
          <Button type="submit" variant="primary" size="icon" loading={assist.isPending} aria-label="Ask">
            {assist.isPending ? null : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </Card>

      {history.length === 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => void ask(example)}
              className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-brand-300 hover:text-brand-700 dark:border-zinc-800 dark:text-zinc-300"
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {history.map((exchange, i) => (
          <Card key={`${exchange.question}-${history.length - i}`} className="p-5">
            <p className="font-medium">{exchange.question}</p>
            <div className="mt-3">
              {exchange.error ? (
                <Notice tone="danger">{exchange.error}</Notice>
              ) : exchange.answer === null ? (
                <Spinner label="Reading your notes…" />
              ) : (
                <Markdown source={exchange.answer} />
              )}
            </div>
            {exchange.sources.length > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3 text-xs text-zinc-500 dark:border-zinc-800">
                <span>Sent:</span>
                {exchange.sources.map((source) => (
                  <Link
                    key={source.id}
                    to="/notes/$noteId"
                    params={{ noteId: source.id }}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 hover:bg-brand-50 hover:text-brand-700 dark:bg-zinc-800"
                  >
                    <FileText className="h-3 w-3" /> {source.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </Card>
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
