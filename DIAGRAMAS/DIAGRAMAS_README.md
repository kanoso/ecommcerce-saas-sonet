# Documentación de Diagramas - Sistema Tiendi

Este directorio contiene toda la documentación técnica en forma de diagramas para el sistema Tiendi.

---

## 📁 Índice de Archivos

### 📊 Diagramas de Flujo de Usuario
**Archivo:** `DIAGRAMAS_FLUJO_TIENDI.md`

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

---

### 🏗️ Arquitectura del Sistema
**Archivos de arquitectura:**

#### `DIAGRAMA_ARQUITECTURA_SISTEMA.md`
- Arquitectura general de alto nivel
- Microservicios backend
- Bases de datos y caché
- Servicios externos
- Procesamiento asíncrono
- Monitoreo y logs
- Stack tecnológico

#### `DIAGRAMA_ARQUITECTURA_FRONTEND.md`
- Arquitectura de componentes frontend
- Estructura de carpetas del proyecto
- Gestión de estado (Redux, React Query)
- Estrategias de rendering (SSR, SSG, ISR)
- Optimizaciones de performance
- Integraciones (Maps, OAuth, Socket.io)
- Progressive Web App (PWA)
- Seguridad frontend

#### `DIAGRAMA_BASE_DATOS.md`
- Diagrama Entidad-Relación (ERD) completo
- Descripción de 15 tablas principales
- Relaciones entre entidades
- Índices recomendados
- Consultas SQL optimizadas
- Triggers y funciones

#### `DIAGRAMA_COMPONENTES.md`
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

#### `DIAGRAMAS_SECUENCIA_AUTENTICACION.md`
Operaciones de autenticación y seguridad:
1. Login con Email/Password
2. Login con Google OAuth
3. Login con Facebook OAuth
4. Registro de Usuario
5. Refresh Token
6. Logout
7. Recuperación de Contraseña
8. Verificación de Email

#### `DIAGRAMAS_SECUENCIA_COMPRA.md`
Proceso completo de compra y pagos:
1. Proceso de Compra Completo
2. Integración de Pago con Tarjeta
3. Pago con Transferencia Bancaria
4. Pago en Efectivo
5. Búsqueda Geolocalizada con Productos
6. Aplicación de Cupón de Descuento
7. Actualización de Estado de Pedido
8. Cancelación de Pedido

#### `DIAGRAMAS_SECUENCIA_CHAT.md`
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

#### `DIAGRAMAS_SECUENCIA_VARIOS.md`
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
**Archivo:** `PATRONES_SEGURIDAD_ESCALABILIDAD.md`

#### Patrones de Arquitectura
- Microservicios
- API Gateway
- Event-Driven Architecture
- Repository Pattern
- CQRS
- Circuit Breaker
- Container/Presenter Pattern
- Custom Hooks

#### Seguridad
- Content Security Policy (CSP)
- Input Validation y Sanitización
- SQL Injection Prevention
- Rate Limiting
- Secrets Management
- Encryption at Rest
- RBAC (Role-Based Access Control)

#### Escalabilidad
- Escalabilidad Horizontal
- Database Sharding
- Multi-level Caching
- Message Queue
- CDN Configuration
- Monitoreo y Observabilidad

---

### 🚀 CI/CD
**Archivo:** `DIAGRAMA_CI_CD.md`

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

---

### ☁️ Despliegue en Azure
**Archivo:** `DIAGRAMA_DESPLIEGUE_AZURE.md`

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

### 🆕 Diagramas Adicionales del Sistema

#### `DIAGRAMA_ARQUITECTURA_MULTITENANT.md`
- Arquitectura multi-tenant con aislamiento de datos por tienda
- Estrategias de multi-tenancy (DB por tenant, Schema, Discriminador)
- Row-Level Security (RLS) en PostgreSQL
- Queries multi-tenant y seguridad
- Backup y recuperación por tenant

#### `DIAGRAMAS_SECUENCIA_INVENTARIO.md`
- Gestión de inventario en tiempo real
- Reserva y liberación de stock
- Prevención de sobreventa (locks optimista y pesimista)
- Ajustes manuales de inventario
- Alertas de stock bajo
- Importación masiva

