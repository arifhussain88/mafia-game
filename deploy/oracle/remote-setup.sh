#!/usr/bin/env bash
set -euo pipefail

# Free-tier guardrails (do NOT change without checking OCI Always Free):
# - Stay on existing Always Free VM shape only (E2.1.Micro or A1 within 2 OCPU/12GB).
# - Do NOT create OCI Block Volumes, Load Balancers, reserved public IPs beyond the free one,
#   Autonomous DB, Object Storage buckets for this app, or Upgrade to Pay As You Go.
# - Swap below is a FILE on the existing free boot disk (/dev/sda1). It is NOT a new
#   paid Block Volume. It only uses ~2GB of the free boot disk space.

echo "==> Adding 2G swap FILE on existing boot disk (not a paid OCI volume)"
if ! swapon --show | grep -q swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  if ! grep -q '/swapfile' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  fi
fi
free -m

echo "==> Installing Node.js 22"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node -v

echo "==> Installing Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update
  sudo apt-get install -y caddy
fi
caddy version

echo "==> App directories"
sudo mkdir -p /opt/mafia-wars /data
sudo chown ubuntu:ubuntu /opt/mafia-wars /data
if [[ ! -f /data/users.json ]]; then
  echo '{"users":[],"sessions":{}}' > /data/users.json
fi

echo "==> Extract release"
tar -xf /tmp/mafia-wars-release.tar -C /opt/mafia-wars
# service file may be inside tarball
if [[ -f /opt/mafia-wars/mafia-wars.service ]]; then
  sudo mv /opt/mafia-wars/mafia-wars.service /etc/systemd/system/mafia-wars.service
fi
if [[ -f /opt/mafia-wars/Caddyfile ]]; then
  sudo mv /opt/mafia-wars/Caddyfile /etc/caddy/Caddyfile
fi

# Prefer node from PATH (nodesource puts it in /usr/bin)
NODE_BIN="$(command -v node)"
sudo sed -i "s|/usr/bin/node|${NODE_BIN}|g" /etc/systemd/system/mafia-wars.service

echo "==> Enable services"
sudo systemctl daemon-reload
sudo systemctl enable --now mafia-wars
sudo systemctl enable --now caddy
sudo systemctl restart mafia-wars
sudo systemctl restart caddy

sleep 2
sudo systemctl --no-pager --full status mafia-wars || true
sudo systemctl --no-pager --full status caddy || true
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8080/ || true
curl -sS -o /dev/null -w "HTTP80 %{http_code}\n" http://127.0.0.1/ || true

echo "==> Done. Try http://$(curl -s ifconfig.me 2>/dev/null || echo PUBLIC_IP)/"
