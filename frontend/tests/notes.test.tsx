// @vitest-environment jsdom
/**
 * The app's data layer (generated reactor, notesQuery, mutations) against
 * ic-reactor's fake replica, with the real note and share crypto.
 */
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity"
import { Principal } from "@icp-sdk/core/principal"
import { createTestCanister, installFakeReplica } from "@ic-reactor/react/testing"
import { cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterAll, afterEach, describe, expect, it } from "vitest"
import { idlFactory, type Note, type _SERVICE } from "../src/declarations/backend/declarations/backend"
import { concatBytes, encoder, idBytes, newId, toBytes, toHex } from "../src/lib/bytes"
import { decryptOpenedShare, openShareRequest, prepareShare, SHARE_OPEN_DOMAIN } from "../src/lib/share"
import { unlockVault } from "../src/lib/vault"
import { FakeVetKd } from "./support/fakeVetKd"

const BACKEND = "bkyz2-fmaaa-aaaaa-qaaaq-cai"
const vetKd = new FakeVetKd()
const user = Ed25519KeyIdentity.generate()
const notes: Note[] = []
const shares = new Map<string, { ciphertext: Uint8Array; verifyingKey: Uint8Array; viewsLeft: number }>()

const replica = installFakeReplica({
  canisters: {
    [BACKEND]: createTestCanister<_SERVICE>(idlFactory, {
      // Two notes per page, so the app has to follow the cursor.
      list_notes: ([args]) => {
        const sorted = [...notes].sort((a, b) => a.id.localeCompare(b.id))
        const start = args.cursor[0] ? sorted.findIndex((n) => n.id === args.cursor[0]) + 1 : 0
        const page = sorted.slice(start, start + 2)
        const more = start + 2 < sorted.length
        return { Ok: { notes: page, next_cursor: more ? [page[page.length - 1].id] : [] } }
      },
      create_share: ([args], { caller }) => {
        if (caller.isAnonymous()) return { Err: { Unauthenticated: null } }
        shares.set(args.id, {
          ciphertext: toBytes(args.ciphertext),
          verifyingKey: toBytes(args.verifying_key),
          viewsLeft: args.max_views,
        })
        return {
          Ok: {
            id: args.id,
            note_id: args.note_id,
            created_at: 0n,
            expires_at: 1n,
            max_views: args.max_views,
            views_left: args.max_views,
            size: args.ciphertext.length,
          },
        }
      },
      open_share: async ([args]) => {
        const share = shares.get(args.id)
        if (!share) return { Err: { NotFound: null } }
        const message = concatBytes(
          encoder.encode(SHARE_OPEN_DOMAIN),
          idBytes(args.id),
          toBytes(args.transport_public_key),
        )
        const { ed25519 } = await import("@noble/curves/ed25519")
        if (!ed25519.verify(toBytes(args.signature), message, share.verifyingKey)) {
          return { Err: { Forbidden: "invalid share signature" } }
        }
        share.viewsLeft -= 1
        if (share.viewsLeft === 0) shares.delete(args.id)
        return {
          Ok: {
            ciphertext: share.ciphertext,
            encrypted_key: vetKd.deriveEncryptedKey(idBytes(args.id), toBytes(args.transport_public_key)),
            verification_key: vetKd.publicKeyBytes(),
            views_left: share.viewsLeft,
            expires_at: 1n,
          },
        }
      },
    }),
  },
})

// What a local network's asset canister (or the Vite plugin) provides: the
// canister id the generated reactor reads, and the root key.
document.cookie = `ic_env=${encodeURIComponent(
  `ic_root_key=${toHex(replica.rootKey)}&PUBLIC_CANISTER_ID:backend=${BACKEND}`,
)}`

const { clientManager, queryClient } = await import("../src/clients")
const { useNotes } = await import("../src/app/notes")
const { createShareMutation, openShareMutation } = await import("../src/declarations/backend")
clientManager.updateAgent(user)

const vault = await unlockVault({
  principal: user.getPrincipal(),
  canisterId: Principal.fromText(BACKEND),
  fetchEncryptedKey: async (tpk) => ({
    encrypted_key: vetKd.deriveEncryptedKey(user.getPrincipal().toUint8Array(), tpk),
    verification_key: vetKd.publicKeyBytes(),
  }),
})

async function addNote(title: string, version = 1n): Promise<Note> {
  const { id } = newId()
  const note: Note = {
    id,
    ciphertext: await vault.encrypt(id, { title, body: `body of ${title}`, tags: [], pinned: false }),
    created_at: 1n,
    updated_at: version,
    expires_at: [],
    version,
  }
  notes.push(note)
  return note
}

afterEach(() => {
  cleanup()
  queryClient.clear()
  notes.length = 0
})
afterAll(() => replica.restore())

describe("useNotes", () => {
  it("loads every page and decrypts each note", async () => {
    for (const title of ["one", "two", "three", "four", "five"]) await addNote(title)
    const { result } = renderHook(() => useNotes(vault))
    await waitFor(() => expect(result.current.notes).toHaveLength(5), { timeout: 5_000 })
    expect(result.current.loadingMore).toBe(false)
    expect(result.current.notes.map((n) => n.content?.title).sort()).toEqual([
      "five",
      "four",
      "one",
      "three",
      "two",
    ])
  })

  it("marks a note it cannot decrypt instead of failing the list", async () => {
    await addNote("fine")
    const tampered = await addNote("tampered")
    const bytes = toBytes(tampered.ciphertext)
    bytes[bytes.length - 1] ^= 1
    tampered.ciphertext = bytes
    const { result } = renderHook(() => useNotes(vault))
    await waitFor(() => expect(result.current.notes).toHaveLength(2), { timeout: 5_000 })
    const byId = new Map(result.current.notes.map((n) => [n.id, n]))
    expect(byId.get(tampered.id)?.content).toBeNull()
    expect(result.current.notes.filter((n) => n.content !== null)).toHaveLength(1)
  })
})

describe("share links through the reactor", () => {
  it("creates a link as the user and opens it once as anyone", async () => {
    const prepared = prepareShare(
      { title: "Wifi", body: "hunter2", tags: [], pinned: false },
      vetKd.publicKeyBytes(),
    )
    await createShareMutation.execute([
      {
        id: prepared.id,
        note_id: [],
        ciphertext: prepared.ciphertext,
        verifying_key: prepared.verifyingKey,
        max_views: 1,
        expires_in_secs: 3_600n,
      },
    ])
    const request = await openShareRequest(prepared.id, prepared.secret)
    const opened = await openShareMutation.execute([request.args])
    expect(opened.views_left).toBe(0)
    expect(decryptOpenedShare(prepared.id, request.transportKey, opened).body).toBe("hunter2")

    const again = await openShareRequest(prepared.id, prepared.secret)
    await expect(openShareMutation.execute([again.args])).rejects.toMatchObject({ code: "NotFound" })
  })
})
