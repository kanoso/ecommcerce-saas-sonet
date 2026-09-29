# Smoke OTLP -> Collector -> Loki en TEST.
$ErrorActionPreference = 'Stop'
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000
$payload = @{
  resourceLogs = @(@{
    resource = @{ attributes = @(
      @{ key = 'service.name'; value = @{ stringValue = 'host-probe' } },
      @{ key = 'deployment.environment.name'; value = @{ stringValue = 'test' } }
    ) }
    scopeLogs = @(@{
      logRecords = @(@{
        timeUnixNano = $ts
        severityText = 'INFO'
        body = @{ stringValue = 'smoke collector host 2026-09-28' }
      })
    })
  })
} | ConvertTo-Json -Depth 8
$r = Invoke-WebRequest -Uri 'http://127.0.0.1:4318/v1/logs' -Method POST -ContentType 'application/json' -Body $payload -UseBasicParsing -TimeoutSec 10
Write-Output "push=$($r.StatusCode)"
Start-Sleep -Seconds 6
$qs = [uri]::EscapeDataString('{service_name="host-probe"}')
$loki = Invoke-RestMethod -Uri "http://127.0.0.1:3100/loki/api/v1/query_range?query=$qs&limit=3&since=5m"
Write-Output "loki_streams=$($loki.data.result.Count)"
