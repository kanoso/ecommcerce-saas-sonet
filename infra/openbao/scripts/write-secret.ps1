# Writes ONE key into a KV v2 path without ever displaying the value.
# Usage:
#   .\write-secret.ps1 -Path secret/dev/apps/tiendi-api/runtime -Key DATABASE_URL            (prompt, secure string)
#   .\Write-secret.ps1 -Path ... -Key FIREBASE_PRIVATE_KEY -ValueFile C:\path\key.pem        (multiline/PEM from file)
# Value travels via stdin into the container; it never appears in console, args or history.

param(
  [Parameter(Mandatory)][string]$Path,
  [Parameter(Mandatory)][string]$Key,
  [string]$ValueFile
)

. (Join-Path $PSScriptRoot '_common.ps1')

if (-not (Test-Path $script:InitFile)) { throw 'custody file missing; run bootstrap-dev.ps1 first' }
$init = Read-CustodyJson
if ($init.root_token) { throw 'root token still in custody file: finish bootstrap (revocation step) first' }

$admFile = Join-Path $CustodyDir 'operator-admin.token'
if (-not (Test-Path $admFile)) { throw 'admin operator token missing (operator-admin.token)' }
$token = (Get-Content $admFile -Raw).Trim()

if ($ValueFile) {
  if (-not (Test-Path $ValueFile)) { throw "value file not found: $ValueFile" }
  $plain = Get-Content -LiteralPath $ValueFile -Raw
} else {
  $sec = Read-Host -Prompt "value for $Path#key" -AsSecureString
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec))
  Remove-Variable sec
}

# KV v2 `kv put` REPLACES the whole data map. To write one key without clobbering
# the rest: read current data, merge, write back atomically.
$current = Exec-Bao -BaoArgs @('kv', 'get', '-format=json', $Path) -Token $token | ConvertFrom-Json
$existing = @{}
if ($current.data.data) {
  foreach ($p in $current.data.data.PSObject.Properties) { $existing[$p.Name] = $p.Value }
}
$existing[$Key] = $plain
$payload = $existing | ConvertTo-Json -Depth 8
$payload | docker exec -i $script:ServerContainer sh -c 'cat > /tmp/kv.json'
Exec-Bao -BaoArgs @('kv', 'put', $Path, '@/tmp/kv.json') -Token $token | Out-Null
docker exec $script:ServerContainer rm -f /tmp/kv.json 2>$null | Out-Null
Remove-Variable plain, payload

Write-Host "written: $Path (key name only, value not displayed)."
Write-Host "NOTE: rotation does not update already-loaded processes - render/validate and restart the consumer (guide section 6)."