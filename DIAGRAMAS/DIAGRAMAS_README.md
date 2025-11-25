# Documentación de Diagramas - Sistema Tiendi

Este directorio contiene toda la documentación técnica en forma de diagramas para el sistema Tiendi.

---

## 📂 Estructura de Carpetas

Los diagramas están organizados en carpetas por tipo:

```
DIAGRAMAS/
├── 📁 arquitectura/         → Arquitectura del sistema (10 archivos)
├── 📁 flujos-usuario/       → Flujos de usuario (2 archivos)
├── 📁 secuencia/            → Diagramas de secuencia (18 archivos)
├── 📁 seguridad/            → Seguridad y permisos (2 archivos)
├── 📁 infraestructura/      → DevOps y despliegue (3 archivos)
└── 📄 DIAGRAMAS_README.md   → Este archivo
```

**Total:** 35 diagramas organizados en 5 categorías

---

## 📁 Índice de Archivos

### 📊 Diagramas de Flujo de Usuario
**Ubicación:** `flujos-usuario/`

#### `flujos-usuario/DIAGRAMAS_FLUJO_TIENDI.md`
Contiene 10 diagramas de flujo que muestran las interacciones del usuario con el sistema:

1. Flujo de Autenticación (Login y Registro)
2. Flujo de Búsqueda de Tiendas
3. Flujo Completo de Compra
4. Flujo de Checkout
5. Flujo de Gestión de Pedidos
6. Flujo de Sistema de Mensajería
7. Flujo de Favoritos
8. Flujo de Vendedor
9. Flujo de Suscripción a Newsletter
10. Flujo de Filtros y Ordenamiento

#### `flujos-usuario/DIAGRAMAS_FLUJO_PANEL_VENDEDOR.md`
Flujos completos del panel de administración para vendedores:
1. Dashboard principal
2. Gestión de productos (CRUD)
3. Gestión de inventario
4. Gestión de pedidos
5. Configuración de tienda
6. Reportes y analytics
7. Sistema de cupones
8. Respuesta a mensajes

---

### 🏗️ Arquitectura del Sistema
**Ubicación:** `arquitectura/`

#### `arquitectura/DIAGRAMA_ARQUITECTURA_SISTEMA.md`
- Arquitectura general de alto nivel
- Microservicios backend
- Bases de datos y caché
- Servicios externos
- Procesamiento asíncrono
- Monitoreo y logs
- Stack tecnológico

#### `arquitectura/DIAGRAMA_ARQUITECTURA_FRONTEND.md`
- Arquitectura de componentes frontend
- Estructura de carpetas del proyecto
- Gestión de estado (Redux, React Query)
- Estrategias de rendering (SSR, SSG, ISR)
- Optimizaciones de performance
- Integraciones (Maps, OAuth, Socket.io)
- Progressive Web App (PWA)
- Seguridad frontend

#### `arquitectura/DIAGRAMA_ARQUITECTURA_MULTITENANT.md`
- Arquitectura multi-tenant con aislamiento de datos por tienda
- Estrategias de multi-tenancy (DB por tenant, Schema, Discriminador)
- Row-Level Security (RLS) en PostgreSQL
- Queries multi-tenant y seguridad
- Backup y recuperación por tenant

#### `arquitectura/DIAGRAMA_NOTIFICACIONES.md`
- Arquitectura del sistema de notificaciones
- Múltiples canales (Email, Push, SMS, WhatsApp, In-App)
- Notificaciones transaccionales y de marketing
- Gestión de preferencias de usuario
- Templates y campañas
- WebSocket para tiempo real

#### `arquitectura/DIAGRAMA_BASE_DATOS.md`
- Diagrama Entidad-Relación (ERD) completo
- Descripción de 15+ tablas principales
- Relaciones entre entidades
- Índices recomendados
- Consultas SQL optimizadas
- Triggers y funciones
- Referencias a tablas adicionales (RBAC, Comisiones, Inventario, etc.)

#### `arquitectura/DIAGRAMA_COMPONENTES.md`
- Diagrama de componentes - Vista general
- Componentes del Backend (User, Order, Product Services)
- Componentes del Frontend (Web App, Feature Modules)
- Componentes de Infraestructura
- Componentes por Microservicio
- Componentes de Integración (Payment, Chat, Search)
- Componentes de Notificación
- Diagrama C4 - Context Level
- Diagrama de Dependencias entre Componentes
- Principios de Diseño de Componentes

