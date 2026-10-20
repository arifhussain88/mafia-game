# Writes a local /tmp-style env file for scp to the VM (gitignored via deploy/oracle/.gitignore if needed).
# Usage: powershell -File deploy/oracle/write-mafia-wars-env.ps1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$envFile = Join-Path $root ".env"
$out = Join-Path $PSScriptRoot "mafia-wars.env"
if (-not (Test-Path $envFile)) { throw "Missing repo .env with DATABASE_URL" }
$line = (Get-Content $envFile -Raw).Trim()
if ($line -notmatch '^DATABASE_URL=') { throw "DATABASE_URL not found in .env" }
$url = $line.Substring("DATABASE_URL=".Length).Trim()
if ($url -match '-pooler\.') { throw "Use a direct (non-pooler) DATABASE_URL" }
Set-Content -Path $out -Value "DATABASE_URL=$url" -NoNewline
Write-Host "Wrote $out (do not commit)"
