#!/usr/bin/env bash
# Moves B3Note from v1 to v2 on mainnet, keeping v1's canister IDs (and so the app's URL), and
# retires v1's insecure system_api canister. Run it from the repository root, with an icp-cli
# identity that controls the v1 canisters:
#
#   ./scripts/migrate-mainnet.sh preflight          read-only: identity, controllers, cycles, tools
#   ./scripts/migrate-mainnet.sh migrate            snapshot v1, then reinstall backend + frontend with v2
#   ./scripts/migrate-mainnet.sh verify             smoke checks against the new deployment
#   ./scripts/migrate-mainnet.sh retire-system-api  stop and delete v1's system_api canister
#   ./scripts/migrate-mainnet.sh rollback           put v1 back from the snapshots `migrate` took
#   ./scripts/migrate-mainnet.sh drop-snapshots     delete those snapshots (after you are happy)
#
# `migrate` wipes v1's data. A keyless public backup was taken on 2026-10-08; the snapshots
# that `migrate` takes keep everything (controller-only) until you drop them.
#
# Overrides (for a rehearsal on a local network): ENVIRONMENT, NETWORK, BACKEND_ID,
# FRONTEND_ID, SYSTEM_API_ID, MIN_BACKEND_CYCLES, APP_URL.
set -Eeuo pipefail

ENVIRONMENT="${ENVIRONMENT:-production}"
NETWORK="${NETWORK:-ic}"
BACKEND_ID="${BACKEND_ID:-xeka7-ryaaa-aaaal-qb57a-cai}"
FRONTEND_ID="${FRONTEND_ID:-4lidq-zqaaa-aaaap-abkbq-cai}"
SYSTEM_API_ID="${SYSTEM_API_ID:-wfdtj-lyaaa-aaaap-abakq-cai}"
# vetKD key_1 derivations cost about 0.026 T each, and production sets a 90-day freezing threshold.
MIN_BACKEND_CYCLES="${MIN_BACKEND_CYCLES:-3000000000000}"
APP_URL="${APP_URL:-https://${FRONTEND_ID}.icp0.io}"
STATE_DIR=".icp/migration-${ENVIRONMENT}"

cd "$(dirname "$0")/.."

