import { useNavigate } from "@tanstack/react-router"
import {
  AlertTriangle,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileUp,
  KeyRound,
  Link2,
  Lock,
  Sparkles,
  Trash2,
  User,
} from "lucide-react"
import { useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { session, useSession } from "../app/session"
import { forgetVaultKey } from "../app/vault"
import { useWorkspace } from "../app/workspace"
import { Dialog } from "../components/Dialog"
import { Button, Card, Input, Notice, Spinner, cn } from "../components/ui"
import {
  backendReactor,
  createNoteMutation,
  deleteAccountMutation,
  getAccountQuery,
  getStatsQuery,
  listSharesQuery,
  revokeShareMutation,
} from "../declarations/backend"
import { hasAiConsent, setAiConsent } from "../lib/ai"
import { newId } from "../lib/bytes"
import { errorMessage } from "../lib/errors"
import { formatBytes, nanosToDate, relativeTime } from "../lib/format"
import { formatRecoveryKey } from "../lib/session"
import { buildExport, download, noteToMarkdown, parseImport } from "../lib/transfer"

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <span className="text-brand-600 dark:text-brand-400">{icon}</span>
        {title}
      </h2>
      {children}
    </Card>
  )
}

function UsageBar({ label, used, total }: { label: string; used: number; total: number }) {
  const percent = total > 0 ? Math.min(100, (used / total) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span>
          {used} / {total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cn("h-full rounded-full", percent > 90 ? "bg-red-500" : "bg-brand-500")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

export function SettingsPage() {
  const { session: current } = useSession()
  const { notes, vault } = useWorkspace()
  const navigate = useNavigate()
  const account = getAccountQuery.useQuery()
  const stats = getStatsQuery.useQuery()
  const shares = listSharesQuery.useQuery()
  const revoke = revokeShareMutation.useMutation({ onSuccess: () => toast.success("Link revoked") })
  const createNote = createNoteMutation.useMutation()
  const deleteAccount = deleteAccountMutation.useMutation()
  const [showKey, setShowKey] = useState(false)
  const [aiConsent, setConsentState] = useState(hasAiConsent())
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)

  if (current.status !== "signedIn") return null
  const principal = current.principal.toText()
  const guestSeed = current.kind === "guest" ? session.guestSeed() : null
  const recoveryKey = guestSeed ? formatRecoveryKey(guestSeed) : null
  const readable = notes.flatMap((n) => (n.content ? [{ ...n, content: n.content }] : []))

  const exportJson = () => {
    const data = buildExport(
      readable.map((n) => ({
        ...n.content,
        createdAt: nanosToDate(n.createdAt).toISOString(),
        updatedAt: nanosToDate(n.updatedAt).toISOString(),
      })),
    )
    download(
      `b3note-export-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    )
  }

  const exportMarkdown = () => {
    const text = readable.map((n) => noteToMarkdown(n.content)).join("\n---\n\n")
    download(`b3note-notes-${new Date().toISOString().slice(0, 10)}.md`, text, "text/markdown")
  }

  const importFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    try {
      const parsed = (
        await Promise.all([...files].map(async (file) => parseImport(file.name, await file.text())))
      ).flat()
      setImporting({ done: 0, total: parsed.length })
      for (const [index, note] of parsed.entries()) {
        const { id } = newId()
        await createNote.mutateAsync([{ id, ciphertext: await vault.encrypt(id, note), expires_at: [] }])
        setImporting({ done: index + 1, total: parsed.length })
      }
      toast.success(`Imported ${parsed.length} note${parsed.length === 1 ? "" : "s"}`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setImporting(null)
      if (fileInput.current) fileInput.current.value = ""
    }
  }

  const removeAccount = async () => {
    try {
      const result = await deleteAccount.mutateAsync([])
      toast.success(`Deleted ${result.notes} notes and ${result.shares} links`)
      setDeleteOpen(false)
      await session.signOut()
      if (current.kind === "guest") session.forgetGuestKey()
      await navigate({ to: "/" })
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Section icon={<User className="h-5 w-5" />} title="Account">
        <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-zinc-500">Signed in with</dt>
          <dd>{current.kind === "ii" ? "Internet Identity" : "Guest key (this browser)"}</dd>
          <dt className="text-zinc-500">Principal</dt>
          <dd className="flex items-center gap-2 font-mono text-xs break-all">
            {principal}
            <Button
              size="sm"
              variant="ghost"
              aria-label="Copy principal"
              onClick={async () => {
                await navigator.clipboard.writeText(principal)
                toast.success("Copied")
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </dd>
        </dl>
        {account.data ? (
          <div className="mt-5 space-y-3">
            <UsageBar
              label="Notes"
              used={account.data.note_count}
              total={account.data.limits.max_notes_per_user}
            />
            <UsageBar
              label="Active share links"
              used={account.data.share_count}
              total={account.data.limits.max_shares_per_user}
            />
            <p className="text-xs text-zinc-500">
              {formatBytes(account.data.storage_bytes)} of encrypted notes stored. Each note may be up to{" "}
              {formatBytes(account.data.limits.max_note_bytes)} once encrypted.
            </p>
          </div>
        ) : account.isPending ? (
          <Spinner className="mt-4" />
        ) : null}
      </Section>

      {recoveryKey ? (
        <Section icon={<KeyRound className="h-5 w-5" />} title="Guest recovery key">
          <Notice tone="warning" className="mb-3">
            Your guest account lives only in this browser. Save this key somewhere safe (a password manager is
            ideal): it is the only way to open your notes on another device or after clearing browser data.
            Anyone who has it can read your notes.
          </Notice>
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950">
            <code className="min-w-0 flex-1 truncate text-xs">{showKey ? recoveryKey : "•".repeat(48)}</code>
            <Button
              size="sm"
              variant="ghost"
              aria-label={showKey ? "Hide key" : "Show key"}
              onClick={() => setShowKey((s) => !s)}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(recoveryKey)
                toast.success("Recovery key copied")
              }}
            >
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button
              size="sm"
              onClick={() => download("b3note-recovery-key.txt", `${recoveryKey}\n`, "text/plain")}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </Section>
      ) : null}

      <Section icon={<Lock className="h-5 w-5" />} title="Encryption">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your note key is derived from your identity by the Internet Computer's vetKD protocol and is cached,
          non-extractable, in this browser so pages load without another derivation. On mainnet the app checks
          the canister's public key against the IC's master key before trusting it.
        </p>
        <Button
          className="mt-4"
          onClick={async () => {
            await forgetVaultKey(current.principal)
            toast.success("Cached key removed. It will be derived again.")
          }}
        >
          <Lock className="h-4 w-4" /> Forget the cached key on this device
        </Button>
      </Section>

      <Section icon={<Sparkles className="h-5 w-5" />} title="AI assistant">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {account.data?.ai_enabled === false
            ? "The assistant is turned off on this deployment."
            : `Runs on the Internet Computer's LLM canister${account.data ? ` (${account.data.ai_model})` : ""}. Only the text you pick for an AI action is sent, never your other notes.`}
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={aiConsent}
            onChange={(e) => {
              setAiConsent(e.target.checked)
              setConsentState(e.target.checked)
            }}
            className="h-4 w-4 accent-brand-600"
          />
          Don't ask before AI actions on this device
        </label>
      </Section>

      <Section icon={<Download className="h-5 w-5" />} title="Export and import">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Exports are decrypted in your browser: keep the files somewhere safe.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={exportJson} disabled={readable.length === 0}>
            <Download className="h-4 w-4" /> JSON backup
          </Button>
          <Button onClick={exportMarkdown} disabled={readable.length === 0}>
            <Download className="h-4 w-4" /> Markdown
          </Button>
          <Button onClick={() => fileInput.current?.click()} loading={importing !== null}>
            <FileUp className="h-4 w-4" />
            {importing ? `Importing ${importing.done}/${importing.total}` : "Import .json / .md"}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,.md,.markdown,.txt"
            multiple
            hidden
            onChange={(e) => void importFiles(e.target.files)}
          />
        </div>
      </Section>

      <Section icon={<Link2 className="h-5 w-5" />} title="Active share links">
        {shares.isPending ? (
          <Spinner />
        ) : (shares.data ?? []).length === 0 ? (
          <p className="text-sm text-zinc-500">No active links.</p>
        ) : (
          <ul className="space-y-1.5">
            {(shares.data ?? []).map((share) => {
              const note = notes.find((n) => n.id === share.note_id[0])
              return (
                <li
                  key={share.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <span className="truncate">{note?.content?.title || `Link ${share.id.slice(0, 8)}`}</span>
                  <span className="ml-auto shrink-0 text-xs text-zinc-500">
                    {share.views_left}/{share.max_views} views · expires{" "}
                    {relativeTime(nanosToDate(share.expires_at))}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Revoke link"
                    onClick={() => revoke.mutate([share.id])}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section icon={<AlertTriangle className="h-5 w-5" />} title="Danger zone">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Delete every note and share link of this account from the canister. Export first if you want a copy.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" /> Delete my account data
        </Button>
      </Section>

      {stats.data ? (
        <p className="px-1 text-xs text-zinc-400">
          B3Note backend v{stats.data.version} · canister {backendReactor.canisterId.toText()} · vetKD key{" "}
          {stats.data.vetkd_key_name} · {String(stats.data.users)} users · {String(stats.data.notes)} notes
        </p>
      ) : null}

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete all your data?"
        description="All notes and share links of this account are deleted from the canister. This cannot be undone."
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void removeAccount()
          }}
        >
          <label className="block text-sm">
            Type <strong>DELETE</strong> to confirm
            <Input
              className="mt-1"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={confirmText !== "DELETE"}
              loading={deleteAccount.isPending}
            >
              Delete everything
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
