# Informe de Implementación: Adecuaciones de Tiendas, Pagos y Trazabilidad (Etapas P0–P6)

**Fecha:** 11 de Octubre de 2026  
**Proyecto:** Tiendi SaaS E-commerce  
**Referencia:** `DOCS/ADMIN-TIENDAS-PAGOS-Y-TRAZABILIDAD-ADECUACIONES.md`  
**Alcance ejecutado:** Etapas obligatorias P0 a P6. (Las ampliaciones de la sección 13 quedan fuera de esta entrega, según lo acordado).

---

## 1. Resumen Ejecutivo

Se completó la implementación integral y verificación técnica de las etapas obligatorias P0 a P6 definidas en la guía de adecuaciones para Tiendas, Pagos y Trazabilidad:

1. **Unificación y normalización de métodos e instrucciones de pago:**
   - Se definió un modelo canónico normalizado (`StorePaymentConfiguration`) en `tiendi-api` que reconcilia las fuentes divergentes (`paymentMethods` y `paymentMessages`).
   - Se implementó detección estricta de conflictos (`hasConflict: true`) priorizando `paymentMethods` sin concatenar textos contradictorios.
   - Se implementó preservación de borrados explícitos (`message: ""` se respeta y no revive notas legacy).
   - Se garantizó la suficiencia de datos (`COMPLETE`, `INCOMPLETE`, `UNKNOWN`) distinguiendo datos verificados de habilitaciones parciales (caso captura Tienda Test2: Yape/Plin habilitados sin QR/número muestran `Habilitado · Configuración no verificada`).

2. **Cálculo de disponibilidad comercial y operativa:**
   - El backend evalúa la disponibilidad efectiva en zona horaria oficial `America/Lima` (`America/Lima`), distinguiendo la bandera manual (`isOpen`), la concordancia con horarios (`scheduleMatch`) y el estado efectivo (`effectiveStatus`) con su motivo descriptivo (`reason`).
   - El Admin y la tienda web consumen esta disponibilidad calculada por el backend.

3. **Inmutabilidad y trazabilidad histórica de cobro:**
   - Se añadió el campo `paymentSnapshot Json?` en la entidad `Order` de Prisma (`tiendi-api`) con su correspondiente migración `20261011140000_order_payment_snapshot`.
   - Al crear un pedido en `orders.service.ts`, se captura y congela la configuración de pagos vigente del comercio.
   - En Admin Venta (`SaleDetailPage`), se exponen las instrucciones históricas capturadas o se reporta explícitamente «Instrucciones históricas no disponibles» para pedidos anteriores a la migración, sin inventar datos.

4. **Separación de roles entre Venta y Pedido:**
   - La vista de Ventas se enfoca en la perspectiva comercial y financiera («Pago e importes», totales, estado de cobro, desglose de items y snapshot histórico).
   - La vista de Pedidos se enfoca en el seguimiento operativo (asignación, estados de reparto, historial de eventos y auditoría).
   - Un pedido entregado (`DELIVERED`) nunca se marca automáticamente como pagado (`PAID`).
   - Se vincularon ambas pantallas de forma bidireccional conservando filtros (`queryParams`).

5. **Modo consulta estricto en Admin:**
   - `tiendi-admin` se mantiene estrictamente en modo consulta y auditoría para las configuraciones comerciales.
   - Las modificaciones comerciales de pagos y tienda residen en `tiendi-vendor`.

---

## 2. Cambios por Aplicación y Archivos Relevantes

### A. Tiendi API (`FUENTES/tiendi-api`)
- `src/modules/stores/payment-configuration.util.ts`:
  - Utilidad canónica para normalizar `paymentMethods` y `paymentMessages` en `StorePaymentConfiguration`.
  - Detección de conflictos, validación de suficiencia (`COMPLETE`, `INCOMPLETE`, `UNKNOWN`) y cálculo de `effectiveAvailability` en timezone `America/Lima`.
- `src/modules/stores/payment-configuration.util.spec.ts`:
  - 9 pruebas unitarias verificando casos de suficiencia, conflictos, borrados explícitos y horarios en Lima.
