# Planificación E-commerce SaaS - Tiendi

## Resumen Ejecutivo

**Tiendi** es una plataforma SaaS de e-commerce multi-tienda que permite a emprendedores crear y gestionar sus propias tiendas virtuales. Los clientes finales pueden descubrir tiendas cercanas mediante geolocalización y realizar compras en línea.

### Stack Tecnológico

- **Frontend**: Angular + TypeScript
- **Backend**: Node.js + NestJS
- **Base de Datos**: PostgreSQL + Redis
- **Mapas**: Google Maps API / Mapbox
- **Pagos**: Stripe/PayPal + Yape/Plin
- **Almacenamiento**: AWS S3 / Cloudinary (imágenes)
- **Deploy**: Docker + AWS/Azure

### Modelo de Negocio

**Freemium + Premium**
- Plan Gratuito: Funcionalidades básicas, límite de productos
- Plan Premium: Sin límites, analytics avanzados, prioridad en soporte

---

## Fase 1: Configuración Inicial y Arquitectura

### 1.1 Estructura del Proyecto

#### Backend (NestJS)
```
backend/
├── src/
│   ├── modules/
│   │   ├── auth/              # Autenticación y autorización
│   │   ├── users/             # Gestión de usuarios
│   │   ├── stores/            # Gestión de tiendas
│   │   ├── products/          # Gestión de productos
│   │   ├── orders/            # Gestión de pedidos
│   │   ├── payments/          # Procesamiento de pagos
│   │   ├── subscriptions/     # Planes y suscripciones
│   │   ├── notifications/     # WhatsApp, Email, SMS
│   │   └── analytics/         # Estadísticas y métricas
│   ├── common/
│   │   ├── guards/            # Guards de autenticación
│   │   ├── decorators/        # Decoradores personalizados
│   │   ├── filters/           # Filtros de excepciones
│   │   └── interceptors/      # Interceptors
│   ├── config/                # Configuraciones
│   └── database/              # Migraciones y seeds
├── test/
└── docker-compose.yml
```

#### Frontend (Angular)
```
frontend/
├── src/
│   ├── app/
│   │   ├── core/              # Servicios singleton, guards
│   │   ├── shared/            # Componentes compartidos
│   │   ├── features/
│   │   │   ├── landing/       # Landing page pública
│   │   │   ├── auth/          # Login, registro
│   │   │   ├── store-front/   # Vista de tienda (cliente)
│   │   │   ├── dashboard/     # Dashboard vendedor
│   │   │   ├── admin/         # Panel super admin
│   │   │   └── checkout/      # Proceso de compra
│   │   └── layout/            # Layouts principales
│   ├── assets/
│   └── environments/
└── angular.json
```

### 1.2 Base de Datos (PostgreSQL)

#### Esquema Principal

**users**
- id, email, password_hash, first_name, last_name
- phone, role (super_admin, store_owner, employee, customer)
- email_verified, phone_verified, status
- created_at, updated_at

**stores**
- id, owner_id (FK users), name, slug, description
- logo_url, banner_url, status (pending, active, suspended)
- address, latitude, longitude
- phone, email, whatsapp
- opening_hours (JSON), delivery_radius
- subscription_plan_id (FK subscription_plans)
- created_at, updated_at

**products**
- id, store_id (FK stores), name, slug, description
- price, sale_price, sku, stock
- images (JSON), category_id (FK categories)
- is_active, featured
- created_at, updated_at

**categories**
- id, name, slug, parent_id (FK categories)
- icon, order, is_active

**orders**
- id, store_id (FK stores), customer_id (FK users)
- order_number, status (pending, confirmed, in_transit, delivered, cancelled)
- subtotal, delivery_fee, total
- payment_method, payment_status
- delivery_address (JSON), delivery_location (point)
- created_at, updated_at

**order_items**
- id, order_id (FK orders), product_id (FK products)
- quantity, unit_price, subtotal

**subscription_plans**
- id, name, description, price, billing_cycle
- features (JSON), max_products, max_orders_per_month
- is_active, created_at

