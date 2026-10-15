# Análisis de Módulos Core: Tiendas, Ventas y Pedidos en tiendi-admin

Evaluación arquitectónica y de experiencia operativa sobre los módulos de **Tiendas**, **Ventas** y **Pedidos** en `tiendi-admin`. Identifica la información faltante, los datos agregables de alto impacto y las oportunidades de integración con el backend (`tiendi-api`).

---

## 1. Resumen Ejecutivo y Matriz de Estado

| Módulo | Alcance Actual | Información Faltante Crítica | Oportunidad de Alto Valor |
|---|---|---|---|
| **Tiendas** (`/admin/stores`) | Revisión básica de tienda y cambio de estado (`PENDING`, `ACTIVE`, `SUSPENDED`). | Datos del propietario (KYC: nombre, DNI/RUC, email), motivo de suspensión auditado. | Métricas operativas del tenant (GMV acumulado, catálogo activo, rating) y navegación contextual. |
| **Ventas** (`/admin/sales`) | Métricas agregadas de negocio (GMV, pedidos, ticket promedio, top 5). | Margen / comisiones netas de la plataforma (Take Rate), costos de pasarela, serie temporal (gráfica). | Desglose por método de pago (Yape/Plin vs Tarjeta), ventas por ciudad/zona y exportación CSV. |
| **Pedidos** (`/admin/orders`) | Listado global, auditoría de máquina de estados y detalle de ítems. | Datos del repartidor asignado en delivery, trazabilidad técnica de pasarela (`chargeId`), emisión de comprobante. | Acciones directas de soporte (cancelación forzosa, reasignación de rider, escalado a ticket). |

---

## 2. Detalle por Módulo

### 2.1 Módulo: Tiendas (`/admin/stores`)

#### Estado Actual
* Tabla con paginación de 20 registros: Nombre, Slug, Ciudad, Dirección, Contacto, Estado.
* Diálogo modal para revisión de atributos descriptivos y contacto.
* Acción binaria: Activar (`ACTIVE`) o Suspender (`SUSPENDED`).

#### Datos que Faltan o se Pueden Agregar
1. **Identidad del Propietario (Owner KYC):**
   * *Actual:* Solo expone el identificador crudo `store.ownerId`.
   * *Propuesta:* Integrar nombre completo del titular, DNI/CE/RUC, correo verificado y teléfono de contacto principal (obtenido de `users` / Kipu). Sin esto, la aprobación de una tienda es a ciegas.
2. **Métricas de Operación del Tenant:**
   * Total de productos publicados y en stock.
   * Volumen de ventas acumulado (GMV histórico) y pedidos totales despachados.
   * Antigüedad de la tienda (`createdAt`) y fecha de última venta/actividad.
3. **Estado Financiero y de Liquidaciones:**
   * Cuenta bancaria configurada para liquidación (Banco, Tipo de cuenta, CCI).
   * Estado de payouts y saldo pendiente por liquidar en el ledger.
4. **Políticas de Entrega y Cobertura:**
   * Tipo de logística configurada: Repartidores propios de tienda vs. Repartidores de la plataforma (Shield).
   * Radio de entrega en kilómetros y costo base de envío.
5. **Auditoría y Justificación de Suspensión:**
   * Campo obligatorio de "Motivo de suspensión" (`rejectionReason` / `suspensionReason`).
   * Registro histórico de quién aprobó o suspendió la tienda y en qué fecha.
6. **Enlaces de Navegación Contextual (Cross-Navigation):**
   * Botón directo: *"Ver tienda pública"* (`tiendi-web/:slug`).
   * Botón directo: *"Ver pedidos de esta tienda"* (`/admin/orders?storeId=...`).
   * Botón directo: *"Ver analítica de esta tienda"* (`/admin/sales?storeId=...`).

---

### 2.2 Módulo: Ventas (`/admin/sales`)

#### Estado Actual
* Selector de períodos: Hoy, Últimos 7 días, Últimos 30 días, Últimos 12 meses, Personalizado.
* Tarjetas KPI con deltas porcentuales: Ventas Totales, Pedidos, Ticket Promedio, Tiendas activas.
* Barra de estados de órdenes agregadas.
* Top 5 tiendas y Top 5 productos por facturación.
* Tabla rápida de pedidos de plataforma con panel lateral de previsualización.

#### Datos que Faltan o se Pueden Agregar
1. **Ingresos Netos de la Plataforma (Take Rate & Monetización):**
   * *Actual:* Muestra únicamente el GMV bruto (dinero transaccionado por los vendedores).
   * *Propuesta:* Agregar KPIs de ingresos de Tiendi:
     * Comisión neta de plataforma (S/ recaudados por comisión porcentual/fija).
     * Comisiones retenidas por pasarelas de pago (costo financiero Niubiz/Stripe/MercadoPago).
     * Ingresos por cobro de delivery de plataforma o suscripciones activas.
