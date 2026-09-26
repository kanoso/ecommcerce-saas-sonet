# State inspection: liveness vs readiness are DIFFERENT states (guide section 4).
# Subcommands: show (default) | unseal | seal

param(
  [Parameter(Position = 0)][ValidateSet('show', 'unseal', 'seal')][string]$Action = 'show'
)

. (Join-Path $PSScriptRoot '_common.ps1')

switch ($Action) {
  'show' {
    $st = Get-ServerState
    if (-not $st.reachable) { Write-Host 'STATE: unreachable (container down)'; exit 1 }
    if (-not $st.initialized) {
      Write-Host 'STATE: not-initialized (LIVENESS only: process up, vault NOT usable)'
      exit 0
    }
    if ($st.sealed) {
      Write-Host 'STATE: sealed (LIVENESS only: process up, vault NOT usable)'
      exit 0
    }
    Write-Host 'STATE: ready (initialized + unsealed). Readiness positive.'
  }
  'unseal' {
    $st = Get-ServerState
    if (-not $st.reachable) { throw 'container not reachable' }
    if (-not $st.initialized) { throw 'server not initialized' }
    if (-not $st.sealed) { Write-Host 'already unsealed'; exit 0 }
    Invoke-Unseal
  }
  'seal' {
    Exec-Bao -BaoArgs @('seal')
    Write-Host 'sealed.'
  }
}