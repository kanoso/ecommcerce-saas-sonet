# Diagnostico del tunnel cloudflared en TEST.
$svc = Get-CimInstance Win32_Service -Filter "Name='cloudflared'"
Write-Output "binario: $($svc.PathName)"
foreach ($p in @("$env:USERPROFILE\.cloudflared", 'C:\Program Files (x86)\cloudflared')) {
  if (Test-Path $p) {
    Write-Output "--- dir: $p"
    Get-ChildItem $p | ForEach-Object { Write-Output "  $($_.Name)" }
  }
}
$cfg = "$env:USERPROFILE\.cloudflared\config.yml"
if (Test-Path $cfg) {
  Write-Output "--- config.yml:"
  Get-Content $cfg
}
