# Issues a new SecretID for an AppRole, delivered as a response-wrapping token
# (5 min) and unwrapped locally into the agent identity directory (NTFS ACL'd).
# Uses the bootstrap-operator token, NEVER root.
# Usage: .\issue-secretid.ps1 -App tiendi-api [-RestartAgent]

param(
  [Parameter(Mandatory)][ValidateSet('tiendi-api', 'tiendi-kipu-api')][string]$App,
  [switch]$RestartAgent
)

. (Join-Path $PSScriptRoot '_common.ps1')

$role = "$App-runtime"
$bootFile = Join-Path $CustodyDir 'operator-bootstrap.token'
if (-not (Test-Path $bootFile)) { throw 'bootstrap operator token missing (operator-bootstrap.token)' }
$bootToken = (Get-Content $bootFile -Raw).Trim()

# 1. Generate wrapped SecretID (short-lived response-wrapping token).
$wrapped = Exec-Bao -BaoArgs @('write', '-force', '-wrap-ttl=5m', '-format=json', "auth/approle/role/$role/secret-id") -Token $bootToken | ConvertFrom-Json
$wrapToken = $wrapped.wrap_info.token
if (-not $wrapToken) { throw 'wrapping token not obtained' }

# 2. Validate creation path expectation then unwrap once (consume the wrapping).
$unwrapped = Exec-Bao -BaoArgs @('unwrap', '-format=json') -Token $wrapToken | ConvertFrom-Json
$secretId = $unwrapped.data.secret_id
if (-not $secretId) { throw 'unwrap failed: secret_id not obtained (wrapping already consumed or expired)' }

# 3. Persist to the restricted identity dir (host-side NTFS ACL; verified in tests).
$appDir = Join-Path $AgentIdRoot $App
if (-not (Test-Path $appDir)) { New-Item -ItemType Directory -Force -Path $appDir | Out-Null; Restrict-Dir $appDir }

$roleId = (Exec-Bao -BaoArgs @('read', '-field=role_id', "auth/approle/role/$role/role-id") -Token $bootToken)
Save-CustodyFile -Path (Join-Path $appDir 'role_id') -Content $roleId
Save-CustodyFile -Path (Join-Path $appDir 'secret_id') -Content $secretId
Remove-Variable secretId, wrapToken, bootToken

Write-Host "identity files written for $App (values not displayed): $appDir{role_id,secret_id}"

if ($RestartAgent) {
  Set-ComposeEnv
  $env:OPENBAO_AGENT_ID_DIR = $appDir
  docker compose -f (Join-Path $InfraDir 'docker-compose.yml') --profile "agent-$App" up -d
  Write-Host "agent container (re)started for $App."
}