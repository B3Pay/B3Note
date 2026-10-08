/**
 * End to end: the frontend's own data layer and crypto against the real
 * backend canister in PocketIC, with genuine vetKD.
 *
 * The Rust PocketIC tests already cover the canister. This suite checks that
 * the browser side (ic-reactor 4 clients over HTTP, the generated candid-core
 * module, `@icp-sdk/vetkeys`, and this app's vault and share modules)
 * interoperates with it.
 *
 * Run with `pnpm test:pic` after `../scripts/build-canisters.sh`. Set
 * POCKET_IC_BIN to a PocketIC server binary (16.x).
 */
import { PocketIc, PocketIcServer, SubnetStateType } from "@dfinity/pic"
import { c } from "@candid-core/schema"
import { encode } from "@candid-core/schema/codec"
import { createClient, isReactorError, type Client } from "@ic-reactor/core"
import { AnonymousIdentity } from "@icp-sdk/core/agent"
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity"
import type { Principal } from "@icp-sdk/core/principal"
import { MasterPublicKey, PocketIcMasterPublicKeyId } from "@icp-sdk/vetkeys"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { actor, InitArgs, type Actor } from "../../src/canisters/backend"
import { encoder, newId } from "../../src/lib/bytes"
import { SHARE_KEY_CONTEXT, USER_KEY_CONTEXT, checkedPublicKey } from "../../src/lib/keys"
import { decryptOpenedShare, openShareRequest, prepareShare } from "../../src/lib/share"
import { unlockVault } from "../../src/lib/vault"

const WASM = resolve(import.meta.dirname, "../../../target/wasm32-unknown-unknown/release/backend.wasm")

let server: PocketIcServer
let pic: PocketIc
let canisterId: Principal
let host: string
const clients: Client[] = []

/** A client as one user (or, with no identity, an anonymous reader), and the backend on it. */
function backendFor(identity?: Ed25519KeyIdentity) {
  const client = createClient({ network: { host }, identity: identity ?? new AnonymousIdentity() })
  clients.push(client)
  return client.canister<Actor>(actor, { id: canisterId.toText() })
}

type Backend = ReturnType<typeof backendFor>

function expectedKey(context: string) {
  return MasterPublicKey.pocketicKey(PocketIcMasterPublicKeyId.KEY_1)
    .deriveCanisterKey(canisterId.toUint8Array())
    .deriveSubKey(encoder.encode(context))
}

function unlock(backend: Backend, identity: Ed25519KeyIdentity) {
  return unlockVault({
    principal: identity.getPrincipal(),
    canisterId,
    expectedKey: expectedKey(USER_KEY_CONTEXT),
    fetchEncryptedKey: (tpk) => backend.get_encrypted_user_key(tpk),
  })
}

/** What a rejected call's `Err` was, e.g. `"NotFound"`. */
async function errTag(call: Promise<unknown>): Promise<string | undefined> {
  const error = await call.then(
    () => undefined,
    (e: unknown) => e,
  )
  return isReactorError(error) && error.kind === "canister_err"
    ? (error.err as { tag: string }).tag
    : String(error)
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
    ai_enabled: false,
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

describe("notes", () => {
  it("are encrypted by the browser code and readable in a later session", async () => {
    const alice = Ed25519KeyIdentity.generate()
    const backend = backendFor(alice)
    const vault = await unlock(backend, alice)

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

    // A new session: a fresh client and a fresh vetKey derivation.
    const later = backendFor(alice)
    const page = await later.list_notes({ cursor: null, limit: null })
    expect(page.notes.map((n) => n.id)).toEqual([id])
    const again = await unlock(later, alice)
    await expect(again.decrypt(id, page.notes[0].version, page.notes[0].ciphertext)).resolves.toEqual(content)
  })

  it("are invisible to other users, and their key cannot decrypt them", async () => {
    const alice = Ed25519KeyIdentity.generate()
    const mallory = Ed25519KeyIdentity.generate()
    const aliceBackend = backendFor(alice)
    const vault = await unlock(aliceBackend, alice)
    const { id } = newId()
    const ciphertext = await vault.encrypt(id, { title: "secret", body: "", tags: [], pinned: false })
    await aliceBackend.create_note({ id, ciphertext, expires_at: null })

    const malloryBackend = backendFor(mallory)
    expect(await errTag(malloryBackend.get_note(id))).toBe("NotFound")
    const malloryVault = await unlock(malloryBackend, mallory)
    await expect(malloryVault.decrypt(id, 1n, ciphertext)).rejects.toThrow()
  })
})

describe("burn-after-reading links", () => {
  it("open once for an anonymous reader and are then gone", async () => {
    const alice = Ed25519KeyIdentity.generate()
    const owner = backendFor(alice)
    const keys = await owner.load_public_keys()
    // The key the browser encrypts to is the canister's genuine share key.
    checkedPublicKey(keys.share_key, expectedKey(SHARE_KEY_CONTEXT))

    const prepared = prepareShare(
      { title: "Door code", body: "4711", tags: [], pinned: false },
      keys.share_key,
    )
    await owner.create_share({
      id: prepared.id,
      note_id: null,
      ciphertext: prepared.ciphertext,
      verifying_key: prepared.verifyingKey,
      max_views: 1,
      expires_in_secs: 3_600n,
    })

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
    const alice = Ed25519KeyIdentity.generate()
    const owner = backendFor(alice)
    const keys = await owner.load_public_keys()
    const prepared = prepareShare({ title: "x", body: "y", tags: [], pinned: false }, keys.share_key)
    await owner.create_share({
      id: prepared.id,
      note_id: null,
      ciphertext: prepared.ciphertext,
      verifying_key: prepared.verifyingKey,
      max_views: 1,
      expires_in_secs: 3_600n,
    })
    const forged = await openShareRequest(prepared.id, crypto.getRandomValues(new Uint8Array(32)))
    expect(await errTag(backendFor().open_share(forged.args))).toBe("Forbidden")
  })
})
