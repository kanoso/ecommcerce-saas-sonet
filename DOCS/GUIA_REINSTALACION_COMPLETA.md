# Guía: Reinstalación completa del stack Tiendi + tiendi-kipu desde cero

> Documento para levantar **todo** el ecosistema en una PC Windows desde cero:
> tiendi-api, tiendi-vendor, tiendi-admin, tiendi-web, tiendi-go y tiendi-kipu.
> Incluye las trampas encontradas en la práctica (PowerShell, CORS, Prisma, procesos huérfanos).
>
> Complementa a [`GUIA_SETUP_PC_NUEVA.md`](GUIA_SETUP_PC_NUEVA.md) (setup de publicación);
> esta guía agrega el entorno de desarrollo completo con tiendi-kipu.

---

## Quick path (resumen ejecutable)

1. Instalar herramientas: Git, Node 22 LTS, Docker Desktop → reiniciar
2. Clonar repo + submódulos + tiendi-kipu
3. Levantar Docker: `postgres` y `redis`
4. Configurar `.env` de tiendi-api (**PORT=4000**) y kipu-api
5. `npm install` en los 6 proyectos
6. Prisma: `generate` → `migrate` → `seed` (en tiendi-api y kipu-api)
7. Lanzar servicios **vía `cmd`** (no PowerShell directo — ver §Trampas)
8. Verificar con la tabla de puertos y logins de §Verificación

---

## 1. Requisitos e instalación de herramientas

| Herramienta | Versión | Nota |
|---|---|---|
| Git | última estable | clonar repo + submódulos |
| Node.js | **22 LTS** (funciona con 24) | kipu exige ≥22 (`@capacitor/cli` v8 aborta con Node 20) |
| npm | 10+ | incluido con Node |
| Docker Desktop | última estable | Postgres, Redis |
| Android Studio / JDK 21 | opcional | solo para compilar APK de tiendi-go o kipu |

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Docker.DockerDesktop
```

> [!IMPORTANT]
> Tras instalar Docker Desktop: **reiniciar la PC** y abrir Docker Desktop una vez
> para que el daemon quede corriendo. Verificar con `docker info`.

> [!WARNING]
> **PowerShell 5.1 bloquea `npm.ps1`** por política de ejecución. Los servicios
> Node deben lanzarse con `cmd /c ...` (o `cmd /k` para ventana interactiva),
> **nunca** `powershell -Command "npm start"`. Los `ng serve`/`nest start`
> lanzados vía PowerShell quedan colgados sin escuchar puerto.

---

## 2. Obtener el código

```powershell
New-Item -ItemType Directory -Path "D:\Proyectos" -Force

# repo padre con submódulos (tiendi-api, web, admin, vendor, go)
git clone --recurse-submodules https://github.com/kanoso/ecommcerce-saas-sonet.git D:\Proyectos\ecommcerce-saas-sonet

# tiendi-kipu NO es submódulo: clonarlo aparte
git clone https://github.com/kanoso/tiendi-kipu.git D:\Proyectos\ecommcerce-saas-sonet\FUENTES\tiendi-kipu
```

Verificar que cada repo quede en `master` apuntando a `origin/master`
(no en detached HEAD):

```powershell
foreach ($r in 'tiendi-api','tiendi-go','tiendi-vendor','tiendi-admin','tiendi-web','tiendi-kipu') {
  git -C "D:\Proyectos\ecommcerce-saas-sonet\FUENTES\$r" checkout master
  git -C "D:\Proyectos\ecommcerce-saas-sonet\FUENTES\$r" pull --ff-only
}
```

---

## 3. Infraestructura (Docker)

Solo se necesitan **postgres y redis** para desarrollo. Prometheus/Loki/Grafana
son el stack de monitoreo (opcional; Grafana ocupa 3001).

```powershell
cd D:\Proyectos\ecommcerce-saas-sonet\FUENTES\tiendi-api
docker compose up -d postgres redis
docker compose ps   # esperar STATUS = healthy
```

| Servicio | Puerto | Credenciales |
|---|---|---|
| PostgreSQL 15 | 5432 | `postgres` / `postgres`, db: `tiendi` |
| Redis 7 | 6379 | sin auth |

---

## 4. Configuración de `.env`

### 4a. tiendi-api (`FUENTES\tiendi-api\.env`)

Crear desde `.env.example`. **Valores críticos:**

```ini
# Los paneles Angular en dev apuntan a http://localhost:4000 (ver sus
# src/environments/environment.ts). NO usar 3000: choca con kipu-api.
PORT=4000
API_PREFIX=api/v1

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tiendi
REDIS_HOST=localhost
REDIS_PORT=6379

