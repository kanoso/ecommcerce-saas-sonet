# Tiendi — PostgreSQL Backup & Disaster Recovery Guide

Guía de configuración, operación y recuperación ante desastres para la base de datos PostgreSQL de **Tiendi**.

---

## 1. Arquitectura de Backups

El sistema cuenta con dos mecanismos complementarios:

1. **Servicio Contenerizado (`postgres-backup`)**: servicio en `docker-compose.yml` basado en `prodrigestivill/postgres-backup-local:15-alpine`. Realiza volcados periódicos automáticos, compresión gzip y rotación por antigüedad sin necesidad de configurar cron en el host.
2. **Scripts CLI Standalone (`scripts/backup-postgres.*` y `scripts/restore-postgres.*`)**: utilitarios en Bash (POSIX) y PowerShell para ejecución manual, automatización vía crontab del host o pipelines de mantenimiento.

---

## 2. Configuración en Docker Compose

En `FUENTES/tiendi-api/docker-compose.yml`:

```yaml
  postgres-backup:
    image: prodrigestivill/postgres-backup-local:15-alpine
    container_name: tiendi-postgres-backup
    restart: unless-stopped
    environment:
      - POSTGRES_HOST=postgres
      - POSTGRES_DB=tiendi
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - SCHEDULE=0 2 * * *       # Todos los días a las 02:00 AM UTC
      - BACKUP_KEEP_DAYS=7       # Retener 7 backups diarios
      - BACKUP_KEEP_WEEKS=4      # Retener 4 backups semanales
      - BACKUP_KEEP_MONTHS=6     # Retener 6 backups mensuales
      - HEALTHCHECK_PORT=80
    volumes:
      - postgres_backups:/backups
    depends_on:
      postgres:
        condition: service_healthy
```

### Operaciones con el contenedor

- **Disparar un backup manual inmediato**:
  ```bash
  docker exec -it tiendi-postgres-backup backup
  ```

- **Listar backups existentes**:
  ```bash
  docker exec -it tiendi-postgres-backup ls -lh /backups
  ```

- **Restaurar un backup desde el contenedor**:
  ```bash
  docker exec -it tiendi-postgres-backup /restore.sh /backups/tiendi-YYYYMMDD-HHMMSS.sql.gz
  ```

---

## 3. Scripts Standalone (Host / Cron)

### Variables de entorno soportadas

| Variable | Default | Descripción |
|---|---|---|
| `POSTGRES_HOST` | `localhost` | Host de PostgreSQL |
| `POSTGRES_PORT` | `5432` | Puerto de conexión |
| `POSTGRES_DB` | `tiendi` | Nombre de base de datos |
| `POSTGRES_USER` | `postgres` | Usuario administrador |
| `POSTGRES_PASSWORD` | `postgres` | Contraseña |
| `BACKUP_DIR` | `./backups` | Carpeta de destino |
| `RETENTION_DAYS` | `7` | Días antes de podar backups viejos |

### Ejecución en Linux / macOS

```bash
# Backup manual
./scripts/backup-postgres.sh

# O mediante npm:
npm run db:backup

# Restauración manual
./scripts/restore-postgres.sh ./backups/tiendi_20260929_030000.sql.gz
```

### Ejecución en Windows (PowerShell)

```powershell
# Backup manual
.\scripts\backup-postgres.ps1

# Restauración manual
.\scripts\restore-postgres.ps1 -BackupFile .\backups\tiendi_20260929_030000.sql.gz
```

---

## 4. Verificación de Integridad

Cada backup generado pasa por un control de suma/integridad con `gzip -t` antes de considerarse exitoso. Si el archivo está corrupto o truncado por corte de red, el archivo dañado se elimina y el script termina con código de salida `1`.

---

## 5. Procedimiento de Disaster Recovery

En caso de pérdida o corrupción de datos:

1. **Detener la API** para evitar escrituras concurrentes:
   ```bash
   docker stop tiendi-api
   ```
2. **Seleccionar el backup más reciente y verificado**:
   ```bash
   gzip -t backups/tiendi_YYYYMMDD_HHMMSS.sql.gz
   ```
3. **Ejecutar la restauración**:
   ```bash
   ./scripts/restore-postgres.sh backups/tiendi_YYYYMMDD_HHMMSS.sql.gz --force
   ```
4. **Validar la consistencia de datos**:
   ```bash
   docker exec -it tiendi-postgres psql -U postgres -d tiendi -c "SELECT count(*) FROM \"Store\"; SELECT count(*) FROM \"Order\";"
   ```
5. **Reiniciar la API**:
   ```bash
   docker start tiendi-api
   ```