- `src/modules/stores/stores.service.ts`:
  - `findBySlug` y `findByIdForVendor` retornan `paymentConfiguration` y `effectiveAvailability`.
  - `update` hace merge profundo de `paymentMethods` preservando métodos no editados en el formulario.
- `src/modules/stores/stores.service.spec.ts`:
  - Actualizado para validar la presencia de la configuración normalizada y disponibilidad efectiva (30 pruebas unitarias pasando).
- `prisma/schema.prisma`:
  - Añadido campo `paymentSnapshot Json?` al modelo `Order`.
- `prisma/migrations/20261011140000_order_payment_snapshot/migration.sql`:
  - Migración SQL que añade la columna `paymentSnapshot` a la tabla `Order`.
- `src/modules/orders/orders.service.ts`:
  - Al ejecutar `createFromCart`, resuelve la configuración comercial de la tienda y la persiste inmutablemente como `paymentSnapshot`.

### B. Tiendi Vendor (`FUENTES/tiendi-vendor`)
- `src/app/vendor/features/store-config/store-config.store.ts`:
  - Modificado `mapApiToState` para retener `rawPaymentMethods` y aceptar fallback desde `paymentConfiguration`.
  - Modificado `buildPaymentsPayload` y `savePayments`: ahora preserva campos y métodos no presentes en el formulario (evita sobreescribir `message: ''` en Yape, Plin o Tarjeta cuando solo se edita Efectivo/Transferencia) y respeta vaciados explícitos.
- `src/app/vendor/features/store-config/store-config.store.spec.ts`:
  - Añadida suite de pruebas para verificar preservación de datos no editados y respeto a borrados explícitos (8 pruebas unitarias pasando; 243 pruebas en toda la suite de Vendor pasando).

### C. Tiendi Web (`FUENTES/tiendi-web`)
- `src/app/core/models/store.model.ts`:
  - Agregadas interfaces `StorePaymentMethodConfig`, `StorePaymentConfiguration`, `EffectiveAvailability` y los campos respectivos en `Store`.
- `src/app/core/services/tienda.service.ts`:
  - `mapStore` mapea `paymentConfiguration` y `effectiveAvailability`, y resuelve las instrucciones prioritarias dinámicamente.
- `src/app/features/checkout/components/payment-and-delivery/payment-and-delivery.ts`:
  - Filtra dinámicamente los medios de pago disponibles según `paymentConfiguration.methods[key].enabled`. Métodos deshabilitados no son ofrecidos al comprador.
  - Selecciona automáticamente el primer método disponible si el método por defecto está deshabilitado.
  - Expone dinámicamente el mensaje/instrucciones del método seleccionado según la configuración del backend.
- `src/app/features/checkout/components/payment-and-delivery/payment-and-delivery.spec.ts`:
  - Pruebas unitarias verificando el filtrado de métodos deshabilitados y la resolución de instrucciones dinámicas (6 pruebas pasando).

### D. Tiendi Admin (`FUENTES/tiendi-admin`)
- `src/app/admin/features/stores/store.types.ts`:
  - Definidos tipos `StorePaymentMethodConfig`, `StorePaymentConfiguration`, `EffectiveAvailability` y añadidos a `Store`.
- `src/app/admin/features/stores/store-detail.page.ts`:
  - Añadida señal `lastConsulted` (actualizada con timestamp local en cada carga).
  - Añadida señal `showDisabledMethods` y método `toggleDisabledMethods()`.
  - Añadidos computed signals `allPaymentMethods`, `enabledPaymentMethods`, `disabledPaymentMethods` y `hasPaymentConflict`.
  - Adaptada sección «Operación y delivery» para mostrar disponibilidad efectiva, motivo real del backend y horario vigente en vez del booleano crudo.
