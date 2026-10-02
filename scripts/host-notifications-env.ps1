# Agrega NOTIFICATIONS_SERVICE_TOKEN (desde OpenBao local) y NOTIFICATIONS_ALLOWED_APPS
# al .env del API en el host. Idempotente.
$ErrorActionPreference = 'Stop'
$envFile = 'D:\Proyectos\ecommcerce-saas-sonet\FUENTES\tiendi-api\.env'
Copy-Item $envFile "$envFile.bak-20260928-notifications" -ErrorAction SilentlyContinue
$content = Get-Content $envFile -Raw
if ($content -match 'NOTIFICATIONS_SERVICE_TOKEN') {
  Write-Output 'ya presente - skip'
  exit 0
}
# Token desde OpenBao (no se imprime)
$body = @{
  credentials = @{ address = 'http://127.0.0.1:8200'; token = (Get-Content 'C:\ProgramData\openbao-agent.token' -Raw).Trim() }
} | ConvertTo-Json -Depth 3
$token = ''
try {
  $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8200/v1/secret/data/dev/apps/tiendi-api/runtime' -Headers @{ 'X-Vault-Token' = (Get-Content 'C:\Users\tiendi-admin\.openbao-tok' -Raw).Trim() } -TimeoutSec 5
  $token = $r.data.data.NOTIFICATIONS_SERVICE_TOKEN
} catch {
  Write-Output 'no hay token accesible en el host - setear manualmente'
  exit 1
}
Add-Content $envFile -Value "`r`n# Modulo central de notificaciones (fase 4): puente entre backends + alcance."
Add-Content $envFile -Value "NOTIFICATIONS_SERVICE_TOKEN=$token"
Add-Content $envFile -Value "NOTIFICATIONS_ALLOWED_APPS=tiendi-kipu,tiendi-go"
Write-Output "env actualizado (token de $($token.Length) chars)"
