/**
 * The files Internet Identity reads before it delivers B3Note's notifications
 * (docs/operations.md, "Notifications"): who may send them, and the name and
 * logo it shows on them.
 */
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { PRODUCTION } from "../src/lib/origins"

const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../public")
const publicFile = (path: string) => readFileSync(join(publicDir, path))
const json = (path: string) => JSON.parse(publicFile(path).toString("utf8")) as Record<string, unknown>

describe("Internet Identity's notification files", () => {
  it("name the B3Pay hub, and only it, as the sender", () => {
    expect(json(".well-known/ii-notification-senders")).toEqual({
      senders: [PRODUCTION.notificationSender],
    })
  })

  it("describe the app within Internet Identity's limits, with a square raster logo of its own", () => {
    const metadata = json(".well-known/ii-app-metadata")
    expect(Object.keys(metadata).sort()).toEqual(["description", "logo", "name"])
    expect(metadata.name).toBe("B3Note")
    expect([...String(metadata.name)].length).toBeLessThanOrEqual(40)
    expect([...String(metadata.description)].length).toBeLessThanOrEqual(120)
    // Relative, since Internet Identity may read it on any gateway address.
    const logo = String(metadata.logo)
    expect(logo).toMatch(/^\/[^/].*\.png$/)
    const png = publicFile(logo.slice(1))
    expect(png.subarray(1, 4).toString("latin1")).toBe("PNG")
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([512, 512])
  })

  it("are served as JSON with CORS, the logo with CORS too", () => {
    const rules = publicFile(".ic-assets.json5").toString("utf8")
    for (const file of ["ii-notification-senders", "ii-app-metadata"]) {
      expect(rules).toMatch(
        new RegExp(
          `match: "\\.well-known/${file}",\\s+headers: \\{ "Access-Control-Allow-Origin": "\\*", "Content-Type": "application/json" \\}`,
        ),
      )
    }
    const logo = String(json(".well-known/ii-app-metadata").logo).slice(1)
    expect(rules).toMatch(
      new RegExp(
        `match: "${logo.replace(/\./g, "\\.")}",\\s+headers: \\{ "Access-Control-Allow-Origin": "\\*" \\}`,
      ),
    )
  })
})
