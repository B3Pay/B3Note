/** What this deployment offers, from the backend's public `get_config`. */
import { useClient } from "@ic-reactor/react"
import { useQuery } from "@tanstack/react-query"
import { backendOf } from "../reactor"

/** Whether a controller switched the AI assistant on (it is off by default). */
export function useAiEnabled(): boolean {
  const client = useClient()
  const config = useQuery(client.queryOptions(backendOf(client), "get_config"))
  return config.data?.ai_enabled === true
}
