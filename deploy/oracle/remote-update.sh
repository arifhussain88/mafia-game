#!/usr/bin/env bash
set -euo pipefail

# Redeploy app bits from /tmp/mafia-wars-release.tar without wiping accounts.
# Does NOT reinstall Node/Caddy or recreate /data/users.json.
# Usage (on VM): bash /tmp/remote-update.sh

TAR="${1:-/tmp/mafia-wars-release.tar}"
if [[ ! -f "$TAR" ]]; then
  echo "Missing release tarball: $TAR" >&2
  echo "Upload with: scp deploy/oracle/mafia-wars-release.tar ubuntu@HOST:/tmp/" >&2
  exit 1
fi

echo "==> Stopping mafia-wars"
sudo systemctl stop mafia-wars

echo "==> Replacing /opt/mafia-wars (keeping /data)"
sudo mkdir -p /opt/mafia-wars
sudo rm -rf /opt/mafia-wars/*
sudo tar -xf "$TAR" -C /opt/mafia-wars
sudo chown -R ubuntu:ubuntu /opt/mafia-wars

if [[ -f /opt/mafia-wars/mafia-wars.service ]]; then
  echo "==> Refreshing systemd unit"
  sudo mv /opt/mafia-wars/mafia-wars.service /etc/systemd/system/mafia-wars.service
  NODE_BIN="$(command -v node)"
  sudo sed -i "s|/usr/bin/node|${NODE_BIN}|g" /etc/systemd/system/mafia-wars.service
  sudo systemctl daemon-reload
fi

if [[ -f /opt/mafia-wars/Caddyfile ]]; then
  echo "==> Refreshing Caddyfile"
  sudo mv /opt/mafia-wars/Caddyfile /etc/caddy/Caddyfile
  sudo systemctl reload caddy || sudo systemctl restart caddy
fi

echo "==> Starting mafia-wars"
sudo systemctl start mafia-wars
sleep 2
sudo systemctl --no-pager --full status mafia-wars || true
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8080/ || true
curl -sS -o /dev/null -w "HTTP80 %{http_code}\n" http://127.0.0.1/ || true

if [[ -f /etc/mafia-wars.env ]]; then
  echo "==> Neon checks (/etc/mafia-wars.env present)"
  if ! grep -q 'EnvironmentFile=.*mafia-wars.env' /etc/systemd/system/mafia-wars.service; then
    echo "FAIL: systemd unit missing EnvironmentFile for mafia-wars.env" >&2
    exit 1
  fi
  MARKER=$(grep -c 'DbUnavailableError' /opt/mafia-wars/index.mjs || true)
  if [[ "$MARKER" -lt 1 ]]; then
    echo "FAIL: index.mjs lacks Neon marker DbUnavailableError (old binary?)" >&2
    exit 1
  fi
  ListenPID=$(sudo ss -lptn 'sport = :8080' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
  ENV_COUNT=0
  if [[ -n "${ListenPID}" ]]; then
    ENV_COUNT=$(sudo tr '\0' '\n' < /proc/"$ListenPID"/environ | grep -c '^DATABASE_URL=' || true)
  fi
  if [[ "$ENV_COUNT" -lt 1 ]]; then
    echo "FAIL: listener PID missing DATABASE_URL in environ" >&2
    exit 1
  fi
  JOURNAL=$(sudo journalctl -u mafia-wars -n 40 --no-pager || true)
  if ! echo "$JOURNAL" | grep -q '"authStore":"neon"'; then
    echo "FAIL: journal does not show authStore neon" >&2
    echo "$JOURNAL" | tail -n 20 >&2 || true
    exit 1
  fi
  echo "OK: neon_marker=$MARKER env_on_listener=$ENV_COUNT authStore=neon"
fi

echo "==> Done. Public: http://$(curl -s ifconfig.me 2>/dev/null || echo 141.148.204.30)/"
echo "Accounts file untouched: /data/users.json"
echo "Note: updating the unit file alone does not update index.mjs - this script replaces /opt/mafia-wars."
