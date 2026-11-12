# Moderation: seeing reports, banning players

Players can report a player (flag icon in the lobby) or a chat message. Reports are stored in Neon (`reports` table) and purged after 12 months, as the privacy policy promises.

The admin API is **off unless `ADMIN_TOKEN` is set** on the VM. Without it, or with a wrong token, every `/api/admin` URL returns 404.

## One-time setup: the admin token

Already done on the live server (2026-11-11). Only repeat this on a new VM.

Run this from PowerShell on your PC as **one line**. The whole server part stays inside single quotes, so it runs on the VM, not on Windows (Windows `sudo` is not needed):

```powershell
ssh -i $env:USERPROFILE\.ssh\oracle_mafia ubuntu@141.148.204.30 'sudo sed -i -e ''$a\'' /etc/mafia-wars.env; sudo grep -q ^ADMIN_TOKEN= /etc/mafia-wars.env || echo ADMIN_TOKEN=$(openssl rand -hex 24) | sudo tee -a /etc/mafia-wars.env >/dev/null; sudo systemctl restart mafia-wars; sudo grep ^ADMIN_TOKEN= /etc/mafia-wars.env'
```

- The first `sed` adds a missing newline at the end of the file. Without it, the token gets glued onto the `DATABASE_URL` line, which breaks login.
- It keeps an existing token, so you never get two.
- Copy the printed value into your password manager. Anyone with it can ban players.

To print the token again later:

```powershell
ssh -i $env:USERPROFILE\.ssh\oracle_mafia ubuntu@141.148.204.30 'sudo grep ^ADMIN_TOKEN= /etc/mafia-wars.env'
```

To check the env file is healthy without showing any values (each name on its own line):

```powershell
ssh -i $env:USERPROFILE\.ssh\oracle_mafia ubuntu@141.148.204.30 'systemctl is-active mafia-wars; sudo cut -d= -f1 /etc/mafia-wars.env'
```

## Method 1: Neon dashboard (read only, no token)

1. Open console.neon.tech and choose the project.
2. **Tables** → **reports** to browse every report.
3. Or **SQL Editor**, for open reports, newest first:

```sql
select created_at, reporter_name, reported_name, room_code, reason, message, id, reported_id
from reports
where status = 'open'
order by created_at desc;
```

Columns: `reason` is what the reporter picked, `message` is the reported chat line (empty for a player report), `reported_id` is the account to ban, and `status` is `open`, `resolved` or `dismissed`.

Use it only for reading. Ban through Method 2, because a ban through the API also signs the player out of a game in progress at once.

## Method 2: PowerShell

Once per PowerShell window, enter the token. It is never saved anywhere:

```powershell
$h = @{ Authorization = "Bearer " + (Read-Host "Admin token") }
```

Open reports, as a table:

```powershell
(Invoke-RestMethod -Headers $h https://mafiatown.duckdns.org/api/admin/reports).reports | Format-Table createdAt, reporterName, reportedName, reason, message, id, reportedId -Wrap
```

All reports, including resolved and dismissed ones:

```powershell
(Invoke-RestMethod -Headers $h "https://mafiatown.duckdns.org/api/admin/reports?status=all").reports | Format-Table createdAt, status, reporterName, reportedName, reason, message, id -Wrap
```

Close a report. `resolved` means action was taken, `dismissed` means it was a false report, and `open` reopens it:

```powershell
Invoke-RestMethod -Method Post -Headers $h -ContentType application/json -Body '{"status":"resolved"}' https://mafiatown.duckdns.org/api/admin/reports/PASTE_REPORT_ID/status
```

Ban, using the `reportedId` from the report or the player's email:

```powershell
Invoke-RestMethod -Method Post -Headers $h -ContentType application/json -Body '{"userId":"PASTE_REPORTED_ID","reason":"Harassment"}' https://mafiatown.duckdns.org/api/admin/ban
Invoke-RestMethod -Method Post -Headers $h -ContentType application/json -Body '{"email":"player@example.com","reason":"Harassment"}' https://mafiatown.duckdns.org/api/admin/ban
```

Unban:

```powershell
Invoke-RestMethod -Method Post -Headers $h -ContentType application/json -Body '{"email":"player@example.com"}' https://mafiatown.duckdns.org/api/admin/unban
```

A ban signs the player out everywhere at once. They can't log in again until unbanned, and they're told how to appeal by email.

What the errors mean:

| Error | Meaning |
|-------|---------|
| 404 Not found | Wrong token, or `ADMIN_TOKEN` not set on the server. |
| 404 No such user / No such report | The ID or email doesn't exist. |
| 503 Database unavailable | Neon is down or `DATABASE_URL` is wrong. |

## Method 3: Admin page (planned)

Not built yet. The plan is a hidden page at `https://mafiatown.duckdns.org/admin.html`:

- you paste the token once;
- it shows open reports as cards with **Ban**, **Resolve** and **Dismiss** buttons;
- it works on a phone and uses the same token check as the API.

## API reference

All routes need `Authorization: Bearer <ADMIN_TOKEN>`.

| Method | Route | Body |
|--------|-------|------|
| GET | `/api/admin/reports?status=open\|resolved\|dismissed\|all&limit=100` | none |
| POST | `/api/admin/reports/:id/status` | `{"status":"open"\|"resolved"\|"dismissed"}` |
| POST | `/api/admin/ban` | `{"userId":"…"}` or `{"email":"…"}`, plus an optional `"reason"` |
| POST | `/api/admin/unban` | `{"userId":"…"}` or `{"email":"…"}` |

New tables and columns are created automatically when the server starts (`ensureSchema` in `lib/db`), so deploys need no manual database steps.