- `src/app/admin/features/stores/store-detail.page.html`:
  - Corregido título de cabecera: muestra `{{ store.name }}` directamente sin prefijo duplicado ("Tienda Tienda Test2" -> "Tienda Test2").
  - Añadido indicador «Última consulta» y botón «Actualizar».
  - Tarjeta unificada: **Métodos e instrucciones de pago** que presenta métodos habilitados arriba, estado de suficiencia (`Configuración completa`, `Datos incompletos`, `Habilitado · Configuración no verificada`), alerta de conflicto si aplica, y métodos deshabilitados colapsables bajo `<details class="disabled-methods-section">`.
  - Renombrada tarjeta de KYC a **Datos del propietario**.
- `src/app/admin/features/stores/store-detail.page.scss`:
  - Estilos de tabla en escritorio y cards apiladas en móvil (`@container (max-width: 640px)`) con corte de línea forzado (`overflow-wrap: anywhere; word-break: break-word`) apto para 320px.
- `src/app/admin/features/stores/store-detail.page.spec.ts`:
  - Pruebas unitarias actualizadas y ampliadas (10 pruebas pasando).
- `src/app/admin/features/sales/types/sales.types.ts`:
  - Agregado campo `paymentSnapshot?: Record<string, unknown> | null;` a `AdminOrder`.
- `src/app/admin/features/sales/sale-detail.page.ts`:
  - Agregado computed `paymentSnapshotInfo` para extraer método e instrucciones capturadas.
- `src/app/admin/features/sales/sale-detail.page.html`:
  - Cabecera: separa etiquetas de «Estado del pedido» y «Estado del cobro».
  - Sección de pagos renombrada a **Pago e importes**.
  - Cuadro de snapshot histórico: expone instrucciones y método vigentes al crear el pedido o «Instrucciones históricas no disponibles».
  - Enlace al pedido operativo conserva `[queryParams]="returnParams"`.
- `src/app/admin/features/sales/sale-detail.page.scss`:
  - Estilos de snapshot histórico y distribución de estados en cabecera.
- `src/app/admin/features/sales/sale-detail.page.spec.ts`:
  - Añadidas pruebas para verificación de etiquetas, snapshot histórico y persistencia de filtros (6 pruebas pasando).
- `src/app/admin/features/orders/order-detail.page.ts`:
  - Escucha reactiva a `route.paramMap` para refrescar estado ante navegación y descartar respuestas tardías.
  - Guarda `returnParams` para navegación cruzada.
- `src/app/admin/features/orders/order-detail.page.html`:
  - Añadido botón de navegación cruzada «Ver detalle de venta» apuntando a `/admin/sales/:id` con `[queryParams]="returnParams"`.
  - Renombrada tarjeta de pago a «Pago e importes».
- `src/app/admin/features/orders/order-detail.page.spec.ts`:
  - Pruebas unitarias actualizadas verificando la presencia del enlace a la venta comercial (3 pruebas pasando).

---

## 3. Contratos Definitivos y Decisiones de Compatibilidad

### 3.1. Normalización de Pagos (`StorePaymentConfiguration`)
```typescript
export interface StorePaymentMethodConfig {
  enabled: boolean;
  message?: string;
  instructions?: string;
  sufficiency?: 'COMPLETE' | 'INCOMPLETE' | 'UNKNOWN';
  phone?: string;
  qrUrl?: string;
}

export interface StorePaymentConfiguration {
  source: 'paymentMethods' | 'paymentMessages' | 'merged' | 'empty';
  hasConflict: boolean;
  conflictDetails?: string[];
  methods: Record<string, StorePaymentMethodConfig>;
}
```

### 3.2. Reglas de Suficiencia y Reconciliación
- **Efectivo (`cash`):** Habilitado sin mensaje se considera `COMPLETE` (contra entrega en tienda o domicilio no requiere instrucción obligatoria).
- **Yape / Plin (`yape`, `plin`):** Si está habilitado pero carece de número o QR verificado, se califica como `UNKNOWN` («Habilitado · Configuración no verificada»).
- **Transferencia (`transfer`):** Si está habilitada pero carece de número de cuenta/banco, se califica como `INCOMPLETE` («Datos incompletos»).
- **Conflicto:** Si existen instrucciones en `paymentMethods.metodo.message` y en `paymentMessages.metodo` y difieren:
  - Se activa `hasConflict: true`.
  - Se prioriza `paymentMethods.metodo.message`.
  - **No se concatenan textos contradictorios.**

