/** What this deployment and this browser offer. */
import { useClient } from "@ic-reactor/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useSyncExternalStore } from "react"
import { detectLocalAi, localAiStatus, subscribeLocalAi, type LocalAiStatus } from "../lib/localAi"
import { backendOf } from "../reactor"

/** Whether a controller switched the canister's AI assistant on (it is off by default). */
export function useAiEnabled(): boolean {
  const client = useClient()
  const config = useQuery(client.queryOptions(backendOf(client), "get_config"))
  return config.data?.ai_enabled === true
}

/** The on-device model: which one this browser can run, and whether it is ready. */
export function useLocalAi(): LocalAiStatus {
  const status = useSyncExternalStore(subscribeLocalAi, localAiStatus, localAiStatus)
  useEffect(() => {
    void detectLocalAi()
  }, [])
  return status
}

/** Whether any assistant can run: on this device, or on the canister when it is switched on. */
export function useAnyAi(): { local: LocalAiStatus; cloud: boolean; any: boolean } {
  const local = useLocalAi()
  const cloud = useAiEnabled()
  return { local, cloud, any: cloud || (local.status !== "unavailable" && local.status !== "checking") }
}
