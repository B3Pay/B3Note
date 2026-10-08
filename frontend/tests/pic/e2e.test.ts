/**
 * End to end: the frontend's own data layer and crypto against the real
 * backend canister in PocketIC, with genuine vetKD.
 *
 * The Rust PocketIC tests already cover the canister. This suite checks that
 * the browser side (ic-reactor 4 clients over HTTP, the generated candid-core
 * module, `@icp-sdk/vetkeys`, and this app's vault and share modules)
 * interoperates with it.
 *
 * Guests call over HTTP with their own Ed25519 key. Internet Identity users
 * cannot (their principals belong to Internet Identity's canister
 * signatures), so they call through PocketIC as their principal, sending the
 * canister-signature public key the principal is derived from, as the app
 * sends the root of its delegation chain.
 *
 * Run with `pnpm test:pic` after `../scripts/build-canisters.sh`. Set
 * POCKET_IC_BIN to a PocketIC server binary (16.x).
 */
import { PocketIc, PocketIcServer, SubnetStateType } from "@dfinity/pic"
import { c, type AnyFieldSchema, type Schema } from "@candid-core/schema"
import { decode, encode, encodeArgs } from "@candid-core/schema/codec"
import { createClient, isReactorError, type Client } from "@ic-reactor/core"
import { AnonymousIdentity } from "@icp-sdk/core/agent"
import type { Ed25519KeyIdentity } from "@icp-sdk/core/identity"
import { Principal } from "@icp-sdk/core/principal"
import { MasterPublicKey, PocketIcMasterPublicKeyId } from "@icp-sdk/vetkeys"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  actor,
  CreateNoteArgs,
  CreateShareArgs,
  Error as BackendError,
  InitArgs,
  ListNotesArgs,
  Result_1,
  Result_2,
  Result_6,
  Result_9,
  type Actor,
} from "../../src/canisters/backend"
import { encoder, newId, randomBytes, type Bytes } from "../../src/lib/bytes"
import { SHARE_KEY_CONTEXT, USER_KEY_CONTEXT, checkedPublicKey } from "../../src/lib/keys"
import { guestIdentity } from "../../src/lib/sessionAuth"
import { decryptOpenedShare, openShareRequest, prepareShare } from "../../src/lib/share"
import { guestVault, unlockVault } from "../../src/lib/vault"

const WASM = resolve(import.meta.dirname, "../../../target/wasm32-unknown-unknown/release/backend.wasm")
const INTERNET_IDENTITY = Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai")

let server: PocketIcServer
let pic: PocketIc
let canisterId: Principal
let host: string
const clients: Client[] = []

/** A client as one guest (or, with no identity, an anonymous reader), and the backend on it. */
function backendFor(identity?: Ed25519KeyIdentity) {
  const client = createClient({ network: { host }, identity: identity ?? new AnonymousIdentity() })
  clients.push(client)
  return client.canister<Actor>(actor, { id: canisterId.toText() })
}

/** A new guest: their key, as the app stores it, and their identity. */
function newGuest() {
  const seed = randomBytes(32)
  const identity = guestIdentity(seed)
  return { seed, identity, principal: identity.getPrincipal() }
}

/** A canister-signature public key (DER, OID 1.3.6.1.4.1.56387.1.2) of `signer`. */
function canisterSigKey(signer: Principal, seed: Uint8Array): Bytes {
  const id = signer.toUint8Array()
  const bits = Uint8Array.of(0, id.length, ...id, ...seed)
  const body = Uint8Array.of(
    ...[0x30, 0x0c, 0x06, 0x0a, 0x2b, 0x06, 0x01, 0x04, 0x01, 0x83, 0xb8, 0x43, 0x01, 0x02],
    0x03,
    bits.length,
    ...bits,
  )
  return Uint8Array.of(0x30, body.length, ...body)
}

/** A new Internet Identity user: the key Internet Identity signs for them, and its principal. */
function newInternetIdentityUser(signer = INTERNET_IDENTITY) {
  const key = canisterSigKey(signer, randomBytes(32))
  return { key, principal: Principal.selfAuthenticating(key) }
}

type Outcome<T> = { tag: "Ok"; value: T } | { tag: "Err"; value: BackendError }

/** An update call as `sender` through PocketIC; rejects with the `Err`'s tag. */
async function callAs<T>(
  sender: Principal,
  method: string,
  argSchemas: readonly AnyFieldSchema[],
  args: readonly unknown[],
  result: Schema<Outcome<T>>,
): Promise<T> {
  const arg = encodeArgs(argSchemas, args)
  if (!arg.ok) throw new Error(`Cannot encode ${method}: ${JSON.stringify(arg.issues)}`)
  const reply = decode(result, await pic.updateCall({ canisterId, method, arg: arg.bytes, sender }))
  if (!reply.ok) throw new Error(`Cannot decode ${method}: ${JSON.stringify(reply.issues)}`)
  const outcome = reply.value as Outcome<T>
  if (outcome.tag === "Err") throw new Error(outcome.value.tag)
  return outcome.value
}

