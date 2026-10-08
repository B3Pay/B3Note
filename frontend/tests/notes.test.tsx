// @vitest-environment jsdom
/**
 * The app's data layer (useNotes, the backend handle, mutations) on a real
 * ic-reactor client over its fake replica, with the real note and share crypto.
 */
import { createTestClient } from "@ic-reactor/core/testing"
import { ReactorProvider } from "@ic-reactor/react"
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity"
import { Principal } from "@icp-sdk/core/principal"
import { useMutation } from "@tanstack/react-query"
import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterAll, afterEach, describe, expect, it } from "vitest"
import { actor, type Actor, type Note } from "../src/canisters/backend"
import { useNotes } from "../src/app/notes"
import { concatBytes, encoder, idBytes, newId } from "../src/lib/bytes"
import { decryptOpenedShare, openShareRequest, prepareShare, SHARE_OPEN_DOMAIN } from "../src/lib/share"
import { unlockVault, type Vault } from "../src/lib/vault"
import { backendOf } from "../src/reactor"
import { FakeVetKd } from "./support/fakeVetKd"

const BACKEND = "bkyz2-fmaaa-aaaaa-qaaaq-cai"
const vetKd = new FakeVetKd()
const alice = Ed25519KeyIdentity.generate()
const bob = Ed25519KeyIdentity.generate()
const notes: { owner: string; note: Note }[] = []
const shares = new Map<string, { ciphertext: Uint8Array; verifyingKey: Uint8Array; viewsLeft: number }>()

// What a local network's asset canister (or the Vite plugin) sets: the id of
// the canister named `backend`, which the app's `{ name: "backend" }` resolves.
// `@icp-sdk/core` ignores a cookie without a root key; the test client never
// uses the cookie's key (it checks replies against its fake replica's own).
const placeholderRootKey = "00".repeat(133)
document.cookie = `ic_env=${encodeURIComponent(
  `ic_root_key=${placeholderRootKey}&PUBLIC_CANISTER_ID:backend=${BACKEND}`,
)}`