# Generar secrets reales de >=32 chars (no dejar los de ejemplo)
JWT_SECRET=<random-32+>
JWT_REFRESH_SECRET=<random-32+>

# CORS: listar TODOS los orígenes de los paneles, en variantes
# localhost Y 127.0.0.1 (el navegador puede abrir por cualquiera)
FRONTEND_URL=http://localhost:4200,http://localhost:4201,http://localhost:4202,http://127.0.0.1:4200,http://127.0.0.1:4201,http://127.0.0.1:4202

GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback

# Puente kipu: vacío = deshabilitado (deny-by-default)
KIPU_URL=
KIPU_SERVICE_TOKEN=
```

> [!IMPORTANT]
> `PORT=4000` es la decisión clave. En la VM de producción el API corre en 3001
> y el `.env` del repo llegó a quedar en 3000; pero en dev los tres paneles
> Angular esperan `localhost:4000`. Un API en puerto equivocado no da error de
> compilación: los paneles simplemente no conectan.

### 4b. kipu-api (`FUENTES\tiendi-kipu\api\.env`)

No hay `.env.example` commiteado — plantilla completa:

```ini
DATABASE_URL="file:./dev.db"
JWT_SECRET="<random-32+>"
JWT_EXPIRES_IN="7d"
SEED_USERNAME="admin"
SEED_PASSWORD="changeme123"
PORT=3000
PURGE_DAYS=90
PURGE_ENABLED=true
# Puente hacia tiendi: vacío = deshabilitado
TIENDI_SERVICE_TOKEN=""
```

Kipu usa **SQLite en archivo**: no necesita Docker ni Postgres.
El CORS de kipu-api (ver `api/src/main.ts`) lee `FRONTEND_URL` si está
definida; si no, usa el default que ya incluye `localhost` y `127.0.0.1`
en puertos 4200/4300.

---

## 5. Dependencias y base de datos

```powershell
# Dependencias (6 proyectos)
foreach ($p in 'tiendi-api','tiendi-vendor','tiendi-admin','tiendi-web','tiendi-go','tiendi-kipu\api','tiendi-kipu\web') {
  npm --prefix "D:\Proyectos\ecommcerce-saas-sonet\FUENTES\$p" install
}
```

### tiendi-api (PostgreSQL)

```powershell
cd D:\Proyectos\ecommcerce-saas-sonet\FUENTES\tiendi-api
npx prisma generate          # REQUERIDO si hubo migraciones nuevas
npx prisma migrate deploy
npx prisma db seed           # crea usuarios de prueba
```

> [!WARNING]
> `prisma migrate deploy` **NO regenera el client**. Si el pull trajo
> migraciones con modelos nuevos, el boot del API falla con
> `TS2339: Property 'xxx' does not exist on type 'PrismaService'`.
> Solución: `npx prisma generate` y relanzar.

### kipu-api (SQLite)

```powershell
cd D:\Proyectos\ecommcerce-saas-sonet\FUENTES\tiendi-kipu\api
npx prisma migrate dev --name init   # crea el archivo dev.db
npm run seed                          # crea el usuario admin
```

---

## 6. Lanzar los servicios

**Siempre vía `cmd`** (ver trampa de PowerShell en §1). Desde una terminal:

```powershell
$f = "D:\Proyectos\ecommcerce-saas-sonet\FUENTES"

