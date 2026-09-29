# Activa la canalizacion OTel del piloto (tiendi-platform-api) en el ecosystem
# de PM2 del host, con backup previo. Idempotente: no duplica si ya existen.
$ErrorActionPreference = 'Stop'
$file = 'D:\Proyectos\ecommcerce-saas-sonet\FUENTES\tiendi-api\ecosystem.config.cjs'
Copy-Item $file "$file.bak-20260928" -ErrorAction SilentlyContinue
$content = Get-Content $file -Raw
if ($content -match 'TIENDI_OTEL_LOGS_ENABLED') {
  Write-Output 'flags already present - skip'
  exit 0
}
$sha = (git -C 'D:\Proyectos\ecommcerce-saas-sonet\FUENTES\tiendi-api' rev-parse --short HEAD)
$block = @"
      env: {
        // TEST ENVIRONMENT: Twilio (and other providers) run in mock mode
        // without credentials. Set back to 'production' with real secrets
        // when moving to prod (twilio.service.ts hard-fails in production).
        NODE_ENV: 'development',
        PORT: 3001,
        // Canalizacion OTel piloto TEST (guia OpenTelemetry T6): export de
        // logs al collector en loopback. Rollback rapido: LOGS_EXPORT_ENABLED
        // en false (cero conexiones) y reinicio.
        TIENDI_OTEL_LOGS_ENABLED: 'true',
        TIENDI_OTEL_LOGS_EXPORT_ENABLED: 'true',
        TIENDI_OTEL_CONTEXT_ENABLED: 'true',
        TIENDI_OTEL_LOGS_ENDPOINT: 'http://127.0.0.1:4318/v1/logs',
        TIENDI_DEPLOYMENT_ENV: 'test',
        TIENDI_SERVICE_VERSION: '$sha',
      },
"@
$content = $content -replace '      env: \{\r?\n        // TEST ENVIRONMENT: Twilio \(and other providers\) run in mock mode\r?\n        // without credentials\. Set back to ''production'' with real secrets\r?\n        // when moving to prod \(twilio\.service\.ts hard-fails in production\)\.\r?\n        NODE_ENV: ''development'',\r?\n        PORT: 3001,\r?\n      \},', $block
Set-Content $file -Value $content -Encoding utf8
Write-Output "flags added (service.version=$sha)"
Get-Content $file | Select-Object -Skip 12 -First 18
