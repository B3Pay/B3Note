import { icReactor } from "@ic-reactor/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  // Set by scripts/pocketic-dev.mjs: a PocketIC gateway instead of icp-cli's
  // local network, and the `ic_env` cookie a local asset canister would set.
  const gateway = env.B3NOTE_GATEWAY
  return {
    plugins: [
      react(),
      tailwindcss(),
      icReactor({
        canisters: [
          {
            name: "backend",
            didFile: "../backend/backend.did",
            // Raw Candid values: the crypto code works on Uint8Array blobs.
            mode: "Reactor",
            factories: true,
            // Written into the generated reactor for deployed builds. Without
            // it the app reads the id from the `ic_env` cookie the local
            // network (and the asset canister) sets.
            canisterId: env.CANISTER_ID_BACKEND || undefined,
          },
        ],
        injectEnvironment: !gateway,
      }),
    ],
    server: gateway
      ? {
          proxy: { "/api": { target: gateway, changeOrigin: true } },
          headers: env.B3NOTE_IC_ENV
            ? { "Set-Cookie": `ic_env=${encodeURIComponent(env.B3NOTE_IC_ENV)}; Path=/; SameSite=Lax` }
            : undefined,
        }
      : undefined,
    build: {
      target: "es2022",
      chunkSizeWarningLimit: 1500,
    },
  }
})
