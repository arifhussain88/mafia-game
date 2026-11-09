#!/usr/bin/env bash
# Boot the exact release tarball the VM will get, in production mode, and check
# that the API and the web page both answer. Run after pack-release.sh.
#   bash deploy/oracle/smoke-test-release.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAR="$HERE/mafia-wars-release.tar"
[[ -f "$TAR" ]] || { echo "No $TAR - run pack-release.sh first" >&2; exit 1; }

WORK="$(mktemp -d)"
PID=""
cleanup() {
  [[ -n "$PID" ]] && kill "$PID" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

tar -xf "$TAR" -C "$WORK"
for f in index.mjs public/index.html mafia-wars.service Caddyfile; do
  [[ -e "$WORK/$f" ]] || { echo "Release is missing $f" >&2; exit 1; }
done

PORT="${SMOKE_PORT:-18080}"
NODE_ENV=production HOST=127.0.0.1 PORT="$PORT" DATABASE_URL= \
  STATIC_DIR="$WORK/public" USERS_FILE="$WORK/users.json" \
  node "$WORK/index.mjs" > "$WORK/server.log" 2>&1 &
PID=$!

ok=0
for _ in $(seq 1 30); do
  if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/healthz" >/dev/null 2>&1; then ok=1; break; fi
  kill -0 "$PID" 2>/dev/null || break
  sleep 0.5
done
if [[ "$ok" != 1 ]]; then
  echo "Release did not start:" >&2
  cat "$WORK/server.log" >&2
  exit 1
fi

page="$(curl -fsS --max-time 5 "http://127.0.0.1:$PORT/")"
grep -q '<div id="root"' <<<"$page" || { echo "Web page was not served" >&2; exit 1; }
curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:$PORT/privacy.html" || { echo "privacy.html missing" >&2; exit 1; }
curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:$PORT/terms.html" || { echo "terms.html missing" >&2; exit 1; }
curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:$PORT/delete-account.html" || { echo "delete-account.html missing" >&2; exit 1; }

echo "OK: release boots in production mode and serves the API, game and legal pages."