**store_subscriptions**
- id, store_id (FK stores), plan_id (FK subscription_plans)
- start_date, end_date, status, auto_renew

### 1.3 Configuración Inicial

**Tareas:**
1. Inicializar proyecto NestJS con TypeScript
2. Configurar PostgreSQL + TypeORM
3. Configurar Redis para sesiones y caché
4. Inicializar proyecto Angular
5. Configurar ESLint, Prettier
6. Configurar variables de entorno (.env)
7. Dockerizar aplicación (backend + frontend + postgres + redis)
8. Configurar Git y .gitignore

**Tiempo estimado: 3-5 días**

---

## Fase 2: Autenticación y Sistema de Roles

### 2.1 Backend - Autenticación

**Funcionalidades:**
- Registro de usuarios (email + password)
- Login con email/password
- Login con Google OAuth2
- Login con Facebook OAuth2
- JWT tokens (access + refresh)
- Verificación de email
- Recuperación de contraseña
- RBAC (Role-Based Access Control)

**Endpoints:**
```
POST   /auth/register
POST   /auth/login
POST   /auth/google
POST   /auth/facebook
POST   /auth/logout
POST   /auth/refresh
POST   /auth/verify-email
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /auth/me
```

### 2.2 Sistema de Roles y Permisos

**Roles:**
1. **super_admin**: Gestión completa de la plataforma
2. **store_owner**: Gestión de su tienda
3. **employee**: Gestión limitada de tienda
4. **customer**: Compra de productos

**Permisos por módulo:**
- stores: create, read, update, delete, approve
- products: create, read, update, delete
- orders: create, read, update, cancel
- users: create, read, update, delete
- subscriptions: manage

### 2.3 Frontend - Auth

**Componentes:**
- LoginComponent (diseño imagen _8.jpg)
- RegisterComponent
- ForgotPasswordComponent
- ResetPasswordComponent
- EmailVerificationComponent

**Guards:**
- AuthGuard: Protege rutas autenticadas
- RoleGuard: Protege rutas por rol
- SubscriptionGuard: Valida suscripción activa

**Tiempo estimado: 5-7 días**

---

## Fase 3: Módulo de Gestión de Tiendas (Dashboard Vendedor)

### 3.1 Onboarding de Tienda

**Flujo:**
1. Usuario se registra como vendedor
2. Completa formulario de creación de tienda:
   - Información básica (nombre, descripción)
   - Logo y banner
   - Ubicación (mapa interactivo)
   - Horarios de atención
   - Métodos de pago aceptados
   - Radio de entrega
3. Revisión por super admin (opcional)
4. Activación de tienda

### 3.2 Dashboard del Vendedor

**Pantallas principales:**

**3.2.1 Resumen General**
- Estadísticas del día/semana/mes:
  - Total de ventas
  - Número de pedidos
  - Productos más vendidos
  - Calificación promedio
- Gráficos de ventas
- Últimos pedidos

**3.2.2 Gestión de Productos**
- Listado de productos (tabla con filtros)
- Crear/editar producto:
  - Información básica (nombre, descripción, precio)
  - Galería de imágenes (múltiples)
  - Categoría y subcategoría
  - SKU y stock
  - Precio especial (oferta)
  - Estado (activo/inactivo)
- Importación masiva (CSV)
- Gestión de categorías

**3.2.3 Gestión de Pedidos**
- Listado de pedidos con estados:
  - Preparar (rojo)
  - Confirmado (azul)
  - Rechazado (gris)
  - En tránsito (naranja)
- Detalle de pedido:
  - Información del cliente
  - Productos y cantidades
  - Dirección de entrega
  - Método de pago
  - Estado de pago
- Actualizar estado de pedido
- Generar nota de venta / factura
- Notificar al cliente (WhatsApp/Email/SMS)

**3.2.4 Configuración de Tienda**
- Información general
- Apariencia (colores, logo)
- Ubicación y radio de entrega
- Horarios de atención
- Métodos de pago
- Políticas (términos, privacidad, devoluciones)
- Integraciones (WhatsApp Business, redes sociales)

