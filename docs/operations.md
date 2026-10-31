---
title: Running B3Note on mainnet
description: "The deploy upgrades the canisters recorded in .icp/data/mappings/production.ids.json: backend xeka7-ryaaa-aaaal-qb57a-cai and frontend…"
editUrl: https://github.com/B3Pay/B3Note/edit/main/docs/operations.md
---

## Deploying

```bash
icp deploy -e production --no-create            # both canisters
icp deploy frontend -e production --no-create   # the frontend only
```

The deploy upgrades the canisters recorded in `.icp/data/mappings/production.ids.json`: backend
`xeka7-ryaaa-aaaal-qb57a-cai` and frontend `4lidq-zqaaa-aaaap-abkbq-cai`. `--no-create` makes it stop
rather than create a canister that is not recorded there. Do not deploy with `-e ic`: that is icp-cli's
built-in mainnet environment, which records none of these ids, so it creates new canisters. A new
frontend is a new origin, which gives every user a new principal, and the custom domain would still
point at the old one.

The `production` environment uses the vetKD key `key_1`, keeps the AI assistant off and sets strict
limits (`icp.yaml`). The frontend reads the backend's id from the asset canister's `ic_env` cookie on
`*.icp0.io`, and from `frontend/src/lib/origins.ts` on a custom domain ([Custom domain](#custom-domain)).
A build with `CANISTER_ID_BACKEND=<id>` set uses that id everywhere.

## Limits, costs and settings

- vetKD derivations cost about 0.026 T cycles each on `key_1`. The app derives one key per Internet
  Identity user per browser (then caches it), plus one per share view; guests cost nothing. Production
  allows 5 derivations per user and 20 in total per hour, so the worst case is about 0.5 T an hour.
  Raise the limits as real use grows.
- Controllers can change limits, models and the AI switch at runtime. `limits` replaces the whole
  record:

  ```bash
  icp canister call backend get_config '()' -e production
  icp canister call backend update_config '(record { ai_enabled = opt true; llm_model = opt "llama4-scout" })' -e production
  ```

- The LLM's free models need no cycles. Set `llm_cycles_per_call` for paid models.

## Custom domain

The frontend is also served at `https://note.b3pay.net`. Internet Identity
gives a user one principal per origin, so a page there signs in with `derivationOrigin` set to the
canister's own address, `https://4lidq-zqaaa-aaaap-abkbq-cai.icp0.io`: a user has the same principal, and
so the same notes, at both addresses. `frontend/src/lib/origins.ts` holds the production ids and the
custom domains, and the client uses them only on a custom domain:

- Sign-in: Internet Identity accepts the `derivationOrigin` because the canister's address lists the
  domain in `/.well-known/ii-alternative-origins`. Internet Identity's page fetches that file from
  another origin, so `.ic-assets.json5` serves it with `Access-Control-Allow-Origin: *`, and keeps the
  `.well-known` folder, which the asset canister would otherwise skip.
- Calls go to `https://icp-api.io`, and to the production backend by its id: the `ic_env` cookie is not
  read there, because any other subdomain of `b3pay.net` could set it.
- The HTTP gateways serve the domain only if the canister lists it in `/.well-known/ic-domains`.

`frontend/tests/customDomain.test.ts` checks that `origins.ts` and both `.well-known` files name the same
domains. To add one, add it to all three, deploy the frontend, check that
`https://4lidq-zqaaa-aaaap-abkbq-cai.icp0.io/.well-known/ii-alternative-origins` returns the JSON (not the
app's HTML), then add these DNS records, as `forge.b3pay.net` has them (on Cloudflare, DNS only, not
proxied):

| Type  | Name                             | Value                                    |
| ----- | -------------------------------- | ---------------------------------------- |
| CNAME | `note.b3pay.net`                 | `note.b3pay.net.icp1.io`                 |
| TXT   | `_canister-id.note.b3pay.net`    | `4lidq-zqaaa-aaaap-abkbq-cai`            |
| CNAME | `_acme-challenge.note.b3pay.net` | `_acme-challenge.note.b3pay.net.icp2.io` |

and register the domain with the boundary nodes:

```bash
curl -sL "https://icp.net/custom-domains/v1/note.b3pay.net/validate"   # "success" once DNS is right
curl -sL -X POST "https://icp.net/custom-domains/v1/note.b3pay.net"    # starts registration
curl -sL "https://icp.net/custom-domains/v1/note.b3pay.net"            # until "registered"
```

A browser keeps two things per origin, so they do not follow a user to the new address: a guest's key
(in localStorage; a guest signs in there by importing their recovery key), and the cached vault key (in
IndexedDB; an Internet Identity user's first unlock there derives it again, which counts toward the
per-user vetKD limit).
