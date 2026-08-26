#Requires -Version 7
<#
.SYNOPSIS
    Prepara una PC para publicar/desplegar ecommcerce-saas-sonet.
.DESCRIPTION
    Verifica prerequisitos (Git, Docker, Node), clona/actualiza el repo con
    submódulos, levanta la infraestructura (Postgres, Redis, monitoreo) e
    instala dependencias de todos los proyectos.
.EXAMPLE
    .\setup-publicacion.ps1 -RepoDir C:\Proyectos\ecommcerce-saas-sonet
#>
param(
    [string]$RepoDir = "C:\Proyectos\ecommcerce-saas-sonet",
    [switch]$SeedData,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$repoUrl = "https://github.com/kanoso/ecommcerce-saas-sonet.git"
$submodules = @("tiendi-api", "tiendi-vendor", "tiendi-admin", "tiendi-go")

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    [OK] $msg" -ForegroundColor Green }

# ---------- 1. Prerequisitos ----------
Step "Verificando prerequisitos"

try { $gitVer = git --version } catch { throw "Git no está instalado. Instalá: winget install Git.Git" }
Ok $gitVer

try { $nodeVer = node --version } catch { throw "Node.js no está instalado. Instalá LTS 22: winget install OpenJS.NodeJS.LTS" }
$nodeMajor = [int]($nodeVer -replace 'v(\d+)\..*', '$1')
if ($nodeMajor -lt 20) { throw "Node $nodeVer es muy viejo. Angular 21 requiere Node 20.19+ o 22 LTS." }
Ok "Node.js $nodeVer"

try { $dockerVer = docker --version } catch { throw "Docker no está instalado. Instalá: winget install Docker.DockerDesktop" }
Ok $dockerVer
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw "Docker está instalado pero no responde. Abrí Docker Desktop y esperá a que arranque." }
Ok "Docker daemon corriendo"

# ---------- 2. Clonar o actualizar ----------
if (Test-Path "$RepoDir\.git") {
    Step "Actualizando repo existente en $RepoDir"
    git -C $RepoDir pull --ff-only
} else {
    Step "Clonando repo en $RepoDir"
    New-Item -ItemType Directory -Path (Split-Path $RepoDir) -Force | Out-Null
    git clone --recurse-submodules $repoUrl $RepoDir
}
git -C $RepoDir submodule update --init --recursive
Ok "Submódulos sincronizados"

$fuentes = Join-Path $RepoDir "FUENTES"

# ---------- 3. Infraestructura ----------
Step "Levantando infraestructura (Postgres, Redis, Prometheus, Loki, Grafana)"
docker compose -f (Join-Path $fuentes "tiendi-api\docker-compose.yml") up -d
docker compose -f (Join-Path $fuentes "tiendi-api\docker-compose.yml") ps
Ok "Infraestructura arriba"

# ---------- 4. Dependencias ----------
foreach ($mod in $submodules) {
    Step "Instalando dependencias de $mod"
    Push-Location (Join-Path $fuentes $mod)
    try {
        npm ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci falló en $mod" }
        Ok "$mod listo"
    } finally { Pop-Location }
}

# ---------- 5. Base de datos ----------
if (-not $SkipBuild) {
    Step "Aplicando migraciones de Prisma"
    Push-Location (Join-Path $fuentes "tiendi-api")
    try {
        npx prisma migrate deploy
        if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy falló" }
        Ok "Migraciones aplicadas"

        if ($SeedData) {
            Step "Cargando datos seed"
            npm run seed
            Ok "Seed cargado"
        }
    } finally { Pop-Location }
}

# ---------- Resumen ----------
Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host " Setup completado en $RepoDir" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host " Servicios:"
Write-Host "   API      : npm run start:dev  (en FUENTES\tiendi-api)"
Write-Host "   Postgres : localhost:5432 (postgres/postgres, db: tiendi)"
Write-Host "   Redis    : localhost:6379"
Write-Host "   Grafana  : http://localhost:3001 (admin/admin)"