**3.2.5 Gestión de Empleados**
- Agregar/eliminar empleados
- Asignar permisos
- Registro de actividad

**Endpoints principales:**
```
# Tiendas
GET    /stores/:id
POST   /stores
PUT    /stores/:id
DELETE /stores/:id
GET    /stores/:id/stats

# Productos
GET    /stores/:storeId/products
POST   /stores/:storeId/products
PUT    /products/:id
DELETE /products/:id
POST   /products/import

# Pedidos
GET    /stores/:storeId/orders
GET    /orders/:id
PUT    /orders/:id/status
POST   /orders/:id/notify
```

**Tiempo estimado: 10-14 días**

---

## Fase 4: Módulo de Productos y Categorías

### 4.1 Sistema de Categorías

**Características:**
- Categorías principales
- Subcategorías (n-niveles)
- Iconos personalizados
- Ordenamiento
- Estado activo/inactivo

**Categorías sugeridas (según diseños):**
- Bebidas y licores
  - Cervezas
  - Agua
  - Gaseosas
  - Vodka
- Tortas y postres
- Snacks
- Alimentos

### 4.2 Gestión de Productos

**Campos del producto:**
- Información básica (nombre, descripción)
- Precio y precio de oferta
- SKU y código de barras
- Stock y alertas de stock bajo
- Galería de imágenes (orden drag & drop)
- Categoría y etiquetas
- Variantes (opcional): talla, color, etc.
- SEO: meta title, meta description, slug

**Funcionalidades:**
- CRUD completo
- Búsqueda y filtros
- Ordenamiento (precio, nombre, stock)
- Productos destacados
- Importación/exportación CSV
- Duplicar producto
- Historial de cambios

### 4.3 Frontend - Catálogo Público

**Componentes:**
- ProductCardComponent (diseño _15.jpg)
- ProductListComponent (diseño _30.jpg)
- ProductDetailComponent
- CategoryFilterComponent
- PriceFilterComponent
- SearchBarComponent

**Tiempo estimado: 7-10 días**

---

## Fase 5: Landing Page y Búsqueda Geolocalizada

### 5.1 Landing Page Pública

**Secciones (según diseños _1.jpg, _2.jpg, _3.jpg):**

**5.1.1 Hero Section**
- Título: "Encuentra lo que estás buscando, más cerca de los que crees"
- Buscador con autocompletado
- Mapa interactivo de fondo con tiendas cercanas
- CTA: "¿Quieres vender?" (botón naranja)
- Social media links (footer)

**5.1.2 Suscripción Newsletter**
- Input de email
- Botón "Suscríbeme"

**5.1.3 Navegación**
- "Sobre nosotros"
- "Como funciona"
- "¿Quieres vender?"
- "Ingresar" (login)

### 5.2 Búsqueda Geolocalizada

**Características (diseños _5.jpg, _7.jpg):**

**5.2.1 Mapa Interactivo**
- Integración con Google Maps / Mapbox
- Marcadores de tiendas con colores por categoría
- Clusters cuando hay muchas tiendas cercanas
- Zoom y pan
- Geolocalización del usuario

**5.2.2 Panel de Búsqueda**
- Input de búsqueda (productos o tiendas)
- Filtros:
  - Abierto ahora
  - Más cerca
  - Medios de pago (tarjetas, transferencia, yape, plin)
  - Marca
  - Presentación
- Resultados con:
  - Nombre de la tienda
  - Distancia en km
  - Estado (abierto/cerrado)
  - Precio desde
  - Botón para ver tienda

**5.2.3 Detalle de Tienda en Mapa (popup)**
- Nombre de la tienda
- Distancia
- Atención 24 hrs / Horario
- Dirección
- Ver WhatsApp
- Botón para ver tienda completa

**5.2.4 Cálculo de Distancia**
- Fórmula haversine para calcular distancia
- Ordenar resultados por proximidad
- Filtro por radio (5km, 10km, 20km)

