# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flujo2-operacion-diaria.spec.ts >> Flujo 2 — Gestión de pedidos >> botón de acción disponible según estado del pedido
- Location: e2e\flujo2-operacion-diaria.spec.ts:61:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForSelector: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('table tbody tr') to be visible

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - navigation "Menú principal" [ref=e6]:
    - list [ref=e7]:
      - listitem [ref=e8]:
        - link "Dashboard" [ref=e9] [cursor=pointer]:
          - /url: /vendor/dashboard
          - generic [ref=e10]: dashboard
          - generic [ref=e11]: Dashboard
      - listitem [ref=e12]:
        - link "Pedidos" [ref=e13] [cursor=pointer]:
          - /url: /vendor/orders
          - generic [ref=e14]: receipt_long
          - generic [ref=e15]: Pedidos
      - listitem [ref=e16]:
        - link "Productos" [ref=e17] [cursor=pointer]:
          - /url: /vendor/products
          - generic [ref=e18]: inventory_2
          - generic [ref=e19]: Productos
      - listitem [ref=e20]:
        - link "Mi Tienda" [ref=e21] [cursor=pointer]:
          - /url: /vendor/store
          - generic [ref=e22]: store
          - generic [ref=e23]: Mi Tienda
      - listitem [ref=e24]:
        - link "Analytics" [ref=e25] [cursor=pointer]:
          - /url: /vendor/analytics
          - generic [ref=e26]: bar_chart
          - generic [ref=e27]: Analytics
      - listitem [ref=e28]:
        - link "Clientes" [ref=e29] [cursor=pointer]:
          - /url: /vendor/customers
          - generic [ref=e30]: group
          - generic [ref=e31]: Clientes
      - listitem [ref=e32]:
        - link "Notificaciones" [ref=e33] [cursor=pointer]:
          - /url: /vendor/notifications
          - generic [ref=e34]: notifications
          - generic [ref=e35]: Notificaciones
      - listitem [ref=e36]:
        - link "Staff" [ref=e37] [cursor=pointer]:
          - /url: /vendor/staff
          - generic [ref=e38]: manage_accounts
          - generic [ref=e39]: Staff
      - listitem [ref=e40]:
        - link "Facturación y Legal" [ref=e41] [cursor=pointer]:
          - /url: /vendor/legal
          - generic [ref=e42]: receipt
          - generic [ref=e43]: Facturación y Legal
      - listitem [ref=e44]:
        - link "Plan y Suscripción" [ref=e45] [cursor=pointer]:
          - /url: /vendor/subscription
          - generic [ref=e46]: credit_card
          - generic [ref=e47]: Plan y Suscripción
  - generic [ref=e48]:
    - banner [ref=e50]:
      - generic [ref=e51]:
        - generic "Ir al dashboard" [ref=e52]:
          - generic [ref=e53]: 🛍️
          - generic [ref=e54]: Tiendi
        - 'generic "Tienda: Bodega El Sol" [ref=e55]': Bodega El Sol
      - generic [ref=e56]:
        - button "Notificaciones" [ref=e57] [cursor=pointer]:
          - generic [ref=e58]: notifications
        - button "Menú de perfil" [ref=e60] [cursor=pointer]:
          - img [ref=e62]:
            - generic [ref=e63]: US
          - generic [ref=e64]: expand_more
    - main [ref=e65]:
      - generic [ref=e67]:
        - generic [ref=e69]:
          - heading "Pedidos" [level=1] [ref=e70]
          - paragraph [ref=e71]: Gestioná y hacé seguimiento de todos tus pedidos
        - search "Filtros de pedidos" [ref=e73]:
          - combobox "Filtrar por estado" [ref=e74] [cursor=pointer]:
            - option "Todos los estados" [selected]
            - option "Pendiente"
            - option "Confirmado"
            - option "En camino"
            - option "Entregado"
            - option "Rechazado"
          - combobox "Filtrar por período" [ref=e75] [cursor=pointer]:
            - option "Todos los períodos" [selected]
            - option "Hoy"
            - option "Ayer"
            - option "Últimos 7 días"
            - option "Este mes"
          - combobox "Filtrar por método de pago" [ref=e76] [cursor=pointer]:
            - option "Todos los pagos" [selected]
            - option "Efectivo"
            - option "Yape"
            - option "Plin"
            - option "Transferencia"
            - option "Tarjeta"
          - combobox "Filtrar por tipo de entrega" [ref=e77] [cursor=pointer]:
            - option "Todos los tipos" [selected]
            - option "Delivery"
            - option "Recojo en tienda"
          - button "Limpiar" [ref=e78] [cursor=pointer]
          - button "Exportar CSV" [ref=e79] [cursor=pointer]
        - tablist "Filtrar pedidos por estado" [ref=e81]:
          - generic [ref=e82]:
            - 'tab "Todos: 0 pedidos" [selected] [ref=e83] [cursor=pointer]':
              - text: Todos
              - generic [ref=e84]: "0"
            - 'tab "Pendientes: 0 pedidos" [ref=e85] [cursor=pointer]':
              - text: Pendientes
              - generic [ref=e86]: "0"
            - 'tab "Confirmados: 0 pedidos" [ref=e87] [cursor=pointer]':
              - text: Confirmados
              - generic [ref=e88]: "0"
            - 'tab "En camino: 0 pedidos" [ref=e89] [cursor=pointer]':
              - text: En camino
              - generic [ref=e90]: "0"
            - 'tab "Entregados: 0 pedidos" [ref=e91] [cursor=pointer]':
              - text: Entregados
              - generic [ref=e92]: "0"
            - 'tab "Rechazados: 0 pedidos" [ref=e93] [cursor=pointer]':
              - text: Rechazados
              - generic [ref=e94]: "0"
        - generic "Sin pedidos" [ref=e97]:
          - status [ref=e98]:
            - generic [ref=e100]: receipt_long
            - heading "Sin pedidos" [level=3] [ref=e101]
            - paragraph [ref=e102]: No hay pedidos que coincidan con los filtros seleccionados.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { loginAs, OWNER } from './helpers/auth.helper';
  3   | import { checkA11y, filterSevere } from './helpers/axe.helper';
  4   | 
  5   | /**
  6   |  * Flujo 2 — Gestión de pedidos (operación diaria)
  7   |  *
  8   |  * Selectores clave (order-list-table.component.ts):
  9   |  *   - tabla con aria-label "Cargando pedidos" / tabla visible sin aria-busy
  10  |  *   - filas de la tabla con clase .table tbody tr
  11  |  *   - botón de volver: aria-label="Volver a pedidos" (order-detail-header)
  12  |  *   - botones de acción: aria-label="Confirmar pedido" | "Marcar como despachado"
  13  |  */
  14  | test.describe('Flujo 2 — Gestión de pedidos', () => {
  15  |   test.beforeEach(async ({ page }) => {
  16  |     await loginAs(page, OWNER);
  17  |   });
  18  | 
  19  |   test('navegar a /vendor/orders muestra lista de pedidos', async ({ page }) => {
  20  |     await page.goto('/vendor/orders');
  21  |     await page.waitForLoadState('networkidle');
  22  | 
  23  |     // La tabla existe y no está en estado de carga (aria-busy=false o ausente)
  24  |     const table = page.locator('table').first();
  25  |     await expect(table).toBeVisible();
  26  | 
  27  |     // Esperar que al menos una fila de datos esté visible (no skeleton)
  28  |     await expect(page.locator('table tbody tr').first()).toBeVisible();
  29  |   });
  30  | 
  31  |   test('click en primer pedido navega al detalle', async ({ page }) => {
  32  |     await page.goto('/vendor/orders');
  33  |     await page.waitForLoadState('networkidle');
  34  | 
  35  |     // Esperar filas reales (sin aria-busy)
  36  |     await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0);
  37  |     await page.waitForSelector('table tbody tr');
  38  | 
  39  |     // La tabla usa botones "Ver detalle" por fila — no toda la fila es clickeable
  40  |     await page.getByRole('button', { name: /ver detalle/i }).first().click();
  41  | 
  42  |     // La URL debe contener /vendor/orders/ seguido de un id
  43  |     await expect(page).toHaveURL(/\/vendor\/orders\/.+/);
  44  |   });
  45  | 
  46  |   test('página de detalle muestra sección de gestión del pedido', async ({ page }) => {
  47  |     await page.goto('/vendor/orders');
  48  |     await page.waitForLoadState('networkidle');
  49  |     await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0);
  50  |     await page.waitForSelector('table tbody tr');
  51  | 
  52  |     await page.getByRole('button', { name: /ver detalle/i }).first().click();
  53  |     await expect(page).toHaveURL(/\/vendor\/orders\/.+/);
  54  |     await page.waitForLoadState('networkidle');
  55  | 
  56  |     // order-actions.component.ts usa role="region" aria-label="Gestión del pedido"
  57  |     const actionsPanel = page.getByRole('region', { name: /gestión del pedido/i });
  58  |     await expect(actionsPanel).toBeVisible();
  59  |   });
  60  | 
  61  |   test('botón de acción disponible según estado del pedido', async ({ page }) => {
  62  |     await page.goto('/vendor/orders');
  63  |     await page.waitForLoadState('networkidle');
  64  |     await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0);
> 65  |     await page.waitForSelector('table tbody tr');
      |                ^ Error: page.waitForSelector: Test timeout of 30000ms exceeded.
  66  | 
  67  |     await page.getByRole('button', { name: /ver detalle/i }).first().click();
  68  |     await page.waitForLoadState('networkidle');
  69  | 
  70  |     // Puede no haber botón si el pedido está en estado terminal (DELIVERED/REJECTED)
  71  |     // En ese caso verificamos que el panel de gestión esté visible igual
  72  |     const actionsPanel = page.getByRole('region', { name: /gestión del pedido/i });
  73  |     await expect(actionsPanel).toBeVisible();
  74  |   });
  75  | 
  76  |   test('botón volver regresa a la lista de pedidos', async ({ page }) => {
  77  |     await page.goto('/vendor/orders');
  78  |     await page.waitForLoadState('networkidle');
  79  |     await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0);
  80  |     await page.waitForSelector('table tbody tr');
  81  | 
  82  |     await page.getByRole('button', { name: /ver detalle/i }).first().click();
  83  |     await expect(page).toHaveURL(/\/vendor\/orders\/.+/);
  84  |     await page.waitForLoadState('networkidle');
  85  | 
  86  |     // order-detail-header usa aria-label="Volver a pedidos"
  87  |     await page.getByRole('button', { name: /volver a pedidos/i }).click();
  88  |     await expect(page).toHaveURL(/\/vendor\/orders$/);
  89  |   });
  90  | 
  91  |   test('auditoría a11y en lista de pedidos — 0 violaciones críticas/serias', async ({ page }) => {
  92  |     await page.goto('/vendor/orders');
  93  |     await page.waitForLoadState('networkidle');
  94  |     await expect(page.locator('table[aria-busy="true"]')).toHaveCount(0);
  95  | 
  96  |     const violations = await checkA11y(page, 'Lista de pedidos');
  97  |     const severe = filterSevere(violations);
  98  |     expect(severe, `Violaciones graves: ${JSON.stringify(severe, null, 2)}`).toHaveLength(0);
  99  |   });
  100 | });
  101 | 
```