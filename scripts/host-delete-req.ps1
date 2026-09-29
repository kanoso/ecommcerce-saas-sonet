# Solicitud de borrado via Loki delete API (form-urlencoded).
$ErrorActionPreference = 'Stop'
$qs = [uri]::EscapeDataString('{service_name="purge-test"}')
$start = [uri]::EscapeDataString('2026-09-28T00:00:00Z')
$end = [uri]::EscapeDataString('2026-09-29T00:00:00Z')
$body = "query=$qs&start=$start&end=$end"
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3100/loki/api/v1/delete' -Method POST -ContentType 'application/x-www-form-urlencoded' -Body $body -UseBasicParsing -TimeoutSec 10
  Write-Output "delete_status=$($r.StatusCode)"
} catch {
  Write-Output "delete_err=$($_.Exception.Response.StatusCode.value__) $($_.ErrorDetails.Message)"
}
# Listar solicitudes de borrado pendientes.
try {
  $list = Invoke-RestMethod -Uri 'http://127.0.0.1:3100/loki/api/v1/delete' -Method GET -TimeoutSec 10
  Write-Output "pendings=$($list.Count)"
  $list | ForEach-Object { Write-Output "del: query=$($_.query) start=$($_.start) end=$($_.end)" }
} catch {
  Write-Output "list_err=$($_.Exception.Response.StatusCode.value__)"
}
