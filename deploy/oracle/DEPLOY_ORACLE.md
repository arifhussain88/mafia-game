# Oracle Always Free — deploy Mafia: Town Has a Problem

Internal names stay `mafia-wars` (systemd unit, `/opt/mafia-wars`, release tarball, Neon project) so existing servers keep working.

**Live URL:** https://mafiatown.duckdns.org/ (VM IP 141.148.204.30; plain-HTTP requests redirect to HTTPS)  
**Production branch:** `main`, deployed automatically by GitHub Actions on every push or merged PR (see "GitHub Actions" below)  
**Runtime on the VM:** Node.js 22 + systemd (`mafia-wars`) + Caddy on `:80` → `127.0.0.1:8080`  
**Not used:** Docker. Node runs directly under systemd; keep it that way on the Always Free micro.

Keep this folder on `main` so the deploy steps always travel with the code they deploy.

---

## What runs on the VM

| Piece | Path / unit | Notes |
|--------|-------------|--------|
| App files | `/opt/mafia-wars/` | Built `index.mjs` + `public/` (lobby static) |
| Accounts | Neon when `DATABASE_URL` is set; else `/data/users.json` | `USERS_FILE=/data/users.json` kept as fallback — **do not overwrite on updates** |
| DB secret | `/etc/mafia-wars.env` | Optional `DATABASE_URL` (direct Neon URL, not pooler). Mode `600`. Never commit. |
| Node service | `mafia-wars.service` | `PORT=8080`, `STATIC_DIR=/opt/mafia-wars/public`, `EnvironmentFile=-/etc/mafia-wars.env` |
| Reverse proxy | Caddy `/etc/caddy/Caddyfile` | `<game-host>` (HTTPS, auto certificate) or `:80` → `127.0.0.1:8080` |
| Swap | `/swapfile` (2G file on boot disk) | Not an OCI Block Volume; stays Always Free |

SSH (from your Windows machine):

```powershell
ssh -i $env:USERPROFILE\.ssh\oracle_mafia ubuntu@141.148.204.30
# or Host alias if configured: ssh ubuntu@mafia-wars
```

Key file: `~/.ssh/oracle_mafia` (passphrase-protected). Agent shell cannot enter the passphrase; use an interactive terminal.

---

## HTTPS on a free subdomain (DuckDNS)

The app and Play Store build should use HTTPS. A free DuckDNS name gets a real Let’s Encrypt certificate, exactly like a paid domain.

1. Sign in at https://www.duckdns.org, create a subdomain (e.g. `mafiagame`), and set its IP to `141.148.204.30`.
2. Check it resolves: `nslookup mafiagame.duckdns.org` should return `141.148.204.30`.
3. Make sure the OCI security list allows TCP **80 and 443** (section A.1). The update script opens them in iptables.
4. Put the hostname in `deploy/oracle/game-host` (one line, no `https://`), commit it, then pack and deploy as in section B. Caddy gets the certificate on first start (allow ~30s).
5. Check: `curl -I https://mafiagame.duckdns.org/api/healthz` returns 200.
6. Point the app at it: in `artifacts/mobile-app/app.json` set `expo.extra.gameUrl` to `https://mafiagame.duckdns.org`. `app.config.js` then turns Android cleartext off automatically.

Moving to a paid domain later is the same steps with the new name, plus an app update. Logins are stored per site, so players sign in once more after a host change.

---

## GitHub Actions: automatic deploy from `main`

**`main` is the production branch.** Every push to `main` (normally a merged pull request) deploys to this VM through `.github/workflows/deploy-oracle.yml`. Do feature work on other branches and open a PR into `main`.

### What runs, in order

Every push to a feature branch and every PR into `main` runs `ci.yml` (gates 1–6). A push to `main` runs `deploy-oracle.yml`: the same gates, then the deploy. If any step fails, nothing is sent to the VM.