#### `arquitectura/DIAGRAMA_ARQUITECTURA_ANALYTICS.md` 🆕
- Pipeline de datos en tiempo real (Streaming)
- Arquitectura de Data Warehouse (OLAP)
- Procesamiento Batch (ETL Diario)
- Stack tecnológico (Kafka, ClickHouse, Prometheus)
- Opciones: Open Source vs Cloud-Native
- Esquema de eventos y métricas clave
- Queries de ejemplo en ClickHouse
- Costos estimados

#### `arquitectura/DIAGRAMA_ARQUITECTURA_BUSQUEDA.md` 🆕
- Arquitectura completa de búsqueda
- Índice de Elasticsearch (Schema)
- Pipeline de sincronización (PostgreSQL → ES)
- Búsqueda multi-criterio con scoring
- Sistema de autocompletado (Trie + Suggestions)
- Sistema de recomendaciones (ML)
- Query DSL de ejemplo
- Stack tecnológico (Elasticsearch vs Typesense vs Algolia)
- Implementación de Sync Service
- Costos comparativos

#### `arquitectura/DIAGRAMA_INTEGRACIONES_EXTERNAS.md` 🆕
- Arquitectura de integraciones con servicios de terceros
- Pasarelas de pago (Niubiz, Culqi, MercadoPago, Yape)
- Google Maps APIs (Geocoding, Distance Matrix, Places)
- OAuth Social (Google, Facebook)
- Mensajería (SendGrid, Twilio, WhatsApp Business)
- Couriers de envío (Olva, Shalom, Urbano)
- PSE - Facturación electrónica (Nubefact, FactuSol)
- Adapter pattern para abstraer integraciones
- Circuit breaker y retry con exponential backoff
- Rate limiting y manejo de cuotas
- Health check de servicios externos
- Implementación de adaptadores TypeScript

#### `arquitectura/DIAGRAMA_SEO_MARKETING.md` 🆕
- SEO Técnico y Marketing Digital
- URLs amigables (slug generation) y sistema de redirects 301
- Meta tags dinámicos (Open Graph, Twitter Cards)
- Schema.org JSON-LD (Product, LocalBusiness, Review, Breadcrumb)
- Sitemap XML dinámico y Robots.txt
- Email marketing automation (abandoned cart, newsletters)
- Campañas con A/B testing y segmentación
- Píxeles de conversión (Facebook Pixel, Google Ads)
- UTM tracking y Google Analytics 4
- Landing pages dinámicas para campañas
- Google Tag Manager integration

---

### 🔄 Diagramas de Secuencia
**Ubicación:** `secuencia/`

#### `secuencia/DIAGRAMAS_SECUENCIA_AUTENTICACION.md`
Operaciones de autenticación y seguridad:
1. Login con Email/Password
2. Login con Google OAuth
3. Login con Facebook OAuth
4. Registro de Usuario
5. Refresh Token
6. Logout
7. Recuperación de Contraseña
8. Verificación de Email

#### `secuencia/DIAGRAMAS_SECUENCIA_COMPRA.md`
Proceso completo de compra y pagos:
1. Proceso de Compra Completo
2. Integración de Pago con Tarjeta
3. Pago con Transferencia Bancaria
4. Pago en Efectivo
5. Búsqueda Geolocalizada con Productos
6. Aplicación de Cupón de Descuento
7. Actualización de Estado de Pedido
8. Cancelación de Pedido

#### `secuencia/DIAGRAMAS_SECUENCIA_CHAT.md`
Sistema de mensajería en tiempo real:
1. Chat en Tiempo Real
2. Conexión WebSocket
3. Mensajes con Plantillas
4. Indicador de Escritura (Typing)
5. Mensajes del Sistema
6. Envío de Archivo/Imagen
7. Sincronización Offline
8. Moderación de Mensajes
9. Cierre de Conversación
10. Notificaciones de Chat

#### `secuencia/DIAGRAMAS_SECUENCIA_INVENTARIO.md`
Gestión de inventario en tiempo real:
1. Agregar Producto al Carrito con Reserva de Stock
2. Liberación Automática de Reserva (TTL)
3. Checkout y Confirmación de Compra
4. Lock Optimista con Version Control
5. Lock Pesimista con SELECT FOR UPDATE
6. Ajuste Manual de Inventario
7. Sincronización de Stock en Tiempo Real (WebSocket)
8. Alerta de Stock Bajo
9. Importación Masiva de Productos