function getEncryptedUserKey(sender: Principal, tpk: Uint8Array, key: Uint8Array | null) {
  return callAs(sender, "get_encrypted_user_key", [c.blob(), c.opt(c.blob())], [tpk, key], Result_6)
}

function expectedKey(context: string) {
  return MasterPublicKey.pocketicKey(PocketIcMasterPublicKeyId.KEY_1)
    .deriveCanisterKey(canisterId.toUint8Array())
    .deriveSubKey(encoder.encode(context))
}

/** The vault of an Internet Identity user, unlocked with their vetKey. */
function unlockAs(user: { key: Bytes; principal: Principal }) {
  return unlockVault({
    principal: user.principal,
    canisterId,
    expectedKey: expectedKey(USER_KEY_CONTEXT),
    fetchEncryptedKey: (tpk) => getEncryptedUserKey(user.principal, tpk, user.key),
  })
}

/** What a rejected call's `Err` was, e.g. `"NotFound"`. */
async function errTag(call: Promise<unknown>): Promise<string | undefined> {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  )
  if (isReactorError(error) && error.kind === "canister_err") return (error.err as { tag: string }).tag
  return error instanceof Error ? error.message : String(error)
}

/** Has an Internet Identity user share a note; returns what the link carries. */
async function share(owner: { key: Bytes; principal: Principal }, title: string, body: string) {
  const keys = await backendFor().load_public_keys()
  // The key the browser encrypts to is the canister's genuine share key.
  checkedPublicKey(keys.share_key, expectedKey(SHARE_KEY_CONTEXT))
  const prepared = prepareShare({ title, body, tags: [], pinned: false }, keys.share_key)
  const args: CreateShareArgs = {
    id: prepared.id,
    note_id: null,
    ciphertext: prepared.ciphertext,
    verifying_key: prepared.verifyingKey,
    max_views: 1,
    expires_in_secs: 3_600n,
    internet_identity_key: owner.key,
  }
  await callAs(owner.principal, "create_share", [CreateShareArgs], [args], Result_2)
  return prepared
}

beforeAll(async () => {
  if (!existsSync(WASM)) throw new Error(`Build the canisters first: ${WASM} is missing`)
  server = await PocketIcServer.start()
  pic = await PocketIc.create(server.getUrl(), {
    ii: { state: { type: SubnetStateType.New } },
    application: [{ state: { type: SubnetStateType.New } }],
  })
  const [appSubnet] = await pic.getApplicationSubnets()
  // The install argument, `opt InitArgs`, encoded with the generated schema.
  const arg = encode(c.opt(InitArgs), {
    vetkd_key_name: "key_1",
    ai_enabled: null,
    llm_canister: null,
    llm_model: null,
    llm_cycles_per_call: null,
    limits: null,
  })
  if (!arg.ok) throw new Error(`Cannot encode the install argument: ${JSON.stringify(arg.issues)}`)
  canisterId = await pic.createCanister({ targetSubnetId: appSubnet.id, cycles: 100_000_000_000_000n })
  await pic.installCode({ canisterId, wasm: readFileSync(WASM), arg: arg.bytes })
  await pic.tick(5)
  const port = await pic.makeLive()
  host = `http://127.0.0.1:${port}`
})

afterAll(async () => {
  for (const client of clients) client.dispose()
  await pic?.tearDown()
  await server?.stop()
})

