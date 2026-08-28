# Guía: Preparar una PC nueva con Windows para publicar ecommcerce-saas-sonet

> Documento para configurar desde cero una PC de publicación/despliegue en la red local.
> Aplica a Windows 10/11 con discos **C:** (sistema y herramientas) y **D:** (proyectos y datos).

---

## 1. Visión general del stack

| Componente | Tecnología | Dónde corre |
|---|---|---|
| Backend API | NestJS + Prisma | Node.js (host) |
| Base de datos | PostgreSQL 15 | Docker |
| Cache / colas | Redis 7 | Docker |
| Monitoreo | Prometheus + Grafana + Loki | Docker |
| Frontends (`tiendi-web`, `tiendi-admin`, `tiendi-vendor`, `tiendi-go`) | Angular 21 | Node.js (host) |

> Diagrama interactivo: [`diagramas/arquitectura-stack.html`](diagramas/arquitectura-stack.html)

> [!NOTE]
> No se necesita .NET, Java ni ningún otro runtime: todo el backend es Node y toda la infraestructura va en Docker.

---

## 2. Requisitos previos

| Herramienta | Versión mínima | Para qué |
|---|---|---|
| Git | última estable | clonar repo + submódulos |
| Node.js | **20.19+** (recomendado **22 LTS**) | API y frontends |
| npm | 10+ | incluido con Node |
| Docker Desktop | última estable | Postgres, Redis, monitoreo |

### Instalación con `winget` (PowerShell como administrador)

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Docker.DockerDesktop
```

> [!IMPORTANT]
> Después de instalar Docker Desktop hay que **reiniciar** la PC y abrir Docker Desktop al menos una vez para que el daemon quede corriendo. Verificar con:

```powershell
git --version      # git version 2.x
node --version     # v22.x
docker info        # no debe dar error
```

### Distribución en disco

| Unidad | Contenido |
|---|---|
| **C:** | Herramientas (Git, Node, Docker Desktop) — instalación por defecto |
| **D:** | Proyectos y volúmenes de datos: `D:\Proyectos\ecommcerce-saas-sonet` |

> [!TIP]
> Si los datos de Docker (imágenes/volúmenes) quedan pesados en C:, se pueden mover desde
> **Docker Desktop → Settings → Resources → Disk image location** apuntándolo a `D:\docker-data`.

---

## 3. Obtener el código

```powershell
# crear carpeta de proyectos en D:
New-Item -ItemType Directory -Path "D:\Proyectos" -Force

# clonar con todos los submódulos
git clone --recurse-submodules https://github.com/kanoso/ecommcerce-saas-sonet.git D:\Proyectos\ecommcerce-saas-sonet

# si el repo ya existía, actualizarlo:
git -C D:\Proyectos\ecommcerce-saas-sonet pull --ff-only
git -C D:\Proyectos\ecommcerce-saas-sonet submodule update --init --recursive
```

Estructura de submódulos:

```text
ecommcerce-saas-sonet/
├── FUENTES/
│   ├── tiendi-api/      ← NestJS API + docker-compose.yml
│   ├── tiendi-web/      ← tienda (Angular)
│   ├── tiendi-admin/
│   ├── tiendi-vendor/
│   └── tiendi-go/
├── DOCS/
└── setup-publicacion.ps1  ← script automático de setup
```

---

## 4. Setup automático con el script

El script `setup-publicacion.ps1` (raíz del repo) automatiza todo:

1. Verifica Git, Node ≥ 20 y Docker daemon
2. Clona o actualiza repo + submódulos
3. Levanta infraestructura (`docker compose`)
4. Instala dependencias (`npm ci`) en los **5** proyectos Node (incluye `tiendi-web`)
5. Crea `.env` desde `.env.example` si no existe
6. Genera el cliente de Prisma (`prisma generate`)
7. Aplica migraciones de Prisma (`prisma migrate deploy`)

```powershell
cd D:\Proyectos\ecommcerce-saas-sonet   # o donde esté el script

# setup completo con datos de prueba:
.\setup-publicacion.ps1 -RepoDir D:\Proyectos\ecommcerce-saas-sonet -SeedData

# sin seed:
.\setup-publicacion.ps1 -RepoDir D:\Proyectos\ecommcerce-saas-sonet
```

> [!WARNING]
> Si PowerShell bloquea el script con "execución de scripts deshabilitada":
>
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```

> [!NOTE]
> No abrir el `.ps1` con doble click desde el Explorador: eso lo abre en el editor.
> Ejecutarlo siempre desde una terminal PowerShell con `.\setup-publicacion.ps1`.

El script es **idempotente**: si el repo ya existe hace `pull --ff-only` y continúa.

---

## 5. Flujo del proceso

1. **Prerequisitos**: Git, Node ≥ 20.19, Docker daemon respondiendo
2. **Código**: clone/pull del repo padre + `submodule update --init --recursive`
3. **Infraestructura**: `docker compose up -d` (Postgres, Redis, Prometheus, Loki, Grafana)
4. **Dependencias**: `npm ci` en los 5 proyectos de `FUENTES/`
5. **Base de datos**: `.env` (si falta), `prisma generate`, `prisma migrate deploy`, seed opcional

