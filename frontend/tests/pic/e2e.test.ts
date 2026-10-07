/**
 * End to end: the frontend's own data layer and crypto against the real
 * backend canister in PocketIC, with genuine vetKD.
 *
 * The Rust PocketIC tests already cover the canister. This suite checks that
 * the browser side (ic-reactor's ClientManager and Reactor over HTTP,
 * `@icp-sdk/vetkeys`, and this app's vault and share modules) interoperates
 * with it.
 *
 * Run with `pnpm test:pic` after `../scripts/build-canisters.sh`. Set
 * POCKET_IC_BIN to a PocketIC server binary (16.x).
 */
import { PocketIc, PocketIcServer, SubnetStateType } from "@dfinity/pic"
import { ClientManager, Reactor, isCanisterError } from "@ic-reactor/react"
import { IDL } from "@icp-sdk/core/candid"
import { Ed25519KeyIdentity } from "@icp-sdk/core/identity"
import type { Principal } from "@icp-sdk/core/principal"
import { MasterPublicKey, PocketIcMasterPublicKeyId } from "@icp-sdk/vetkeys"
import { QueryClient } from "@tanstack/react-query"
import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { idlFactory, init, type _SERVICE } from "../../src/declarations/backend/declarations/backend"
import { encoder, newId, toBytes } from "../../src/lib/bytes"
import { SHARE_KEY_CONTEXT, USER_KEY_CONTEXT, checkedPublicKey } from "../../src/lib/keys"
import { decryptOpenedShare, openShareRequest, prepareShare } from "../../src/lib/share"
import { unlockVault } from "../../src/lib/vault"

const WASM = resolve(import.meta.dirname, "../../../target/wasm32-unknown-unknown/release/backend.wasm")

let server: PocketIcServer
let pic: PocketIc
let canisterId: Principal
let host: string

function reactorFor(identity?: Ed25519KeyIdentity): Reactor<_SERVICE> {
  const clientManager = new ClientManager({
    queryClient: new QueryClient(),
    agentOptions: { host },
  })
  if (identity) clientManager.updateAgent(identity)
  return new Reactor<_SERVICE>({ clientManager, idlFactory, canisterId, name: "backend" })
}

function expectedKey(context: string) {
  return MasterPublicKey.pocketicKey(PocketIcMasterPublicKeyId.KEY_1)
    .deriveCanisterKey(canisterId.toUint8Array())
    .deriveSubKey(encoder.encode(context))
}

function unlock(backend: Reactor<_SERVICE>, identity: Ed25519KeyIdentity) {
  return unlockVault({
    principal: identity.getPrincipal(),
    canisterId,
    expectedKey: expectedKey(USER_KEY_CONTEXT),
    fetchEncryptedKey: (tpk) => backend.callMethod({ functionName: "get_encrypted_user_key", args: [tpk] }),
  })
}

beforeAll(async () => {
  if (!existsSync(WASM)) throw new Error(`Build the canisters first: ${WASM} is missing`)
  server = await PocketIcServer.start()
  pic = await PocketIc.create(server.getUrl(), {
    ii: { state: { type: SubnetStateType.New } },
    application: [{ state: { type: SubnetStateType.New } }],
  })
  const [appSubnet] = await pic.getApplicationSubnets()
  const arg = IDL.encode(init({ IDL }), [
    [
      {
        vetkd_key_name: ["key_1"],
        ai_enabled: [false],
        llm_canister: [],
        llm_model: [],
        llm_cycles_per_call: [],
        limits: [],
      },
    ],
  ])
  const fixture = await pic.setupCanister<_SERVICE>({
    idlFactory,
    wasm: WASM,
    arg: new Uint8Array(arg),
    targetSubnetId: appSubnet.id,
    cycles: 100_000_000_000_000n,
  })
  canisterId = fixture.canisterId
  await pic.tick(5)
  const port = await pic.makeLive()
  host = `http://127.0.0.1:${port}`
})

afterAll(async () => {
  await pic?.tearDown()
  await server?.stop()
})

