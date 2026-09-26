# Daily OpenBao maintenance: Raft snapshot (retention 14) + renewal of the
# periodic operator tokens (7d period; renewal every day keeps them alive).
# Designed to run from Task Scheduler (SYSTEM or the user account with access
# to %USERPROFILE%\.openbao-dev). No values printed.

. (Join-Path $PSScriptRoot '_common.ps1')
$ErrorActionPreference = 'Continue'

# 1. Renew operator tokens (periodic tokens die if not renewed within their period).
foreach ($name in @('operator-admin.token', 'operator-bootstrap.token', 'operator-backup.token')) {
  $file = Join-Path $CustodyDir $name
  if (-not (Test-Path $file)) { Write-Host "skip renew (missing): $name"; continue }
  $tok = (Get-Content $file -Raw).Trim()
  try {
    $r = Exec-Bao -BaoArgs @('token', 'renew', '-increment=168h', '-format=json') -Token $tok | ConvertFrom-Json
    Write-Host "renewed: $name (new ttl: $([int]($r.auth.lease_duration/3600))h)"
  } catch {
    Write-Host "RENEW FAILED for ${name}: run scripts/generate-root.ps1 recovery if all tokens die"
  }
}

# 2. Raft snapshot with retention.
& (Join-Path $PSScriptRoot 'snapshot.ps1')