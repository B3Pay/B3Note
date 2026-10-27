import { Download, Lock } from "lucide-react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { localAiError, prepareLocalAi, type LocalAiStatus } from "../lib/localAi"
import { SheetMark } from "./brand"
import { Button, Spinner, cn } from "./ui"

const PRIVACY = "Runs in this browser. Your notes are decrypted here and never sent anywhere."

/** Gets the on-device model ready: says which one, how big, and asks before downloading. */
export function LocalAiSetup({ status, className }: { status: LocalAiStatus; className?: string }) {
  if (status.status === "ready") return null
  return (
    <div className={cn("space-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800", className)}>
      {status.status === "checking" ? (
        <Spinner label="Checking what this browser can run…" />
      ) : status.status === "unavailable" ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{status.reason}</p>
      ) : (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{PRIVACY}</p>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            <dt className="text-zinc-500">Model</dt>
            <dd className="font-mono text-xs leading-5">{status.model}</dd>
            <dt className="text-zinc-500">Runs on</dt>
            <dd>{status.engine === "chrome" ? "Chrome, built in" : "Your GPU, with WebLLM"}</dd>
            {status.status === "download" ? (
              <>
                <dt className="text-zinc-500">Download</dt>
                <dd>{status.size}</dd>
              </>
            ) : null}
          </dl>
          {status.status === "download" ? (
            <Button
              variant="secondary"
              onClick={() => prepareLocalAi().catch((error) => toast.error(localAiError(error)))}
            >
              <Download className="h-4 w-4" /> Download the model
            </Button>
          ) : (
            <div className="space-y-1.5">
              <div
                className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
                role="progressbar"
                aria-label="Getting the model ready"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(status.progress * 100)}
              >
                <div
                  className="h-full rounded-full bg-brand-600 transition-[width] dark:bg-brand-500"
                  style={{ width: `${Math.max(2, status.progress * 100)}%` }}
                />
              </div>
              <p className="b3-meta truncate" aria-live="polite">
                {Math.round(status.progress * 100)}% · {status.text}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Where an answer came from, said every time: the lock, the place, the model. */
export function AiMemo({ words, where, model }: { words?: string; where: string; model?: string }) {
  return (
    <p className="flex items-start gap-1.5 border-t border-zinc-200 pt-2.5 text-xs text-zinc-500 dark:border-zinc-800">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {words ? `“${words}” · ` : ""}
        {where}
        {model ? (
          <>
            {" · "}
            <span className="font-mono">{model}</span>
          </>
        ) : null}
      </span>
    </p>
  )
}

/**
 * An AI answer as a block of work (B3Pay's Work Layer): dashed while it is being
 * written, solid once it is ready. Never a chat bubble.
 */
export function AiBlock({
  route,
  state,
  children,
  actions,
  memo,
}: {
  route: string
  state: "drafting" | "ready" | "failed"
  children: ReactNode
  actions?: ReactNode
  memo?: ReactNode
}) {
  return (
    <article
      aria-busy={state === "drafting"}
      className={cn(
        "space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900",
        state === "drafting" && "bn-drafting",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="b3-label inline-flex items-center gap-1.5">
          <SheetMark size={12} /> {route}
        </span>
        <StatePill state={state} />
      </div>
      {children}
      {actions ? <div className="flex flex-wrap justify-end gap-2">{actions}</div> : null}
      {memo}
    </article>
  )
}

function StatePill({ state }: { state: "drafting" | "ready" | "failed" }) {
  const look = {
    drafting: "border border-dashed border-zinc-500 text-zinc-900 dark:text-zinc-100",
    ready: "border border-brand-600 text-zinc-900 dark:border-brand-500 dark:text-zinc-100",
    failed: "border border-red-600 text-red-600",
  }[state]
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold tracking-[0.06em] uppercase",
        look,
      )}
    >
      {state === "ready" ? (
        <span className="h-2 w-2 rounded-full bg-brand-600 ring-2 ring-white ring-offset-0 dark:bg-brand-500 dark:ring-zinc-900" />
      ) : state === "failed" ? (
        <span className="h-2 w-2 rotate-45 rounded-[1px] bg-red-600" />
      ) : null}
      {{ drafting: "Drafting", ready: "Ready", failed: "Stopped" }[state]}
    </span>
  )
}