**Endpoints:**
```
GET    /stores/nearby?lat=X&lng=Y&radius=Z
GET    /stores/search?q=query&lat=X&lng=Y
GET    /stores/:id/distance?lat=X&lng=Y
```

**Tiempo estimado: 8-12 días**

---

## Fase 6: Catálogo y Carrito de Compras

### 6.1 Vista de Tienda (Store Front)

**Layout (diseños _15.jpg, _30.jpg):**

**6.1.1 Header**
- Logo de la tienda
- Buscador interno
- Categorías principales (chips)
- Iconos:
  - Carrito (con contador)
  - Calendario (horarios)
  - Favoritos
  - Notificaciones
  - Usuario

**6.1.2 Navegación de Categorías**
- Tabs horizontales con scroll
- "Ofertas del día" (destacado)
- Categorías dinámicas por tienda

**6.1.3 Grid de Productos**
- Cards con:
  - Imagen del producto
  - Marca
  - Nombre/descripción
  - Precio actual
  - Precio anterior (tachado)
  - Badge de descuento (%)
  - Control de cantidad (+/-)
  - Botón "Agregar" / "Agregado" ✓
  - Icono de favorito (corazón)
- Responsive: mobile, tablet, desktop
- Paginación o infinite scroll

**6.1.4 Sidebar de Categorías** (vista desktop)
- Árbol de categorías
- Contador de productos por categoría
- Collapse/expand

**6.1.5 Footer de Tienda**
- Servicios al cliente
  - Preguntas frecuentes
  - Cambios y devoluciones
  - Términos y condiciones
  - Política de privacidad
  - Libro de reclamaciones
- Sobre la tienda
  - Horarios de atención
  - Todos los días 24 hrs / Horario específico
  - Email de contacto
  - Ver dirección
  - Ver WhatsApp
- Medios de pago
  - Logos de tarjetas aceptadas
  - Contra entrega
  - Yape/Plin
- Call-to-action: "Compra antes de las 2:00pm y recibe tu pedido hoy mismo"
- "Powered by Tiendi"

### 6.2 Carrito de Compras

**Funcionalidades (diseño _18.jpg):**

**6.2.1 Panel Lateral "Mis pedidos"**
- Lista de pedidos activos con estados:
  - Preparar (rojo)
  - Rechazado (gris)
  - Confirmado (azul)
  - En tránsito (verde)
- Cada pedido muestra:
  - Nombre de la tienda
  - Número de pedido
  - Total
  - Cantidad de productos
  - Botón para ver detalle
- Botón "Ver más pedidos"

**6.2.2 Modal "Bolsa de compras"**
- Proceso en 2 pasos:
  1. Productos
  2. Datos de pago
- Lista de productos en carrito:
  - Miniatura
  - Nombre y marca
  - Precio unitario
  - Control de cantidad (+/-)
  - Botón eliminar (X)
- Subtotal
- Botón "Continuar"

**6.2.3 Detalle de Pedido (diseño _16.jpg)**
- Número de pedido
- Botón "Repetir pedido" (naranja)
- Resumen:
  - Lista de productos (imagen, nombre, cantidad, precio)
  - Subtotal
  - Despacho
  - Total
- Dirección de entrega
  - Recojo en tienda / Entrega a domicilio
  - Dirección completa
- Forma de pago
  - Método seleccionado

**6.2.4 Funcionalidades adicionales**
- Persistencia del carrito (localStorage + backend)
- Cálculo automático de costos de envío
- Validación de stock antes de checkout
- Cupones de descuento (opcional)

**Endpoints:**
```
GET    /cart
POST   /cart/items
PUT    /cart/items/:id
DELETE /cart/items/:id
POST   /cart/clear
POST   /cart/apply-coupon
```

**Tiempo estimado: 10-14 días**

---

## Fase 7: Sistema de Pedidos y Pagos

### 7.1 Proceso de Checkout

**Flujo:**
1. Revisar carrito
2. Seleccionar método de entrega:
   - Recojo en tienda
   - Entrega a domicilio (validar radio de entrega)
