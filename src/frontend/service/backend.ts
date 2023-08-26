import { Identity } from "@dfinity/agent"
import { getHttpAgent } from "frontend/service"
import { backend, canisterId, createActor } from "../../declarations/backend"

export function createBackendActor(identity: Identity) {
  const agent = getHttpAgent(identity)

  return createActor(canisterId, {
    agent,
  })
}

export type Backend = typeof backend
