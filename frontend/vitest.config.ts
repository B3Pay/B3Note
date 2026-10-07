import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Unit and component tests. They use the committed bindings in
// src/declarations, so the ic-reactor plugin is not loaded here.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{ts,tsx}", "tests/*.test.{ts,tsx}"],
    environment: "node",
    restoreMocks: true,
  },
})
