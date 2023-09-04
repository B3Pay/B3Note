import { HttpAgent, Identity, getManagementCanister } from "@dfinity/agent"
import { Principal } from "@dfinity/principal"
import { IS_LOCAL } from "helper/config"

export { createBackendActor } from "./backend"
export type { Backend } from "./backend"

export function getHttpAgent(identity?: Identity) {
  return new HttpAgent({
    host: process.env.NEXT_PUBLIC_IC_HOST || "http://localhost:8080",
    identity,
  })
}

export async function createManagmentActor(identity: Identity) {
  const agent = getHttpAgent(identity)

  if (IS_LOCAL) {
    await agent.fetchRootKey()
  }

  return getManagementCanister({
    agent,
  })
}

export interface CanisterStatus {
  status:
    | {
        stopped: null
      }
    | {
        stopping: null
      }
    | {
        running: null
      }
  memory_size: bigint
  cycles: bigint
  settings: {
    controllers: Array<Principal>
    freezing_threshold: bigint
    memory_allocation: bigint
    compute_allocation: bigint
  }
  module_hash: [] | [Array<number>]
}
