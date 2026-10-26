import { Navigate } from "@tanstack/react-router"
import { Flame, KeyRound, ListChecks, Lock, ShieldCheck, Timer, UserRound } from "lucide-react"
import { useState, type CSSProperties } from "react"
import { continueAsGuest, signInWithInternetIdentity, useSession } from "../app/session"
import { SheetMark, type Paper } from "../components/brand"
import { Dialog } from "../components/Dialog"
import { Button, Card, Notice, Textarea } from "../components/ui"
import { errorMessage } from "../lib/errors"
import { parseRecoveryKey } from "../lib/sessionAuth"
import { sessionAuth } from "../reactor"

const FEATURES = [
  {
    icon: ({ className }: { className?: string }) => <SheetMark size={22} className={className} />,
    title: "AI that stays on your device",
    text: "Tidy, shorten, summarize, retitle or tag a note, and ask questions across your notes, with a model that runs in this browser. Your notes never leave it.",
  },
  {
    icon: Lock,
    title: "Encrypted in your browser",
    text: "Each note is encrypted before it leaves your browser: with a key the Internet Computer's vetKeys derive for your Internet Identity, or one derived from your guest key. The canister only ever stores ciphertext.",
  },
  {
    icon: Flame,
    title: "Burn-after-reading links",
    text: "Share a snapshot through a link that works once (or a few times) and then can never be decrypted again, enforced by threshold cryptography. Available with Internet Identity.",
  },
  {
    icon: Timer,
    title: "Self-destructing notes",
    text: "Give a note a timer and the canister deletes it when the time is up.",
  },
  {
    icon: ListChecks,
    title: "Markdown, tags and search",
    text: "Checklists you can tick, tags, pins and search, saved as you type and kept in step across your devices.",
  },
  {
    icon: ShieldCheck,
    title: "Yours to keep",
    text: "Sign in with Internet Identity or a guest key, no email needed. Export everything as Markdown or JSON, or delete your account at any time.",
  },
]

// Example notes for the hero, drawn as paper. Not anyone's real notes.
const EXAMPLES: { paper: Paper; tilt: string; title: string; body: string; place: string }[] = [
  {
    paper: "butter",
    tilt: "-5deg",
    title: "Wi-Fi at the cabin",
    body: "Lakeside-5G. The password is on the router.",
    place: "left-0 top-6",
  },
  {
    paper: "peach",
    tilt: "4deg",
    title: "Gift ideas for Mina",
    body: "- The blue teapot\n- A strap for her camera",
    place: "right-0 top-0",
  },
  {
    paper: "sky",
    tilt: "-1.5deg",
    title: "Thursday with Sara",
    body: "Bring the Q3 numbers. Ask about the new hire.",
    place: "left-16 top-36",
  },
]

export function LandingPage() {
  const { signedIn, status } = useSession()
  const [importOpen, setImportOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (signedIn) return <Navigate to="/notes" />

  const run = async (signIn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await signIn()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="b3-label mb-4 inline-flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5" /> 100% on-chain · end-to-end encrypted
          </p>
          <h1 className="text-[28px] leading-[34px] font-semibold tracking-tight text-balance sm:text-5xl sm:leading-[52px] sm:font-bold">
            Private notes that only you can read.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-7 text-zinc-600 dark:text-zinc-400">
            B3Note keeps your notes on the Internet Computer, encrypted with keys that never leave your
            browser in readable form. Share a note through a link that burns after reading, and let on-device
            AI tidy it up without it ever leaving this browser.
          </p>
          <div className="relative mt-8 hidden h-60 max-w-md sm:block" aria-hidden>
            {EXAMPLES.map((note) => (
              <div
                key={note.title}
                data-paper={note.paper}
                style={{ "--tilt": note.tilt } as CSSProperties}
                className={`bn-folded bn-note absolute w-52 px-4 py-3 ${note.place}`}
              >
                <p className="b3-meta">Example</p>
                <p className="mt-1 font-semibold">{note.title}</p>
                <p className="mt-1 text-sm leading-6 whitespace-pre-line text-[var(--ink-muted)]">
                  {note.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Get started</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">No email, no password.</p>
          <div className="mt-5 flex flex-col gap-3">
            {status === "expired" ? (
              <Notice tone="warning">Your Internet Identity session expired. Sign in again.</Notice>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              loading={busy}
              onClick={() => void run(signInWithInternetIdentity)}
            >
              <KeyRound className="h-5 w-5" /> Sign in with Internet Identity
            </Button>
            <Button size="lg" disabled={busy} onClick={() => void run(() => continueAsGuest())}>
              <UserRound className="h-5 w-5" />
              {sessionAuth().hasGuestKey ? "Continue with your guest key" : "Try it as a guest"}
            </Button>
            <button
              type="button"
              className="text-sm font-semibold text-brand-600 underline-offset-4 hover:underline dark:text-brand-500"
              onClick={() => setImportOpen(true)}
            >
              I have a recovery key
            </button>
            {error ? <Notice tone="danger">{error}</Notice> : null}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              A guest key is a private key stored in this browser. Save its recovery key in Settings, or you
              lose your notes when the browser data is cleared. Share links need Internet Identity.
            </p>
          </div>
        </Card>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <Card key={title} className="p-5">
            <Icon className="h-6 w-6 text-zinc-900 dark:text-zinc-100" />
            <h3 className="mt-3 text-lg leading-6 font-semibold">{title}</h3>
            <p className="mt-1 text-sm leading-[22px] text-zinc-600 dark:text-zinc-400">{text}</p>
          </Card>
        ))}
      </section>

      <ImportKeyDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}

function ImportKeyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("")
  const [invalid, setInvalid] = useState(false)
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Sign in with a recovery key"
      description="Paste the guest recovery key you saved (it starts with b3note-guest-v1:)."
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          const seed = parseRecoveryKey(text)
          if (!seed) {
            setInvalid(true)
            return
          }
          void continueAsGuest(seed)
          onClose()
        }}
      >
        <Textarea
          rows={3}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setInvalid(false)
          }}
          placeholder="b3note-guest-v1:…"
          className="font-mono"
          autoFocus
          aria-label="Recovery key"
        />
        {invalid ? <Notice tone="danger">That is not a valid recovery key.</Notice> : null}
        <Notice tone="warning">
          This replaces the guest key stored in this browser. Save that one first if it holds notes.
        </Notice>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!text.trim()}>
            Sign in
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