#### `secuencia/DIAGRAMAS_SECUENCIA_COMISIONES.md`
Sistema de monetización y comisiones:
1. Cálculo Automático de Comisión
2. Proceso de Payout a Vendedores
3. Dashboard Financiero del Vendedor
4. Facturación de Suscripción Mensual
5. Cambio de Plan de Suscripción
6. Suspensión por Falta de Pago

#### `secuencia/DIAGRAMAS_SECUENCIA_VALORACIONES.md`
Sistema de reseñas y valoraciones de productos:
1. Cliente Deja Valoración de Producto
2. Moderación de Reseña
3. Vendedor Responde a Reseña
4. Cálculo de Reputación de Tienda

#### `secuencia/DIAGRAMAS_SECUENCIA_CUPONES.md`
Creación y gestión de cupones de descuento:
1. Vendedor Crea Cupón de Descuento
2. Cliente Aplica Cupón en Checkout

#### `secuencia/DIAGRAMAS_SECUENCIA_DEVOLUCIONES.md`
Proceso completo de devoluciones:
1. Solicitud de Devolución (Cliente)
2. Evaluación de Devolución (Vendedor)
3. Escalamiento a Disputa

#### `secuencia/DIAGRAMAS_SECUENCIA_MODERACION.md`
Onboarding y verificación KYC de vendedores:
1. Onboarding de Vendedor (KYC)
2. Aprobación Manual de Tienda (Super Admin)
3. Moderación de Productos
4. Sistema de Reportes
5. Suspensión de Tienda

#### `secuencia/DIAGRAMAS_SECUENCIA_VARIOS.md`
Operaciones adicionales del sistema:
1. Gestión de Favoritos
2. Suscripción a Newsletter
3. Registro de Lead de Vendedor
4. Búsqueda con Autocompletado
5. Valoración de Producto
6. Aplicación de Filtros
7. Repetir Pedido
8. Notificaciones Push
9. Actualización de Perfil
10. Eliminación de Cuenta

#### `secuencia/DIAGRAMAS_SECUENCIA_ANALYTICS.md` 🆕
Sistema de analytics y reportes para vendedores:
1. Recolección de Eventos (Event Tracking)
2. Dashboard de Vendedor - Métricas en Tiempo Real
3. Reporte de Productos Top
4. Comparativa de Períodos
5. Exportar Reporte (PDF/Excel)
6. Análisis de Tráfico (Funnel de Conversión)

Incluye: Tablas de BD, Jobs programados, ejemplos de código

#### `secuencia/DIAGRAMAS_SECUENCIA_BUSQUEDA.md` 🆕
Búsqueda avanzada y recomendaciones personalizadas:
1. Búsqueda con Filtros y Geolocalización
2. Autocompletado en Tiempo Real
3. Reindexación de Producto (Sync)
4. Búsqueda con "¿Quisiste decir?"
5. Productos Recomendados (Personalizados)
6. "Productos Relacionados" (Content-Based)
7. Búsqueda Semántica (con Embeddings)

#### `secuencia/DIAGRAMAS_SECUENCIA_ENVIOS.md` 🆕
Integración con couriers y logística de envíos:
1. Cálculo de Costo de Envío
2. Generación de Etiqueta de Envío
3. Tracking en Tiempo Real
4. Gestión de Incidencia en Envío
5. Cambio de Dirección de Entrega

Incluye: Integraciones con Olva, Shalom, Urbano. Webhooks para actualizaciones. CDC con Outbox Pattern.

#### `secuencia/DIAGRAMAS_SECUENCIA_FACTURACION.md` 🆕
Sistema de facturación electrónica (SUNAT - Perú):
1. Emisión de Boleta Electrónica (03)
2. Emisión de Factura con RUC (01)
3. Nota de Crédito (Anulación) (07)
4. Resumen Diario (RC)

Incluye: Integración con PSE (Nubefact, FactuSol). Formato UBL 2.1. Cálculo de IGV (18%). Firma digital.

#### `secuencia/DIAGRAMAS_SECUENCIA_WEBHOOKS.md` 🆕
Sistema de webhooks para integraciones externas:
1. Configuración de Webhook por Vendedor
2. Trigger de Webhook en Evento (order.created)
3. Retry con Exponential Backoff
4. Consulta de Historial de Entregas
5. Reenvío Manual de Webhook

