# Historias de Usuario - Tiendi

## Índice

1. [Super Admin](#super-admin)
2. [Vendedor / Dueño de Tienda](#vendedor--dueño-de-tienda)
3. [Empleado de Tienda](#empleado-de-tienda)
4. [Cliente](#cliente)

---

## Super Admin

### US-SA-01: Visualizar dashboard de la plataforma
**Como** super admin
**Quiero** visualizar un dashboard con métricas globales
**Para** monitorear el rendimiento de la plataforma

**Criterios de aceptación:**
- Ver total de tiendas (activas, pendientes, suspendidas)
- Ver total de ventas en la plataforma
- Ver comisiones generadas
- Ver usuarios registrados por rol
- Ver gráficos de crecimiento temporal

---

### US-SA-02: Aprobar nuevas tiendas
**Como** super admin
**Quiero** revisar y aprobar/rechazar solicitudes de nuevas tiendas
**Para** asegurar la calidad de la plataforma

**Criterios de aceptación:**
- Ver listado de tiendas pendientes de aprobación
- Ver detalles completos de la tienda
- Aprobar una tienda (cambia a estado "activa")
- Rechazar una tienda con motivo
- Notificar al vendedor de la decisión

---

### US-SA-03: Gestionar planes de suscripción
**Como** super admin
**Quiero** crear y modificar planes de suscripción
**Para** ofrecer diferentes opciones a los vendedores

**Criterios de aceptación:**
- Crear nuevo plan con características y precio
- Editar plan existente
- Activar/desactivar planes
- Ver estadísticas de conversión por plan

---

### US-SA-04: Suspender tiendas
**Como** super admin
**Quiero** suspender tiendas que violen políticas
**Para** mantener la calidad del marketplace

**Criterios de aceptación:**
- Buscar y seleccionar tienda
- Suspender tienda con motivo
- Tienda suspendida no aparece en búsquedas
- Notificar al vendedor
- Reactivar tienda cuando se resuelva el problema

---

## Vendedor / Dueño de Tienda

### US-V-01: Registrarme como vendedor
**Como** emprendedor
**Quiero** registrarme en la plataforma
**Para** crear mi tienda online

**Criterios de aceptación:**
- Registro con email y contraseña
- Registro con Google/Facebook
- Verificación de email
- Seleccionar rol "vendedor"
- Recibir email de bienvenida

---

### US-V-02: Crear mi tienda
**Como** vendedor
**Quiero** completar el formulario de creación de tienda
**Para** empezar a vender mis productos

**Criterios de aceptación:**
- Ingresar información básica (nombre, descripción)
- Subir logo y banner
- Seleccionar ubicación en mapa interactivo
- Configurar horarios de atención
- Seleccionar métodos de pago aceptados
- Definir radio de entrega
- Seleccionar plan de suscripción
- Enviar para aprobación

---

### US-V-03: Agregar productos
**Como** vendedor
**Quiero** agregar productos a mi catálogo
**Para** que los clientes puedan comprarlos

**Criterios de aceptación:**
- Ingresar información del producto (nombre, descripción, precio)
- Subir múltiples imágenes
- Seleccionar categoría
- Ingresar SKU y stock
- Configurar precio especial (oferta)
- Activar/desactivar producto
- Producto visible en el catálogo inmediatamente

---

### US-V-04: Recibir notificación de nuevo pedido
**Como** vendedor
**Quiero** recibir notificación inmediata al recibir un pedido
**Para** procesarlo rápidamente

**Criterios de aceptación:**
- Recibir notificación por WhatsApp
- Recibir notificación por Email
- Recibir notificación por SMS (opcional)
- Ver detalle del pedido desde la notificación

---

### US-V-05: Gestionar pedidos
**Como** vendedor
**Quiero** ver y actualizar el estado de los pedidos
**Para** mantener informado al cliente

**Criterios de aceptación:**
- Ver listado de pedidos con filtros
- Ver detalle completo de cada pedido
- Actualizar estado del pedido:
  - Confirmar pedido
  - Marcar como "en preparación"
  - Marcar como "en tránsito"
  - Marcar como "entregado"
  - Rechazar pedido (con motivo)
- Cliente recibe notificación al cambiar estado
- Imprimir nota de venta

---

### US-V-06: Configurar mi tienda
**Como** vendedor
**Quiero** personalizar la apariencia y configuración de mi tienda
**Para** que refleje mi marca

**Criterios de aceptación:**
- Cambiar colores principales
- Actualizar logo y banner
- Modificar información de contacto
- Actualizar horarios
- Configurar políticas (términos, devoluciones)
- Integrar WhatsApp Business

---

### US-V-07: Ver estadísticas de mi tienda
**Como** vendedor
**Quiero** ver estadísticas de ventas y productos
**Para** tomar decisiones de negocio

**Criterios de aceptación:**
- Ver ventas del día/semana/mes
- Ver productos más vendidos
- Ver número de pedidos
- Ver gráficos de tendencia
- Exportar reportes (CSV, PDF)

---

### US-V-08: Gestionar empleados
**Como** dueño de tienda
**Quiero** agregar empleados a mi tienda
**Para** que me ayuden a gestionar pedidos

**Criterios de aceptación:**
- Agregar empleado por email
- Asignar permisos específicos
- Ver actividad de cada empleado
- Desactivar acceso de empleado

---

### US-V-09: Cambiar plan de suscripción
**Como** vendedor
**Quiero** actualizar mi plan de suscripción
**Para** acceder a más funcionalidades

**Criterios de aceptación:**
- Ver comparativa de planes
- Hacer upgrade inmediato
- Hacer downgrade al final del período
- Ver historial de pagos
- Descargar facturas

---

## Empleado de Tienda

### US-E-01: Iniciar sesión
**Como** empleado
**Quiero** iniciar sesión con mi cuenta
**Para** gestionar la tienda

**Criterios de aceptación:**
- Login con email y contraseña
- Ver solo las tiendas donde tengo permisos
- Ver solo las funcionalidades permitidas

---

### US-E-02: Actualizar estado de pedidos
**Como** empleado
**Quiero** cambiar el estado de los pedidos
**Para** mantener el flujo de trabajo actualizado

**Criterios de aceptación:**
- Ver listado de pedidos pendientes
- Cambiar estado según permisos
- No puedo eliminar pedidos
- No puedo acceder a configuración de tienda

---

## Cliente

### US-C-01: Buscar tiendas cercanas
**Como** cliente
**Quiero** buscar tiendas cerca de mi ubicación
**Para** encontrar productos que necesito rápidamente

**Criterios de aceptación:**
- Ver mapa con tiendas cercanas
- Ver marcadores de tiendas en el mapa
- Filtrar por distancia (5km, 10km, 20km)
- Ver distancia en km de cada tienda
- Ver si la tienda está abierta/cerrada
- Hacer clic en marcador para ver info rápida

---

### US-C-02: Buscar productos
**Como** cliente
**Quiero** buscar productos por nombre
**Para** encontrar lo que necesito

**Criterios de aceptación:**
- Buscador con autocompletado
- Ver sugerencias al escribir
- Ver resultados agrupados por tienda
- Ver precio y disponibilidad
- Filtrar por categoría
- Filtrar por precio
- Filtrar por tienda

---

### US-C-03: Ver catálogo de una tienda
**Como** cliente
**Quiero** explorar los productos de una tienda
**Para** decidir qué comprar

**Criterios de aceptación:**
- Ver grid de productos con imágenes
- Ver precio actual y precio anterior
- Ver badge de descuento
- Filtrar por categoría
- Ordenar por precio, nombre, popularidad
- Ver "ofertas del día"
- Agregar a favoritos

---

### US-C-04: Agregar productos al carrito
**Como** cliente
**Quiero** agregar productos al carrito
**Para** comprarlos después

**Criterios de aceptación:**
- Seleccionar cantidad deseada
- Botón "Agregar al carrito"
- Ver confirmación visual (botón cambia a "Agregado" ✓)
- Ver contador de carrito actualizado
- Carrito persiste si cierro la página

---

### US-C-05: Ver mi carrito
**Como** cliente
**Quiero** revisar los productos en mi carrito
**Para** confirmar mi compra

**Criterios de aceptación:**
- Ver lista de productos en carrito
- Modificar cantidad de cada producto
- Eliminar productos del carrito
- Ver subtotal actualizado
- Ver costo de envío estimado
- Continuar comprando o proceder al checkout

---

### US-C-06: Realizar pedido
**Como** cliente
**Quiero** completar el proceso de compra
**Para** recibir mis productos

**Criterios de aceptación:**
- Seleccionar método de entrega (pickup/delivery)
- Ingresar dirección de entrega (si es delivery)
- Validar que estoy dentro del radio de entrega
- Seleccionar método de pago
- Ver resumen del pedido
- Confirmar pedido
- Ver pantalla de confirmación
- Recibir email de confirmación

---

### US-C-07: Pagar con tarjeta
**Como** cliente
**Quiero** pagar con tarjeta de crédito/débito
**Para** completar mi compra de forma segura

**Criterios de aceptación:**
- Ver formulario seguro de Stripe/PayPal
- Ingresar datos de tarjeta
- Procesar pago
- Ver confirmación de pago exitoso
- Pago se refleja inmediatamente en el pedido

---

### US-C-08: Pagar con Yape/Plin
**Como** cliente
**Quiero** pagar con billetera digital
**Para** usar mi método de pago preferido

**Criterios de aceptación:**
- Ver datos de cuenta de la tienda (número de teléfono)
- Realizar pago en app externa
- Subir comprobante de pago
- Pedido queda como "pago pendiente de verificación"
- Vendedor aprueba el pago
- Recibir notificación de aprobación

---

### US-C-09: Seguir mi pedido
**Como** cliente
**Quiero** ver el estado de mi pedido
**Para** saber cuándo llegará

**Criterios de aceptación:**
- Ver listado de mis pedidos
- Ver estado actual de cada pedido
- Ver detalle del pedido
- Ver historial de cambios de estado
- Recibir notificaciones de cambios
- Ver tiempo estimado de entrega

---

### US-C-10: Cancelar pedido
**Como** cliente
**Quiero** cancelar un pedido antes de que sea procesado
**Para** cambiar de opinión sobre la compra

**Criterios de aceptación:**
- Solo puedo cancelar si está en estado "pendiente"
- Ingresar motivo de cancelación
- Pedido cambia a "cancelado"
- Si pagué, se procesa reembolso
- Recibir confirmación de cancelación

---

### US-C-11: Ver mis pedidos anteriores
**Como** cliente
**Quiero** ver el historial de mis pedidos
**Para** hacer seguimiento y repetir compras

**Criterios de aceptación:**
- Ver listado de todos mis pedidos
- Filtrar por estado (activos, completados, cancelados)
- Ver detalle de cada pedido
- Botón "Repetir pedido" en pedidos completados
- Al repetir, se agregan los mismos productos al carrito

---

### US-C-12: Contactar a la tienda
**Como** cliente
**Quiero** comunicarme con la tienda
**Para** hacer consultas sobre productos o pedidos

**Criterios de aceptación:**
- Ver botón de WhatsApp en página de tienda
- Ver teléfono de contacto
- Ver email de contacto
- Al hacer clic en WhatsApp, se abre chat con mensaje predefinido

---

### US-C-13: Marcar productos como favoritos
**Como** cliente
**Quiero** guardar productos como favoritos
**Para** comprarlos después

**Criterios de aceptación:**
- Hacer clic en ícono de corazón en producto
- Producto se guarda en mis favoritos
- Ver listado de mis favoritos
- Quitar de favoritos
- Agregar al carrito desde favoritos

---

### US-C-14: Recibir notificaciones
**Como** cliente
**Quiero** recibir notificaciones sobre mis pedidos
**Para** estar informado del estado

**Criterios de aceptación:**
- Notificación cuando se confirma el pedido
- Notificación cuando está en preparación
- Notificación cuando está en camino
- Notificación cuando está entregado
- Puedo elegir canal: email, SMS, WhatsApp
- Puedo desactivar notificaciones

---

### US-C-15: Ver información de la tienda
**Como** cliente
**Quiero** ver información detallada de la tienda
**Para** confiar en mi compra

**Criterios de aceptación:**
- Ver horarios de atención
- Ver métodos de pago aceptados
- Ver políticas de devolución
- Ver términos y condiciones
- Ver ubicación en mapa
- Ver calificación (futuro)
- Ver tiempo en la plataforma

---

## Historias de Usuario - Fase 2 (Futuro)

### US-C-16: Calificar productos y tiendas
**Como** cliente
**Quiero** dejar reseñas de productos
**Para** ayudar a otros compradores

---

### US-C-17: Usar cupones de descuento
**Como** cliente
**Quiero** aplicar cupones de descuento
**Para** ahorrar en mi compra

---

### US-V-10: Crear promociones y ofertas
**Como** vendedor
**Quiero** crear ofertas especiales
**Para** aumentar mis ventas

---

### US-V-11: Ver análisis de conversión
**Como** vendedor (plan premium)
**Quiero** ver métricas de conversión
**Para** optimizar mis productos

---

### US-SA-05: Ver mapa de calor de ventas
**Como** super admin
**Quiero** ver un mapa de calor de ventas por zona
**Para** identificar oportunidades de expansión

---

**Documento creado:** 2025-11-23
**Total de historias:** 28
**Versión:** 1.0
