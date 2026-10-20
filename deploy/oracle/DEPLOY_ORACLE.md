# Oracle Always Free — deploy Mafia Wars

**Live URL:** http://141.148.204.30/  
**Production branch:** `feature/done-live`  
**Runtime on the VM:** Node.js 22 + systemd (`mafia-wars`) + Caddy on `:80` → `127.0.0.1:8080`  
**Not used on Oracle:** Docker. The repo `Dockerfile` was for Fly.io (app destroyed). Do not run Docker on this Always Free micro unless you intentionally change the stack.

Scripts in this folder were first committed on `feature/oracle-cutover` (`da470cf` / `a32e398`). Keep them on `feature/done-live` so deploy steps are never orphaned on another branch again.

---

## What runs on the VM

| Piece | Path / unit | Notes |
|--------|-------------|--------|
| App files | `/opt/mafia-wars/` | Built `index.mjs` + `public/` (lobby static) |
| Accounts | `/data/users.json` | `USERS_FILE=/data/users.json` — **do not overwrite on updates** |
| Node service | `mafia-wars.service` | `PORT=8080`, `STATIC_DIR=/opt/mafia-wars/public` |
| Reverse proxy | Caddy `/etc/caddy/Caddyfile` | `:80` → `127.0.0.1:8080` (HTTP until you have a domain) |
| Swap | `/swapfile` (2G file on boot disk) | Not an OCI Block Volume; stays Always Free |

SSH (from your Windows machine):

```powershell
ssh -i $env:USERPROFILE\.ssh\oracle_mafia ubuntu@141.148.204.30
# or Host alias if configured: ssh ubuntu@mafia-wars
```

Key file: `~/.ssh/oracle_mafia` (passphrase-protected). Agent shell cannot enter the passphrase; use an interactive terminal.

---

## A. First-time setup (already done on live VM)

Only needed on a **new** Always Free Ubuntu VM.

### 1. Open OCI security list / iptables for 80 (and 443 later)

Allow TCP 80 (and 443 when you add HTTPS) on the VCN security list and on the VM firewall if enabled.

### 2. On your Windows PC (repo root)

```powershell
git checkout feature/done-live
git pull
powershell -File deploy/oracle/pack-release.ps1
scp -i $env:USERPROFILE\.ssh\oracle_mafia deploy/oracle/mafia-wars-release.tar ubuntu@141.148.204.30:/tmp/
scp -i $env:USERPROFILE\.ssh\oracle_mafia deploy/oracle/remote-setup.sh ubuntu@141.148.204.30:/tmp/
```

### 3. On the VM

```bash
bash /tmp/remote-setup.sh
```

That script:

1. Creates a 2G swap **file** on the free boot disk (if missing)
2. Installs Node.js 22 (NodeSource) if missing
3. Installs Caddy if missing
4. Creates `/opt/mafia-wars` and `/data` (seeds empty `users.json` only if absent)
5. Extracts `/tmp/mafia-wars-release.tar` into `/opt/mafia-wars`
6. Installs `mafia-wars.service` and Caddyfile, enables and starts both services
7. Smoke-checks `http://127.0.0.1:8080/` and `http://127.0.0.1/`

### 4. Public check

Open http://141.148.204.30/ — expect HTTP 200.

---

## B. Update / redeploy (normal path after code changes)

Do this whenever `feature/done-live` has new commits to ship.

### 1. On Windows (repo root, on `feature/done-live`)

```powershell
git checkout feature/done-live
git pull
powershell -File deploy/oracle/pack-release.ps1
scp -i $env:USERPROFILE\.ssh\oracle_mafia deploy/oracle/mafia-wars-release.tar ubuntu@141.148.204.30:/tmp/
```

`pack-release.ps1` builds `@workspace/game-lobby` + `@workspace/api-server`, copies lobby `public/` into the API dist, packs `deploy/oracle/mafia-wars-release.tar` (gitignored).

### 2. On the VM (preserves `/data/users.json`)

```bash
sudo systemctl stop mafia-wars
sudo rm -rf /opt/mafia-wars/*
sudo tar -xf /tmp/mafia-wars-release.tar -C /opt/mafia-wars
# Optional: refresh unit/Caddy if those files changed in the tarball
if [[ -f /opt/mafia-wars/mafia-wars.service ]]; then
  sudo mv /opt/mafia-wars/mafia-wars.service /etc/systemd/system/mafia-wars.service
  sudo systemctl daemon-reload
fi
if [[ -f /opt/mafia-wars/Caddyfile ]]; then
  sudo mv /opt/mafia-wars/Caddyfile /etc/caddy/Caddyfile
  sudo systemctl reload caddy || sudo systemctl restart caddy
fi
sudo systemctl start mafia-wars
sudo systemctl --no-pager --full status mafia-wars
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8080/
curl -sS -o /dev/null -w "HTTP80 %{http_code}\n" http://127.0.0.1/
```

Or copy `deploy/oracle/remote-update.sh` once and run:

```bash
bash /tmp/remote-update.sh
```

**Never** delete `/data/users.json` during an update.

### 3. Public check

http://141.148.204.30/

---

## C. Useful ops commands (on the VM)

```bash
# Status
sudo systemctl status mafia-wars
sudo systemctl status caddy
journalctl -u mafia-wars -n 80 --no-pager

# Confirm stack (Docker should be absent / unused)
command -v docker; docker ps 2>/dev/null || true
ls -la /opt/mafia-wars
ls -la /data
node -v
caddy version

# Restart only
sudo systemctl restart mafia-wars
```

---

## D. Files in this directory

| File | Purpose |
|------|---------|
| `pack-release.ps1` | Windows: build lobby+API and write `mafia-wars-release.tar` |
| `remote-setup.sh` | VM: first-time install (Node, Caddy, swap, extract, enable services) |
| `remote-update.sh` | VM: extract new tarball and restart (keeps `/data`) |
| `mafia-wars.service` | systemd unit packaged into the tarball |
| `Caddyfile` | reverse proxy packaged into the tarball |
| `.gitignore` | ignores `release/` and `*.tar` |

---

## E. Free-tier guardrails

- Stay on the existing Always Free shape only.
- Do **not** create paid OCI Block Volumes, load balancers, extra reserved public IPs, Autonomous DB, or Object Storage for this app.
- Swap is a **file** on the free boot disk, not a new volume.
- When adding a domain later: point DNS at `141.148.204.30`, change Caddy from `:80` to the domain, then enable HTTPS (Let’s Encrypt).

---

## F. Why these steps were missing before

Deploy assets were committed on **`feature/oracle-cutover`**, not merged into **`feature/done-live`**. Working trees on later branches had no `deploy/oracle/`, so it looked like “Docker + Node” with no saved runbook. Canonical path for Oracle is this folder + this document on `feature/done-live`.
