# Análisis de Módulos - Sistema Tiendi

## Descripción General
**Tiendi** es una plataforma SaaS de e-commerce que conecta tiendas locales con clientes a través de búsqueda geolocalizada y compras en línea. El sistema permite a los usuarios encontrar tiendas cercanas, navegar productos, realizar compras y gestionar pedidos.

---

## Módulos Identificados

### 1. **Landing Page / Home**
- **Funcionalidades:**
  - Búsqueda geolocalizada con campo de texto
  - Mapa interactivo con marcadores de tiendas
  - Carrusel de promociones/productos destacados
  - Suscripción a newsletter
  - Enlaces a redes sociales
  - Menú principal: "Sobre nosotros", "Como funciona", "¿Quieres vender?", "Ingresar"

- **Componentes clave:**
  - Buscador principal
  - Mapa de geolocalización (Tiendi SAC © 2021)
  - Card promocional con diferentes medios de pago

---

### 2. **Autenticación de Usuarios**

#### 2.1 Login / Inicio de Sesión
- **Campos:**
  - Correo electrónico
  - Contraseña
  - Checkbox "Mantener sesión iniciada"
- **Opciones:**
  - Inicio de sesión con Google
  - Inicio de sesión con Facebook
  - Link a registro: "¿Aún no te has registrado? Regístrate aquí"

#### 2.2 Registro de Usuario
- **Campos:**
  - Tipo de documento (DNI)
  - Número de documento
  - Nombres
  - Apellido Paterno
  - Apellido Materno
  - Correo electrónico
  - Teléfono
  - Acepto los términos y condiciones (checkbox)
- **Validaciones:**
  - Aceptación de términos y condiciones obligatoria

---

### 3. **Búsqueda y Filtros**

#### 3.1 Búsqueda de Tiendas
- **Funcionalidades:**
  - Búsqueda por texto (ej: "cerveza")
  - Visualización de resultados en lista
  - Visualización de resultados en mapa
  - Información de tienda:
    - Nombre de la tienda
    - Dirección
    - Distancia (ej: "a 1 km")
    - Estado (Abierto/Cerrado)
  - Radio de búsqueda: 5 km

#### 3.2 Filtros de Búsqueda
- **Filtros disponibles:**
  - Abierto/Cerrado
  - Más cerca
  - Medios de pago:
    - Tarjetas de crédito/débito
    - Transferencia
    - Yape
    - Plin
  - Marca
  - Presentación

---

### 4. **Detalle de Tienda**

#### 4.1 Información de la Tienda
- **Datos mostrados:**
  - Horario de atención (ej: "Atendemos 24 hrs")
  - Dirección completa (ej: "Ca. Descripción 3920 Detalles, Provincia")
  - Enlace a dirección en mapa
  - Botón "Ver WhatsApp"
  - Botón "Ver teléfono"

#### 4.2 Navegación en Tienda
- **Elementos:**
  - Logo de la tienda
  - Búsqueda dentro de la tienda
  - Categorías de productos (Ofertas del día, Tortas y postres, etc.)
  - Breadcrumb de navegación
  - Icono de carrito de compras
  - Icono de pedidos
  - Icono de favoritos
  - Icono de mensajes/chat
  - Menú de usuario

---

### 5. **Catálogo de Productos**

#### 5.1 Vista de Productos
- **Elementos del producto:**
  - Imagen del producto
  - Marca
  - Nombre/Descripción
  - Precio actual (ej: S/ 90.00)
  - Precio anterior tachado (ej: S/ 100.00)
  - Badge de descuento (ej: "-10%")
  - Icono de favorito (corazón)
  - Selector de cantidad
  - Botón "Agregar"

#### 5.2 Vista Grid con Categorías
- **Características:**
  - Sidebar con categorías y subcategorías
  - Productos en grid (4 columnas)
  - Botón de filtros
  - Ordenamiento (ej: "Con mayor descuento", "Con menor descuento")
  - Paginación
  - Total de productos encontrados

#### 5.3 Detalle de Producto
- **Componentes:**
  - Galería de imágenes con thumbnails
  - Nombre del producto
  - Marca
  - Precio con descuento
  - Selector de cantidad
  - Botón "Agregar"
  - Icono de favorito
  - Sección "Información adicional" con descripción del producto
  - Breadcrumb completo

---

### 6. **Carrito de Compras**

#### 6.1 Carrito Lateral (Sidebar)
- **Información mostrada:**
  - Título: "Tienes X productos"
  - Lista de productos con:
    - Imagen
    - Nombre/Descripción
    - Marca
    - Precio unitario
    - Selector de cantidad
    - Botón eliminar (X)
  - Subtotal
  - Botón "Ir a bolsa de compras"

