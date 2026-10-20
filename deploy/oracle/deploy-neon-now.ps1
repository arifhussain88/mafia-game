# Interactive Oracle deploy: upload release + Neon DATABASE_URL, then remote-update.
# Run in a normal PowerShell window (not agent) so you can type the SSH key passphrase.
# Usage (repo root): powershell -File deploy/oracle/deploy-neon-now.ps1

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

$key = Join-Path $env:USERPROFILE ".ssh\oracle_mafia"
$hostName = "141.148.204.30"
$tar = Join-Path $PSScriptRoot "mafia-wars-release.tar"
$envLocal = Join-Path $PSScriptRoot "mafia-wars.env"
$updateSh = Join-Path $PSScriptRoot "remote-update.sh"

if (-not (Test-Path $key)) { throw "Missing SSH key: $key" }
if (-not (Test-Path $tar)) { throw "Missing $tar — run pack-release.ps1 first" }
if (-not (Test-Path $envLocal)) { throw "Missing $envLocal — run write-mafia-wars-env.ps1 first" }

Write-Host "==> Upload release + env + update script (enter SSH passphrase if asked)"
scp -i $key $tar "ubuntu@${hostName}:/tmp/mafia-wars-release.tar"
scp -i $key $envLocal "ubuntu@${hostName}:/tmp/mafia-wars.env"
scp -i $key $updateSh "ubuntu@${hostName}:/tmp/remote-update.sh"

Write-Host "==> Install DATABASE_URL and restart app on VM"
ssh -i $key "ubuntu@${hostName}" @'
set -euo pipefail
sudo install -m 600 -o root -g root /tmp/mafia-wars.env /etc/mafia-wars.env
rm -f /tmp/mafia-wars.env
bash /tmp/remote-update.sh
echo "==> DATABASE_URL set:"
sudo grep -c '^DATABASE_URL=' /etc/mafia-wars.env
curl -sS -o /dev/null -w "public HTTP %{http_code}\n" http://127.0.0.1/
'@

Write-Host ""
Write-Host "Done. Check http://141.148.204.30/ — signup should hit Neon."
