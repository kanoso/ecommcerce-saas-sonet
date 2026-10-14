# Servidor TEST actual

Actualizado: 2026-10-14. Fuente: confirmación directa del usuario.

| Dato | Valor |
|---|---|
| Entorno | TEST |
| Sistema operativo | Ubuntu |
| IP local | `192.168.1.51` |
| Usuario SSH | `tiendi-admin` |
| Acceso verificado | Llave local `~/.ssh/tiendi-test/id_rsa` |
| Hostname | `tiendi-server` |
| Aplicaciones | Docker Compose en `/opt/tiendi/docker-compose.yml` |
| Fuentes / estáticos | `/opt/tiendi/src` / `/opt/tiendi/static` |
| Despliegue | `/opt/tiendi/scripts/deploy-app.sh` (bloqueo, respaldo, build y health checks) |
| Secretos | OpenBao; el usuario confirma que allí están las credenciales |
| Comandos con secretos de runtime | `/opt/tiendi/scripts/runtime-job.py` |

Esta información sustituye las referencias históricas al servidor Windows en `192.168.1.37`. Los documentos de rollout y OpenBao describen ese entorno anterior; la guía de CI/CD contiene información histórica y evidencia posterior de Ubuntu en su apartado 13. Revalidar la configuración efectiva antes de operar.

Antes de desplegar, verificar acceso, procesos, directorios, configuración y respaldo de la base de datos en Ubuntu. No ejecutar los scripts Windows de `FUENTES/deploy-pc` sobre este servidor.

Acceso SSH y rutas comprobados el 2026-10-14. El archivo `~/.ssh/tiendi-test` es un directorio; la llave está dentro, en `id_rsa`. No imprimir llaves, tokens, credenciales ni respuestas completas de OpenBao. El helper histórico `scripts/ssh-host.ps1` apunta a la IP anterior y no corresponde al servidor actual.

La migración de apariencia `20261014000000_store_appearance_palette` y el despliegue de API, Vendor y Web se completaron el 2026-10-14. Ver [evidencia de publicación](WEB-VENDOR/APARIENCIA-PALETAS.md).
