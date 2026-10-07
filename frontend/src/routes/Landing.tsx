import { Navigate } from "@tanstack/react-router"
import { Flame, KeyRound, Lock, ShieldCheck, Sparkles, UserRound } from "lucide-react"
import { useState } from "react"
import { session, useSession } from "../app/session"
import { Dialog } from "../components/Dialog"
import { Button, Card, Notice, Spinner, Textarea } from "../components/ui"
import { parseRecoveryKey } from "../lib/session"

const FEATURES = [
  {
    icon: Lock,
    title: "Encrypted in your browser",
    text: "Each note is encrypted with a key derived from your identity by the Internet Computer's vetKeys. The canister only ever stores ciphertext.",
  },
  {
    icon: Flame,
    title: "Burn-after-reading links",
    text: "Share a snapshot through a link that works once (or a few times) and then can never be decrypted again, enforced by threshold cryptography.",
  },
  {
    icon: Sparkles,
    title: "On-chain AI assistant",
    text: "Summaries, titles, tags, rewrites, translations, to-do extraction and answers from your notes, by an LLM running on the Internet Computer. Only what you choose is sent.",
  },
  {
    icon: ShieldCheck,
    title: "Yours to keep",
    text: "Sign in with Internet Identity or a guest key, no email needed. Export everything as Markdown or JSON, or delete your account at any time.",
  },
]

export function LandingPage() {
  const { session: current, busy, error } = useSession()
  const [importOpen, setImportOpen] = useState(false)

  if (current.status === "signedIn") return <Navigate to="/notes" />

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200">
            <ShieldCheck className="h-3.5 w-3.5" /> 100% on-chain · end-to-end encrypted
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Private notes that only <span className="text-brand-600 dark:text-brand-400">you</span> can read.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
            B3Note keeps your notes on the Internet Computer, encrypted with keys that never leave your
            browser in readable form. Share a note through a link that burns after reading, and let an
            on-chain AI help you write.
          </p>
        </div>

        <Card className="p-6">
          <h2 className="text-lg font-semibold">Get started</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">No email, no password.</p>
          {current.status === "restoring" ? (
            <div className="py-10 text-center">
              <Spinner label="Checking your session…" />
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                loading={busy}
                onClick={() => void session.signInWithInternetIdentity()}
              >
                <KeyRound className="h-5 w-5" /> Sign in with Internet Identity
              </Button>
              <Button size="lg" disabled={busy} onClick={() => session.continueAsGuest()}>
                <UserRound className="h-5 w-5" />
                {session.hasGuestKey ? "Continue with your guest key" : "Try it as a guest"}
              </Button>
              <button
                type="button"
                className="text-sm text-brand-700 hover:underline dark:text-brand-300"
                onClick={() => setImportOpen(true)}
              >
                I have a recovery key
              </button>
              {error ? <Notice tone="danger">{error}</Notice> : null}
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                A guest key is a private key stored in this browser. Save its recovery key in Settings, or you
                lose your notes when the browser data is cleared.
              </p>
            </div>
          )}
        </Card>
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <Card key={title} className="p-5">
            <Icon className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
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
          session.continueAsGuest(seed)
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
