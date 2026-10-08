import type { Client } from "@ic-reactor/core"
import { useClient } from "@ic-reactor/react"
import { Principal } from "@icp-sdk/core/principal"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Check, Copy, Flame, Link2, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { canisterIdOf, isMainnet } from "../app/canister"
import { toBytes } from "../lib/bytes"
import { backendErrorTag, errorMessage } from "../lib/errors"
import { DURATION_CHOICES, nanosToDate, relativeTime } from "../lib/format"
import { checkedPublicKey, expectedPublicKey, SHARE_KEY_CONTEXT } from "../lib/keys"
import type { NoteContent } from "../lib/note"
import { prepareShare, shareLink } from "../lib/share"
import { backendOf, type Backend } from "../reactor"
import { Dialog } from "./Dialog"
import { Button, Notice, Select } from "./ui"

const VIEW_CHOICES = [
  { value: "1", label: "Once (burn after reading)" },
  { value: "3", label: "3 times" },
  { value: "10", label: "10 times" },
]

/** The canister's share key, checked offline against the IC master key on mainnet. */
async function verifiedShareKey(client: Client, backend: Backend): Promise<Uint8Array> {
  const config = await client.queryClient.fetchQuery(client.queryOptions(backend, "get_config"))
  let keys
  try {
    keys = await client.queryClient.fetchQuery(client.queryOptions(backend, "get_public_keys"))
  } catch (error) {
    if (backendErrorTag(error) !== "NotReady") throw error
    keys = await backend.load_public_keys()
  }
  const canisterId = Principal.fromText(canisterIdOf(client, backend))
  // Encrypt only to the genuine share key.
  checkedPublicKey(
    toBytes(keys.share_key),
    expectedPublicKey(config.vetkd_key_name, canisterId, SHARE_KEY_CONTEXT, !isMainnet(client)),
  )
  return keys.share_key
}

export function ShareDialog({
  open,
  onClose,
  noteId,
  content,
}: {
  open: boolean
  onClose: () => void
  /** `null` while the note has not been saved yet. */
  noteId: string | null
  content: NoteContent
}) {
  const [views, setViews] = useState("1")
  const [ttl, setTtl] = useState(String(DURATION_CHOICES[1].seconds))
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const client = useClient()
  const backend = backendOf(client)
  const createShare = useMutation(client.mutationOptions(backend, "create_share"))
  const shares = useQuery({ ...client.queryOptions(backend, "list_shares"), enabled: open })
  const revoke = useMutation(client.mutationOptions(backend, "revoke_share"))
  const noteShares = (shares.data ?? []).filter((share) => share.note_id === noteId)

  const create = async () => {
    try {
      const prepared = prepareShare(content, await verifiedShareKey(client, backend))
      await createShare.mutateAsync({
        id: prepared.id,
        note_id: noteId,
        ciphertext: prepared.ciphertext,
        verifying_key: prepared.verifyingKey,
        max_views: Number(views),
        expires_in_secs: BigInt(ttl),
      })
      setLink(shareLink(window.location.origin, prepared.id, prepared.secret))
      setCopied(false)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }

  const copy = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success("Link copied")
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        setLink(null)
        onClose()
      }}
      title="Share a burn-after-reading link"
      description="The link opens a snapshot of this note. Once its views are used up or it expires, it can never be decrypted again."
    >
      {link ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950">
            <Link2 className="h-4 w-4 shrink-0 text-zinc-400" />
            <input
              readOnly
              value={link}
              className="min-w-0 flex-1 bg-transparent font-mono text-xs focus:outline-none"
              onFocus={(e) => e.target.select()}
              aria-label="Share link"
            />
            <Button size="sm" variant="primary" onClick={() => void copy()}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <Notice tone="warning">
            Anyone with this link can open it. The part after <code>#</code> is the key: it never reaches the
            canister, and this is the only time you can copy it.
          </Notice>
          <div className="flex justify-end">
            <Button variant="ghost" onClick={() => setLink(null)}>
              Create another link
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Can be opened</span>
              <Select value={views} onChange={setViews} options={VIEW_CHOICES} className="w-full" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Expires after</span>
              <Select
                value={ttl}
                onChange={setTtl}
                options={DURATION_CHOICES.map((c) => ({ value: String(c.seconds), label: c.label }))}
                className="w-full"
              />
            </label>
          </div>
          <Button
            variant="primary"
            className="w-full"
            loading={createShare.isPending}
            onClick={() => void create()}
          >
            <Flame className="h-4 w-4" /> Create link
          </Button>
        </div>
      )}

      {noteId && noteShares.length > 0 ? (
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium">Active links for this note</h3>
          <ul className="space-y-1.5">
            {noteShares.map((share) => (
              <li
                key={share.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800"
              >
                <span className="font-mono">{share.id.slice(0, 8)}…</span>
                <span className="text-zinc-500">
                  {share.views_left}/{share.max_views} views left · expires{" "}
                  {relativeTime(nanosToDate(share.expires_at))}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  aria-label="Revoke link"
                  loading={revoke.isPending && revoke.variables === share.id}
                  onClick={() =>
                    revoke.mutate(share.id, {
                      onSuccess: () => toast.success("Link revoked"),
                      onError: (error) => toast.error(errorMessage(error)),
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Dialog>
  )
}
