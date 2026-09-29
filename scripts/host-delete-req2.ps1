# Solicitud de borrado via Loki delete API usando archivo de body (evita
# problemas de quoting de curl en PowerShell 5.1).
$ErrorActionPreference = 'Stop'
$qs = [uri]::EscapeDataString('{service_name="purge-test"}')
$start = [uri]::EscapeDataString('2026-09-28T00:00:00Z')
$end = [uri]::EscapeDataString('2026-09-29T00:00:00Z')
Set-Content "$env:TEMP\del-body.txt" -Value "query=$qs&start=$start&end=$end" -NoNewline -Encoding ascii
$r = curl.exe -s -X POST 'http://127.0.0.1:3100/loki/api/v1/delete' -H 'Content-Type: application/x-www-form-urlencoded' --data-binary '@C:/Users/tiendi-admin/AppData/Local/Temp/del-body.txt' -w '%{http_code}'
Write-Output "delete_status=$r"
$list = Invoke-RestMethod -Uri 'http://127.0.0.1:3100/loki/api/v1/delete' -Method GET -TimeoutSec 10
Write-Output "pendings=$($list.Count)"
$list | ForEach-Object { Write-Output "del: query=$($_.query)" }
