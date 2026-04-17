# Módulos Faltantes y Especificaciones — Panel del Vendedor (Store Manager Dashboard)

Tras la auditoría de las fuentes actuales (`tiendi-api` y `tiendi-web`), se definen los siguientes módulos críticos para convertir la plataforma en un SaaS real y competitivo.

---

## 1. Módulo de Analytics y Dashboard (ESTADO: CRÍTICO - PENDIENTE)
Este es el corazón del panel. Actualmente la carpeta en el backend está vacía.
*   **KPIs en Tiempo Real:** Ventas totales (S/), Pedidos completados, Ticket promedio.
*   **Gráficos de Tendencia:** Visualización de ventas diarias y semanales para toma de decisiones.
*   **Ranking de Productos:** Top 5 productos con mayor rotación y margen de ganancia.
*   **Embudos de Conversión:** Cuántos clientes entran a la tienda vs. cuántos terminan la compra.

## 2. Módulo de Gestión de Pedidos (ESTADO: AVANZADO EN BACKEND / PENDIENTE EN UI)
El backend ya tiene los endpoints de confirmación y despacho. Falta la interfaz operativa.
*   **Monitor en Tiempo Real:** Lista dinámica con WebSockets (Socket.io) para alertas instantáneas de ventas.
*   **Gestión de Estados:** Interfaz rápida para pasar pedidos de `confirmado` -> `preparando` -> `en_camino` -> `entregado`.
*   **Detalle Logístico:** Mapa con la ubicación exacta del cliente y botón de contacto rápido vía WhatsApp.

## 3. Módulo de Inventario y Catálogo Dinámico (ESTADO: BÁSICO)
Faltan funcionalidades de gestión masiva y variantes.
*   **Gestión de Variantes (SKUs):** Soporte para productos con múltiples tallas, colores o presentaciones.
*   **Carga Masiva:** Importación y exportación de productos vía Excel o CSV para catálogos grandes.
*   **Alertas de Stock Bajo:** Configuración de umbrales mínimos para recibir avisos automáticos al celular.
*   **Gestión de Imágenes:** Integración con Cloudinary para optimización automática de fotos.

## 4. Módulo de Configuración de Tienda y Logística (ESTADO: BÁSICO)
Falta la gestión de logística avanzada y branding.
*   **Zonas de Reparto (Geofencing):** Herramienta para dibujar polígonos manuales en el mapa y definir áreas de entrega precisas (GeoJSON).
*   **Tarifario Variable:** Cobrar delivery según la zona de reparto o distancia.
*   **Horarios y Feriados:** Configuración de tiempos de atención y cierre automático por días no laborables.

## 5. Módulo de Gestión de Empleados y Roles (ESTADO: PENDIENTE)
*   **Staff de Tienda:** Invitar colaboradores por correo electrónico.
*   **Permisos Granulares:** Definir roles (ej: "Solo Despachador" no puede ver las ventas totales).

## 6. Módulo de Clientes y Fidelización (ESTADO: PENDIENTE)
*   **CRM Básico:** Directorio de clientes con historial de compras y productos favoritos.
*   **Cupones Propios:** Capacidad del vendedor para crear sus propios códigos de descuento para sus clientes.

## 7. Módulo de Facturación y Legal (ESTADO: PENDIENTE - OBLIGATORIO)
*   **Facturación Electrónica (SUNAT):** Integración para emitir boletas/facturas automáticas al concretar la venta.
*   **Libro de Reclamaciones Digital:** Obligatorio por INDECOPI para evitar multas.

---
**Documento generado para:** Tiendi SaaS Project
**Fecha de última auditoría:** 2026-04-15