describe("notes", () => {
  it("are encrypted by the browser code and readable in a later session", async () => {
    const alice = Ed25519KeyIdentity.generate()
    const backend = reactorFor(alice)
    const vault = await unlock(backend, alice)

    const { id } = newId()
    const content = {
      title: "Launch plan",
      body: "- [ ] write docs\n- [x] tests",
      tags: ["work"],
      pinned: true,
    }
    const created = await backend.callMethod({
      functionName: "create_note",
      args: [{ id, ciphertext: await vault.encrypt(id, content), expires_at: [] }],
    })
    expect(created.version).toBe(1n)

    // A new session: a fresh reactor and a fresh vetKey derivation.
    const later = reactorFor(alice)
    const page = await later.callMethod({ functionName: "list_notes", args: [{ cursor: [], limit: [] }] })
    expect(page.notes.map((n) => n.id)).toEqual([id])
    const again = await unlock(later, alice)
    await expect(again.decrypt(id, page.notes[0].version, page.notes[0].ciphertext)).resolves.toEqual(content)
  })

  it("are invisible to other users, and their key cannot decrypt them", async () => {
    const alice = Ed25519KeyIdentity.generate()
    const mallory = Ed25519KeyIdentity.generate()
    const aliceBackend = reactorFor(alice)
    const vault = await unlock(aliceBackend, alice)
    const { id } = newId()
    const ciphertext = await vault.encrypt(id, { title: "secret", body: "", tags: [], pinned: false })
    await aliceBackend.callMethod({ functionName: "create_note", args: [{ id, ciphertext, expires_at: [] }] })

    const malloryBackend = reactorFor(mallory)
    const error = await malloryBackend
      .callMethod({ functionName: "get_note", args: [id] })
      .catch((e: unknown) => e)
    expect(isCanisterError(error) && error.code).toBe("NotFound")
    const malloryVault = await unlock(malloryBackend, mallory)
    await expect(malloryVault.decrypt(id, 1n, ciphertext)).rejects.toThrow()
  })
})

describe("burn-after-reading links", () => {
  it("open once for an anonymous reader and are then gone", async () => {
    const alice = Ed25519KeyIdentity.generate()
    const owner = reactorFor(alice)
    const keys = await owner.callMethod({ functionName: "load_public_keys", args: [] })
    // The key the browser encrypts to is the canister's genuine share key.
    checkedPublicKey(toBytes(keys.share_key), expectedKey(SHARE_KEY_CONTEXT))

    const prepared = prepareShare(
      { title: "Door code", body: "4711", tags: [], pinned: false },
      keys.share_key,
    )
    await owner.callMethod({
      functionName: "create_share",
      args: [
        {
          id: prepared.id,
          note_id: [],
          ciphertext: prepared.ciphertext,
          verifying_key: prepared.verifyingKey,
          max_views: 1,
          expires_in_secs: 3_600n,
        },
      ],
    })

    const reader = reactorFor()
    const info = await reader.callMethod({ functionName: "get_share", args: [prepared.id] })
    expect(info.views_left).toBe(1)

    const request = await openShareRequest(prepared.id, prepared.secret)
    const opened = await reader.callMethod({ functionName: "open_share", args: [request.args] })
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
    const error = await reader
      .callMethod({ functionName: "open_share", args: [second.args] })
      .catch((e: unknown) => e)
    expect(isCanisterError(error) && error.code).toBe("NotFound")
  })

  it("refuse a reader without the link secret", async () => {
    const alice = Ed25519KeyIdentity.generate()
    const owner = reactorFor(alice)
    const keys = await owner.callMethod({ functionName: "load_public_keys", args: [] })
    const prepared = prepareShare({ title: "x", body: "y", tags: [], pinned: false }, keys.share_key)
    await owner.callMethod({
      functionName: "create_share",
      args: [
        {
          id: prepared.id,
          note_id: [],
          ciphertext: prepared.ciphertext,
          verifying_key: prepared.verifyingKey,
          max_views: 1,
          expires_in_secs: 3_600n,
        },
      ],
    })
    const forged = await openShareRequest(prepared.id, crypto.getRandomValues(new Uint8Array(32)))
    const error = await reactorFor()
      .callMethod({ functionName: "open_share", args: [forged.args] })
      .catch((e: unknown) => e)
    expect(isCanisterError(error) && error.code).toBe("Forbidden")
  })
})