# tiendi API (watch) — log a archivo para diagnosticar
Start-Process cmd -ArgumentList '/c','npx nest start --watch > boot-log.txt 2>&1' -WorkingDirectory "$f\tiendi-api" -WindowStyle Minimized

# Paneles Angular
Start-Process cmd -ArgumentList '/k','npm start' -WorkingDirectory "$f\tiendi-vendor" -WindowStyle Minimized   # :4201
Start-Process cmd -ArgumentList '/k','npm start' -WorkingDirectory "$f\tiendi-admin" -WindowStyle Minimized   # :4202
Start-Process cmd -ArgumentList '/k','npm start' -WorkingDirectory "$f\tiendi-web"   -WindowStyle Minimized   # :4200

# App móvil (Expo) — Metro en :8081
Start-Process cmd -ArgumentList '/k','npx expo start' -WorkingDirectory "$f\tiendi-go" -WindowStyle Minimized

# kipu API y PWA
Start-Process cmd -ArgumentList '/c','npm run start:dev > kipu-api-log.txt 2>&1' -WorkingDirectory "$f\tiendi-kipu\api" -WindowStyle Minimized
Start-Process cmd -ArgumentList '/c','npx ng serve --port 4300 > kipu-web-log.txt 2>&1' -WorkingDirectory "$f\tiendi-kipu\web" -WindowStyle Minimized
```

> [!IMPORTANT]
> La web de kipu **debe** ir con `--port 4300`: `ng serve` sin puerto usa 4200,
> que ya ocupa tiendi-web. No hay puerto definido en su `angular.json`.

Los primeros builds de Angular tardan **2–5 minutos** (más si la PC está
cargada). Verificar con `netstat -ano | findstr LISTENING` antes de asumir fallo.

---

## 7. Servicios y puertos (referencia completa)

| Servicio | URL | Repo | Notas |
|---|---|---|---|
| tiendi API | http://localhost:4000/api/v1 | tiendi-api | NestJS + Prisma |
| Vendor panel | http://localhost:4201 | tiendi-vendor | Angular dev |
| Admin back-office | http://localhost:4202 | tiendi-admin | Angular dev |
| Tienda web | http://localhost:4200 | tiendi-web | Angular SSR dev |
| App móvil (Metro) | exp://localhost:8081 | tiendi-go | Expo/React Native |
| kipu API | http://localhost:3000 | tiendi-kipu/api | sin prefijo `/api` |
| kipu PWA | http://localhost:4300 | tiendi-kipu/web | PWA offline-first |
| PostgreSQL | localhost:5432 | Docker | db `tiendi` |
| Redis | localhost:6379 | Docker | colas BullMQ |

---

## 8. Credenciales de prueba

| App | Usuario | Contraseña | Rol |
|---|---|---|---|
| tiendi (vendor/admin) | `admin@tiendi.app` | `Admin2024!` | SUPER_ADMIN |
| tiendi usuarios test | `juan@tiendi.app`, `rosa@tiendi.app`, `pedro@tiendi.app`, `cliente@tiendi.app`, etc. | `Test123!` | cajero/depósito/rider/cliente |
| kipu | `admin` | `changeme123` | único usuario (config en `api/.env`) |

> [!NOTE]
> `superadmin@tiendi.pe` existe solo en la base de la **VM de producción**,
> no la crea el seed local. El seed local crea `admin@tiendi.app`.

---

## 9. Verificación post-instalación

```powershell
# 1. Puertos escuchando (4200, 4201, 4202, 4300, 4000, 3000, 8081)
netstat -ano | findstr "LISTENING" | findstr ":42 :43 :3000 :4000 :8081"

# 2. HTTP de cada panel
foreach ($u in 'http://localhost:4200','http://localhost:4201','http://localhost:4202','http://localhost:4300') {
  (Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 10).StatusCode
}

# 3. Logins (server-side)
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"admin@tiendi.app","password":"Admin2024!"}'
Invoke-RestMethod -Uri "http://localhost:3000/auth/login" -Method Post -ContentType "application/json" -Body '{"username":"admin","password":"changeme123"}'