3. Ingresar/seleccionar dirección de entrega
4. Seleccionar método de pago:
   - Tarjeta (Stripe/PayPal)
   - Yape/Plin (upload de comprobante)
   - Pago contraentrega
5. Revisar resumen del pedido
6. Confirmar pedido
7. Pantalla de confirmación (diseño _28.jpg)

**Componentes:**
- CheckoutComponent
- AddressFormComponent
- PaymentMethodComponent
- OrderSummaryComponent
- OrderConfirmationComponent (mensaje: "Pedido enviado")

### 7.2 Procesamiento de Pagos

**7.2.1 Stripe/PayPal**
- Integrar Stripe Checkout / PayPal SDK
- Webhook para confirmación de pago
- Guardar información de pago (tokenizada)
- Manejo de pagos fallidos
- Reembolsos

**7.2.2 Yape/Plin**
- Upload de comprobante de pago (imagen)
- Estado "Pago pendiente de verificación"
- Vendedor aprueba/rechaza el pago manualmente
- Notificación al cliente

**7.2.3 Contraentrega**
- No requiere procesamiento inmediato
- Estado "Pago pendiente" hasta entrega

### 7.3 Estados del Pedido

**Flujo de estados:**
1. **Pendiente**: Pedido creado, esperando confirmación
2. **Confirmado**: Vendedor confirma el pedido
3. **Preparar**: En preparación
4. **En tránsito**: Pedido en camino
5. **Entregado**: Pedido completado
6. **Cancelado**: Pedido cancelado (por cliente o vendedor)
7. **Rechazado**: Vendedor rechaza el pedido

**Notificaciones automáticas:**
- Cliente: Al cambiar estado del pedido
- Vendedor: Al recibir nuevo pedido
- Métodos: Email, SMS, WhatsApp, Push

### 7.4 Gestión de Pedidos (Vendedor)

**Pantalla de pedidos:**
- Vista tipo Kanban por estados
- Vista de lista con filtros
- Búsqueda por número de pedido, cliente, producto
- Filtros por fecha, estado, método de pago
- Acciones rápidas:
  - Cambiar estado
  - Imprimir nota de venta
  - Contactar cliente (WhatsApp)
  - Marcar como entregado
  - Cancelar pedido

**Endpoints:**
```
POST   /orders
GET    /orders/:id
PUT    /orders/:id/status
POST   /orders/:id/cancel
POST   /orders/:id/payment/confirm
GET    /orders/track/:trackingCode
```

**Tiempo estimado: 14-18 días**

---

## Fase 8: Panel de Administración (Super Admin)

### 8.1 Dashboard Super Admin

**Métricas globales:**
- Total de tiendas (activas, pendientes, suspendidas)
- Total de ventas en la plataforma
- Comisiones generadas
- Usuarios registrados (vendedores, clientes)
- Gráficos de crecimiento

### 8.2 Gestión de Tiendas

**Funcionalidades:**
- Listar todas las tiendas
- Aprobar/rechazar nuevas tiendas
- Suspender/activar tiendas
- Ver detalles de cada tienda
- Estadísticas por tienda
- Gestionar suscripciones

### 8.3 Gestión de Usuarios

- Listar todos los usuarios
- Filtrar por rol
- Bloquear/desbloquear usuarios
- Cambiar roles
- Ver actividad del usuario

### 8.4 Gestión de Categorías Globales

- CRUD de categorías maestras
- Asignar iconos
- Ordenar categorías

### 8.5 Gestión de Planes de Suscripción

- CRUD de planes
- Configurar características
- Precios y facturación
- Métricas de conversión

### 8.6 Reportes y Analytics

- Reporte de ventas por tienda
- Reporte de comisiones
- Productos más vendidos (global)
- Análisis geográfico (mapa de calor)
- Exportar datos (CSV, PDF)

**Endpoints:**
```
GET    /admin/dashboard
GET    /admin/stores
PUT    /admin/stores/:id/status
GET    /admin/users
PUT    /admin/users/:id/role
GET    /admin/reports/sales
GET    /admin/reports/commissions
```

