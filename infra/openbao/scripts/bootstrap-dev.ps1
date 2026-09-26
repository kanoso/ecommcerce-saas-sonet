# One-time OpenBao dev bootstrap. Idempotent-guarded: refuses to re-init.
# Steps: compose up -> init (1/1 Shamir, explicit risk) -> custody file (ACL'd) ->
# unseal via stdin -> KV v2 mount -> policies -> AppRoles -> operator tokens ->
# fictitious canaries -> verify non-root admin login -> revoke root token.
# No real credentials are imported here (authorization gate in guide section 1).

param(
  [switch]$SkipCanaries
)

. (Join-Path $PSScriptRoot '_common.ps1')
Ensure-Dirs
Set-ComposeEnv

Write-Host "== OpenBao dev bootstrap =="

# --- 1. Liveness: start server container
docker compose -f (Join-Path $InfraDir 'docker-compose.yml') up -d openbao
Write-Host "waiting for server process..."
$deadline = (Get-Date).AddSeconds(60)
do {
  Start-Sleep -Seconds 2
  $st = Get-ServerState
} while (-not $st.reachable -and (Get-Date) -lt $deadline)
if (-not $st.reachable) { throw "server container did not become reachable" }
Write-Host ("state: initialized={0} sealed={1}" -f $st.initialized, $st.sealed)

# --- 2. Init once, custody outside repo
if ($st.initialized) {
  Write-Host "already initialized: NOT re-initializing (guide section 4)."
  if (-not (Test-Path $script:InitFile)) {
    throw "initialized but custody file missing: unseal keys are elsewhere; do not wipe the volume."
  }
} else {
  Write-Host "initializing (Shamir 1/1 - accepted dev-only risk; test requires separate custody)..."
  $raw = Exec-Bao -BaoArgs @('operator', 'init', '-key-shares=1', '-key-threshold=1', '-format=json')
  Save-CustodyFile -Path $script:InitFile -Content ($raw -join "`n")
  Write-Host "custody saved (keys NOT displayed): $script:InitFile"
  Write-Host "ACTION REQUIRED: copy this file to encrypted external storage, then keep it out of machine backups."
}

$init = Read-CustodyJson

# --- 3. Unseal (interactive-equivalent: key flows via stdin pipe only)
$st = Get-ServerState
if ($st.sealed) {
  Invoke-Unseal
}

# --- 4. Readiness gate (initialized + unsealed + leader) before any setup
$st = Get-ServerState
if (-not ($st.initialized -eq $true -and $st.sealed -eq $false)) {
  throw "server not ready (initialized=$($st.initialized) sealed=$($st.sealed)): refusing setup"
}

$rootToken = $init.root_token
if (-not $rootToken) { throw "custody file has no root_token (expected on re-runs after revocation - use operator tokens instead)" }

# --- 5. KV v2 mount named 'secret' + AppRole auth method
$mounts = Exec-Bao -BaoArgs @('secrets', 'list', '-format=json') -Token $rootToken | ConvertFrom-Json
if (-not $mounts.'secret/') {
  Exec-Bao -BaoArgs @('secrets', 'enable', '-path=secret', '-version=2', 'kv') -Token $rootToken | Out-Null
}
Write-Host "KV v2 mount 'secret' present."

$auths = Exec-Bao -BaoArgs @('auth', 'list', '-format=json') -Token $rootToken | ConvertFrom-Json
if (-not $auths.'approle/') {
  Exec-Bao -BaoArgs @('auth', 'enable', '-path=approle', 'approle') -Token $rootToken | Out-Null
  Write-Host 'approle auth method enabled.'
}

# --- 6. Policies
foreach ($p in @('tiendi-api-runtime', 'tiendi-kipu-api-runtime', 'admin-operator', 'bootstrap-operator', 'backup-operator')) {
  Exec-Bao -BaoArgs @('policy', 'write', $p, "/openbao/policies/$p.hcl") -Token $rootToken | Out-Null
  Write-Host "policy written: $p"
}

# --- 7. AppRoles (token_num_uses MUST be 0 for auto-auth renewal; secret_id 1 day, unlimited re-uses within TTL)
$approles = @(
  @{ name = 'tiendi-api-runtime';      policy = 'tiendi-api-runtime' },
  @{ name = 'tiendi-kipu-api-runtime'; policy = 'tiendi-kipu-api-runtime' }
)
foreach ($r in $approles) {
  Exec-Bao -BaoArgs @('write', "auth/approle/role/$($r.name)",
    "token_policies=$($r.policy)", 'bind_secret_id=true',
    'token_ttl=15m', 'token_max_ttl=1h', 'token_num_uses=0',
    'secret_id_ttl=24h', 'secret_id_num_uses=0') -Token $rootToken | Out-Null
  Write-Host "approle created: $($r.name)"
}

