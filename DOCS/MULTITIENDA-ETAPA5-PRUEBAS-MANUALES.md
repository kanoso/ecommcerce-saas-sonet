# Pruebas manuales — Certificación multitienda (Etapa 5)

**Fecha:** 2026-09-22.
**Fuente:** `FUENTES/GUIA-ADECUACION-MULTITIENDA.md` §7 (matriz de aceptación).
**Ambiente:** staging o dev con el build mergeado de `tiendi-api` (master ≥ `3fe02b7c`) + `tiendi-vendor` (master ≥ `8723e1d7`) + `tiendi-web` (master ≥ `2f24820a`).
**Regla:** cada caso ejecutado se registra con resultado (✅/❌), evidencia (captura o request/response) y commit/version del build probado. Cualquier evidencia de lectura o escritura cruzada detiene el despliegue.

## 0. Cobertura ya automatizada (no repetir manualmente)

| Área | Dónde | Estado |
|---|---|---|
| Matriz de pertenencia U/V/E/Z a nivel API (401/403/404, listing, duplicados, PENDING excluido) | `tiendi-api` jest: 59 suites / 637 tests | ✅ verde |
| Wiring de guards en 13 controladores | `guard-wiring.spec.ts` (Reflector) | ✅ verde |
| Unidades del panel vendor (ActiveStoreStore, guard, switcher, badge) | vitest: 20 archivos / 175 tests | ✅ verde |
| Casos negativos de URL/cuerpo alterado, recursos de otra tienda, empleados | specs del backend (orders, products, staff, notifications, chat, gateways) | ✅ verde |
| E2E Playwright con mock | rama `test/e2e-multitienda` de tiendi-vendor — **suspendida por demora**; 13/18 specs multitienda pasaban al suspender. Reanudable. | ⚠️ WIP |

## 1. Datos de prueba (crear antes de empezar)

| Usuario | Configuración |
|---|---|
| **U** | STORE_OWNER con tiendas **A** y **B** (A con pedidos, productos y empleados distinguibles; B con otros recursos y ≥1 notificación sin leer) |
| **V** | STORE_OWNER con una sola tienda **C** |
| **E** | EMPLOYEE (p. ej. storeRole MANAGER) asociado **solo** a A |
| **Z** | Sin tiendas |
| **X** (opcional) | OWNER de A **y** EMPLOYEE de C (acceso cruzado) |
| Tienda **S** | Una tienda SUSPENDED accesible para U |

Productos/pedidos con nombres/códigos inequívocos por tienda (p. ej. `PED-A-001`, `PROD-B-002`) para detectar contaminación visual.

## 2. Matriz manual de casos

### A. Acceso 0/1/N

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| M1 | U inicia sesión (N=2) | Login como U | Selector de tiendas muestra A y B (Delta/S si existe suspendida con badge de estado); **nunca C** |
| M2 | V inicia sesión (N=1) | Login como V | Entra directo al dashboard de C, sin paso de selección |
| M3 | Z inicia sesión (N=0) | Login como Z | Estado "sin tiendas" con alta/solicitud; sin errores de navegación ni datos privados |
| M4 | Preferencia recordada | Como U, operá A, logout, login | Sugiere A si sigue autorizada; **nunca** decide destino si A fue revocada |
| M5 | Tienda ajena en URL | Como U, abrí `/vendor/<id-de-C>/dashboard` | Estado store-denied; sin datos de C; sin redirección silenciosa a A/B |

### B. Cambio de tienda y aislamiento

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| M6 | Cambio A→B completo | Como U en A, cambiá a B desde el selector | Todas las vistas (dashboard, pedidos, productos, analytics) muestran datos de B; el nombre activo visible es B |
| M7 | Respuesta tardía de A | En A, abrí B; forzá latencia (DevTools → throttling) de una petición pendiente de A | La respuesta tardía de A **no** modifica la vista de B |
| M8 | Dos pestañas | Pestaña 1 en A, pestaña 2 en B | Cambiar/guardar en una no altera la URL ni los datos de la otra |
| M9 | Formulario sin guardar | Formulario de producto en A con cambios → cambiá de tienda | Confirmación guardar/descartar/cancelar; si descartás o cancelás, el borrador **nunca** se guarda en B |
| M10 | Escritura en vuelo a A | Lanzá una escritura en A y cambiá a B de inmediato | La escritura completa en **A**; su confirmación/toast identifica A; no se reenvía a B |
| M11 | Logout y cambio de usuario | U logout → login V | Sin cachés, borradores ni suscripciones de U visibles en V; solo datos de C |

### C. Autorización negativa (verificación manual liviana; la matriz completa ya está en tests del backend)

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| M12 | Tienda ajena alterando URL | Como U, editá la URL a un resource de C (p. ej. `/vendor/<C-id>/orders`) | 403/estado denied; sin datos ni modificaciones |
| M13 | Empleado fuera de ámbito | Como E (solo A): intentá operar B y una acción no permitida en A (p. ej. staff si su storeRole no lo permite) | Denegado por ámbito o capacidad con mensaje claro |
| M14 | Recurso cruzado A/B | Como U en A: abrí un orderId de B por URL | Denegado (el recurso de B no opera por ruta de A) |

### D. Notificaciones y estados

| # | Caso | Pasos | Resultado esperado |
|---|---|---|---|
| M15 | Notificación de B mientras operás A | Generá un aviso en B (p. ej. nuevo pedido) mientras U opera A | El badge lo identifica como de B; al abrirlo navega al contexto de B sin perder borradores silenciosamente |
| M16 | Tienda suspendida | Operá sobre la tienda S (suspendida) | Config visible en **solo lectura**; escrituras 403; sin fallback silencioso a otra tienda |
| M17 | Acceso revocado con sesión abierta | Con E logueado en A, revocá su employment desde otro admin; E intenta la próxima operación | 403 en la próxima operación; datos/suscripciones tratados según política (sin leaks) |
| M18 | Reintento/exportación | Forzá un reintento de red (DevTools offline→online) en una escritura, y una exportación/CSV si existe | Conserva el ámbito de la tienda original; no filtra datos de otras |

## 3. Hallazgos conocidos a vigilar durante la certificación

1. **Switcher con unread:** el click en una fila con notificaciones sin leer lleva a la bandeja de esa tienda en lugar de cambiar de tienda (comportamiento implementado así en Etapa 4). Si QA lo encuentra confuso, decidir: click = cambiar de tienda, badge informativo.
2. **Login de empleado con mock:** el mock de e2e devuelve `role: 'CASHIER'` (contrato real es `EMPLOYEE` + `storeRole`) — en ambiente real no aplica, pero si el empleado real queda pegado en login reportarlo con consola y request.
3. **A11y:** contraste de color "serious" en la página de staff (detectado en auditoría automática) — verificar visualmente y decidir fix.
4. Invoicing en ambiente de mock mostró "Error al cargar facturación" — en staging verificar que `/stores/:id/invoices` responda con el shape esperado.

## 4. Registro de ejecución

| Caso | Fecha | Probado por | Build (commit) | Resultado | Evidencia |
|---|---|---|---|---|---|
| M1 | | | | ☐ ✅ ☐ ❌ | |
| M2 | | | | ☐ ✅ ☐ ❌ | |
| M3-M18 | | | | ☐ ✅ ☐ ❌ | |

**Criterio de salida (§9 de la guía):** matriz completa ✅ + evidencias adjuntas + ninguna vulnerabilidad de aislamiento pendiente.