### 3.3. Snapshot Histórico de Pagos (`paymentSnapshot`)
En Prisma:
```prisma
model Order {
  // ...
  paymentSnapshot Json?
  // ...
}
```
Contenido capturado al crear la orden:
```json
{
  "paymentMethod": "CASH",
  "methodName": "Efectivo",
  "instructions": "Pagar con cambio exacto",
  "source": "paymentMethods",
  "capturedAt": "2026-10-11T17:00:00.000Z"
}
```
Si un pedido antiguo no tiene este campo, la interfaz muestra «Instrucciones históricas no disponibles» sin asumir textos actuales del comercio.

### 3.4. Disponibilidad Comercial y Operativa (`EffectiveAvailability`)
```typescript
export interface EffectiveAvailability {
  effectiveStatus: 'OPEN' | 'CLOSED';
  isOpenFlag: boolean;
  scheduleMatch: boolean;
  reason: string;
}
```
Calculada en el backend evaluando la hora actual en zona horaria `America/Lima`:
- Si `isOpen === false` -> `effectiveStatus: 'CLOSED'`, `reason: 'Cierre manual por el comercio'`.
- Si `isOpen === true` y hoy no abre o está fuera del rango horario -> `effectiveStatus: 'CLOSED'`, `reason: 'Fuera de horario de atención comercial'`.
- Si `isOpen === true` y está dentro del rango horario -> `effectiveStatus: 'OPEN'`, `reason: 'Abierto según horario de atención comercial'`.

---

## 4. Resultados de las Pruebas

| Proyecto | Archivo / Suite | Pruebas | Resultado |
|---|---|---|---|
| `tiendi-api` | `src/modules/stores/payment-configuration.util.spec.ts` | 9 | **9/9 PASS** |
| `tiendi-api` | `src/modules/stores/stores.service.spec.ts` | 30 | **30/30 PASS** |
| `tiendi-api` | Suite completa (`npm test`) | 1079 (109 suites) | **1079/1079 PASS** |
| `tiendi-vendor` | `store-config.store.spec.ts` | 8 | **8/8 PASS** |
| `tiendi-vendor` | Suite completa (`npm test -- --watch=false`) | 243 (30 suites) | **243/243 PASS** |
| `tiendi-web` | `payment-and-delivery.spec.ts` | 6 | **6/6 PASS** |
| `tiendi-admin` | `store-detail.page.spec.ts` | 10 | **10/10 PASS** |
| `tiendi-admin` | `sale-detail.page.spec.ts` | 6 | **6/6 PASS** |
| `tiendi-admin` | `order-detail.page.spec.ts` | 3 | **3/3 PASS** |
| `tiendi-admin` | Suite completa (`npm test -- --watch=false`) | 170 (28 suites) | **170/170 PASS** |

**Total de pruebas ejecutadas:** Más de 1,500 pruebas automatizadas sin regresiones.

---

## 5. Evidencias Visuales y Responsivas

### 5.1. Detalle de Tienda (`StoreDetailPage`)
- **Cabecera:** Se eliminó la duplicidad en el título (antes mostraba "Tienda Tienda Test2", ahora muestra "Tienda Test2"). Incorpora badge de «Última consulta: hh:mm:ss» y botón de acción «Actualizar» que recarga los datos en tiempo real.
- **Operación y delivery:** Ya no muestra un simple booleano descontextualizado. Desglosa:
  - Disponibilidad efectiva: «Abierta» / «Cerrada».
  - Motivo de disponibilidad: Texto explicativo provisto por el backend (ej. «Abierto según horario de atención comercial»).
  - Disponibilidad manual: «Abierta» / «Cerrada».
  - Horario vigente: «En horario de atención» / «Fuera de horario».
  - Etiquetas de delivery claras y sin tecnicismos («Delivery habilitado», «Costo de entrega», «Pedido mínimo», «Entrega gratis desde»).