| # | Step | What it catches |
|---|------|-----------------|
| 1 | `pnpm install --frozen-lockfile` | lockfile out of date with `package.json` |
| 2 | `pnpm run typecheck` | type errors in the server, web game, mobile app and libs |
| 3 | `node .github/scripts/audit-shipped.mjs` | high/critical CVEs in packages that ship to players. Expo build tooling is only reported, not blocking |
| 4 | `pnpm --filter @workspace/api-server run test` | security and gameplay tests against the built server (`artifacts/api-server/test/`) |
| 5 | `deploy/oracle/pack-release.sh` | build failures; produces the same tarball as `pack-release.ps1` |
| 6 | `deploy/oracle/smoke-test-release.sh` | the packaged release boots in production mode and serves the API, game and legal pages |
| 7 | `scp` + `ssh … remote-update.sh` (deploy only) | installs on the VM. **Keeps the previous version and rolls back automatically** if the new one isn't healthy within 30s or the Neon checks fail |
| 8 | public health check (deploy only) | `<PUBLIC_URL>/api/healthz` answers after the deploy |

Deploys run one at a time; a second push waits for the first to finish.

### One-time setup (you do this; it needs your GitHub and VM access)

1. **Create a deploy-only SSH key** on your PC. Use a separate key without a passphrase, never your personal `oracle_mafia` key:

   ```powershell
   ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\mafia_deploy" -N '""' -C github-actions-deploy
   ```

2. **Allow that key on the VM** (uses your normal key once):

   ```powershell
   type "$env:USERPROFILE\.ssh\mafia_deploy.pub" | ssh -i "$env:USERPROFILE\.ssh\oracle_mafia" ubuntu@141.148.204.30 "cat >> ~/.ssh/authorized_keys"
   ```

3. **Create the `production` environment** in GitHub: repo **Settings → Environments → New environment →** `production`. Optionally add yourself under *Required reviewers*; then every deploy waits for your click. Under *Deployment branches*, pick **Selected branches → main**.

