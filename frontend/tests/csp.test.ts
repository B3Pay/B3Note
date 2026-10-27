/**
 * The page's Content-Security-Policy, from the asset canister's headers
 * (public/.ic-assets.json5).
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const rules = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../public/.ic-assets.json5"),
  "utf8",
)

/** Each directive of the policy and its sources. */
function policy(): Map<string, string[]> {
  const header = rules.match(/"Content-Security-Policy": "([^"]+)"/)
  if (!header) throw new Error("No Content-Security-Policy in .ic-assets.json5")
  return new Map(
    header[1].split(";").map((directive) => {
      const [name, ...sources] = directive.trim().split(/\s+/)
      return [name, sources]
    }),
  )
}

describe("the Content-Security-Policy", () => {
  it("loads images from the app only, so no image URL can carry a note out", () => {
    expect(policy().get("img-src")).toEqual(["'self'", "data:"])
  })
})
