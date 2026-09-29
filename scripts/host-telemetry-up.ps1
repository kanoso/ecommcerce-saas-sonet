# Levanta el stack de telemetria en TEST (loki con config + collector + grafana provisioning).
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path "$env:TEMP\dockercfg" | Out-Null
Set-Content "$env:TEMP\dockercfg\config.json" -Value '{"auths":{}}'
$env:DOCKER_CONFIG = "$env:TEMP\dockercfg"
Set-Location 'D:\Proyectos\ecommcerce-saas-sonet\FUENTES\tiendi-api'
docker compose -f docker-compose.yml -f docker-compose.telemetry.yml up -d loki otel-collector grafana
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
