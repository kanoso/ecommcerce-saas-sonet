# Relevamiento de Tareas y Pendientes en Documentación (DOCS)

> **Fecha de análisis:** 2026-10-01  
> **Criterio de orden:** Cronológico descendente (desde el documento más reciente al más antiguo).  
> **Total de documentos analizados:** 44 archivos Markdown en `DOCS/`.

---

## 1. Resumen Ejecutivo por Estado

| Documento | Última Modif. | Pendientes Críticos / Checklists |
|---|---|---|
| [`PLAN-MODULO-CENTRAL-NOTIFICACIONES.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/PLAN-MODULO-CENTRAL-NOTIFICACIONES.md) | 2026-10-01 | Despliegue TEST/PROD, APK Kipu push, Fases 6 (Campañas), 7 (Purgas R1–R7) y 8 (Extracción). |
| [`DISENO-TECNICO-CALENDARIO-CUOTAS-KIPU.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/DISENO-TECNICO-CALENDARIO-CUOTAS-KIPU.md) | 2026-09-30 | Diseño completado; implementación archivada en SDD `kipu-cuotas-calendario` (commit `1dfd371`). |
| [`DECISIONES-CALENDARIO-CUOTAS-KIPU.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/DECISIONES-CALENDARIO-CUOTAS-KIPU.md) | 2026-09-30 | Decisiones C1–C7 cerradas. Reglas de reversión multi-préstamo documentadas. |
| [`OPENTELEMETRY_T6_ROLLOUT.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/OPENTELEMETRY_T6_ROLLOUT.md) | 2026-09-29 | Deploy tiendi-kipu con variables de notificación en host, ajuste de falso positivo en redactor de fechas ISO, redeploy de browsers en TEST con flags de commit, rotación de SSH. |
| [`NOTIFICACIONES.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/NOTIFICACIONES.md) | 2026-09-28 | Documento de diseño base (reemplazado por plan central). 27 ítems completados. |
| [`OPENTELEMETRY_T0_INVENTORY.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/OPENTELEMETRY_T0_INVENTORY.md) | 2026-09-26 | Pendientes de verificación en host (`192.168.1.37`), ya resueltos en su mayoría en T6. |
| [`OPENTELEMETRY_IMPLEMENTATION_GUIDE.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/OPENTELEMETRY_IMPLEMENTATION_GUIDE.md) | 2026-09-26 | 10 criterios formales de entrega (informe final de rollout OTel). |
| [`OPENBAO_IMPLEMENTATION_GUIDE.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/OPENBAO_IMPLEMENTATION_GUIDE.md) | 2026-09-25 | 14 pruebas de aceptación obligatorias del unseal, tokens, rotación y canarios. |
| [`TIENDI_ADMIN.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/TIENDI_ADMIN.md) | 2026-09-25 | Fase 7: Pantalla `/admin/finance/ledger` (conciliación Culqi) y `/admin/finance/payouts`. |
| [`TIENDI_SHIELD_DISENO.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/TIENDI_SHIELD_DISENO.md) | 2026-09-24 | 10 criterios de revisión visual, responsive (320px–1440px), accesibilidad y contraste. |
| [`TIENDI_LAUNCHER_IMPLEMENTACION.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/TIENDI_LAUNCHER_IMPLEMENTACION.md) | 2026-09-24 | Checklists de aceptación independientes para E1 (Launcher estático) y E2 (Sesión Shield). |
| [`TIENDI_LAUNCHER.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/TIENDI_LAUNCHER.md) | 2026-09-24 | Contratos de integración E1 y E2 pendientes de firma entre apps. |
| [`PLAN-PRUEBAS-E2E.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/PLAN-PRUEBAS-E2E.md) | 2026-09-20 | Pruebas e2e móviles con Detox y credenciales reales en CI/CD. |
| [`CATALOGO_MAESTRO.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/CATALOGO_MAESTRO.md) | 2026-08-31 | Prueba pendiente en Chrome Android y Safari iOS para captura de código de barras. |
| [`GUIA_REINSTALACION_COMPLETA.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/GUIA_REINSTALACION_COMPLETA.md) | 2026-08-31 | Tareas de endurecimiento en producción (firewall, SSL, backups automatizados). |
| [`INTEGRACION-TIENDI.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/INTEGRACION-TIENDI.md) | 2026-08-29 | Saldo en tiempo real y wallet para comercios (`STORE_PAYABLE`). |
| [`FACTURACION_Y_CONTABILIDAD.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/FACTURACION_Y_CONTABILIDAD.md) | 2026-08-28 | Fase 4: Conciliación bancaria y contra extracto de Culqi. |
| [`FLUJO_DINERO.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/FLUJO_DINERO.md) | 2026-08-28 | Fase 5: Reportes fiscales y comprobantes electrónicos; Fase 6: Recaudador integrado opcional. |
| [`TAREAS.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/TAREAS.md) | 2026-08-28 | 35 endpoints y tareas pendientes del backend original (SendGrid, Google OAuth2, Cloudinary, etc.). |
| [`MODELO_NEGOCIO.md`](file:///G:/PROYECTOS/ecommcerce-saas-sonet/DOCS/MODELO_NEGOCIO.md) | 2026-08-26 | Sección 12: Definición de comisiones de tarjetas, esquemas de delivery y umbrales mínimos. |

---

## 2. Detalle Exhaustivo de Pendientes (Nuevo a Antiguo)

### 2.1. `PLAN-MODULO-CENTRAL-NOTIFICACIONES.md` (2026-10-01)
* **Ops / Infraestructura:**
  - Cargar variables de entorno en servidores **TEST y PROD** (`TIENDI_NOTIFICATIONS_URL/TOKEN`, `ADMIN_ALERT_EMAILS`, credenciales Firebase Kipu) y ejecutar `prisma migrate deploy`.
  - Rotar token de servicio compartido del puente.
  - Revocar la cuenta de servicio duplicada (`d31cef653b`) en la consola de Firebase.
* **Mobile / Validación de Dispositivos:**
  - Compilar APK de Kipu con `google-services.json` de su proyecto propio y validar recepción en foreground, background y arranque en frío.
  - Verificación móvil de `tiendi-go` con registro dual en dispositivo físico.
* **Fases del Plan Pendientes de Desarrollo:**
  - **Fase 6 — Campañas y Alertas Globales:**
    - Pantalla de campañas en Tiendi Admin con título, cuerpo, vista previa y programación.
    - Segmentación por app, grupo autorizado o usuarios específicos.
    - Paginación y ejecución por lotes sin cargar audiencias masivas en memoria.
  - **Fase 7 — Funciones Ampliadas y Operación:**
    - Ejecución de purgas automáticas según políticas de retención R1–R7 (instalaciones inválidas a 7d, logs/solicitudes a 30d, bandejas a 90d).
  - **Fase 8 — Extracción de Servicio:**
    - Separación del módulo a microservicio independiente (`tiendi-notifications`) una vez estabilizado el monolito modular.

---

### 2.2. `DECISIONES-CALENDARIO-CUOTAS-KIPU.md` y `DISENO-TECNICO-CALENDARIO-CUOTAS-KIPU.md` (2026-09-30)
* **Estado:** Las decisiones de producto C1 a C7 quedaron formalmente cerradas y la especificación fue implementada y archivada en `tiendi-kipu` (SDD commit `1dfd371`).
* **Pendientes Operativos de Continuidad:**
  - Validar en uso real la interacción de la reversión multi-préstamo (C4d2b2b2b2b) cuando un cobro con sobrepago aplicado a varios préstamos es anulado o corregido en el cliente móvil.

---

### 2.3. `OPENTELEMETRY_T6_ROLLOUT.md` (2026-09-29)
* **Tareas de Host y Despliegue:**
  - Desplegar `tiendi-kipu` en host con `TIENDI_NOTIFICATIONS_URL=https://api.tiendi.pe/api/v1` y su token de OpenBao (`secret/dev/apps/tiendi-api/runtime`).
  - **Falso positivo en redactor de telemetría:** Fechas ISO en texto libre (`2026-09-28T09:22:11`) quedan enmascaradas como `[REDACTED]`. Ajustar regex en `packages/telemetry/src/redact.ts`.
  - **Activación en navegadores en TEST:** Rebuild de `tiendi-web`, `tiendi-vendor`, `tiendi-admin` y `kipu-web` con flags de build que inyectan el commit en `service.version`.
  - Rotación de contraseña SSH del servidor de test que circuló en texto plano.

---

### 2.4. `OPENTELEMETRY_IMPLEMENTATION_GUIDE.md` (2026-09-26)
* **Checklist de Entrega Formal (Sección 7):**
  - Matriz de estado final por runtime (`implementado`, `no desplegado`, `bloqueado`).
  - Trace ID de prueba sanitizado con captura de consulta en Grafana.
  - Comprobación de rollback operativo garantizando 0 conexiones residuales cuando el export está deshabilitado.

---

### 2.5. `OPENBAO_IMPLEMENTATION_GUIDE.md` (2026-09-25)
* **Pruebas de Aceptación Obligatorias (Sección 9):**
  - Validar retención de datos tras recreación de contenedor sin `-v`.
  - Revocación de root inicial y verificación de políticas por rol (rol API no lee Kipu, rol Kipu no lee API).
  - Escaneo de bundles, sourcemaps y capas de Docker para comprobar que no existan canarios de secretos incrustados en tiempo de compilación.

---

### 2.6. `TIENDI_ADMIN.md` (2026-09-25)
* **Fase 7 — Finanzas, Conciliación y Ledger:**
  - Implementar pantalla `/admin/finance/ledger` con conciliación contra extracto de Culqi.
  - Implementar pantalla `/admin/finance/payouts` conectada a `GET /stores/:storeId/payouts`.
  - Test de invariante I8: Saldo de `Wallet` coincidente con el saldo derivado del libro contable.

---

### 2.7. `TIENDI_LAUNCHER_IMPLEMENTACION.md` y `TIENDI_LAUNCHER.md` (2026-09-24)
* **Checklist E1 (Launcher Estático):**
  - Validación de assets visuales y composición responsive aprobada en móvil y escritorio.
  - Links oficiales de descarga y verificación de checksum/firma de los APKs de Kipu y Go.
* **Checklist E2 (Sesión Shield Unificada):**
  - Contratos C04–C07 pendientes antes de alterar flujos de login.
  - Generación de alta global en servidor y vinculación de identidades sin duplicar cuentas en backends compartidos.

---

### 2.8. `PLAN-PRUEBAS-E2E.md` (2026-09-20)
* **Pendientes de Automatización E2E:**
  - Configuración de pipelines en CI/CD con emulador Android headless para ejecutar los 3 suites de Detox de `tiendi-go`.
  - Creación de fixtures de testing con tarjetas de prueba de Culqi no mockeadas para pasarela real de staging.

---

### 2.9. `CATALOGO_MAESTRO.md` (2026-08-31)
* **Fase 4 (Captura en `tiendi-vendor`):**
  - Prueba de cámara y escaneo de códigos de barra en dispositivos móviles reales (Chrome en Android y Safari en iOS fallback).

---

### 2.10. `GUIA_REINSTALACION_COMPLETA.md` (2026-08-31)
* **Sección 14f — Endurecimiento:**
  - Automatización de backups de PostgreSQL a storage externo cifrado.
  - Configuración de alertas de saturación de disco y memoria en PM2 / Prometheus.

---

### 2.11. `INTEGRACION-TIENDI.md` (2026-08-29)
* **Checklist de Integración:**
  - Saldo en tiempo real y módulo de billetera para comercios (actualmente solo liquidación semanal contra repartidores).

---

### 2.12. `FACTURACION_Y_CONTABILIDAD.md` y `FLUJO_DINERO.md` (2026-08-28)
* **Fase 4 y 5:**
  - Conciliación bancaria automatizada con extractos bancarios y reporte de liquidaciones Culqi.
  - Integración con PSE/SUNAT para emisión directa de boletas y facturas electrónicas.
  - Recaudador integrado opcional para cobranzas en efectivo/billeteras.

---

### 2.13. `TAREAS.md` (2026-08-28)
* **Módulo Auth & Usuarios:**
  - `POST /auth/verify-email` con SendGrid.
  - Integración Google OAuth2.
  - `PUT /users/me/password` (cambio de password autenticado).
  - Soft-delete de cuenta (`DELETE /users/me`) y panel de activación/suspensión de usuarios para super_admin.
* **Módulo Tiendas & Catálogo:**
  - Subida directa de imágenes y banners a Cloudinary (`POST /stores/:id/logo`, `POST /products/:id/images`).
  - Módulo de promociones y cupones de descuento.
* **Infraestructura:**
  - `Dockerfile` multi-stage build optimizado para el backend de plataforma.

---

### 2.14. `MODELO_NEGOCIO.md` (2026-08-26)
* **Sección 12 — Decisiones Pendientes de Negocio:**
  - Absorción de la comisión de pasarela (3.99% + IGV) según ticket mínimo.
  - Tarifa dinámica por distancia vs tarifa plana de delivery.
  - Políticas de penalización por cancelación tardía de pedidos.

---

## 3. Documentos 100% Cerrados o Informativos (Sin Tareas Pendientes)

- `NOTIFICACIONES.md` (27/27 verificados)
- `TIENDI_ADMIN-LITE-MOBILE.md` (Alineado con especificación de API)
- `TIENDI_SHIELD-E2-AUDITORIA.md` (Auditoría técnica de cierre)
- `TIENDI_SHIELD-ADRS-DRAFT.md` (ADRs acordados)
- `DIAGRAMAS_SECUENCIA_MATCHING_RIDERS.md` (Diagramas de referencia)
- `MAPA_RUTAS_APPS.md` (Mapeo completo de URLs)
- `PRODUCTOS_Y_COMERCIALIZACION.md` (Definición conceptual)
- `CATALOGO_MAESTRO-PRELOAD.md` (Script de precarga completado)
- `GUIA_SETUP_PC_NUEVA.md` (Instrucciones de onboarding)
- `MULTI-TENANCY-KIPU.md` (Aislamiento verificado)
- `COMPLIANCE_LEGAL.md` (Términos, condiciones y marco regulatorio)
- `AUTENTICACION.md` (Fases de tokens y middleware implementadas)
- `REVOCACION_SESION.md` (Listas negras en Redis implementadas)
- `MIGRACION-JSONSERVER-API.md` (Migración concluida)
- `ARCHITECTURE-SONNET.md` (Arquitectura base de referencia)
- `MONITORING_RUNBOOK.md` (Guía de incidentes)
- `MODULOS_SISTEMA_TIENDI.md` (Catálogo de módulos)
- `API_DOCUMENTATION.md` (Endpoints documentados)
- `TESTING_STRATEGY.md` (Estrategia de pruebas)
- `COSTOS_ESTIMADOS.md` (Presupuestos de infraestructura)
- `SEGURIDAD.md` (Lineamientos y hardening)
- `USER_STORIES.md` (Historias base implementadas)
- `README.md` (Descripción general)
- `PLANIFICACION.md` (Cronograma inicial)
