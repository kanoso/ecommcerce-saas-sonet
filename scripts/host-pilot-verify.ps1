# Verificacion e2e del piloto API en TEST: health, request y Loki.
$ErrorActionPreference = 'Continue'
try {
  Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/v1/health' -UseBasicParsing -TimeoutSec 10 | Out-Null
  Write-Output 'health=200'
} catch {
  $c = $_.Exception.Response.StatusCode.value__
  Write-Output "health=$c"
}
try {
  Invoke-WebRequest -Uri 'http://127.0.0.1:3001/api/v1/auth/login' -Method POST -ContentType 'application/json' -Body '{"email":"noexiste@test.local","password":"x"}' -UseBasicParsing -TimeoutSec 10 | Out-Null
} catch {
  Write-Output "login_status=$($_.Exception.Response.StatusCode.value__)"
}
Start-Sleep -Seconds 10
$qs = [uri]::EscapeDataString('{service_name="tiendi-api"}')
$l = Invoke-RestMethod -Uri "http://127.0.0.1:3100/loki/api/v1/query_range?query=$qs&limit=5&since=10m"
Write-Output "loki_streams=$($l.data.result.Count)"
$l.data.result | ForEach-Object {
  Write-Output "env=$($_.stream.deployment_environment_name) ver=$($_.stream.service_version)"
} | Select-Object -First 3
$qt = [uri]::EscapeDataString('{service_name="tiendi-api"} | trace_id=~".+"')
$lt = Invoke-RestMethod -Uri "http://127.0.0.1:3100/loki/api/v1/query_range?query=$qt&limit=3&since=10m"
Write-Output "con_trace_id=$($lt.data.result.Count)"
