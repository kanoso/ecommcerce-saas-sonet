# Metricas del API en host (auth con METRICS_SECRET del .env local) + eventos.
$ErrorActionPreference = 'Continue'
$line = (Get-Content 'D:\Proyectos\ecommcerce-saas-sonet\FUENTES\tiendi-api\.env' | Select-String 'METRICS_SECRET').Line
$sec = $line -replace 'METRICS_SECRET=', ''
try {
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3001/metrics' -Headers @{ Authorization = "Bearer $sec" } -UseBasicParsing -TimeoutSec 15
  ($r.Content -split "`n") | Select-String 'http_requests' | Select-Object -First 12
} catch {
  Write-Output "metrics=$($_.Exception.Response.StatusCode.value__)"
}