const { client, auth, mock } = createTestClient({ identity: alice, allowEnvConfig: true })
mock<Actor>(actor, BACKEND, {
  // Two notes per page, so the app has to follow the cursor.
  list_notes: ({ cursor }, { caller }) => {
    const sorted = notes
      .filter((n) => n.owner === caller)
      .map((n) => n.note)
      .sort((a, b) => a.id.localeCompare(b.id))
    const start = cursor ? sorted.findIndex((n) => n.id === cursor) + 1 : 0
    const page = sorted.slice(start, start + 2)
    const more = start + 2 < sorted.length
    return { tag: "Ok", value: { notes: page, next_cursor: more ? page[page.length - 1].id : null } }
  },
  create_note: ({ id, ciphertext, expires_at }, { caller }) => {
    const note: Note = { id, ciphertext, expires_at, created_at: 1n, updated_at: 1n, version: 1n }
    notes.push({ owner: caller, note })
    return { tag: "Ok", value: note }
  },
  create_share: (args) => {
    shares.set(args.id, {
      ciphertext: args.ciphertext,
      verifyingKey: args.verifying_key,
      viewsLeft: args.max_views,
    })
    return {
      tag: "Ok",
      value: {
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
  open_share: async (args) => {
    const share = shares.get(args.id)
    if (!share) return { tag: "Err", value: { tag: "NotFound" } }
    const message = concatBytes(
      encoder.encode(SHARE_OPEN_DOMAIN),
      idBytes(args.id),
      args.transport_public_key,
    )
    const { ed25519 } = await import("@noble/curves/ed25519")
    if (!ed25519.verify(args.signature, message, share.verifyingKey)) {
      return { tag: "Err", value: { tag: "Forbidden", value: "invalid share signature" } }
    }
    share.viewsLeft -= 1
    if (share.viewsLeft === 0) shares.delete(args.id)
    return {
      tag: "Ok",
      value: {
        ciphertext: share.ciphertext,
        encrypted_key: vetKd.deriveEncryptedKey(idBytes(args.id), args.transport_public_key),
        verification_key: vetKd.publicKeyBytes(),
        views_left: share.viewsLeft,
        expires_at: 1n,
      },
    }
  },
})

function vaultOf(identity: Ed25519KeyIdentity): Promise<Vault> {
  return unlockVault({
    principal: identity.getPrincipal(),
    canisterId: Principal.fromText(BACKEND),
    fetchEncryptedKey: async (tpk) => ({
      encrypted_key: vetKd.deriveEncryptedKey(identity.getPrincipal().toUint8Array(), tpk),
      verification_key: vetKd.publicKeyBytes(),
    }),
  })
}

const aliceVault = await vaultOf(alice)
const bobVault = await vaultOf(bob)

async function addNote(title: string, owner = alice, vault = aliceVault): Promise<Note> {
  const { id } = newId()
  const note: Note = {
    id,
    ciphertext: await vault.encrypt(id, { title, body: `body of ${title}`, tags: [], pinned: false }),
    created_at: 1n,
    updated_at: 1n,
    expires_at: null,
    version: 1n,
  }
  notes.push({ owner: owner.getPrincipal().toText(), note })
  return note
}

function wrapper({ children }: { children: ReactNode }) {
  return <ReactorProvider client={() => client}>{children}</ReactorProvider>
}

afterEach(() => {
  cleanup()
  client.queryClient.clear()
  notes.length = 0
  auth.switchTo(alice)
})
afterAll(() => client.dispose())

describe("useNotes", () => {
  it("resolves the backend by name from the ic_env cookie", () => {
    expect(client.queryKey(backendOf(client))[3]).toBe(BACKEND)
  })

  it("loads every page and decrypts each note", async () => {
    for (const title of ["one", "two", "three", "four", "five"]) await addNote(title)
    const { result } = renderHook(() => useNotes(aliceVault), { wrapper })
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
    tampered.ciphertext = tampered.ciphertext.slice()
    tampered.ciphertext[tampered.ciphertext.length - 1] ^= 1
    const { result } = renderHook(() => useNotes(aliceVault), { wrapper })
    await waitFor(() => expect(result.current.notes).toHaveLength(2), { timeout: 5_000 })
    const byId = new Map(result.current.notes.map((n) => [n.id, n]))
    expect(byId.get(tampered.id)?.content).toBeNull()
    expect(result.current.notes.filter((n) => n.content !== null)).toHaveLength(1)
  })

  it("refetches the list after a create_note mutation", async () => {
    await addNote("existing")
    const { result } = renderHook(
      () => ({
        list: useNotes(aliceVault),
        create: useMutation(client.mutationOptions(backendOf(client), "create_note")),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.list.notes).toHaveLength(1), { timeout: 5_000 })
    const { id } = newId()
    const ciphertext = await aliceVault.encrypt(id, { title: "new", body: "", tags: [], pinned: false })
    await act(() => result.current.create.mutateAsync({ id, ciphertext, expires_at: null }))
    await waitFor(() => expect(result.current.list.notes).toHaveLength(2), { timeout: 5_000 })
  })

  it("never shows one account's notes to the next", async () => {
    await addNote("alice's secret")
    await addNote("bob's note", bob, bobVault)
    const { result, rerender } = renderHook(({ vault }) => useNotes(vault), {
      wrapper,
      initialProps: { vault: aliceVault },
    })
    await waitFor(() => expect(result.current.notes).toHaveLength(1), { timeout: 5_000 })
    expect(result.current.notes[0].content?.title).toBe("alice's secret")

    const seen: (string | undefined)[] = []
    act(() => auth.switchTo(bob))
    rerender({ vault: bobVault })
    await waitFor(
      () => {
        seen.push(...result.current.notes.map((n) => n.content?.title))
        expect(result.current.notes.map((n) => n.content?.title)).toEqual(["bob's note"])
      },
      { timeout: 5_000 },
    )
    expect(seen).not.toContain("alice's secret")
  })
})

describe("share links", () => {
  it("are created by the owner and open once for someone else", async () => {
    const backend = backendOf(client)
    const prepared = prepareShare(
      { title: "Wifi", body: "hunter2", tags: [], pinned: false },
      vetKd.publicKeyBytes(),
    )
    await backend.create_share({
      id: prepared.id,
      note_id: null,
      ciphertext: prepared.ciphertext,
      verifying_key: prepared.verifyingKey,
      max_views: 1,
      expires_in_secs: 3_600n,
    })

    auth.switchTo(bob)
    const request = await openShareRequest(prepared.id, prepared.secret)
    const opened = await backend.open_share(request.args)
    expect(opened.views_left).toBe(0)
    expect(decryptOpenedShare(prepared.id, request.transportKey, opened).body).toBe("hunter2")

    const again = await openShareRequest(prepared.id, prepared.secret)
    await expect(backend.open_share(again.args)).rejects.toMatchObject({
      kind: "canister_err",
      err: { tag: "NotFound" },
    })
  })

  it("are refused to a client nobody signed in to", async () => {
    await auth.signOut()
    const request = await openShareRequest("00".repeat(16), new Uint8Array(32))
    await expect(backendOf(client).open_share(request.args)).rejects.toMatchObject({
      kind: "unauthenticated",
    })
    await auth.signIn()
  })
})
