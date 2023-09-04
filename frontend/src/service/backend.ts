import { Identity } from "@dfinity/agent"
import { Principal } from "@dfinity/principal"
import {
  canisterId as backendCanisterId,
  createActor,
  type backend,
} from "declarations/backend"
import { IS_LOCAL } from "helper/config"
import { getHttpAgent } from "service"

export async function createBackendActor(identity?: Identity) {
  // import it dynamically to avoid circular dependency
  console.log("creating backend actor")
  let canisterId = Principal.fromText(backendCanisterId)

  const agent = getHttpAgent(identity)

  if (IS_LOCAL) {
    agent.fetchRootKey()
  }

  return {
    backendActor: createActor(canisterId, {
      agent,
    }),
    canisterId,
  }
}

export type Backend = typeof backend
