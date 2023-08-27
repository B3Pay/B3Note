import { Identity } from "@dfinity/agent"
import { getHttpAgent } from "frontend/service"
import { backend, canisterId, createActor } from "../../declarations/backend"

export function createBackendActor(identity?: Identity) {
  if (identity) {
    const agent = getHttpAgent(identity)
    return createActor(canisterId, {
      agent,
    })
  }

  return createActor(canisterId)
}

export type Backend = typeof backend
