/**
 * B3Note's mainnet canisters (README, "Deploying to mainnet"). icp-cli deploys
 * the `production` environment to the ids in `.icp/data/mappings`, and creates
 * a new canister for any it cannot find there. A new frontend is a new origin,
 * which gives every user a new principal, so the ids recorded there must stay
 * the ones the app signs in for and calls.
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { PRODUCTION } from "../src/lib/origins"

const root = join(dirname(fileURLToPath(import.meta.url)), "../..")

describe("production's canisters", () => {
  it("are recorded for icp-cli as the ones the app signs in for and calls", () => {
    const ids = JSON.parse(readFileSync(join(root, ".icp/data/mappings/production.ids.json"), "utf8"))
    expect(ids).toEqual({
      backend: PRODUCTION.backend,
      frontend: new URL(PRODUCTION.origin).hostname.replace(/\.icp0\.io$/, ""),
    })
  })
})