say() { printf '\n== %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
confirm() {
  local word="$1" answer
  printf '%s\nType %s to continue: ' "$2" "$word"
  read -r answer
  [[ "$answer" == "$word" ]] || die "cancelled"
}
status_json() { icp canister status "$1" -n "$NETWORK" --json; }
field() { node -e "const s = JSON.parse(require('fs').readFileSync(0, 'utf8')); const v = ($1); process.stdout.write(String(v ?? ''))"; }

preflight() {
  say "Tools"
  for tool in icp ic-wasm cargo pnpm node curl; do
    command -v "$tool" >/dev/null || die "$tool is not installed (see README: Getting started)"
  done
  icp --version

  say "Identity"
  local me
  me="$(icp identity principal)"
  [[ "$me" != "2vxsx-fae" ]] || die "the current identity is anonymous; select your controller identity (icp identity default <name>)"
  echo "deploying as $me"

  for id in "$BACKEND_ID" "$FRONTEND_ID" "$SYSTEM_API_ID"; do
    say "Canister $id"
    local json controllers cycles
    json="$(status_json "$id")" || die "cannot read the status of $id: is $me one of its controllers?"
    controllers="$(field '(s.settings?.controllers ?? []).join(",")' <<<"$json")"
    # icp-cli prints numbers with digit separators ("1_491_861_093_105").
    cycles="$(field 'String(s.cycles ?? "").replace(/_/g, "")' <<<"$json")"
    echo "status:      $(field 's.status' <<<"$json")"
    echo "cycles:      $cycles"
    echo "controllers: $controllers"
    [[ ",$controllers," == *"$me"* ]] || die "$me does not control $id"
    if [[ "$id" == "$BACKEND_ID" && -n "$cycles" ]] && ((cycles < MIN_BACKEND_CYCLES)); then
      die "the backend has $cycles cycles; top it up to at least $MIN_BACKEND_CYCLES first:
  icp cycles balance -n $NETWORK
  icp cycles mint --icp <amount> -n $NETWORK      # if your cycles balance is too low
  icp canister top-up --amount 3t $BACKEND_ID -n $NETWORK"
    fi
  done
  say "Preflight passed"
}

snapshot() {
  local id="$1" name="$2" snap previous=()
  icp canister stop "$id" -n "$NETWORK"
  # A re-run replaces the snapshot an earlier run took instead of adding another.
  if [[ -s "$STATE_DIR/$name-snapshot" ]]; then previous=(--replace "$(cat "$STATE_DIR/$name-snapshot")"); fi
  snap="$(icp canister snapshot create "$id" -n "$NETWORK" -q "${previous[@]}")"
  echo "$snap" >"$STATE_DIR/$name-snapshot"
  echo "$name snapshot: $snap (saved in $STATE_DIR/$name-snapshot)"
}

migrate() {
  preflight
  mkdir -p "$STATE_DIR"
  confirm MIGRATE "This reinstalls $BACKEND_ID and $FRONTEND_ID with v2 on '$NETWORK' and wipes v1's data (snapshots are taken first)."

  # If anything below fails, the canisters are restarted (whatever code they hold) and the way
  # back is printed, so a failed run never leaves the app stopped.
  trap 'on_migrate_failure' ERR

  say "Snapshotting v1"
  snapshot "$BACKEND_ID" backend
  snapshot "$FRONTEND_ID" frontend

  say "Linking v1's canister IDs to this project's '$ENVIRONMENT' environment"
  icp canister link backend "$BACKEND_ID" -e "$ENVIRONMENT" --force
  icp canister link frontend "$FRONTEND_ID" -e "$ENVIRONMENT" --force

  say "Installing v2"
  icp deploy backend -e "$ENVIRONMENT" --mode reinstall --no-create -y
  icp deploy frontend -e "$ENVIRONMENT" --mode reinstall --no-create -y
  icp canister start "$BACKEND_ID" -n "$NETWORK" || true
  icp canister start "$FRONTEND_ID" -n "$NETWORK" || true

  trap - ERR
  verify
  echo
  echo "Done. Keep the snapshots until you are happy, then: $0 drop-snapshots"
  echo "To undo: $0 rollback"
}

on_migrate_failure() {
  trap - ERR
  printf '\nThe migration stopped early. Restarting both canisters...\n' >&2
  icp canister start "$BACKEND_ID" -n "$NETWORK" || true
  icp canister start "$FRONTEND_ID" -n "$NETWORK" || true
  cat >&2 <<MSG
Nothing is lost: the v1 snapshots are recorded in $STATE_DIR.
  - Retry:            $0 migrate   (an "install code rate limited" error clears after a few minutes)
  - Go back to v1:    $0 rollback
MSG
}

verify() {
  say "Backend"
  icp canister call backend get_stats '()' -e "$ENVIRONMENT"
  icp canister call backend get_config '()' -e "$ENVIRONMENT"
  # An update that fetches the vetKD public keys: proves the key and the cycles work.
  icp canister call backend load_public_keys '()' -e "$ENVIRONMENT"

  say "Frontend"
  local headers cookie
  headers="$(curl -sS -D - -o /dev/null "$APP_URL/" | tr -d '\r')"
  grep -qi "^HTTP/[0-9.]* 200" <<<"$headers" || die "$APP_URL did not answer 200"
  # The asset canister URL-encodes the whole value (":" "=" "_" "-" included).
  cookie="$(grep -i '^set-cookie: ic_env=' <<<"$headers" | head -1 | sed -E 's/^[^:]*: *ic_env=([^;]*).*/\1/')"
  node -e 'process.stdout.write(decodeURIComponent(process.argv[1]))' "$cookie" \
    | grep -q "PUBLIC_CANISTER_ID:backend=${BACKEND_ID}" \
    || die "$APP_URL does not set the ic_env cookie with the backend's id"
  echo "$APP_URL serves v2 and points at $BACKEND_ID"
}

rollback() {
  local backend frontend
  backend="$(cat "$STATE_DIR/backend-snapshot")" || die "no backend snapshot recorded in $STATE_DIR"
  frontend="$(cat "$STATE_DIR/frontend-snapshot")" || die "no frontend snapshot recorded in $STATE_DIR"
  confirm ROLLBACK "This puts v1 back on $BACKEND_ID and $FRONTEND_ID (anything written to v2 since is lost)."
  for pair in "$BACKEND_ID:$backend" "$FRONTEND_ID:$frontend"; do
    local id="${pair%%:*}" snap="${pair#*:}"
    icp canister stop "$id" -n "$NETWORK"
    icp canister snapshot restore "$id" "$snap" -n "$NETWORK"
    icp canister start "$id" -n "$NETWORK"
  done
  say "v1 restored"
}

drop_snapshots() {
  confirm DROP "This deletes the v1 snapshots; rollback is impossible afterwards."
  icp canister snapshot delete "$BACKEND_ID" "$(cat "$STATE_DIR/backend-snapshot")" -n "$NETWORK"
  icp canister snapshot delete "$FRONTEND_ID" "$(cat "$STATE_DIR/frontend-snapshot")" -n "$NETWORK"
  rm -f "$STATE_DIR/backend-snapshot" "$STATE_DIR/frontend-snapshot"
  say "Snapshots deleted"
}

retire_system_api() {
  confirm RETIRE "This stops and deletes $SYSTEM_API_ID (v1's insecure vetKD stand-in). Its cycles go to your cycles-ledger account."
  icp canister stop "$SYSTEM_API_ID" -n "$NETWORK"
  icp canister delete "$SYSTEM_API_ID" -n "$NETWORK"
  say "$SYSTEM_API_ID deleted"
}

case "${1:-}" in
  preflight) preflight ;;
  migrate) migrate ;;
  verify) verify ;;
  rollback) rollback ;;
  drop-snapshots) drop_snapshots ;;
  retire-system-api) retire_system_api ;;
  *) sed -n '2,20p' "$0"; exit 2 ;;
esac
