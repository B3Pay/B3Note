import { Identity } from "@dfinity/agent"
import { Principal } from "@dfinity/principal"
import { backend } from "declarations/backend"
import { getHttpAgent } from "service"

export async function createBackendActor(identity?: Identity) {
  // import it dynamically to avoid circular dependency
  return import("declarations/backend").then(
    ({ canisterId: backendCanisterId, createActor }) => {
      console.log("creating backend actor")
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
  )
}

export type Backend = typeof backend
