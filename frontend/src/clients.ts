// The QueryClient, ClientManager and Internet Identity sign-in shared by the
// app. The generated backend reactor (src/declarations/backend) imports
// `clientManager` from here.
import { AuthenticationManager, ClientManager, reactorRetry } from "@ic-reactor/react"
import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: reactorRetry, staleTime: 30_000 },
  },
})

// The asset canister sets the `ic_env` cookie (canister ids, root key) when it
// serves the app. ClientManager trusts it on a local network by itself; on the
// IC's own domains no other canister can set a cookie for this host, so it is
// safe to trust there too.
const servedByTheIc =
  typeof window !== "undefined" && /\.(icp0\.io|ic0\.app|icp\.net)$/.test(window.location.hostname)

export const clientManager = new ClientManager({
  queryClient,
  ...(servedByTheIc ? { allowEnvConfig: true } : {}),
})

// The Internet Identity canister an icp-cli local network installs (`ii: true`).
const LOCAL_II_CANISTER = "rdmx6-jaaaa-aaaaa-aaadq-cai"

// Served by the asset canister of a local icp-cli network
// (`<name>.local.localhost:<port>`): Internet Identity's sign-in UI is the
// gateway's `id.ai.localhost` domain, which the asset canister's `ic_env`
// cookie does not name. Under `vite dev` the ic-reactor plugin's cookie names
// the provider, and on mainnet the default (id.ai) applies.
const localNetworkPage =
  typeof window !== "undefined" && window.location.hostname.endsWith(".localhost") ? window.location : null

export const authentication = new AuthenticationManager({
  clientManager,
  ...(localNetworkPage
    ? {
        identityProvider: `${localNetworkPage.protocol}//id.ai.localhost:${localNetworkPage.port}/authorize`,
        internetIdentityId: LOCAL_II_CANISTER,
      }
    : {}),
})
