# ============================================================
# Deploy Tiendi en PC local (RUPERTAMINI) — PowerShell ADMIN
# Uso:  powershell -ExecutionPolicy Bypass -File setup.ps1
# Instala: PostgreSQL 16 + Memurai (Redis) + tiendi-platform-api
#          + panel vendor (:4201) + panel admin (:4202), todo con pm2.
# ============================================================

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Step($msg) { Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  [OK] $msg" -ForegroundColor Green }

# ---------- 0. Requisitos ----------
Step "0. Verificando admin y herramientas"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
           ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { throw "Ejecutar PowerShell COMO ADMINISTRADOR" }
winget --version | Out-Null; Ok "winget"
node -v; npm -v; git --version

# ---------- 1. PostgreSQL 16 ----------
Step "1. PostgreSQL 16 (usuario postgres / pass tiendi2025)"
$pgInstalled = (Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue) -ne $null
if ($pgInstalled) {
    Ok "PostgreSQL ya instalado: $((Get-Service -Name 'postgresql*').Name)"
} else {
    winget install --id PostgreSQL.PostgreSQL.16 --silent --accept-package-agreements --accept-source-agreements `
      --override "--unattendedmodeui none --mode unattended --superpassword tiendi2025 --enable-components server,commandlinetools --disable-components pgAdmin,stackbuilder"
    Ok "PostgreSQL instalado"
    # refrescar PATH de esta sesión
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}
$pgService = (Get-Service -Name "postgresql*")[0]
if ($pgService.Status -ne "Running") { Start-Service $pgService.Name }
Ok "Servicio $($pgService.Name): $($pgService.Status)"
# crear DB tiendi (idempotente)
$env:PGPASSWORD = "tiendi2025"
$psql = (Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" | Sort-Object FullName -Descending | Select-Object -First 1).FullName
$exists = & $psql -U postgres -h localhost -tAc "SELECT 1 FROM pg_database WHERE datname='tiendi'"
if ($exists -ne "1") { & $psql -U postgres -h localhost -c "CREATE DATABASE tiendi;" }
Ok "Base de datos tiendi lista"

# ---------- 2. Memurai (Redis para Windows) ----------
Step "2. Memurai (Redis)"
$memurai = Get-Service -Name "Memurai*" -ErrorAction SilentlyContinue
if (-not $memurai) {
    winget install --id Memurai.MemuraiDeveloper --silent --accept-package-agreements --accept-source-agreements
    $memurai = Get-Service -Name "Memurai*" -ErrorAction SilentlyContinue
}
if ($memurai -and $memurai.Status -ne "Running") { Start-Service $memurai.Name }
if ($memurai) { Ok "Servicio $($memurai.Name): $($memurai.Status)" }
else { Write-Warning "Memurai no quedó instalado — revisar manualmente"; }

# ---------- 3. API (tiendi-platform-api, puerto 3001) ----------
Step "3. API: secretos + dependencias + migraciones + seed"
$Api = Join-Path $Root "api"
# generar JWT secrets reales (una sola vez)
$envPath = Join-Path $Api ".env"
$envText = Get-Content $envPath -Raw
if ($envText -match "REEMPLAZAR") {
    $j1 = -join ((1..96) | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })
    $j2 = -join ((1..96) | ForEach-Object { "{0:x}" -f (Get-Random -Max 16) })
    $envText = $envText -replace "JWT_SECRET=REEMPLAZAR[^`r`n]*", "JWT_SECRET=$j1"
    $envText = $envText -replace "JWT_REFRESH_SECRET=REEMPLAZAR[^`r`n]*", "JWT_REFRESH_SECRET=$j2"
    Set-Content $envPath $envText -NoNewline
    Ok "JWT secrets generados"
}
Push-Location $Api
npm ci --no-audit --no-fund 2>&1 | Select-Object -Last 1
npx prisma generate 2>&1 | Select-String "Generated"
npx prisma migrate deploy 2>&1 | Select-String "applied|migrations"
npx prisma db seed 2>&1 | Select-Object -Last 2
Pop-Location
Ok "API lista"

# ---------- 4. pm2 + servicios ----------
Step "4. pm2: API + vendor (4201) + admin (4202)"
npm i -g pm2 --silent 2>&1 | Select-Object -Last 1
pm2 delete tiendi-platform-api 2>$null | Out-Null
pm2 delete tiendi-vendor 2>$null | Out-Null
pm2 delete tiendi-admin 2>$null | Out-Null
pm2 start (Join-Path $Api "ecosystem.config.cjs")
pm2 serve (Join-Path $Root "vendor") 4201 --name tiendi-vendor --spa
pm2 serve (Join-Path $Root "admin") 4202 --name tiendi-admin --spa
pm2 save
Ok "pm2 levantó los 3 procesos"

# ---------- 5. Firewall (acceso desde la LAN) ----------
Step "5. Firewall LAN: 3001, 4201, 4202"
foreach ($port in 3001, 4201, 4202) {
    netsh advfirewall firewall add rule name="Tiendi $port" dir=in action=allow protocol=TCP localport=$port | Out-Null
}
Ok "Puertos abiertos en la red local"

# ---------- 6. Verificación ----------
Step "6. Verificación"
Start-Sleep -Seconds 8
pm2 list
foreach ($u in "http://localhost:3001/api/v1", "http://localhost:4201", "http://localhost:4202") {
    try { $c = (Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 10).StatusCode; Ok "$u -> $c" }
    catch { Write-Warning "$u -> $($_.Exception.Message)" }
}

Write-Host "`n=== LISTO ===" -ForegroundColor Yellow
Write-Host "Vendor:  http://localhost:4201   (también desde la LAN: http://$(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like '192.168.1.*' -and $_.InterfaceAlias -like '*Ether*'} | Select-Object -First 1 -ExpandProperty IPAddress):4201)"
Write-Host "Admin:   http://localhost:4202"
Write-Host "API:     http://localhost:3001/api/v1"
Write-Host ""
Write-Host "Tras un REINICIO de Windows, correr:  pm2 resurrect"
