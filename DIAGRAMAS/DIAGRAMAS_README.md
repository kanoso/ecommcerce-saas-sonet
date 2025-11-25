# Documentación de Diagramas - Sistema Tiendi

Este directorio contiene toda la documentación técnica en forma de diagramas para el sistema Tiendi.

---

## 📂 Estructura de Carpetas

Los diagramas están organizados en carpetas por tipo:

```
DIAGRAMAS/
├── 📁 arquitectura/         → Arquitectura del sistema (6 archivos)
├── 📁 flujos-usuario/       → Flujos de usuario (2 archivos)
├── 📁 secuencia/            → Diagramas de secuencia (10 archivos)
├── 📁 seguridad/            → Seguridad y permisos (2 archivos)
├── 📁 infraestructura/      → DevOps y despliegue (2 archivos)
└── 📄 DIAGRAMAS_README.md   → Este archivo
```

**Total:** 22 diagramas organizados en 5 categorías

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

---

## 🎯 Uso Recomendado

### Para Desarrolladores
1. **Inicio**: Revisar `arquitectura/DIAGRAMA_ARQUITECTURA_SISTEMA.md` para entender la arquitectura general
2. **Componentes**: Consultar `arquitectura/DIAGRAMA_COMPONENTES.md` para entender la estructura modular
3. **Frontend**: Consultar `arquitectura/DIAGRAMA_ARQUITECTURA_FRONTEND.md`
4. **Backend**: Revisar `secuencia/` según la funcionalidad a implementar
5. **Base de Datos**: Usar `arquitectura/DIAGRAMA_BASE_DATOS.md` como referencia
6. **Multi-tenant**: Revisar `arquitectura/DIAGRAMA_ARQUITECTURA_MULTITENANT.md` para entender aislamiento de datos

### Para DevOps
1. **Despliegue en Azure**: `infraestructura/DIAGRAMA_DESPLIEGUE_AZURE.md`
2. **CI/CD**: `infraestructura/DIAGRAMA_CI_CD.md`
3. **Escalabilidad**: `seguridad/PATRONES_SEGURIDAD_ESCALABILIDAD.md`
4. **Monitoreo**: Secciones de observabilidad en archivos de infraestructura
5. **Infraestructura como Código**: Terraform en despliegue Azure

### Para Product Managers
1. **Flujos de usuario**: `flujos-usuario/DIAGRAMAS_FLUJO_TIENDI.md`
2. **Panel de vendedor**: `flujos-usuario/DIAGRAMAS_FLUJO_PANEL_VENDEDOR.md`
3. **Funcionalidades**: Diagramas de secuencia específicos en `secuencia/`

### Para Security
1. **Revisión de seguridad**: `seguridad/PATRONES_SEGURIDAD_ESCALABILIDAD.md`
2. **RBAC**: `seguridad/DIAGRAMAS_RBAC_PERMISOS.md`
3. **Autenticación**: `secuencia/DIAGRAMAS_SECUENCIA_AUTENTICACION.md`

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

**Última actualización:** 2025-01-24 (Reorganización en carpetas por tipo de diagrama)
**Mantenido por:** Equipo de Desarrollo Tiendi
