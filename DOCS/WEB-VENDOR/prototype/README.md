# Tiendi Vendor — Prototipos HTML

Prototipos estáticos del Panel del Vendedor (Store Manager Dashboard).
No requieren servidor — abrí cualquier archivo directamente en el navegador.

## Stack

- **HTML + CSS puro** — sin frameworks
- **Material Icons** (Google Fonts CDN) — íconos
- **Chart.js** (CDN) — gráficos en Dashboard y Analytics

## Pantallas

| Archivo | Pantalla | Interacciones destacadas |
|---|---|---|
| `dashboard.html` | Dashboard principal | KPI cards, gráfico de ventas (Chart.js), tabla de pedidos recientes, alertas de stock bajo |
| `orders.html` | Lista de pedidos | Filtros por estado (tabs), búsqueda en tiempo real, confirmar / despachar / entregar inline |
| `orders-detail.html` | Detalle de pedido | Timeline de estado, cambio de estado con actualización visual, datos del cliente y productos |
| `products.html` | Catálogo de productos | Vista grilla, filtros por categoría y stock, modal de confirmación para eliminar |
| `products-form.html` | Formulario de producto | Drag & drop de imágenes, preview en tiempo real, selects en cascada categoría → subcategoría |
| `store.html` | Configuración de tienda | Tabs (Información / Horarios / Delivery / Pagos / Facturación / Apariencia), toggles de estado |
| `analytics.html` | Analytics | 3 gráficos Chart.js (línea, doughnut, barras), top 5 productos, filtro de período |
| `customers.html` | Clientes | Tabla con búsqueda, modal de detalle, filtros por tipo (VIP / nuevo / regular) |
| `notifications.html` | Notificaciones | Marcar como leído, filtrar por tipo, configurar preferencias |
| `subscription.html` | Suscripción / planes | Toggle mensual/anual con precios dinámicos, comparativa de planes, modal de cancelación |
| `staff.html` | Staff y empleados | Tabla de colaboradores, modal de invitación, roles y permisos |
| `legal.html` | Facturación y Legal | Comprobantes electrónicos (SUNAT), Libro de Reclamaciones |
| `onboarding.html` | Wizard de configuración inicial | Setup en 4 pasos para nuevos vendedores |

## Modelo de categorías

Las categorías siguen un modelo **híbrido**:

- **Categorías globales** → definidas por el equipo de Tiendi, disponibles para todos los vendedores (solo lectura)
- **Subcategorías propias** → cada vendedor puede crear las suyas dentro de cualquier categoría global

La gestión se hace desde `products.html` → pestaña **Categorías**.
Al crear un producto (`products-form.html`), se elige primero la categoría global y luego la subcategoría propia (opcional).

## Diseño

El sistema de diseño está definido en `styles.css` con CSS custom properties:

```css
--primary:     #10B981   /* verde principal */
--secondary:   #3B82F6   /* azul secundario */
--warning:     #F59E0B   /* amarillo alertas */
--danger:      #EF4444   /* rojo errores */
--text:        #111827
--text-muted:  #6B7280
--border:      #E5E7EB
--bg:          #F9FAFB
```

Este archivo sirve como referencia directa para configurar el tema de PrimeNG cuando se implemente el proyecto Angular.
