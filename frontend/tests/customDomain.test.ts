// @vitest-environment jsdom
/**
 * B3Note at a custom domain (README, "Custom domain"): which origins count as
 * one, the files the HTTP gateways and Internet Identity read, and the app's
 * client on each address that serves it.
 */
import { IC_ROOT_KEY } from "@icp-sdk/core/agent"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it, vi } from "vitest"
import { customDomainAt, PRODUCTION } from "../src/lib/origins"

/** The page's JSDOM, which vitest's jsdom environment exposes. */
declare const jsdom: { reconfigure(settings: { url: string }): void }

/** The options of each `AuthClient` the app builds. */
const authClients = vi.hoisted(() => [] as Record<string, unknown>[])

// Stands in for `@icp-sdk/auth`'s AuthClient, signed out.
vi.mock("@icp-sdk/auth/client", () => ({
  AuthClient: class {
    constructor(options: Record<string, unknown>) {
      authClients.push(options)
    }
    getPrincipal() {
      return undefined
    }
    getStatus() {
      return { state: "signed-out" }
    }
    async getIdentity() {
      throw new Error("Signed out.")
    }
    subscribe() {
      return () => {}
    }
    async signIn() {}
    async signOut() {}
  },
}))

// A path, not `new URL(..., import.meta.url)`, which Vite rewrites as an asset
// import in the browser-like environment.
const publicDir = join(dirname(fileURLToPath(import.meta.url)), "../public")
const publicFile = (path: string) => readFileSync(join(publicDir, path), "utf8")

describe("custom domains", () => {
  it("sign in for the canister's own address and call production's backend", () => {
    expect(customDomainAt("https://note.b3pay.net")).toEqual({
      derivationOrigin: "https://4lidq-zqaaa-aaaap-abkbq-cai.icp0.io",
      backendId: "xeka7-ryaaa-aaaal-qb57a-cai",
    })
  })

  it("change nothing anywhere else", () => {
    for (const origin of [
      undefined,
      PRODUCTION.origin,
      "https://4lidq-zqaaa-aaaap-abkbq-cai.icp.net",
      "http://localhost:5173",
      "http://note.b3pay.net",
      "https://note.b3pay.net.example.com",
      "https://other.b3pay.net",
    ]) {
      expect(customDomainAt(origin), String(origin)).toBeUndefined()
    }
  })

  it("are the ones public/.well-known lists for the gateways and Internet Identity", () => {
    const icDomains = publicFile(".well-known/ic-domains")
      .split("\n")
      .filter((line) => line !== "")
      .map((domain) => `https://${domain}`)
    expect(icDomains).toEqual(PRODUCTION.customDomains)
    expect(JSON.parse(publicFile(".well-known/ii-alternative-origins"))).toEqual({
      alternativeOrigins: PRODUCTION.customDomains,
    })
  })

  it("are served: the asset canister keeps .well-known and lets Internet Identity read its list", () => {
    const rules = publicFile(".ic-assets.json5")
    expect(rules).toMatch(/match: "\.well-known",\s+ignore: false,/)
    expect(rules).toMatch(
      /match: "\.well-known\/ii-alternative-origins",\s+headers: \{ "Access-Control-Allow-Origin": "\*",/,
    )
  })
})

describe("the app's client", () => {
  /** A canister that an `ic_env` cookie names instead of production's backend. */
  const COOKIE_BACKEND = "bkyz2-fmaaa-aaaaa-qaaaq-cai"

  /**
   * Loads `src/reactor.ts` afresh on a page at `url` that was sent an `ic_env`
   * cookie naming `COOKIE_BACKEND`, as a sibling subdomain could set one.
   */
  async function appAt(url: string) {
    jsdom.reconfigure({ url })
    document.cookie = `ic_env=${encodeURIComponent(
      `ic_root_key=${IC_ROOT_KEY}&PUBLIC_CANISTER_ID:backend=${COOKIE_BACKEND}`,
    )}`
    vi.resetModules()
    authClients.length = 0
    const { client, backendOf, sessionAuth } = await import("../src/reactor")
    sessionAuth() // builds the auth, and with it the AuthClient
    return {
      host: client.network,
      backend: client.queryKey(backendOf(client), "get_config")[3],
      authClient: authClients[0],
    }
  }

  it("at the custom domain signs in for the canister's address, and calls production's backend through mainnet's API", async () => {
    const app = await appAt("https://note.b3pay.net/")
    expect(app.authClient).toMatchObject({ derivationOrigin: PRODUCTION.origin })
    expect(app.backend).toBe(PRODUCTION.backend)
    expect(app.host).toBe("https://icp-api.io")
  })

  it("at the canister's own address signs in for it, and reads the backend from its cookie", async () => {
    const app = await appAt(`${PRODUCTION.origin}/`)
    expect(app.authClient).toBeDefined()
    expect(app.authClient).not.toHaveProperty("derivationOrigin")
    expect(app.backend).toBe(COOKIE_BACKEND)
    expect(app.host).toBe(PRODUCTION.origin)
  })
})