# --- 8. Operator tokens (non-root), custody files
# -orphan: revoking the root token must NOT cascade to operator tokens
# (token tree revocation would otherwise kill them together with root).
$boot = Exec-Bao -BaoArgs @('token', 'create', '-orphan', '-policy=bootstrap-operator', '-ttl=24h', '-format=json') -Token $rootToken | ConvertFrom-Json
Save-CustodyFile -Path (Join-Path $CustodyDir 'operator-bootstrap.token') -Content $boot.auth.client_token
Write-Host "bootstrap-operator token saved: $(Join-Path $CustodyDir 'operator-bootstrap.token') (not displayed)"

$adm = Exec-Bao -BaoArgs @('token', 'create', '-orphan', '-policy=admin-operator', '-ttl=24h', '-renewable=true', '-format=json') -Token $rootToken | ConvertFrom-Json
Save-CustodyFile -Path (Join-Path $CustodyDir 'operator-admin.token') -Content $adm.auth.client_token
Write-Host "admin-operator token saved: $(Join-Path $CustodyDir 'operator-admin.token') (not displayed)"

$bak = Exec-Bao -BaoArgs @('token', 'create', '-orphan', '-policy=backup-operator', '-ttl=24h', '-renewable=true', '-format=json') -Token $rootToken | ConvertFrom-Json
Save-CustodyFile -Path (Join-Path $CustodyDir 'operator-backup.token') -Content $bak.auth.client_token
Write-Host "backup-operator token saved: $(Join-Path $CustodyDir 'operator-backup.token') (not displayed)"

# --- 9. Fictitious canaries (no real credentials; importing real ones needs explicit authorization)
if (-not $SkipCanaries) {
  $canaryRuntimeApi = @{
    DATABASE_URL       = 'postgresql://canary_user:canary_not_a_real_password@localhost:5432/canary_db'
    JWT_SECRET         = 'CANARY-dev-jwt-secret-not-real-0001'
    JWT_REFRESH_SECRET = 'CANARY-dev-jwt-refresh-not-real-0002'
    METRICS_SECRET     = 'CANARY-dev-metrics-not-real-0003'
  } | ConvertTo-Json -Compress
  $canaryRuntimeKipu = @{
    DATABASE_URL  = 'postgresql://canary_user:canary_not_a_real_password@localhost:5432/kipu_canary_db'
    JWT_SECRET    = 'CANARY-kipu-jwt-not-real-0004'
    SEED_USERNAME = 'canary_seed_user'
    SEED_PASSWORD = 'CANARY-seed-not-real-0005'
  } | ConvertTo-Json -Compress
  $canaryKipuBridge = @{ service_token = 'CANARY-bridge-tiendi-kipu-not-real-0006' } | ConvertTo-Json -Compress
  $canaryShield     = @{ service_token = 'CANARY-shield-bridge-not-real-0007' } | ConvertTo-Json -Compress

  foreach ($pair in @(
    @{ path = 'secret/dev/apps/tiendi-api/runtime';      body = $canaryRuntimeApi },
    @{ path = 'secret/dev/apps/tiendi-kipu-api/runtime'; body = $canaryRuntimeKipu },
    @{ path = 'secret/dev/integrations/tiendi-kipu';     body = $canaryKipuBridge },
    @{ path = 'secret/dev/integrations/shield';          body = $canaryShield }
  )) {
    $pair.body | docker exec -i $script:ServerContainer sh -c 'cat > /tmp/canary.json'
    Exec-Bao -BaoArgs @('kv', 'put', $pair.path, '@/tmp/canary.json') -Token $rootToken | Out-Null
    docker exec $script:ServerContainer rm -f /tmp/canary.json | Out-Null
    Write-Host "canary written: $($pair.path)"
  }
}

# --- 10. Verify non-root admin login, then revoke root
$admCheck = Exec-Bao -BaoArgs @('token', 'lookup', '-format=json') -Token $adm.auth.client_token | ConvertFrom-Json
if ($admCheck.data.policies -notcontains 'admin-operator') { throw "admin operator verification failed" }
Write-Host "admin-operator login verified (non-root). Revoking initial root..."
Exec-Bao -BaoArgs @('token', 'revoke', '-self') -Token $rootToken | Out-Null
Remove-Variable rootToken

# Strip now-useless root_token from custody (keys remain for unseal custody).
$kept = @{ unseal_keys_b64 = $init.unseal_keys_b64; unseal_keys_hex = $init.unseal_keys_hex }
Save-CustodyFile -Path $script:InitFile -Content ($kept | ConvertTo-Json -Depth 4)
Write-Host "root token revoked; custody file no longer contains it."
Write-Host "== bootstrap complete =="
Write-Host "Evidence: server initialized+unsealed, KV v2, policies, AppRoles, canaries, non-root admin verified, root revoked."