#### `DIAGRAMAS_RBAC_PERMISOS.md`
- Sistema de control de acceso basado en roles
- Jerarquía de roles (Super Admin, Store Admin, Staff, Customer)
- Matriz de permisos completa
- Validación de permisos y ownership
- Implementación de middleware

#### `DIAGRAMAS_SECUENCIA_COMISIONES.md`
- Sistema de monetización y comisiones
- Cálculo automático de comisiones
- Proceso de payout a vendedores
- Dashboard financiero
- Facturación de suscripciones
- Cambio de planes

#### `DIAGRAMAS_FLUJO_PANEL_VENDEDOR.md`
- Flujos completos del panel de administración para vendedores
- Dashboard principal
- Gestión de productos (CRUD)
- Gestión de inventario
- Gestión de pedidos
- Configuración de tienda
- Reportes y analytics
- Sistema de cupones
- Respuesta a mensajes

#### `DIAGRAMAS_SECUENCIA_VALORACIONES.md`
- Sistema de reseñas y valoraciones de productos
- Verificación de compra para valorar
- Moderación de reseñas
- Respuesta del vendedor
- Cálculo de reputación de tienda
- Sistema de badges

#### `DIAGRAMAS_SECUENCIA_CUPONES.md`
- Creación y gestión de cupones de descuento
- Validación de cupones en checkout
- Límites de uso y restricciones
- Cupones por porcentaje o monto fijo
- Aplicabilidad por producto/categoría

#### `DIAGRAMAS_SECUENCIA_DEVOLUCIONES.md`
- Proceso completo de devoluciones
- Solicitud por parte del cliente
- Evaluación por vendedor
- Procesamiento de reembolsos
- Sistema de disputas
- Mediación por equipo Tiendi

#### `DIAGRAMAS_SECUENCIA_MODERACION.md`
- Onboarding y verificación KYC de vendedores
- Aprobación manual de tiendas
- Moderación automática de productos
- Sistema de reportes
- Suspensión de tiendas
- Auditoría completa

#### `DIAGRAMA_NOTIFICACIONES.md`
- Arquitectura del sistema de notificaciones
- Múltiples canales (Email, Push, SMS, WhatsApp, In-App)
- Notificaciones transaccionales y de marketing
- Gestión de preferencias de usuario
- Templates y campañas
- WebSocket para tiempo real

---

## 🎯 Uso Recomendado

### Para Desarrolladores
1. **Inicio**: Revisar `DIAGRAMA_ARQUITECTURA_SISTEMA.md` para entender la arquitectura general
2. **Componentes**: Consultar `DIAGRAMA_COMPONENTES.md` para entender la estructura modular
3. **Frontend**: Consultar `DIAGRAMA_ARQUITECTURA_FRONTEND.md`
4. **Backend**: Revisar diagramas de secuencia según la funcionalidad a implementar
5. **Base de Datos**: Usar `DIAGRAMA_BASE_DATOS.md` como referencia

### Para DevOps
1. **Despliegue en Azure**: `DIAGRAMA_DESPLIEGUE_AZURE.md`
2. **CI/CD**: `DIAGRAMA_CI_CD.md`
3. **Escalabilidad**: `PATRONES_SEGURIDAD_ESCALABILIDAD.md`
4. **Monitoreo**: Secciones de observabilidad en ambos archivos
5. **Infraestructura como Código**: Terraform en `DIAGRAMA_DESPLIEGUE_AZURE.md`

### Para Product Managers
1. **Flujos de usuario**: `DIAGRAMAS_FLUJO_TIENDI.md`
2. **Funcionalidades**: Diagramas de secuencia específicos

### Para Security
1. **Revisión de seguridad**: `PATRONES_SEGURIDAD_ESCALABILIDAD.md`
2. **Autenticación**: `DIAGRAMAS_SECUENCIA_AUTENTICACION.md`

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

**Última actualización:** 2025-11-24 (Agregado: Diagrama de Componentes, Despliegue en Azure)
**Mantenido por:** Equipo de Desarrollo Tiendi