2. **Visualización de Tendencia Temporal (Gráfico de Serie Temporal):**
   * Falta un gráfico interactivo (barras/línea) que muestre la curva de facturación diaria u horaria, identificando picos y caídas de demanda.
3. **Desglose por Canal de Pago:**
   * Distribución de volumen transaccionado: Billeteras digitales (Yape / Plin) vs. Tarjetas (Débito / Crédito) vs. Contra Entrega (Efectivo/POS).
   * Tasa de conversión y porcentaje de transacciones fallidas (`paymentStatus === 'FAILED'`).
4. **Desglose Geográfico (Cobertura SaaS):**
   * Volumen de ventas segmentado por ciudad y distrito (crucial para evaluar expansión territorial).
5. **Reportabilidad Contable:**
   * Botón de descarga/exportación a CSV / Excel del balance analítico para conciliación mensual.

---

### 2.3 Módulo: Pedidos (`/admin/orders`)

#### Estado Actual
* Filtros por búsqueda (`orderNumber`, cliente) y estado (`PENDING`, `CONFIRMED`, `DISPATCHED`, `DELIVERED`, `REJECTED`).
* Tabla general con tipo de entrega (Domicilio vs. Retiro), importes y datos del cliente.
* Vista de detalle (`/admin/orders/:id`) con desglose de ítems, precios, impuestos, estado de pago y componente de tracking con historial de estados.

#### Datos que Faltan o se Pueden Agregar
1. **Trazabilidad de Logística y Repartidor (Rider Tracking):**
   * *Actual:* Si el pedido es `DELIVERY`, solo muestra un tag genérico.
   * *Propuesta:* Mostrar datos del repartidor asignado:
     * Nombre, teléfono de contacto y vehículo/placa.
     * Enlace al perfil del repartidor (`/admin/riders/:id`).
     * Última posición GPS o tiempo estimado de entrega (ETA).
2. **Detalle Técnico de la Pasarela de Pago:**
   * Identificador único de transacción (`gatewayChargeId`).
   * Método de pago específico (marca de tarjeta, últimos 4 dígitos, código de autorización bancaria).
   * Enlace directo a la conciliación en Ledger (`/admin/finance/ledger`) o a la sección de devoluciones (`refunds`).
3. **Acciones Operativas y de Contingencia del Super Admin:**
   * Cancelación forzosa con motivo y disparo de devolución al cliente.
   * Reasignación manual de repartidor si un pedido quedó bloqueado en despacho.
   * Creación directa de ticket de soporte vinculado al pedido (`/admin/support`).
4. **Comprobante de Pago y Facturación Electrónica:**
   * Estado de emisión de comprobante tributario: Boleta / Factura Electrónica emitida (`invoicing`).
   * Número de serie, correlativo y acceso al PDF/XML para responder a disputas de clientes.
5. **Filtros Avanzados en el Listado:**
   * Filtro por tienda específica (selector con autocompletado).
   * Filtro por estado de pago (`PAID`, `PENDING`, `FAILED`, `REFUNDED`).
   * Filtro por rango de fechas (desde / hasta).

---

## 3. Checklist de Priorización

### Fase 1: Datos Esenciales (Bajo esfuerzo, alto impacto operativo)
- [ ] **Tiendas:** Cargar nombre, email y documento del propietario en el modal de revisión (evita aprobaciones a ciegas).
- [ ] **Tiendas:** Agregar motivo obligatorio al suspender una tienda.
- [ ] **Pedidos:** Exponer enlace directo al repartidor asignado y datos de contacto en pedidos con delivery.
- [ ] **Ventas:** Incorporar KPI de comisión neta de la plataforma (Take Rate) junto al GMV.

### Fase 2: Navegación y Usabilidad
- [ ] **Cross-Navigation:** Enlazar Tienda $\rightarrow$ Pedidos de la tienda $\rightarrow$ Ventas de la tienda.
- [ ] **Pedidos:** Permitir filtrar pedidos por Tienda específica y por estado de pago.
- [ ] **Ventas:** Habilitar exportación de reportes a CSV.

### Fase 3: Integraciones Avanzadas
- [ ] **Ventas:** Implementar gráfico interactivo de tendencia temporal diaria/semanal.
- [ ] **Pedidos:** Vincular comprobante tributario electrónico (PDF/XML) y gateway transaction ID.
- [ ] **Pedidos:** Acciones de contingencia (cancelar con refund, escalar a soporte).
