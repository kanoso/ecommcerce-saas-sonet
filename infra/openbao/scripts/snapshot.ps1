# Raft snapshot + retention + out-of-host copy reminder. Uses the dedicated
# backup-operator token (periodic; renewed by the scheduled task).
# A snapshot is NOT a replacement for unseal key custody (guide section 8).
# Usage: .\snapshot.ps1 [output-dir]   (default: %USERPROFILE%\.openbao-dev\backups)
# Retention: keeps the newest 14 snapshots; prunes older ones locally.
# OFF-HOST copy (encrypted, separate from unseal shares) remains an operator duty.

param(
  [string]$OutDir = (Join-Path $env:USERPROFILE '.openbao-dev\backups'),
  [int]$Keep = 14
)

. (Join-Path $PSScriptRoot '_common.ps1')

$bakFile = Join-Path $CustodyDir 'operator-backup.token'
if (-not (Test-Path $bakFile)) { throw 'backup operator token missing (operator-backup.token)' }
$token = (Get-Content $bakFile -Raw).Trim()

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$containerPath = "/openbao/logs/snapshot-$ts.snap"

Exec-Bao -BaoArgs @('operator', 'raft', 'snapshot', 'save', $containerPath) -Token $token | Out-Null
docker cp "${script:ServerContainer}:$containerPath" $OutDir
docker exec $script:ServerContainer rm -f $containerPath | Out-Null

$local = Join-Path $OutDir "snapshot-$ts.snap"
Restrict-File $local

# Retention: prune all but the newest $Keep snapshots.
$old = Get-ChildItem $OutDir -Filter 'snapshot-*.snap' | Sort-Object Name -Descending | Select-Object -Skip $Keep
foreach ($f in $old) { Remove-Item $f.FullName -Force; Write-Host "pruned old snapshot: $($f.Name)" }

Write-Host "snapshot saved (content not displayed): $local"
Write-Host "ACTION REQUIRED: copy off-host (encrypted), retain per policy, keep unseal shares SEPARATE from this snapshot."