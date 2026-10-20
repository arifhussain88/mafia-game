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

echo "==> Done. Public: http://$(curl -s ifconfig.me 2>/dev/null || echo 141.148.204.30)/"
echo "Accounts file untouched: /data/users.json"