Incluye: HMAC signature verification. Retry schedule (1min, 5min, 30min, 2h, 8h, 24h). Delivery tracking.

#### `secuencia/DIAGRAMAS_SECUENCIA_REFERIDOS_LEALTAD.md` 🆕
Sistema de referidos y programa de lealtad:
1. Generación de Código de Referido
2. Registro con Código de Referido (Bonos)
3. Acumulación de Puntos por Compra
4. Canje de Puntos por Descuento
5. Upgrade Automático de Nivel de Membresía
6. Dashboard de Referidos del Usuario

Incluye: Tiers (Bronze, Silver, Gold, Platinum). Multiplicadores de puntos. Sistema de recompensas. Expiración de puntos.

#### `secuencia/DIAGRAMAS_SECUENCIA_LIBRO_RECLAMACIONES.md` 🆕
Libro de Reclamaciones Digital (Ley N° 29571 - Perú):
1. Cliente Registra Reclamo
2. Tienda Responde a Reclamo
3. Cliente Acepta/Rechaza Solución
4. Super Admin Gestiona Reclamo Escalado
5. Consulta Pública de Reclamos (Transparencia)

Incluye: Cumplimiento legal SUNAT. Plazos de 30 días hábiles. Sistema de sanciones. PDFs oficiales.

#### `secuencia/DIAGRAMAS_SECUENCIA_SOPORTE_TICKETS.md` 🆕
Sistema de soporte técnico y tickets:
1. Cliente Crea Ticket de Soporte
2. Agente Responde a Ticket
3. Cliente Continúa Conversación
4. Escalamiento a Supervisor
5. Cierre de Ticket y Encuesta de Satisfacción

Incluye: SLA (Service Level Agreement). Asignación automática. Prioridades. Métricas CSAT. Categorías.

---

### 🛡️ Seguridad y Escalabilidad
**Ubicación:** `seguridad/`

#### `seguridad/PATRONES_SEGURIDAD_ESCALABILIDAD.md`

**Patrones de Arquitectura:**
- Microservicios
- API Gateway
- Event-Driven Architecture
- Repository Pattern
- CQRS
- Circuit Breaker
- Container/Presenter Pattern
- Custom Hooks

**Seguridad:**
- Content Security Policy (CSP)
- Input Validation y Sanitización
- SQL Injection Prevention
- Rate Limiting
- Secrets Management
- Encryption at Rest
- RBAC (Role-Based Access Control)

**Escalabilidad:**
- Escalabilidad Horizontal
- Database Sharding
- Multi-level Caching
- Message Queue
- CDN Configuration
- Monitoreo y Observabilidad

#### `seguridad/DIAGRAMAS_RBAC_PERMISOS.md`

Sistema de control de acceso basado en roles:
- Jerarquía de roles (Super Admin, Store Admin, Staff, Customer)
- Matriz de permisos completa
- Validación de permisos y ownership
- Implementación de middleware
- Ejemplos de código TypeScript

---

### 🚀 Infraestructura y DevOps
**Ubicación:** `infraestructura/`

#### `infraestructura/DIAGRAMA_CI_CD.md`

- Flujo completo de CI/CD
- GitHub Actions workflows
- Dockerfile optimizado (multi-stage)
- Kubernetes manifests:
  - Deployment
  - Service
  - Ingress
  - HorizontalPodAutoscaler
- Estrategias de deployment:
  - Rolling Update
  - Blue-Green
  - Canary
- Health checks y monitoreo

#### `infraestructura/DIAGRAMA_DESPLIEGUE_AZURE.md`

- Arquitectura completa de despliegue en Azure
- Recursos de Azure por categoría:
  - Compute (AKS, VMSS)
  - Databases (PostgreSQL, Cosmos DB, Redis)
  - Storage (Blob, Files, Backup)
  - Networking (VNet, NSG, Private Link, Front Door)
- Seguridad (Key Vault, Managed Identities, Defender)
- Monitoreo (Azure Monitor, Application Insights, Log Analytics)
- CI/CD con Azure DevOps Pipelines
- Disaster Recovery y Backup
- Estimación de costos mensuales (~$4,400)
- Configuración de Terraform completa

