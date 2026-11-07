# Running B3Note on mainnet

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

## Notifications

A user who turns it on in Settings, or from the offer under a new share link, is told when someone opens
a link they shared. B3Note sends nothing itself: after a successful `open_share` the backend asks the
B3Pay hub (`vi4fr-7aaaa-aaaay-aadwq-cai`) to `notify` the owner, and the hub sends through Internet
Identity for every B3Pay app. The notification says how many views are left and never which note; the
backend only has ciphertext anyway. It goes out only when all three agree:

- the deployment: `notifications` in the backend's config, off until a controller sets it;
- the owner, in B3Note: `set_notify_share_opened`, which the app calls only after Internet Identity
  asked them;
- the owner, in Internet Identity: their consent for this origin, which Internet Identity keeps.

The call to the hub runs in a timer of its own, so a reader never waits for it, and a hub that refuses or
fails cannot fail the open (`integration_tests/tests/notifications.rs`).

Internet Identity takes notifications for `https://4lidq-zqaaa-aaaap-abkbq-cai.icp0.io`, the origin
principals derive from (also on `note.b3pay.net`, which signs in for it), and only from a sender listed in
`/.well-known/ii-notification-senders` there. `/.well-known/ii-app-metadata` gives the name and logo shown
on the sign-in screen and on each notification. `.ic-assets.json5` serves both, and the logo, with CORS.

To turn it on, once this backend and frontend are deployed:

```bash
# At the hub (controllers): B3Note's backend may notify for the b3note app, and the
# hub sends for B3Note's sign-in origin. upsert_app replaces the name, origins,
# canisters and access with the ones passed (the hub's README, "Register B3Note"), so pass
# them all; ai_policy = null keeps the AI policy.
icp canister call hub upsert_app '(record {
  id = "b3note";
  name = "B3Note";
  origins = vec { "https://4lidq-zqaaa-aaaap-abkbq-cai.icp0.io"; "https://note.b3pay.net" };
  frontend_canisters = vec { principal "4lidq-zqaaa-aaaap-abkbq-cai" };
  backend_canisters = vec { principal "xeka7-ryaaa-aaaal-qb57a-cai" };
  access = variant { Open };
  ai_policy = null;
})' -e production
icp canister call hub set_notification_origin '("b3note", opt "https://4lidq-zqaaa-aaaap-abkbq-cai.icp0.io")' -e production

# At B3Note (controllers): name the hub, and the page a notification opens.
icp canister call backend update_config '(record { notifications = opt record {
  enabled = true;
  hub_canister = principal "vi4fr-7aaaa-aaaay-aadwq-cai";
  url = opt "https://note.b3pay.net/settings";
} })' -e production
```

The hub refuses a `url` that is not on one of the app's origins there. To stop sending, set the same
record with `enabled = false`.
