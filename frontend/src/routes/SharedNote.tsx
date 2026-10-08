import { useClient } from "@ic-reactor/react"
import { Principal } from "@icp-sdk/core/principal"
import { skipToken, useMutation, useQuery } from "@tanstack/react-query"
import { Link, useParams } from "@tanstack/react-router"
import { Copy, Download, Eye, Flame, Lock, Save, ShieldCheck } from "lucide-react"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import { canisterIdOf, isMainnet } from "../app/canister"
import { useSession } from "../app/session"
import { readyVault } from "../app/vault"
import { Markdown } from "../components/Markdown"
import { Button, Card, EmptyState, Notice, Spinner, TagChip } from "../components/ui"
import { newId } from "../lib/bytes"
import { errorMessage } from "../lib/errors"
import { formatBytes, formatDateTime, nanosToDate, relativeTime } from "../lib/format"
import { SHARE_KEY_CONTEXT, expectedPublicKey } from "../lib/keys"
import { decryptOpenedShare, openShareRequest, parseShareSecret, type SharePayload } from "../lib/share"
import { download, markdownFileName, noteToMarkdown } from "../lib/transfer"
import { backendOf, createReaderClient } from "../reactor"

export function SharedNotePage() {
  const { shareId } = useParams({ strict: false }) as { shareId: string }
  const secret = useMemo(() => parseShareSecret(window.location.hash), [])
  const validId = /^[0-9a-f]{32}$/.test(shareId)
  const client = useClient()
  const backend = backendOf(client)
  const info = useQuery({
    ...client.queryOptions(backend, "get_share", validId && secret ? shareId : skipToken),
    retry: false,
    staleTime: 0,
  })
  const open = useMutation({
    mutationFn: async (secretKey: Uint8Array) => {
      const request = await openShareRequest(shareId, secretKey)
      // Opened anonymously, so the reader's account is not linked to the share.
      const reader = createReaderClient()
      try {
        const readerBackend = backendOf(reader)
        const reply = await readerBackend.open_share(request.args)
        const config = await readerBackend.get_config()
        const canisterId = Principal.fromText(canisterIdOf(reader, readerBackend))
        const payload = decryptOpenedShare(
          shareId,
          request.transportKey,
          reply,
          expectedPublicKey(config.vetkd_key_name, canisterId, SHARE_KEY_CONTEXT, !isMainnet(reader)),
        )
        return { payload, viewsLeft: reply.views_left }
      } finally {
        reader.dispose()
      }
    },
  })

  if (!validId || !secret) {
    return (
      <EmptyState icon={<Lock className="h-10 w-10" />} title="This link is incomplete">
        A share link ends with <code>#</code> and a key. Ask the sender to copy the whole link again.
      </EmptyState>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {open.data ? (
        <OpenedNote payload={open.data.payload} viewsLeft={open.data.viewsLeft} />
      ) : (
        <Card className="p-8 text-center">
          <Flame className="mx-auto h-10 w-10 text-orange-500" />
          <h1 className="mt-4 text-2xl font-bold">Someone shared an encrypted note with you</h1>
          {info.isPending ? (
            <div className="mt-6">
              <Spinner label="Checking the link…" />
            </div>
          ) : info.error ? (
            <Notice tone="danger" className="mt-6">
              {errorMessage(info.error)}
            </Notice>
          ) : info.data ? (
            <>
              <p className="mx-auto mt-3 max-w-md text-sm text-zinc-600 dark:text-zinc-400">
                {info.data.views_left === 1
                  ? "It can be opened one more time. After you open it, it is destroyed and can never be decrypted again."
                  : `It can be opened ${info.data.views_left} more times.`}{" "}
                It expires {relativeTime(nanosToDate(info.data.expires_at))}.
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {formatBytes(info.data.size)} encrypted · shared{" "}
                {formatDateTime(nanosToDate(info.data.created_at))}
              </p>
              {open.error ? (
                <Notice tone="danger" className="mt-4">
                  {errorMessage(open.error)}
                </Notice>
              ) : null}
              <div className="mt-6 flex flex-col items-center gap-3">
                <Button
                  variant="primary"
                  size="lg"
                  loading={open.isPending}
                  onClick={() => open.mutate(secret)}
                >
                  <Eye className="h-5 w-5" /> Open the note
                </Button>
                <p className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <ShieldCheck className="h-3.5 w-3.5" /> Decrypted in your browser with vetKeys
                </p>
              </div>
            </>
          ) : null}
        </Card>
      )}
    </div>
  )
}

function OpenedNote({ payload, viewsLeft }: { payload: SharePayload; viewsLeft: number }) {
  const { signedIn, principal } = useSession()
  const client = useClient()
  const save = useMutation(client.mutationOptions(backendOf(client), "create_note"))
  const [saved, setSaved] = useState(false)
  const content = { title: payload.title, body: payload.body, tags: payload.tags, pinned: false }

  const saveToMyNotes = async () => {
    if (!signedIn) return
    try {
      const vault = await readyVault(principal)
      const { id } = newId()
      await save.mutateAsync({ id, ciphertext: await vault.encrypt(id, content), expires_at: null })
      setSaved(true)
      toast.success("Saved to your notes")
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  return (
    <article className="space-y-4">
      <Notice tone={viewsLeft === 0 ? "warning" : "info"}>
        {viewsLeft === 0
          ? "This was the last view: the note has been destroyed on the canister. Copy or save it now if you need it."
          : `This link can be opened ${viewsLeft} more time${viewsLeft === 1 ? "" : "s"}.`}
      </Notice>
      <Card className="p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{payload.title || "Shared note"}</h1>
        {payload.tags.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {payload.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        ) : null}
        {payload.sharedAt ? (
          <p className="mt-1 text-xs text-zinc-500">Shared {formatDateTime(new Date(payload.sharedAt))}</p>
        ) : null}
        <div className="mt-6">
          <Markdown source={payload.body} />
        </div>
      </Card>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={async () => {
            await navigator.clipboard.writeText(noteToMarkdown(content))
            toast.success("Copied")
          }}
        >
          <Copy className="h-4 w-4" /> Copy
        </Button>
        <Button onClick={() => download(markdownFileName(content), noteToMarkdown(content), "text/markdown")}>
          <Download className="h-4 w-4" /> Download
        </Button>
        {signedIn ? (
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={saved}
            onClick={() => void saveToMyNotes()}
          >
            <Save className="h-4 w-4" /> {saved ? "Saved" : "Save to my notes"}
          </Button>
        ) : (
          <Link
            to="/"
            className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Get your own encrypted notebook →
          </Link>
        )}
      </div>
    </article>
  )
}