describe("guest notes", () => {
  it("are encrypted with a key derived from the guest key, readable in a later session", async () => {
    const guest = newGuest()
    const backend = backendFor(guest.identity)
    const vault = await guestVault(guest.principal, canisterId, guest.seed)
    const { id } = newId()
    const content = {
      title: "Launch plan",
      body: "- [ ] write docs\n- [x] tests",
      tags: ["work"],
      pinned: true,
    }
    const created = await backend.create_note({
      id,
      ciphertext: await vault.encrypt(id, content),
      expires_at: null,
    })
    expect(created.version).toBe(1n)

    // A new session elsewhere: the recovery key restores the identity and the note key.
    const restored = guestIdentity(Uint8Array.from(guest.seed))
    const later = backendFor(restored)
    const page = await later.list_notes({ cursor: null, limit: null })
    expect(page.notes.map((n) => n.id)).toEqual([id])
    const again = await guestVault(restored.getPrincipal(), canisterId, Uint8Array.from(guest.seed))
    await expect(again.decrypt(id, page.notes[0].version, page.notes[0].ciphertext)).resolves.toEqual(content)
  })

  it("are invisible to other guests, whose key cannot decrypt them", async () => {
    const alice = newGuest()
    const mallory = newGuest()
    const vault = await guestVault(alice.principal, canisterId, alice.seed)
    const { id } = newId()
    const ciphertext = await vault.encrypt(id, { title: "secret", body: "", tags: [], pinned: false })
    await backendFor(alice.identity).create_note({ id, ciphertext, expires_at: null })

    expect(await errTag(backendFor(mallory.identity).get_note(id))).toBe("NotFound")
    const malloryVault = await guestVault(mallory.principal, canisterId, mallory.seed)
    await expect(malloryVault.decrypt(id, 1n, ciphertext)).rejects.toThrow()
  })

  it("cost the canister no vetKD: guests get no vetKey and no share links", async () => {
    const guest = newGuest()
    const backend = backendFor(guest.identity)
    const tpk = new Uint8Array(48)
    expect(await errTag(backend.get_encrypted_user_key(tpk, null))).toBe("Forbidden")
    // Nor with an Internet Identity user's key, which is not theirs.
    expect(await errTag(backend.get_encrypted_user_key(tpk, newInternetIdentityUser().key))).toBe("Forbidden")
    const keys = await backend.load_public_keys()
    const prepared = prepareShare({ title: "x", body: "y", tags: [], pinned: false }, keys.share_key)
    const refused = backend.create_share({
      id: prepared.id,
      note_id: null,
      ciphertext: prepared.ciphertext,
      verifying_key: prepared.verifyingKey,
      max_views: 1,
      expires_in_secs: 3_600n,
      internet_identity_key: guest.identity.getPublicKey().toDer(),
    })
    expect(await errTag(refused)).toBe("Forbidden")
  })
})

describe("Internet Identity notes", () => {
  it("are encrypted with the user's vetKey, readable after a fresh derivation", async () => {
    const alice = newInternetIdentityUser()
    const vault = await unlockAs(alice)
    const { id } = newId()
    const content = { title: "Taxes", body: "receipts in the blue folder", tags: [], pinned: false }
    const args: CreateNoteArgs = { id, ciphertext: await vault.encrypt(id, content), expires_at: null }
    await callAs(alice.principal, "create_note", [CreateNoteArgs], [args], Result_1)

    const list: ListNotesArgs = { cursor: null, limit: null }
    const page = await callAs(alice.principal, "list_notes", [ListNotesArgs], [list], Result_9)
    const again = await unlockAs(alice)
    await expect(again.decrypt(id, page.notes[0].version, page.notes[0].ciphertext)).resolves.toEqual(content)
  })

  it("need the user's own key, signed by Internet Identity", async () => {
    const alice = newInternetIdentityUser()
    const mallory = newInternetIdentityUser()
    const tpk = new Uint8Array(48)
    await expect(getEncryptedUserKey(mallory.principal, tpk, alice.key)).rejects.toThrow("Forbidden")
    await expect(getEncryptedUserKey(mallory.principal, tpk, null)).rejects.toThrow("Forbidden")
    const impostor = newInternetIdentityUser(Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai"))
    await expect(getEncryptedUserKey(impostor.principal, tpk, impostor.key)).rejects.toThrow("Forbidden")
  })
})

describe("burn-after-reading links", () => {
  it("open once for an anonymous reader and are then gone", async () => {
    const prepared = await share(newInternetIdentityUser(), "Door code", "4711")

    // What SharedNote does: an anonymous client that may send updates.
    const reader = backendFor()
    const info = await reader.get_share(prepared.id)
    expect(info.views_left).toBe(1)

    const request = await openShareRequest(prepared.id, prepared.secret)
    const opened = await reader.open_share(request.args)
    const payload = decryptOpenedShare(
      prepared.id,
      request.transportKey,
      opened,
      expectedKey(SHARE_KEY_CONTEXT),
    )
    expect(payload.title).toBe("Door code")
    expect(payload.body).toBe("4711")
    expect(opened.views_left).toBe(0)

    const second = await openShareRequest(prepared.id, prepared.secret)
    expect(await errTag(reader.open_share(second.args))).toBe("NotFound")
  })

  it("refuse a reader without the link secret", async () => {
    const prepared = await share(newInternetIdentityUser(), "x", "y")
    const forged = await openShareRequest(prepared.id, crypto.getRandomValues(new Uint8Array(32)))
    expect(await errTag(backendFor().open_share(forged.args))).toBe("Forbidden")
  })
})