4. **Add these to the `production` environment:**

   | Kind | Name | Value |
   |------|------|-------|
   | Secret | `ORACLE_SSH_KEY` | full contents of `%USERPROFILE%\.ssh\mafia_deploy` (the private key) |
   | Secret | `ORACLE_KNOWN_HOSTS` | output of `ssh-keygen -F 141.148.204.30` (the VM's host key, from a machine that has connected before) |
   | Variable | `ORACLE_HOST` | `141.148.204.30` |
   | Variable | `ORACLE_USER` | `ubuntu` |
   | Variable | `PUBLIC_URL` | `http://141.148.204.30` (later `https://<your-duckdns-name>`) |

   The same thing with the GitHub CLI (from the repo folder, PowerShell):

   ```powershell
   Get-Content -Raw "$env:USERPROFILE\.ssh\mafia_deploy" | gh secret set ORACLE_SSH_KEY --env production
   ssh-keygen -F 141.148.204.30 | Select-String -NotMatch '^#' | Out-String | gh secret set ORACLE_KNOWN_HOSTS --env production
   gh variable set ORACLE_HOST --env production --body 141.148.204.30
   gh variable set ORACLE_USER --env production --body ubuntu
   gh variable set PUBLIC_URL --env production --body http://141.148.204.30
   ```

5. **Protect `main`** (recommended): Settings → Branches → add a rule for `main` → *Require a pull request* and *Require status checks to pass* → pick **CI / Typecheck, audit, test, build**. A broken PR then can't be merged, so it can't deploy.

To redeploy without a code change: **Actions → Deploy to Oracle → Run workflow** (on `main`).

### Manual deploy still works

Section B below is unchanged and is the fallback if GitHub is down or you need to hot-fix from your PC.

---

## A. First-time setup (already done on live VM)

Only needed on a **new** Always Free Ubuntu VM.

### 1. Open OCI security list for 80 and 443

In the OCI console, add ingress rules for TCP 80 and 443 (source `0.0.0.0/0`) to the VCN security list. The setup and update scripts open the same ports in the VM iptables.

### 2. On your Windows PC (repo root)

```powershell
git checkout main
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

Manual fallback. Normally GitHub Actions does this for you when `main` changes.

### 1. On Windows (repo root, on `main`)

```powershell
git checkout main
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

Updating only `mafia-wars.service` does **not** update `/opt/mafia-wars/index.mjs`. Neon support requires a release built from the Neon code path, then `remote-update.sh` (or a full extract into `/opt/mafia-wars`). When `/etc/mafia-wars.env` exists, `remote-update.sh` fails unless the new binary contains `DbUnavailableError`, the listener has `DATABASE_URL`, and the journal shows `authStore neon`.

### Neon `DATABASE_URL` (opt-in)

On the VM only (direct endpoint host, **no** `-pooler` in the hostname):

```bash
sudo install -m 600 -o root -g root /dev/null /etc/mafia-wars.env
sudo tee /etc/mafia-wars.env >/dev/null <<'EOF'
DATABASE_URL=postgresql://USER:PASSWORD@ep-XXXX.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
EOF
sudo systemctl daemon-reload
sudo systemctl restart mafia-wars
```

To fall back to JSON: remove or empty `/etc/mafia-wars.env`, then `sudo systemctl restart mafia-wars`.

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

## Moderation: reports and bans

Players can report a player (lobby flag icon) or a chat message. Reports are stored in Neon (`reports` table) and purged after 12 months, as the privacy policy promises. The admin API is **off unless `ADMIN_TOKEN` is set** on the VM. Without it, or with a wrong token, every `/api/admin` URL returns 404.

One-time, on the VM (use a long random token, at least 24 characters):

```bash
echo "ADMIN_TOKEN=$(openssl rand -hex 24)" | sudo tee -a /etc/mafia-wars.env
sudo systemctl restart mafia-wars
sudo grep ADMIN_TOKEN /etc/mafia-wars.env   # copy it into your password manager
```

Then, from your PC (PowerShell; put the token in `$t` first):

```powershell
$h = @{ Authorization = "Bearer $t" }
Invoke-RestMethod -Headers $h http://141.148.204.30/api/admin/reports                 # open reports
Invoke-RestMethod -Headers $h "http://141.148.204.30/api/admin/reports?status=all"
Invoke-RestMethod -Method Post -Headers $h -ContentType application/json -Body '{"status":"resolved"}' http://141.148.204.30/api/admin/reports/<id>/status
Invoke-RestMethod -Method Post -Headers $h -ContentType application/json -Body '{"email":"player@example.com","reason":"Harassment"}' http://141.148.204.30/api/admin/ban
Invoke-RestMethod -Method Post -Headers $h -ContentType application/json -Body '{"email":"player@example.com"}' http://141.148.204.30/api/admin/unban
```

A ban signs the player out everywhere right away. They can't log in again until unbanned, and they're told how to appeal (email). Use `https://<game-host>` instead of the IP once HTTPS is live.

New tables and columns are created automatically when the server starts (`ensureSchema` in `lib/db`), so deploys need no manual database steps.

## D. Files in this directory

| File | Purpose |
|------|---------|
| `pack-release.ps1` | Windows: build lobby+API and write `mafia-wars-release.tar` |
| `remote-setup.sh` | VM: first-time install (Node, Caddy, swap, extract, enable services) |
| `remote-update.sh` | VM: extract new tarball and restart (keeps `/data`) |
| `mafia-wars.service` | systemd unit packaged into the tarball |
| `Caddyfile` | reverse proxy template; `{{SITE}}` is filled from `game-host` |
| `game-host` | one line: the public hostname for HTTPS (empty = HTTP on `:80`) |
| `pack-release.sh` | Linux/CI version of `pack-release.ps1` (same tarball) |
| `smoke-test-release.sh` | boots the tarball in production mode and checks the API, game and legal pages |
| `.gitignore` | ignores `release/` and `*.tar` |

---

## E. Free-tier guardrails

- Stay on the existing Always Free shape only.
- Do **not** create paid OCI Block Volumes, load balancers, extra reserved public IPs, Autonomous DB, or Object Storage for this app.
- Swap is a **file** on the free boot disk, not a new volume.
- Capacity is capped in the app, not by accounts: `MAX_SOCKETS` (default 400), `MAX_OPEN_ROOMS` (150), `MAX_SOCKETS_PER_IP` (30). Set them in `/etc/mafia-wars.env` if the box can take more; the journal logs a `Load` line with live room/socket counts.
- Oracle can reclaim Always Free VMs that sit idle for a long time. Real traffic prevents it; check the console if the game ever stops answering.

---

## F. History

The deploy assets once lived only on side branches (`feature/oracle-cutover`, then `feature/done-live`), which made them easy to lose. Since moving production to `main` with GitHub Actions, this folder and document live on `main`.
