/**
 * B3Note's production canisters and the custom domains that serve its
 * frontend (README, "Custom domain").
 *
 * Internet Identity derives a principal per origin, and counts a canister's
 * gateway addresses (`icp0.io`, `ic0.app`, `icp.net`) as one. A custom domain
 * is another origin, so a page there signs in with `derivationOrigin` set to
 * the canister's address, which lists the domain in
 * `public/.well-known/ii-alternative-origins`: a user keeps one principal, and
 * so their notes, on both.
 *
 * A custom domain is sent cookies that any sibling subdomain can write, so the
 * client does not trust the asset canister's `ic_env` cookie there, and the
 * backend's id comes from here instead.
 */
export const PRODUCTION = {
  /** The frontend canister's own address, the origin principals derive from. */
  origin: "https://4lidq-zqaaa-aaaap-abkbq-cai.icp0.io",
  backend: "xeka7-ryaaa-aaaal-qb57a-cai",
  /** Also listed in `public/.well-known/ic-domains` and `ii-alternative-origins`. */
  customDomains: ["https://note.b3pay.net"],
} as const

export interface CustomDomain {
  /** For `AuthClient`: the origin Internet Identity derives the principal for. */
  derivationOrigin: string
  /** The backend canister to call. */
  backendId: string
}

/** What a page at `origin` needs when it is one of the custom domains, else `undefined`. */
export function customDomainAt(origin: string | undefined): CustomDomain | undefined {
  if (origin === undefined || !(PRODUCTION.customDomains as readonly string[]).includes(origin))
    return undefined
  return { derivationOrigin: PRODUCTION.origin, backendId: PRODUCTION.backend }
}
