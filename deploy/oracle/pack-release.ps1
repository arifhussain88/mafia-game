# Rebuild the Oracle release tarball (gitignored). Run from repo root on Windows.
# Usage: powershell -File deploy/oracle/pack-release.ps1

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $root

Write-Host "==> Building game-lobby and api-server"
pnpm --filter @workspace/game-lobby run build
pnpm --filter @workspace/api-server run build

$dist = Join-Path $root "artifacts\api-server\dist"
$publicSrc = Join-Path $root "artifacts\game-lobby\dist\public"
$publicDst = Join-Path $dist "public"
New-Item -ItemType Directory -Force -Path $publicDst | Out-Null
Copy-Item -Recurse -Force (Join-Path $publicSrc "*") $publicDst

$release = Join-Path $PSScriptRoot "release"
if (Test-Path $release) { Remove-Item -Recurse -Force $release }
New-Item -ItemType Directory -Force -Path $release | Out-Null
Copy-Item -Recurse (Join-Path $dist "*") $release
Copy-Item (Join-Path $PSScriptRoot "mafia-wars.service") $release
Copy-Item (Join-Path $PSScriptRoot "Caddyfile") $release

$tar = Join-Path $PSScriptRoot "mafia-wars-release.tar"
if (Test-Path $tar) { Remove-Item -Force $tar }
tar -cf $tar -C $release .
Write-Host "==> Wrote $tar"
Write-Host ""
Write-Host "Update (usual path) - see deploy/oracle/DEPLOY_ORACLE.md section B:"
Write-Host ('  scp -i $env:USERPROFILE\.ssh\oracle_mafia {0} ubuntu@141.148.204.30:/tmp/' -f $tar)
Write-Host '  scp -i $env:USERPROFILE\.ssh\oracle_mafia deploy/oracle/remote-update.sh ubuntu@141.148.204.30:/tmp/'
Write-Host '  # on VM: bash /tmp/remote-update.sh'
Write-Host ''
Write-Host 'First-time VM only: also upload remote-setup.sh and run bash /tmp/remote-setup.sh'
