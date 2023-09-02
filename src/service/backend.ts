import { Identity } from "@dfinity/agent"
import { Principal } from "@dfinity/principal"
import {
  backend,
  canisterId as backendCanisterId,
  createActor,
} from "declarations/backend"
import { getHttpAgent } from "service"

export function createBackendActor(identity?: Identity) {
  let canisterId = Principal.fromText(backendCanisterId)

  if (identity) {
    const agent = getHttpAgent(identity)
    return {
      actor: createActor(canisterId, {
        agent,
      }),
      canisterId,
    }
  }

  return { actor: createActor(canisterId), canisterId }
}

export type Backend = typeof backend