> Diagrama interactivo: [`diagramas/flujo-setup.html`](diagramas/flujo-setup.html)

---

## 5b. Cómo levantar la aplicación

La infraestructura corre en Docker; los procesos Node corren en el host:

```powershell
cd D:\Proyectos\ecommcerce-saas-sonet\FUENTES

# API (NestJS) — terminal propia
npm --prefix tiendi-api run start:dev

# Frontends (Angular) — una terminal por cada uno
npm --prefix tiendi-web  start
npm --prefix tiendi-admin start
npm --prefix tiendi-vendor start
npm --prefix tiendi-go    start
```

Los frontends usan Angular CLI (`ng serve`), puerto por defecto **4200**.
Si se levantan varios a la vez, separarlos con `-- --port <puerto>`,
ej.: `npm --prefix tiendi-admin start -- --port 4201`.

Verificar que los contenedores estén *healthy* antes de arrancar la API:

```powershell
docker compose -f FUENTES\tiendi-api\docker-compose.yml ps
```

---

## 6. Servicios y puertos (docker-compose)

| Servicio | Puerto host | Credenciales |
|---|---|---|
| PostgreSQL 15 | `5432` | `postgres` / `postgres`, db: `tiendi` |
| Redis 7 | `6379` | sin auth |
| Prometheus | `9090` | — |
| Loki | `3100` | — |
| Grafana | `3001` | `admin` / `admin` |

Comandos útiles de infra:

```powershell
# estado
docker compose -f FUENTES\tiendi-api\docker-compose.yml ps

# logs de un servicio
docker compose -f FUENTES\tiendi-api\docker-compose.yml logs -f postgres

# bajar / subir todo
docker compose -f FUENTES\tiendi-api\docker-compose.yml down
docker compose -f FUENTES\tiendi-api\docker-compose.yml up -d
```

---

## 7. Publicar cambios en esta PC (flujo diario)

Desde la PC de desarrollo (o esta misma PC si desarrollás aquí):

```powershell
cd D:\Proyectos\ecommcerce-saas-sonet

# 1. Commitear primero en los SUBMÓDULOS que cambiaron
git -C FUENTES\tiendi-web add <archivos>
git -C FUENTES\tiendi-web commit -m "feat(scope): mensaje"

# 2. PUSH de los submódulos ANTES que el padre
git -C FUENTES\tiendi-web push

# 3. Después: commitear y pushear el padre (bump del puntero del submódulo)
git add FUENTES\tiendi-web
git commit -m "chore(submódulos): bump tiendi-web"
git push
```

> [!IMPORTANT]
> El orden es estricto: **submódulos primero, repo padre después**.
> Si se pushea el padre primero, queda apuntando a commits que aún no
> existen en el remote de los submódulos.

En la PC de publicación:

```powershell
git -C D:\Proyectos\ecommcerce-saas-sonet pull --ff-only
git -C D:\Proyectos\ecommcerce-saas-sonet submodule update --init --recursive
```

---

## 8. Abrir puertos en el firewall (acceso desde la red local)

El firewall de Windows bloquea por defecto las conexiones entrantes.
Para que otras PCs de la red accedan a los servicios, abrir solo los
puertos necesarios (PowerShell como administrador):

```powershell
# Grafana (monitoreo)
New-NetFirewallRule -DisplayName "tiendi-grafana" -Direction Inbound `
  -Protocol TCP -LocalPort 3001 -Action Allow

# API NestJS (ajustar puerto según .env del backend)
New-NetFirewallRule -DisplayName "tiendi-api" -Direction Inbound `
  -Protocol TCP -LocalPort 3000 -Action Allow

# Frontends Angular si se sirven hacia la red (ej. ng serve --host 0.0.0.0)
New-NetFirewallRule -DisplayName "tiendi-web" -Direction Inbound `
  -Protocol TCP -LocalPort 4200 -Action Allow

# Verificar reglas creadas
Get-NetFirewallRule -DisplayName "tiendi-*"
```

> [!IMPORTANT]
> **No exponer** Postgres (`5432`) ni Redis (`6379`) al resto de la red:
> van sin credenciales fuertes y solo el host local debería hablar con ellos.

---

## 9. Troubleshooting

### Ping no responde pero la PC está encendida

> [!NOTE]
> El firewall de Windows bloquea ICMP por defecto. No es un error: verificar conectividad
> por puerto real (ej. RDP `3389`) con `Test-NetConnection 192.168.1.12 -Port 3389`.

### No se puede copiar/pegar texto por RDP

1. En el cliente RDP: **Mostrar opciones → Recursos locales → Portapapeles** ✓
2. En la PC remota, reiniciar el proceso `rdpclip.exe` desde el Task Manager.

### `npm ci` falla por red corporativa/proxy

```powershell
npm config set registry https://registry.npmjs.org/
```

### Puerto 5432 o 6379 ocupado

Si ya existe un Postgres/Redis local instalado como servicio de Windows, detenerlo o
cambiar el mapeo de puertos en `FUENTES\tiendi-api\docker-compose.yml`.

### Migraciones fallan por conexión a la BD

Verificar que el contenedor esté healthy antes de correr Prisma:

```powershell
docker compose -f FUENTES\tiendi-api\docker-compose.yml ps   # STATUS = healthy
```
