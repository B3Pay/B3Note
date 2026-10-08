import { defineConfig } from "vitest/config"

// End-to-end tests of the frontend's data layer against the real backend
// canister in PocketIC. Build the canisters first (../scripts/build-canisters.sh).
export default defineConfig({
  test: {
    include: ["tests/pic/**/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
})