#### `infraestructura/DIAGRAMA_OBSERVABILIDAD.md` 🆕
Sistema completo de monitoreo y observabilidad:
- Los 3 Pilares: Métricas, Logs, Traces
- Stack de Métricas (Prometheus + Grafana)
- Stack de Logs (Loki + Promtail)
- Distributed Tracing (Tempo / Jaeger)
- Métricas Clave (RED & USE Methods)
- Dashboards de Grafana (Application, Infrastructure, Business)
- Alertas Críticas con Alertmanager
- Instrumentación de aplicaciones (Node.js ejemplo)
- LogQL y PromQL queries
- SLOs (Service Level Objectives)
- Opciones: Self-hosted vs Managed
- Costos comparativos

---

## 🎯 Uso Recomendado

### Para Desarrolladores
1. **Inicio**: Revisar `arquitectura/DIAGRAMA_ARQUITECTURA_SISTEMA.md` para entender la arquitectura general
2. **Componentes**: Consultar `arquitectura/DIAGRAMA_COMPONENTES.md` para entender la estructura modular
3. **Frontend**: Consultar `arquitectura/DIAGRAMA_ARQUITECTURA_FRONTEND.md`
4. **Backend**: Revisar `secuencia/` según la funcionalidad a implementar
5. **Base de Datos**: Usar `arquitectura/DIAGRAMA_BASE_DATOS.md` como referencia
6. **Multi-tenant**: Revisar `arquitectura/DIAGRAMA_ARQUITECTURA_MULTITENANT.md` para entender aislamiento de datos
7. **Búsqueda**: `arquitectura/DIAGRAMA_ARQUITECTURA_BUSQUEDA.md` y `secuencia/DIAGRAMAS_SECUENCIA_BUSQUEDA.md` 🆕
8. **Analytics**: `arquitectura/DIAGRAMA_ARQUITECTURA_ANALYTICS.md` y `secuencia/DIAGRAMAS_SECUENCIA_ANALYTICS.md` 🆕
9. **Integraciones**: `arquitectura/DIAGRAMA_INTEGRACIONES_EXTERNAS.md` (Pagos, Maps, Couriers, PSE) 🆕
10. **Envíos**: `secuencia/DIAGRAMAS_SECUENCIA_ENVIOS.md` (Olva, Shalom, Urbano) 🆕
11. **Facturación**: `secuencia/DIAGRAMAS_SECUENCIA_FACTURACION.md` (SUNAT, PSE) 🆕
12. **Webhooks**: `secuencia/DIAGRAMAS_SECUENCIA_WEBHOOKS.md` (Event-driven, Retry) 🆕
13. **SEO y Marketing**: `arquitectura/DIAGRAMA_SEO_MARKETING.md` (URLs, Schema.org, Email marketing) 🆕
14. **Sistema de Lealtad**: `secuencia/DIAGRAMAS_SECUENCIA_REFERIDOS_LEALTAD.md` (Referidos, Puntos) 🆕
15. **Soporte**: `secuencia/DIAGRAMAS_SECUENCIA_SOPORTE_TICKETS.md` (Tickets, SLA) 🆕

### Para DevOps
1. **Despliegue en Azure**: `infraestructura/DIAGRAMA_DESPLIEGUE_AZURE.md`
2. **CI/CD**: `infraestructura/DIAGRAMA_CI_CD.md`
3. **Observabilidad**: `infraestructura/DIAGRAMA_OBSERVABILIDAD.md` (Métricas, Logs, Traces) 🆕
4. **Escalabilidad**: `seguridad/PATRONES_SEGURIDAD_ESCALABILIDAD.md`
5. **Infraestructura como Código**: Terraform en despliegue Azure

### Para Product Managers
1. **Flujos de usuario**: `flujos-usuario/DIAGRAMAS_FLUJO_TIENDI.md`
2. **Panel de vendedor**: `flujos-usuario/DIAGRAMAS_FLUJO_PANEL_VENDEDOR.md`
3. **Analytics y métricas**: `secuencia/DIAGRAMAS_SECUENCIA_ANALYTICS.md` (Dashboard vendedor) 🆕
4. **Envíos y logística**: `secuencia/DIAGRAMAS_SECUENCIA_ENVIOS.md` (Couriers peruanos) 🆕
5. **Facturación electrónica**: `secuencia/DIAGRAMAS_SECUENCIA_FACTURACION.md` (SUNAT) 🆕
6. **Integraciones API**: `secuencia/DIAGRAMAS_SECUENCIA_WEBHOOKS.md` 🆕
7. **Funcionalidades**: Diagramas de secuencia específicos en `secuencia/`

