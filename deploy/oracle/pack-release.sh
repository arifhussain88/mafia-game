#!/usr/bin/env bash
# Build the Oracle release tarball (same output as pack-release.ps1).
# Used by GitHub Actions (.github/workflows/deploy-oracle.yml); also works on
# Linux/macOS or Git Bash from the repo root:  bash deploy/oracle/pack-release.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$ROOT/deploy/oracle"
cd "$ROOT"

PNPM="${PNPM:-pnpm}"

echo "==> Building game-lobby and api-server"
$PNPM --filter @workspace/game-lobby run build
$PNPM --filter @workspace/api-server run build

DIST="$ROOT/artifacts/api-server/dist"
mkdir -p "$DIST/public"
cp -R "$ROOT/artifacts/game-lobby/dist/public/." "$DIST/public/"

RELEASE="$HERE/release"
rm -rf "$RELEASE"
mkdir -p "$RELEASE"
cp -R "$DIST/." "$RELEASE/"
cp "$HERE/mafia-wars.service" "$RELEASE/"

# Public hostname for HTTPS (one line in deploy/oracle/game-host). Empty = plain HTTP on :80.
GAME_HOST="$(tr -d '[:space:]' < "$HERE/game-host" 2>/dev/null || true)"
if [[ -n "$GAME_HOST" && ! "$GAME_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo "game-host must be a bare hostname, got '$GAME_HOST'" >&2
  exit 1
fi
SITE="${GAME_HOST:-:80}"
echo "==> Caddy site: $SITE"
sed "s|{{SITE}}|$SITE|g" "$HERE/Caddyfile" | tr -d '\r' > "$RELEASE/Caddyfile"
if [[ -n "$GAME_HOST" ]]; then
  # Old links to the bare IP (http://141.148.204.30/...) land on the HTTPS site.
  printf '\n:80 {\n\tredir https://%s{uri} permanent\n}\n' "$GAME_HOST" >> "$RELEASE/Caddyfile"
fi

TAR="$HERE/mafia-wars-release.tar"
rm -f "$TAR"
tar -cf "$TAR" -C "$RELEASE" .
echo "==> Wrote $TAR ($(du -h "$TAR" | cut -f1))"
