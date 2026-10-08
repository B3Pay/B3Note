/**
 * A local backend for UI work without icp-cli: starts PocketIC (with an II
 * subnet holding the vetKD key `key_1`), installs the backend and the mock
 * LLM canister, and writes `.env.development.local` so `pnpm dev` talks to it.
 *
 *   ../scripts/build-canisters.sh
 *   POCKET_IC_BIN=/path/to/pocket-ic pnpm dev:pocketic   # keep it running
 *   pnpm dev                                             # in another terminal
 *
 * Internet Identity is not installed: use a guest key to sign in. Node 22.18
 * or later runs this TypeScript file as is.
 */
import { c } from "@candid-core/schema"
import { encode, encodeArgs } from "@candid-core/schema/codec"
import { PocketIc, PocketIcServer, SubnetStateType } from "@dfinity/pic"
import { HttpAgent } from "@icp-sdk/core/agent"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { InitArgs } from "../src/canisters/backend.ts"

const here = dirname(fileURLToPath(import.meta.url))
const release = resolve(here, "../../target/wasm32-unknown-unknown/release")
const port = Number(process.env.GATEWAY_PORT ?? 4944)

function bytes(result: ReturnType<typeof encode>): Uint8Array {
  if (!result.ok) throw new Error(`Cannot encode an install argument: ${JSON.stringify(result.issues)}`)
  return result.bytes
}

// HTTP gateway traffic does not count as activity for the idle timeout.
const server = await PocketIcServer.start({ ttl: 24 * 3_600 })
const pic = await PocketIc.create(server.getUrl(), {
  ii: { state: { type: SubnetStateType.New } },
  application: [{ state: { type: SubnetStateType.New } }],
})
const [app] = await pic.getApplicationSubnets()

const llm = await pic.createCanister({ targetSubnetId: app.id, cycles: 10_000_000_000_000n })
await pic.installCode({
  canisterId: llm,
  wasm: readFileSync(resolve(release, "mock_llm.wasm")),
  arg: bytes(encodeArgs([], [])),
})

const backend = await pic.createCanister({ targetSubnetId: app.id, cycles: 100_000_000_000_000n })
await pic.installCode({
  canisterId: backend,
  wasm: readFileSync(resolve(release, "backend.wasm")),
  // `opt InitArgs`, encoded with the schema the app's client uses.
  arg: bytes(
    encode(c.opt(InitArgs), {
      vetkd_key_name: "key_1",
      ai_enabled: true,
      llm_canister: llm.toText(),
      llm_model: null,
      llm_cycles_per_call: null,
      limits: null,
    }),
  ),
})
await pic.tick(5)
const gatewayPort = await pic.makeLive({ httpGateway: { port } })
const gateway = `http://127.0.0.1:${gatewayPort}`

const agent = await HttpAgent.create({ host: gateway, shouldFetchRootKey: true })
const rootKey = Buffer.from(agent.rootKey!).toString("hex")
const env = [
  `# Written by scripts/pocketic-dev.ts`,
  `B3NOTE_GATEWAY=${gateway}`,
  `B3NOTE_IC_ENV=ic_root_key=${rootKey}&PUBLIC_CANISTER_ID:backend=${backend.toText()}`,
  "",
].join("\n")
writeFileSync(resolve(here, "../.env.development.local"), env)

console.log(`PocketIC gateway: ${gateway}`)
console.log(`backend:          ${backend.toText()}`)
console.log(`mock LLM:         ${llm.toText()}`)
console.log("Wrote .env.development.local. Run `pnpm dev` and sign in as a guest. Ctrl+C to stop.")

const stop = async () => {
  await pic.tearDown()
  await server.stop()
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
setInterval(() => {}, 1 << 30)