### Para Data Engineers
1. **Pipeline de datos**: `arquitectura/DIAGRAMA_ARQUITECTURA_ANALYTICS.md` 🆕
2. **Event tracking**: `secuencia/DIAGRAMAS_SECUENCIA_ANALYTICS.md` 🆕
3. **Data warehouse**: Queries y esquemas en arquitectura analytics

### Para Security
1. **Revisión de seguridad**: `seguridad/PATRONES_SEGURIDAD_ESCALABILIDAD.md`
2. **RBAC**: `seguridad/DIAGRAMAS_RBAC_PERMISOS.md`
3. **Autenticación**: `secuencia/DIAGRAMAS_SECUENCIA_AUTENTICACION.md`

### Para Marketing
1. **SEO y Marketing Digital**: `arquitectura/DIAGRAMA_SEO_MARKETING.md` (URLs, Meta tags, Schema.org) 🆕
2. **Email Campaigns**: `arquitectura/DIAGRAMA_SEO_MARKETING.md` (Automation, A/B testing) 🆕
3. **Tracking y Analytics**: `arquitectura/DIAGRAMA_SEO_MARKETING.md` (Píxeles, UTM, GA4) 🆕
4. **Landing Pages**: `arquitectura/DIAGRAMA_SEO_MARKETING.md` (Campañas dinámicas) 🆕
5. **Sistema de Lealtad**: `secuencia/DIAGRAMAS_SECUENCIA_REFERIDOS_LEALTAD.md` (Programa de puntos) 🆕

### Para Legal/Compliance
1. **Libro de Reclamaciones**: `secuencia/DIAGRAMAS_SECUENCIA_LIBRO_RECLAMACIONES.md` (Ley N° 29571) 🆕
2. **Facturación SUNAT**: `secuencia/DIAGRAMAS_SECUENCIA_FACTURACION.md` (Comprobantes electrónicos) 🆕

### Para Customer Support
1. **Sistema de Tickets**: `secuencia/DIAGRAMAS_SECUENCIA_SOPORTE_TICKETS.md` (SLA, CSAT) 🆕
2. **Chat en vivo**: `secuencia/DIAGRAMAS_SECUENCIA_CHAT.md`
3. **Libro de Reclamaciones**: `secuencia/DIAGRAMAS_SECUENCIA_LIBRO_RECLAMACIONES.md` 🆕

---

## 📝 Formato de los Diagramas

Todos los diagramas están escritos en **Mermaid**, un lenguaje de diagramas compatible con:

- ✅ GitHub/GitLab (visualización automática)
- ✅ VSCode (con extensión Mermaid Preview)
- ✅ Notion, Confluence
- ✅ [Mermaid Live Editor](https://mermaid.live)
- ✅ Docusaurus, MkDocs

### Visualizar en VSCode
1. Instalar extensión: "Markdown Preview Mermaid Support"
2. Abrir archivo `.md`
3. Presionar `Ctrl+Shift+V` (Windows) o `Cmd+Shift+V` (Mac)

### Exportar a Imagen
```bash
# Instalar mermaid-cli
npm install -g @mermaid-js/mermaid-cli

# Convertir a PNG
mmdc -i DIAGRAMA_ARQUITECTURA_SISTEMA.md -o arquitectura.png

# Convertir a SVG
mmdc -i DIAGRAMA_ARQUITECTURA_SISTEMA.md -o arquitectura.svg
```

---

## 🔄 Mantenimiento

### Actualización de Diagramas
1. Editar el archivo correspondiente
2. Verificar sintaxis en [Mermaid Live](https://mermaid.live)
3. Actualizar la fecha al final del archivo
4. Documentar cambios en el commit

### Versionado
Cada archivo incluye:
- **Fecha de creación**
- **Versión**
- Actualizar la versión cuando haya cambios significativos

---

## 📚 Documentos Relacionados

- `MODULOS_SISTEMA_TIENDI.md` - Análisis detallado de módulos
- Código fuente del proyecto
- Documentación de API (cuando esté disponible)

---

## 🤝 Contribuciones

Al agregar nuevos diagramas:
1. Seguir la estructura existente
2. Usar convenciones de Mermaid consistentes
3. Incluir descripción detallada
4. Actualizar este README

---

**Última actualización:** 2025-01-25 (Agregados diagramas de baja prioridad: Referidos y Lealtad, Libro de Reclamaciones, Soporte y Tickets, SEO y Marketing)
**Mantenido por:** Equipo de Desarrollo Tiendi