#### 6.2 Pedidos Recientes (Sidebar)
- **Información:**
  - Nombre de la tienda
  - Número de pedido
  - Cantidad de productos
  - Total
  - Estados con colores:
    - 🔴 OBI-ENVIAR (rojo)
    - 🔴 RECHAZADO (rojo)
    - 🔵 CONFIRMADO (azul)
    - 🟢 ENTREGADO (verde)
  - Botón "Ver historial"

---

### 7. **Proceso de Checkout**

#### 7.1 Bolsa de Compras - Paso 1: Productos
- **Elementos:**
  - Lista de productos seleccionados
  - Cantidad editable
  - Precio por producto
  - Botón eliminar
  - Subtotal
  - Botón "Continuar"
  - Indicador de pasos (1: Productos → 2: Despacho y pago)

#### 7.2 Bolsa de Compras - Paso 2: Despacho y Pago
- **Forma de despacho:**
  - Opción 1: Recojo en tienda
    - Dirección de recojo
  - Opción 2: Despacho a domicilio

- **Medio de pago:**
  - Efectivo (seleccionado por defecto)
  - Transferencia
  - Pago con tarjeta
  - Mensaje informativo según el medio seleccionado

- **Resumen del pedido:**
  - Lista de productos (imagen, nombre, cantidad, precio)
  - Subtotal
  - Concepto (si aplica)
  - Total
  - Checkbox de términos y condiciones
  - Botón "Enviar pedido"

---

### 8. **Gestión de Pedidos**

#### 8.1 Mis Pedidos
- **Información del pedido:**
  - Nombre de la tienda
  - Número de pedido
  - Estado con color distintivo
  - Total del pedido
  - Cantidad de productos
  - Opción "Ver más pedidos"
  - Buscador de pedidos (por número)

#### 8.2 Detalle de Pedido
- **Componentes:**
  - Número de pedido
  - Botón "Repetir pedido"
  - Resumen del pedido:
    - Lista de productos con imagen, marca, nombre, cantidad y precio
    - Subtotal
    - Despacho
    - Total
  - Información de despacho:
    - Dirección de recojo o entrega
  - Forma de pago seleccionada

---

### 9. **Confirmación de Pedido**
- **Elementos:**
  - Mensaje de confirmación: "Pedido enviado"
  - Texto de confirmación (Lorem ipsum successful message)
  - Notificación toast verde con check
  - Producto marcado como "Agregado" en el catálogo

---

### 10. **Sistema de Mensajería / Chat**

#### 10.1 Lista de Conversaciones
- **Información mostrada:**
  - Avatar de la tienda
  - Nombre de la tienda
  - Número de pedido
  - Timestamp (ej: "Hoy a las 10:08 am")
  - Vista previa del último mensaje

#### 10.2 Chat Individual
- **Características:**
  - Nombre de la tienda
  - Número de pedido
  - Historial de mensajes
  - Mensajes del sistema (ej: "Mensaje de la tienda sobre el pedido realizado")
  - Mensajes del cliente
  - Mensajes de la tienda
  - Botones rápidos:
    - "Mensaje de plantilla para realizar el pedido" (botón turquesa)
    - "¿A granel?" (botón turquesa)
  - Campo de texto para escribir mensaje
  - Botón "Enviar"

---

### 11. **Favoritos**
- **Funcionalidades:**
  - Icono de corazón en cada producto
  - Toggle para agregar/quitar de favoritos
  - Contador de favoritos en el header

---

### 12. **Formulario de Vendedores**
- **Modal: "¿Quieres vender con nosotros?"**
  - Campo: "¿Cómo te llamas?"
  - Campo: "Ingresa tu correo electrónico"
  - Campo: "Ingresa tu nro. de teléfono"
  - Botón "Mandaremos tu información"

---

### 13. **Páginas Legales**

#### 13.1 Términos y Condiciones
- **Contenido:**
  - Título: "Términos y condiciones"
  - Texto Lorem ipsum (contenido legal placeholder)
  - Botón "Volver"
  - Botón "Aceptar"

---

### 14. **Suscripción a Newsletter**
- **Estados:**
  1. Botón "Suscríbete"
  2. Campo de correo electrónico + botón "Suscríbirse"
  3. Mensaje de confirmación: "✓ Gracias por suscribirte"

---

## Componentes Globales

