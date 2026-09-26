# Shared helpers for OpenBao dev operation scripts. Sourced by the other scripts.
# Rule: no secret value is ever written to console, transcript, or command history.

$ErrorActionPreference = 'Stop'

$script:OpenBaoBase   = Join-Path $env:USERPROFILE '.openbao-dev'
$script:CustodyDir    = Join-Path $OpenBaoBase 'custody'
$script:InitFile      = Join-Path $CustodyDir 'init.json'
$script:AgentIdRoot   = Join-Path $OpenBaoBase 'agent'
$script:RenderRoot    = Join-Path $OpenBaoBase 'render'
$script:InfraDir      = Resolve-Path (Join-Path $PSScriptRoot '..')
$script:ServerContainer = 'openbao-dev'

function Ensure-Dirs {
  foreach ($d in @($OpenBaoBase, $CustodyDir, $AgentIdRoot, $RenderRoot)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
  }
}

function Restrict-File {
  param([string]$Path)
  # NTFS ACL: only the current user. This is the documented dev custody control.
  icacls $Path /inheritance:r /grant:r "$($env:USERNAME):(R,W)" | Out-Null
}

function Restrict-Dir {
  param([string]$Path)
  icacls $Path /inheritance:r /grant:r "$($env:USERNAME):(OI)(CI)(R,W)" | Out-Null
}

function Save-CustodyFile {
  param([string]$Path, [string]$Content)
  $dir = Split-Path $Path -Parent
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  Set-Content -LiteralPath $Path -Value $Content -NoNewline -Encoding utf8
  Restrict-File $Path
}

function Read-CustodyJson {
  if (-not (Test-Path $script:InitFile)) {
    throw "custody file not found: $script:InitFile (was the server initialized with bootstrap-dev.ps1?)"
  }
  Get-Content -LiteralPath $script:InitFile -Raw | ConvertFrom-Json
}

# Runs `bao` inside the server container. Token is passed via exec env (documented
# residual exposure: host process list). Values are never echoed.
function Exec-Bao {
  param(
    [Parameter(Mandatory)][string[]]$BaoArgs,
    [string]$Token,
    [string]$Container = $script:ServerContainer
  )
  $dockerArgs = @('exec', '-e', 'BAO_ADDR=http://127.0.0.1:8200')
  if ($Token) { $dockerArgs += @('-e', "BAO_TOKEN=$Token") }
  $dockerArgs += @('-i', $Container, 'bao') + $BaoArgs
  $out = & docker @dockerArgs
  if ($LASTEXITCODE -ne 0) {
    throw "bao command failed (no values printed): $($BaoArgs -join ' ')"
  }
  return $out
}

function Invoke-Unseal {
  # OpenBao CLI refuses piped unseal keys by design; we use the local REST API.
  # The key flows custody-file -> variable -> request body only (never args/logs).
  $init = Read-CustodyJson
  $key = $init.unseal_keys_b64[0]
  $resp = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8200/v1/sys/unseal' `
    -ContentType 'application/json' -Body (@{ key = $key } | ConvertTo-Json -Compress)
  Remove-Variable key
  if ($resp.sealed) { throw 'unseal attempt did not unseal the server' }
  Write-Host 'unsealed.'
}

function Get-ServerState {
  # Returns object with .initialized and .sealed. Exit codes of `bao status`
  # differ by state; we only parse JSON, never treat sealed as ready.
  $out = docker exec -e BAO_ADDR=http://127.0.0.1:8200 $script:ServerContainer bao status -format=json 2>$null
  if ($LASTEXITCODE -eq 125 -or -not $out) {
    return [pscustomobject]@{ reachable = $false; initialized = $null; sealed = $null }
  }
  $j = $out | ConvertFrom-Json
  [pscustomobject]@{ reachable = $true; initialized = $j.initialized; sealed = $j.sealed }
}

function Set-ComposeEnv {
  $env:OPENBAO_AGENT_ID_DIR = Join-Path $script:AgentIdRoot 'tiendi-api'
  $env:OPENBAO_RENDER_DIR   = $script:RenderRoot
  $env:OPENBAO_KIPU_AGENT_ID_DIR = Join-Path $script:AgentIdRoot 'tiendi-kipu-api'
  $env:OPENBAO_KIPU_RENDER_DIR   = $script:RenderRoot
}

Write-Verbose 'openbao _common.ps1 loaded'