# Prueba de purga real de retencion (guia T6): inyecta logs sinteticos
# purge-test, agenda su borrado via /loki/api/v1/delete y verifica.
$ErrorActionPreference = 'Stop'

function Push-Log([string]$svc, [string]$msg) {
  $ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000
  $payload = @{
    resourceLogs = @(@{
      resource = @{ attributes = @(
        @{ key = 'service.name'; value = @{ stringValue = $svc } },
        @{ key = 'deployment.environment.name'; value = @{ stringValue = 'test' } }
      ) }
      scopeLogs = @(@{
        logRecords = @(@{ timeUnixNano = $ts; severityText = 'INFO'; body = @{ stringValue = $msg } })
      })
    })
  } | ConvertTo-Json -Depth 8
  $r = Invoke-WebRequest -Uri 'http://127.0.0.1:4318/v1/logs' -Method POST -ContentType 'application/json' -Body $payload -UseBasicParsing -TimeoutSec 10
  Write-Output "push=$($r.StatusCode)"
}

Push-Log 'purge-test' 'entrada A - debe ser borrada'
Push-Log 'purge-test' 'entrada B - debe ser borrada'
Start-Sleep -Seconds 6
$qs = [uri]::EscapeDataString('{service_name="purge-test"}')
$l = Invoke-RestMethod -Uri "http://127.0.0.1:3100/loki/api/v1/query_range?query=$qs&limit=10&since=10m"
Write-Output "antes_streams=$($l.data.result.Count) lineas=$($l.data.result | ForEach-Object { $_.values.Count } | Measure-Object -Sum | ForEach-Object Sum)"

# Solicitud de borrado de TODO purge-test en la ultima hora.
$now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$delBody = @{
  query = '{service_name="purge-test"}'
  start = "$([DateTimeOffset]::UtcNow.AddHours(-1).ToString('o'))"
  end   = "$([DateTimeOffset]::UtcNow.AddMinutes(1).ToString('o'))"
  max_lookback_period = "25h"
} | ConvertTo-Json
try {
  $d = Invoke-RestMethod -Uri 'http://127.0.0.1:3100/loki/api/v1/delete' -Method POST -ContentType 'application/json' -Body $delBody -TimeoutSec 10
  Write-Output "delete_agendado ok"
} catch {
  Write-Output "delete_err=$($_.Exception.Response.StatusCode.value__) $($_.ErrorDetails.Message)"
}