### Header
- **Elementos:**
  - Logo Tiendi
  - Links de navegación
  - Botón "¿Quieres vender?"
  - Botón "Ingresar" / Avatar de usuario
  - Iconos:
    - Carrito de compras (con badge de cantidad)
    - Pedidos
    - Favoritos
    - Mensajes (con badge de notificaciones)

### Footer
- **Secciones:**
  - Servicio al cliente:
    - Preguntas frecuentes
    - Cambios y devoluciones
    - Términos y condiciones
    - Política de privacidad
    - Libro de reclamaciones
  - Sobre la tienda:
    - Horarios de atención
    - Todos los días 24 hrs
    - Email de contacto
    - Ver dirección
    - Ver WhatsApp
  - Medios de pago:
    - Contraentrega
    - Pago en efectivo
    - Todas las tarjetas
    - Íconos: American Express, Mastercard, PayPal, Visa
  - Banner promocional: "Compra antes de las 2:00pm y recibe tu pedido hoy mismo!"
  - Powered by Tiendi © 2021
  - Redes sociales: Facebook, Twitter, LinkedIn, YouTube, Instagram

---

## Tecnologías y Características Técnicas Requeridas

### Frontend
- **Framework:** React/Next.js o Vue.js/Nuxt.js
- **Mapa:** Integración con Google Maps o Mapbox
- **Estado global:** Redux, Zustand o Context API
- **Autenticación social:** OAuth 2.0 (Google, Facebook)
- **Chat en tiempo real:** WebSockets o Firebase Realtime
- **Responsive design:** Mobile-first approach

### Backend
- **API RESTful** o GraphQL
- **Base de datos:** PostgreSQL o MongoDB
- **Autenticación:** JWT
- **Geolocalización:** PostGIS o servicios de geolocalización
- **Notificaciones:** Email (SMTP) y Push notifications
- **Pasarela de pago:** Integración con Visa, Mastercard, PayPal

### Integraciones
- **WhatsApp Business API**
- **Google Maps API**
- **Servicios de email** (SendGrid, Mailgun)
- **CDN** para imágenes

---

## Priorización de Desarrollo (Sugerencia)

### Fase 1 - MVP (Mínimo Producto Viable)
1. ✅ Autenticación de usuarios (login/registro)
2. ✅ Búsqueda de tiendas con geolocalización
3. ✅ Catálogo de productos básico
4. ✅ Carrito de compras
5. ✅ Checkout básico (sin integración de pagos)
6. ✅ Gestión de pedidos básica

### Fase 2 - Funcionalidades Principales
1. ✅ Integración de medios de pago
2. ✅ Sistema de filtros avanzados
3. ✅ Detalle de producto completo
4. ✅ Historial de pedidos con estados
5. ✅ Favoritos
6. ✅ Perfil de usuario

### Fase 3 - Características Avanzadas
1. ✅ Sistema de mensajería/chat
2. ✅ Notificaciones push y email
3. ✅ Sistema de valoraciones y reseñas
4. ✅ Dashboard para vendedores
5. ✅ Analytics y reportes
6. ✅ Sistema de cupones y descuentos

### Fase 4 - Optimizaciones y Extras
1. ✅ Progressive Web App (PWA)
2. ✅ Optimización SEO
3. ✅ Panel administrativo completo
4. ✅ Integración con WhatsApp Business
5. ✅ Sistema de recomendaciones
6. ✅ Multi-idioma

---

## Flujos de Usuario Principales

### 1. Flujo de Compra
```
Home → Búsqueda → Selección de Tienda → Catálogo →
Agregar al Carrito → Ver Carrito → Checkout →
Selección de Despacho → Selección de Pago → Confirmar Pedido →
Confirmación
```

### 2. Flujo de Registro/Login
```
Click en "Ingresar" → Login (o Registro) →
Autenticación Social (opcional) → Home Autenticado
```

### 3. Flujo de Seguimiento de Pedido
```
Click en Pedidos → Ver Mis Pedidos →
Seleccionar Pedido → Ver Detalle →
Chat con Tienda (opcional)
```

---

## Notas Adicionales

- El sistema está diseñado para el mercado peruano (moneda: S/ - Soles)
- Enfoque en tiendas de conveniencia y minimarkets
- Soporte para delivery y recojo en tienda
- Énfasis en geolocalización y proximidad
- Sistema multi-tenant (cada tienda es independiente)
- Necesita panel de administración para vendedores (no visible en prototipo)

---

**Fecha de análisis:** 2025-11-23
**Basado en:** 32 imágenes de prototipo del sistema Tiendi