**Tiempo estimado: 10-14 días**

---

## Fase 9: Integraciones Externas

### 9.1 WhatsApp Business API

**Funcionalidades:**
- Notificaciones de nuevos pedidos al vendedor
- Confirmaciones de pedido al cliente
- Actualizaciones de estado
- Chat directo tienda-cliente
- Plantillas de mensajes

**Servicio recomendado:** Twilio WhatsApp API

### 9.2 Email (SendGrid/AWS SES)

**Emails transaccionales:**
- Confirmación de registro
- Verificación de email
- Recuperación de contraseña
- Confirmación de pedido
- Actualizaciones de pedido
- Factura/recibo
- Newsletter (opcional)

**Plantillas:**
- Diseño responsive
- Branding de Tiendi
- Personalización por tienda (logo)

### 9.3 SMS (Twilio)

**Notificaciones críticas:**
- Código de verificación
- Confirmación de pedido
- Pedido en camino
- Pedido entregado

### 9.4 Google Analytics

**Tracking:**
- Conversiones de tiendas
- Productos más vistos
- Embudo de compra
- Abandono de carrito
- Tiempo en sitio
- Fuentes de tráfico

**Eventos personalizados:**
- store_view
- product_view
- add_to_cart
- begin_checkout
- purchase

### 9.5 Google Maps API

**Funcionalidades:**
- Geocoding (dirección → coordenadas)
- Reverse geocoding (coordenadas → dirección)
- Autocomplete de direcciones
- Mapa interactivo
- Marcadores personalizados
- Cálculo de rutas (opcional)

**Tiempo estimado: 8-12 días**

---

## Fase 10: Sistema de Suscripciones Freemium/Premium

### 10.1 Definición de Planes

**Plan Gratuito:**
- Hasta 50 productos
- Hasta 100 pedidos/mes
- Sin comisión por venta (o comisión alta: 5%)
- Soporte por email
- Analytics básico

**Plan Básico ($29/mes):**
- Hasta 500 productos
- Pedidos ilimitados
- Comisión reducida (2%)
- Soporte prioritario
- Analytics completo
- Personalización básica

**Plan Premium ($79/mes):**
- Productos ilimitados
- Pedidos ilimitados
- Sin comisión
- Soporte 24/7
- Analytics avanzado + reportes personalizados
- Personalización completa (dominio propio, colores)
- API access
- Prioridad en búsquedas

### 10.2 Gestión de Suscripciones

**Funcionalidades:**
- Selección de plan al crear tienda
- Cambio de plan (upgrade/downgrade)
- Facturación automática (Stripe Subscriptions)
- Período de prueba (14 días)
- Cancelación de suscripción
- Historial de pagos
- Facturas descargables

### 10.3 Limitaciones por Plan

**Validaciones en backend:**
- Límite de productos
- Límite de pedidos mensuales
- Acceso a funcionalidades premium
- Middleware que verifica suscripción activa

**Frontend:**
- Mostrar límites actuales vs. usados
- Prompts para upgrade cuando se alcanzan límites
- Bloqueo de funcionalidades premium

**Endpoints:**
```
GET    /subscriptions/plans
POST   /subscriptions/subscribe
PUT    /subscriptions/change-plan
POST   /subscriptions/cancel
GET    /subscriptions/invoices
POST   /subscriptions/webhook (Stripe)
```

**Tiempo estimado: 10-14 días**

---

## Fase 11: Testing y Optimización

### 11.1 Testing Backend

**Unit Tests (Jest):**
- Servicios y controladores
- Lógica de negocio
- Validaciones
- Coverage mínimo: 80%

**Integration Tests:**
- Flujos completos (E2E)
- Endpoints principales
- Webhooks

**Tests específicos:**
- Autenticación y autorización
- Procesamiento de pedidos
- Cálculo de distancias
- Pagos (con Stripe test mode)

### 11.2 Testing Frontend

**Unit Tests (Jasmine/Karma):**
- Componentes
- Servicios
- Pipes y directivas

