import type { Canister, Client } from "@ic-reactor/core"

/**
 * The id a canister handle resolved to, read from its query key
 * (`["ic-reactor", network, caller, canisterId, ...]`).
 */
export function canisterIdOf(client: Client, canister: Canister<object>): string {
  const id = client.queryKey(canister)[3]
  if (typeof id !== "string" || id.startsWith("$unresolved:")) {
    throw new Error(
      "The backend canister id is unknown: deploy with icp-cli, or build with CANISTER_ID_BACKEND set.",
    )
  }
  return id
}

/** Whether the client talks to mainnet, whose vetKD master keys are known offline. */
export function isMainnet(client: Client): boolean {
  return (
    client.network === "ic" || /(^|[./])(icp0\.io|ic0\.app|icp-api\.io|icp\.net)(:\d+)?$/.test(client.network)
  )
}
