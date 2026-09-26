# Moves migrated secrets OUT of an app .env: backs up the full file to the
# custody dir (ACL'd, outside repo) and rewrites the .env without the given
# keys. Values never displayed.
# Usage: .\env-scrub.ps1 -EnvFile FUENTES\X\.env -RemoveKeys A,B,C

param(
  [Parameter(Mandatory)][string]$EnvFile,
  [Parameter(Mandatory)][string[]]$RemoveKeys
)

. (Join-Path $PSScriptRoot '_common.ps1')

if (-not (Test-Path $EnvFile)) { throw "env file not found: $EnvFile" }

# 1. Custody backup (rollback window), ACL'd, outside the repo.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupName = "$(Split-Path $EnvFile -Leaf).$stamp.bak"
$backupDir = Join-Path $CustodyDir 'env-backups'
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Force -Path $backupDir | Out-Null }
$backupPath = Join-Path $backupDir $backupName
Copy-Item $EnvFile $backupPath -Force
Restrict-File $backupPath
Write-Host "backup: $backupPath (values not displayed)"

# 2. Rewrite without the migrated keys.
$removed = New-Object System.Collections.Generic.List[string]
$kept = New-Object System.Collections.Generic.List[string]
foreach ($line in (Get-Content $EnvFile)) {
  if ($line -match '^\s*([A-Z0-9_]+)\s*=') {
    $name = $Matches[1]
    if ($RemoveKeys -contains $name) { $removed.Add($name); continue }
  }
  $kept.Add($line)
}
$header = @(
  '# OpenBao: private secrets are served by the launcher from OpenBao (KV v2).',
  '# This file holds PUBLIC config only. Do NOT add secret values here.',
  '# DATABASE_URL (when present) is the documented Prisma-CLI/rollback window copy;'
  '# OpenBao is the authoritative source. End of window: delete it (see ROTATION_CHECKLIST).'
)
$newContent = ($header + $kept) -join "`n"
Set-Content -LiteralPath $EnvFile -Value $newContent -Encoding utf8
Write-Host "removed $($removed.Count) key(s) (names only): $($removed -join ', ')"