- **Métodos e instrucciones de pago (Unificados):**
  - **Escritorio:** Tabla de 4 columnas (Método, Habilitación, Estado de configuración, Instrucciones / Datos comerciales).
  - **Móvil (<= 640px y 320px):** Tarjetas apiladas con badges coloreados (`badge-success` para completo, `badge-unknown` para no verificado, `badge-incomplete` para incompleto). Todos los textos usan `overflow-wrap: anywhere; word-break: break-word` para garantizar que cadenas largas o números de cuenta no desborden la pantalla en anchos mínimos (320px).
  - **Métodos deshabilitados:** Agrupados bajo un elemento interactivo `<details>` que permite expandir y colapsar la lista («Mostrar métodos deshabilitados (N)»).

### 5.2. Detalle de Venta (`SaleDetailPage`)
- **Cabecera:** Separa claramente el «Estado del pedido» (operativo: `CONFIRMED`, `DISPATCHED`, `DELIVERED`, etc.) del «Estado del cobro» (financiero: `PENDING`, `PAID`, `FAILED`, `REFUNDED`).
- **Tarjeta comercial «Pago e importes»:** Renombrada para mayor claridad comercial.
- **Instrucciones históricas de pago:** Caja informativa destacada que muestra la instantánea capturada al momento de comprar. Si el pedido es anterior, presenta explícitamente «Instrucciones históricas no disponibles».
- **Navegación cruzada:** El botón «Ver seguimiento completo» enlaza directamente a `/admin/orders/:id` conservando los query parameters (`?period=...&status=...&page=...`).

### 5.3. Detalle de Pedido (`OrderDetailPage` y `OrderTrackingComponent`)
- **Navegación cruzada:** Añadido botón «Ver detalle de venta» enlazando a `/admin/sales/:id` con conservación de filtros de retorno.
- **Trazabilidad:** Distingue el recorrido real observado (stepper histórico verificado) del mapa de estados y transiciones permitidas o rutas potenciales (grafo del flujo).
- **Desacoplamiento entrega/pago:** Un pedido marcado como `DELIVERED` mantiene su estado de cobro independiente (ej. cobro contra entrega pendiente de confirmación bancaria).

---

## 6. Instrucciones Reproducibles para Probar

1. **Pruebas en Tiendi API:**
   ```bash
   cd FUENTES/tiendi-api
   npm test -- src/modules/stores/payment-configuration.util.spec.ts
   npm test -- src/modules/stores/stores.service.spec.ts
   ```

2. **Pruebas en Tiendi Vendor:**
   ```bash
   cd FUENTES/tiendi-vendor
   npm test -- --include src/app/vendor/features/store-config/store-config.store.spec.ts --watch=false
   ```

3. **Pruebas en Tiendi Web:**
   ```bash
   cd FUENTES/tiendi-web
   npm test -- --include src/app/features/checkout/components/payment-and-delivery/payment-and-delivery.spec.ts --watch=false
   ```

4. **Pruebas en Tiendi Admin:**
   ```bash
   cd FUENTES/tiendi-admin
   npm test -- --include src/app/admin/features/stores/store-detail.page.spec.ts --watch=false
   npm test -- --include src/app/admin/features/sales/sale-detail.page.spec.ts --include src/app/admin/features/orders/order-detail.page.spec.ts --watch=false
   ```

---

## 7. Pendientes y Limitaciones Concretas

1. **Exclusiones pactadas:**
   - Conforme a la consigna, las ampliaciones de la **Sección 13** (conciliación avanzada multi-fuente y cronología combinada en una sola vista) quedan fuera de esta entrega y se abordarán en una fase posterior.
2. **Pedidos históricos previos a la migración:**
   - Los pedidos creados antes de la adición de la columna `paymentSnapshot` en base de datos carecen de instantánea histórica. Por diseño y para no inventar datos, la interfaz expone explícitamente «Instrucciones históricas no disponibles».
3. **Ambiente productivo:**
   - No se aplicaron migraciones ni despliegues en ambientes de producción (trabajo 100% verificado en entornos de desarrollo local y pruebas automatizadas).
