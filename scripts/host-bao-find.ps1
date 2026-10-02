# Busca custody/init del OpenBao en el host.
foreach ($p in @('C:\openbao', 'D:\openbao', "$env:ProgramData\openbao", "$env:USERPROFILE\.openbao", 'D:\Proyectos\ecommcerce-saas-sonet\infra\openbao', "$env:USERPROFILE\.openbao-dev")) {
  if (Test-Path $p) {
    Write-Output "--- $p"
    Get-ChildItem $p -Recurse -Depth 2 -ErrorAction SilentlyContinue | ForEach-Object { Write-Output "  $($_.FullName)" } | Select-Object -First 15
  }
}
Get-Process | Where-Object { $_.ProcessName -match 'bao|vault' } | Select-Object Id, ProcessName
Get-Service | Where-Object { $_.Name -match 'bao|vault' } | Select-Object Name, Status
