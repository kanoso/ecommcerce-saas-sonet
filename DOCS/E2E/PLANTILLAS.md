# Plantillas de casos y ejecuciones

## Ficha del caso

[Volver al plan general](../PLAN-PRUEBAS-E2E.md)

Copiar esta ficha para cada escenario nuevo y completar sus campos.

#### ID del caso — Nombre del escenario

- Objetivo:
- Prioridad:
- Actores y roles:
- Aplicaciones y servicios:
- Alcance: smoke UI / UI con mocks / integración API / E2E integrado.
- Estado de implementación: disponible / parcial / pendiente; indicar evidencia.
- Precondiciones y configuración:
- Datos iniciales: usuarios, tienda/negocio, cuentas, productos, stock y saldos aplicables.
- Servicios reales o simulados:

| Paso | Actor / aplicación | Acción | Resultado esperado | Evidencia |
|---|---|---|---|---|
| 1 | | | | |

##### Verificaciones finales
- Interfaz:
- Persistencia y estados:
- Efecto financiero: saldo inicial → movimiento → saldo final.
- Ausencia de efectos indebidos:
- IDs correlacionados:
- Condición y plazo de espera de procesos asíncronos:
- Limpieza/restablecimiento de datos:
- Referencias de negocio y código:

## Registro de ejecución

Copiar este registro para cada ejecución, sin sobrescribir resultados anteriores.

#### ID de ejecución — ID y versión del caso

- Fecha/hora y zona horaria:
- Responsable:
- Entorno y versiones/commits de cada aplicación y API participante:
- Dispositivo/navegador:
- Datos preparados e IDs generados:
- Configuración relevante y servicios simulados (sin secretos):
- Resultado: no ejecutado / aprobado / fallido / bloqueado / omitido.

| Paso o comprobación | Esperado | Obtenido | Resultado | Evidencia |
|---|---|---|---|---|
| | | | | |

- Controles omitidos y motivo:
- Incidencias vinculadas:
- Limpieza realizada:
- Próximo paso:

Capturar evidencia sanitizada: screenshots, respuestas de API, consultas de lectura y logs correlacionados. No guardar contraseñas, tokens, datos bancarios completos ni información personal de clientes reales.


Para un caso nuevo, usar CASOS/ID.md y enlazarlo en el catálogo general. Guardar cada ejecución en EJECUCIONES/ID-EJECUCION.md y vincular la versión/commit del caso. No sustituir el historial por la última ejecución.
