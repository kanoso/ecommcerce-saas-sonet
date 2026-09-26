# Imports REAL credential values from an existing .env into OpenBao KV v2,
# authorized by the user, without ever echoing values (no chat/logs/args).
# Parses ONLY the requested keys; values stay in memory and travel via stdin.
# Usage:
#   .\import-from-env.ps1 -EnvFile FUENTES\tiendi-api\.env -Path secret/dev/apps/tiendi-api/runtime -Keys DATABASE_URL,JWT_SECRET,JWT_REFRESH_SECRET

param(
  [Parameter(Mandatory)][string]$EnvFile,
  [Parameter(Mandatory)][string]$Path,
  [Parameter(Mandatory)][string[]]$Keys
)

. (Join-Path $PSScriptRoot '_common.ps1')

if (-not (Test-Path $EnvFile)) { throw "env file not found: $EnvFile" }
$admFile = Join-Path $CustodyDir 'operator-admin.token'
if (-not (Test-Path $admFile)) { throw 'admin operator token missing' }
$token = (Get-Content $admFile -Raw).Trim()

# Read current KV data (merge, not replace - KV v2 put clobbers).
$current = Exec-Bao -BaoArgs @('kv', 'get', '-format=json', $Path) -Token $token | ConvertFrom-Json
$existing = @{}
if ($current.data.data) {
  foreach ($p in $current.data.data.PSObject.Properties) { $existing[$p.Name] = $p.Value }
}

# Parse .env lines for the requested keys only. Values never printed.
$imported = 0
foreach ($line in (Get-Content $EnvFile)) {
  if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$') {
    $name = $Matches[1]
    if ($Keys -notcontains $name) { continue }
    $value = $Matches[2]
    if ($value -match '^"(.*")$') { $value = $Matches[1].Trim('"') }
    if ($value -eq '') { Write-Host "skip $name (empty value in env file)"; continue }
    $existing[$name] = $value
    $imported++
  }
}

$missing = $Keys | Where-Object { -not $existing.ContainsKey($_) -or [string]::IsNullOrEmpty($existing[$_]) }
if ($missing.Count -gt 0) { throw "keys not found/empty in env file (names only): $($missing -join ', ')" }

$payload = $existing | ConvertTo-Json -Depth 8
$payload | docker exec -i $script:ServerContainer sh -c 'cat > /tmp/import.json'
Exec-Bao -BaoArgs @('kv', 'put', $Path, '@/tmp/import.json') -Token $token | Out-Null
docker exec $script:ServerContainer rm -f /tmp/import.json 2>$null | Out-Null
Remove-Variable payload, existing, current

Write-Host "imported $imported key(s) into $Path (names only): $($Keys -join ', ')"
Write-Host "Rotation reminder: KV change does not update running processes - restart the consumer via launcher."