**E2E Tests (Cypress):**
- Flujo de registro y login
- Crear tienda
- Agregar productos
- Realizar compra
- Cambiar estado de pedido

### 11.3 Optimización de Performance

**Backend:**
- Indexación de base de datos
- Queries N+1
- Caching con Redis:
  - Listado de productos
  - Información de tiendas
  - Búsquedas frecuentes
- Rate limiting
- Compression

**Frontend:**
- Lazy loading de módulos
- Optimización de imágenes (WebP, responsive)
- Tree shaking
- Bundle size analysis
- Infinite scroll vs pagination
- Service Workers (PWA)

### 11.4 SEO

- Meta tags dinámicos por página
- Sitemap.xml
- Robots.txt
- Schema.org markup (LocalBusiness, Product)
- URLs amigables (slugs)
- Server-side rendering (SSR con Angular Universal)

### 11.5 Seguridad

**Auditoría de seguridad:**
- SQL Injection
- XSS (Cross-Site Scripting)
- CSRF (Cross-Site Request Forgery)
- Rate limiting para prevenir DDoS
- Sanitización de inputs
- HTTPS obligatorio
- Helmet.js (security headers)
- Validación de tokens JWT
- Expiración de sesiones

**Tiempo estimado: 10-14 días**

---

## Fase 12: Deploy y CI/CD

### 12.1 Containerización

**Docker:**
- Dockerfile para backend (Node.js)
- Dockerfile para frontend (Nginx)
- docker-compose.yml para desarrollo
- Optimización de imágenes (multi-stage builds)

### 12.2 CI/CD Pipeline

**GitHub Actions / GitLab CI:**

**Pipeline para backend:**
1. Linting (ESLint)
2. Tests unitarios
3. Tests de integración
4. Build
5. Docker build & push
6. Deploy a staging
7. Deploy a producción (manual approval)

**Pipeline para frontend:**
1. Linting (ESLint)
2. Tests unitarios
3. Build production
4. Docker build & push
5. Deploy a staging
6. Deploy a producción

### 12.3 Infraestructura

**Opción AWS:**
- **Backend**: ECS Fargate / EKS (Kubernetes)
- **Frontend**: S3 + CloudFront (CDN)
- **Base de datos**: RDS PostgreSQL (Multi-AZ)
- **Caché**: ElastiCache Redis
- **Storage**: S3 para imágenes
- **CDN**: CloudFront
- **Logs**: CloudWatch
- **Monitoring**: CloudWatch + Datadog

**Opción alternativa (más económica):**
- **VPS**: DigitalOcean / Linode
- **Web server**: Nginx
- **PostgreSQL**: Managed Database
- **Redis**: Managed Redis
- **Storage**: DigitalOcean Spaces / Cloudinary

### 12.4 Dominios y SSL

- Registrar dominio (tiendi.com)
- Subdominios:
  - app.tiendi.com (plataforma principal)
  - {store-slug}.tiendi.com (tiendas individuales)
  - admin.tiendi.com (panel super admin)