# 4. CORS preflight (debe devolver el Origin en Access-Control-Allow-Origin)
Invoke-WebRequest "http://localhost:4000/api/v1/auth/login" -Method Options `
  -Headers @{Origin='http://localhost:4201'; 'Access-Control-Request-Method'='POST'}
```

**Login en el navegador falla pero el API responde OK** → es CORS. Verificar
que el origen exacto de la barra de direcciones (¿`localhost` o `127.0.0.1`?)
esté en `FRONTEND_URL` del API correspondiente. Ojo: kipu muestra
"Usuario o contraseña incorrectos" para **cualquier** error, incluidos los de
red — no confiar en el mensaje, revisar la pestaña Network de DevTools.

---

## 10. Trampas conocidas (leídas de dolores reales)

| # | Trampa | Síntoma | Solución |
|---|---|---|---|
| 1 | PowerShell 5.1 bloquea `npm.ps1` | servicios lanzados que nunca escuchan puerto | lanzar vía `cmd /c` o `cmd /k` |
| 2 | `migrate deploy` sin `prisma generate` | `TS2339` al boot del API | `npx prisma generate` |
| 3 | `.env` con PORT=3000 | paneles no conectan al API | `PORT=4000` en tiendi-api |
| 4 | CORS sin `127.0.0.1` | login falla solo si se abre por `127.0.0.1` | agregar ambas variantes a `FRONTEND_URL` |
| 5 | `ng serve` de kipu sin puerto | choca con tiendi-web en 4200 | `--port 4300` |
| 6 | Proceso node huérfano | CPU al 100%, builds eternos | `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` → revisar CommandLine → `taskkill /PID <pid> /T /F` |
| 7 | `npm install` sobre Node actualizado | bindings nativos (`.node`) inválidos | `npm ci` (borra node_modules) |
| 8 | Repos en detached HEAD tras setup | pull no trae cambios, pusheos pierden commits | `git checkout master && git pull --ff-only` |
| 9 | Grafana ocupa 3001 | no arranca otro servicio en 3001 | para dev: `docker compose up -d postgres redis` solamente |

---

## 11. Rutina después de reiniciar Windows

```powershell
# 1. Docker Desktop arranca solo si está en inicio automático; verificar:
docker start tiendi-postgres tiendi-redis

# 2. Relanzar los 7 servicios (§6)
```

Los procesos Node no sobreviven al reinicio. Docker sí (con auto-start),
pero los contenedores pueden quedar detenidos.

---

## 12. Firewall (acceso desde la red local)

```powershell
New-NetFirewallRule -DisplayName "tiendi-vendor" -Direction Inbound -Protocol TCP -LocalPort 4201 -Action Allow
New-NetFirewallRule -DisplayName "tiendi-admin" -Direction Inbound -Protocol TCP -LocalPort 4202 -Action Allow
New-NetFirewallRule -DisplayName "tiendi-api"   -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow
```

> [!WARNING]
> **No exponer** Postgres (5432) ni Redis (6379) a la red. Si se accede desde
> otra PC por `http://192.168.1.x:4201`, recordar que el API también debe
> aceptar ese origen en CORS (`FRONTEND_URL`).

---

## 13. Checklist final

- [ ] `docker compose ps` muestra postgres y redis *healthy*
- [ ] Los 7 servicios escuchan sus puertos (tabla §7)
- [ ] Login OK en vendor/admin (`admin@tiendi.app` / `Admin2024!`)
- [ ] Login OK en kipu (`admin` / `changeme123`)
- [ ] CORS preflight devuelve el Origin correcto en ambas APIs
- [ ] tiendi-go compila y Metro corre (probar QR con Expo Go si hay dispositivo)
- [ ] Sin procesos node con CPU sostenida >30% fuera de builds activos

---

## Next step

Para el flujo diario de publicación de cambios (orden de push submódulos,
deploy a VM), ver [`GUIA_SETUP_PC_NUEVA.md`](GUIA_SETUP_PC_NUEVA.md) §7.
Para el puente de liquidaciones tiendi→kipu, ver [`INTEGRACION-TIENDI.md`](INTEGRACION-TIENDI.md).
