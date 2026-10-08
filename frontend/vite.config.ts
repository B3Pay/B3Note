import { icReactor } from "@ic-reactor/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  // Set by scripts/pocketic-dev.ts: a PocketIC gateway instead of icp-cli's
  // local network, and the `ic_env` cookie a local asset canister would set.
  const gateway = env.B3NOTE_GATEWAY
  return {
    plugins: [
      react(),
      tailwindcss(),
      // ic-reactor 4: runs `candid-core-cli gen` on the backend's .did and
      // writes src/canisters/backend.ts (the `actor` schema and `type Actor`).
      icReactor({
        canisters: { backend: { didFile: "../backend/backend.did" } },
        injectEnvironment: !gateway,
      }),
    ],
    // `CANISTER_ID_BACKEND` bakes the backend's id into a deployed build.
    // Without it the app reads the id from the `ic_env` cookie.
    envPrefix: ["VITE_", "CANISTER_ID_"],
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