- Certificados SSL (Let's Encrypt / AWS Certificate Manager)

### 12.5 Monitoreo y Logs

**Herramientas:**
- Sentry (error tracking)
- New Relic / Datadog (APM)
- LogRocket (session replay)
- Uptime monitoring (UptimeRobot)

**Alertas:**
- Errores críticos (500s)
- Downtime
- Latencia alta
- Memoria/CPU alta
- Disco lleno

### 12.6 Backups

- Backups automáticos diarios de PostgreSQL
- Retención de 30 días
- Backups de imágenes (S3 versioning)
- Plan de disaster recovery

**Tiempo estimado: 7-10 días**

---

## Cronograma General

| Fase | Duración | Dependencias |
|------|----------|--------------|
| Fase 1: Configuración inicial | 3-5 días | - |
| Fase 2: Autenticación y roles | 5-7 días | Fase 1 |
| Fase 3: Dashboard vendedor | 10-14 días | Fase 2 |
| Fase 4: Productos y categorías | 7-10 días | Fase 2 |
| Fase 5: Landing y geolocalización | 8-12 días | Fase 2 |
| Fase 6: Catálogo y carrito | 10-14 días | Fase 4, 5 |
| Fase 7: Pedidos y pagos | 14-18 días | Fase 3, 6 |
| Fase 8: Panel super admin | 10-14 días | Fase 2, 3 |
| Fase 9: Integraciones externas | 8-12 días | Fase 7 |
| Fase 10: Suscripciones | 10-14 días | Fase 8 |
| Fase 11: Testing y optimización | 10-14 días | Todas |
| Fase 12: Deploy y CI/CD | 7-10 días | Fase 11 |

**Duración total estimada: 14-18 semanas (3.5-4.5 meses)**

Con un equipo de:
- 1-2 desarrolladores fullstack
- 1 diseñador UI/UX (part-time)
- 1 QA tester (últimas fases)

---

## Consideraciones Adicionales

### Escalabilidad

**Arquitectura:**
- Microservicios (para futuro):
  - Auth service
  - Store service
  - Order service
  - Payment service
  - Notification service
- Message queue (RabbitMQ/SQS) para tareas asíncronas
- CDN para assets estáticos
- Database sharding (cuando haya muchas tiendas)

### Multi-tenancy

**Estrategia:**
- Shared database, shared schema
- Filtros por `store_id` en todas las queries
- Row-level security en PostgreSQL
- Aislamiento de datos entre tiendas

### Internacionalización (i18n)

**Idiomas iniciales:**
- Español (Perú)

**Futuro:**
- Inglés
- Portugués (Brasil)
- Otros países de LATAM

**Moneda:**
- PEN (Soles peruanos)
- Futuro: Multi-currency

### Compliance

**GDPR / Ley de Protección de Datos:**
- Política de privacidad
- Términos y condiciones
- Cookie consent
- Derecho al olvido (eliminar cuenta)
- Exportar datos personales

**PCI-DSS:**
- No almacenar datos de tarjetas (usar Stripe/PayPal)
- Tokens de pago únicos

### Roadmap Futuro

**V2 Features:**
- App móvil nativa (React Native / Flutter)
- Sistema de reviews y calificaciones
- Programa de lealtad/puntos
- Cupones y promociones avanzadas
- Multi-almacén (inventario distribuido)
- Integración con sistemas de facturación (SUNAT Perú)
- Marketplace de envíos (integrar con couriers)
- Chat en vivo tienda-cliente
- Video llamadas para soporte
- AR para preview de productos
- Recomendaciones con ML
- Dashboard mobile para vendedores

---

## Recursos y Documentación

### APIs y Servicios

- **NestJS**: https://docs.nestjs.com
- **Angular**: https://angular.io/docs
- **TypeORM**: https://typeorm.io
- **Stripe**: https://stripe.com/docs
- **Twilio (WhatsApp, SMS)**: https://www.twilio.com/docs
- **SendGrid**: https://docs.sendgrid.com
- **Google Maps API**: https://developers.google.com/maps
- **Google OAuth**: https://developers.google.com/identity
- **Facebook Login**: https://developers.facebook.com/docs/facebook-login

### Librerías Útiles

**Backend:**
- `@nestjs/passport` - Autenticación
- `@nestjs/jwt` - JWT tokens
- `@nestjs/typeorm` - ORM
- `bcrypt` - Hashing de contraseñas
- `class-validator` - Validación de DTOs
- `helmet` - Security headers
- `rate-limiter-flexible` - Rate limiting
- `bull` - Job queue con Redis

**Frontend:**
- `@angular/material` - UI components
- `@ngrx/store` - State management
- `ngx-translate` - Internacionalización
- `leaflet` / `@angular/google-maps` - Mapas
- `ngx-stripe` - Stripe integration
- `socket.io-client` - Real-time notifications

---

## Contacto y Soporte

Para cualquier duda o aclaración sobre esta planificación, contactar al equipo de desarrollo.

---

**Documento creado:** 2025-11-23
**Versión:** 1.0
**Próxima revisión:** Después de completar Fase 1
