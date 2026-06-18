# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flujo4-staff.spec.ts >> Flujo 4 — Staff y roles >> CASHIER no puede acceder a /vendor/staff
- Location: e2e\flujo4-staff.spec.ts:70:7

# Error details

```
Error: expect(received).not.toMatch(expected)

Expected pattern: not /\/vendor\/staff$/
Received string:      "http://localhost:4201/vendor/staff"
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
          - generic [ref=e70]:
            - generic [ref=e71]: group
            - generic [ref=e72]:
              - generic [ref=e73]: Usando 0 de 5 slots — Plan Pro
              - generic [ref=e74]: ¿Necesitás más colaboradores? Pasá al plan Business
          - link "Ver planes →" [ref=e75] [cursor=pointer]:
            - /url: /vendor/subscription
        - generic [ref=e76]:
          - generic [ref=e77]:
            - heading "Miembros del equipo" [level=2] [ref=e78]
            - generic [ref=e79]: 0 activos
          - button "person_add Invitar colaborador" [ref=e80] [cursor=pointer]:
            - generic [ref=e81]: person_add
            - text: Invitar colaborador
        - table [ref=e85]:
          - rowgroup [ref=e86]:
            - row "Miembro Rol Estado Acciones" [ref=e87]:
              - columnheader "Miembro" [ref=e88]
              - columnheader "Rol" [ref=e89]
              - columnheader "Estado" [ref=e90]
              - columnheader "Acciones" [ref=e91]
          - rowgroup
        - generic [ref=e92]:
          - generic [ref=e93]:
            - heading "Descripción de roles" [level=3] [ref=e95]
            - generic [ref=e97]:
              - generic [ref=e98]:
                - generic [ref=e99]: 👑 Dueño
                - generic [ref=e100]: Acceso completo a todas las funciones. No puede ser modificado.
              - generic [ref=e101]:
                - generic [ref=e102]: 🏢 Gerente
                - generic [ref=e103]: Gestión de pedidos, productos y clientes. No puede modificar suscripción.
              - generic [ref=e104]:
                - generic [ref=e105]: 💰 Cajero/a
                - generic [ref=e106]: Puede ver y gestionar pedidos únicamente. Sin acceso a configuración.
              - generic [ref=e107]:
                - generic [ref=e108]: 📦 Depósito (WAREHOUSE)
                - generic [ref=e109]: Puede ver productos y actualizar stock. Sin acceso a ventas ni configuración.
          - generic [ref=e110]:
            - heading "Matriz de permisos" [level=3] [ref=e112]
            - table [ref=e114]:
              - rowgroup [ref=e115]:
                - row "Módulo STORE_OWNER MANAGER CASHIER WAREHOUSE" [ref=e116]:
                  - columnheader "Módulo" [ref=e117]
                  - columnheader "STORE_OWNER" [ref=e118]
                  - columnheader "MANAGER" [ref=e119]
                  - columnheader "CASHIER" [ref=e120]
                  - columnheader "WAREHOUSE" [ref=e121]
              - rowgroup [ref=e122]:
                - row "Dashboard ✓ ✓ ✓ ✗" [ref=e123]:
                  - cell "Dashboard" [ref=e124]
                  - cell "✓" [ref=e125]
                  - cell "✓" [ref=e126]
                  - cell "✓" [ref=e127]
                  - cell "✗" [ref=e128]
                - row "Pedidos — ver ✓ ✓ ✓ ✗" [ref=e129]:
                  - cell "Pedidos — ver" [ref=e130]
                  - cell "✓" [ref=e131]
                  - cell "✓" [ref=e132]
                  - cell "✓" [ref=e133]
                  - cell "✗" [ref=e134]
                - row "Pedidos — gestionar ✓ ✓ ✓ ✗" [ref=e135]:
                  - cell "Pedidos — gestionar" [ref=e136]
                  - cell "✓" [ref=e137]
                  - cell "✓" [ref=e138]
                  - cell "✓" [ref=e139]
                  - cell "✗" [ref=e140]
                - row "Productos — ver ✓ ✓ ✗ ✓" [ref=e141]:
                  - cell "Productos — ver" [ref=e142]
                  - cell "✓" [ref=e143]
                  - cell "✓" [ref=e144]
                  - cell "✗" [ref=e145]
                  - cell "✓" [ref=e146]
                - row "Productos — editar ✓ ✓ ✗ ✗" [ref=e147]:
                  - cell "Productos — editar" [ref=e148]
                  - cell "✓" [ref=e149]
                  - cell "✓" [ref=e150]
                  - cell "✗" [ref=e151]
                  - cell "✗" [ref=e152]
                - row "Stock — actualizar ✓ ✓ ✗ ✓" [ref=e153]:
                  - cell "Stock — actualizar" [ref=e154]
                  - cell "✓" [ref=e155]
                  - cell "✓" [ref=e156]
                  - cell "✗" [ref=e157]
                  - cell "✓" [ref=e158]
                - row "Configuración tienda ✓ ✓ ✗ ✗" [ref=e159]:
                  - cell "Configuración tienda" [ref=e160]
                  - cell "✓" [ref=e161]
                  - cell "✓" [ref=e162]
                  - cell "✗" [ref=e163]
                  - cell "✗" [ref=e164]
                - row "Analytics ✓ ✓ ✗ ✗" [ref=e165]:
                  - cell "Analytics" [ref=e166]
                  - cell "✓" [ref=e167]
                  - cell "✓" [ref=e168]
                  - cell "✗" [ref=e169]
                  - cell "✗" [ref=e170]
                - row "Clientes ✓ ✓ ✗ ✗" [ref=e171]:
                  - cell "Clientes" [ref=e172]
                  - cell "✓" [ref=e173]
                  - cell "✓" [ref=e174]
                  - cell "✗" [ref=e175]
                  - cell "✗" [ref=e176]
                - row "Staff ✓ ✗ ✗ ✗" [ref=e177]:
                  - cell "Staff" [ref=e178]
                  - cell "✓" [ref=e179]
                  - cell "✗" [ref=e180]
                  - cell "✗" [ref=e181]
                  - cell "✗" [ref=e182]
                - row "Suscripción / Plan ✓ ✗ ✗ ✗" [ref=e183]:
                  - cell "Suscripción / Plan" [ref=e184]
                  - cell "✓" [ref=e185]
                  - cell "✗" [ref=e186]
                  - cell "✗" [ref=e187]
                  - cell "✗" [ref=e188]
                - row "Facturación y Legal ✓ ✓ ✗ ✗" [ref=e189]:
                  - cell "Facturación y Legal" [ref=e190]
                  - cell "✓" [ref=e191]
                  - cell "✓" [ref=e192]
                  - cell "✗" [ref=e193]
                  - cell "✗" [ref=e194]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { loginAs, logout, OWNER, CASHIER } from './helpers/auth.helper';
  3  | import { checkA11y, filterSevere } from './helpers/axe.helper';
  4  | 
  5  | /**
  6  |  * Flujo 4 — Gestión de staff y restricciones de rol
  7  |  *
  8  |  * Rutas protegidas (vendor.routes.ts):
  9  |  *   - /vendor/staff        → roleGuard(['STORE_OWNER'])
  10 |  *   - /vendor/analytics    → roleGuard(['STORE_OWNER', 'MANAGER'])
  11 |  *
  12 |  * El roleGuard retorna false (sin redirect) y emite un toast de error.
  13 |  * Cuando la navegación falla, el router NO cambia la URL — el usuario
  14 |  * permanece en la URL anterior o en la URL raíz del shell.
  15 |  *
  16 |  * Selectores clave (staff-list.page.ts / staff-slots-banner.component.ts):
  17 |  *   - .slots-banner → banner "Usando X de Y slots — Plan Pro"
  18 |  *   - "Miembros del equipo" → h2.toolbar__title
  19 |  */
  20 | test.describe('Flujo 4 — Staff y roles', () => {
  21 |   test('OWNER ve tabla de empleados en /vendor/staff', async ({ page }) => {
  22 |     await loginAs(page, OWNER);
  23 |     await page.goto('/vendor/staff');
  24 |     await page.waitForLoadState('networkidle');
  25 | 
  26 |     // Debe mostrar el título de la sección
  27 |     await expect(page.getByRole('heading', { name: /miembros del equipo/i })).toBeVisible();
  28 |   });
  29 | 
  30 |   test('OWNER ve el banner de slots en /vendor/staff', async ({ page }) => {
  31 |     await loginAs(page, OWNER);
  32 |     await page.goto('/vendor/staff');
  33 |     await page.waitForLoadState('networkidle');
  34 | 
  35 |     // staff-slots-banner.component.ts — texto "Plan Pro" siempre visible
  36 |     const banner = page.locator('.slots-banner');
  37 |     await expect(banner).toBeVisible();
  38 |     await expect(banner).toContainText(/Plan Pro/i);
  39 |   });
  40 | 
  41 |   test('OWNER ve tabla de miembros cargada', async ({ page }) => {
  42 |     await loginAs(page, OWNER);
  43 |     await page.goto('/vendor/staff');
  44 |     await page.waitForLoadState('networkidle');
  45 | 
  46 |     // Esperar que desaparezca el estado de carga
  47 |     await expect(page.locator('text=Cargando equipo...')).toHaveCount(0);
  48 | 
  49 |     // La tabla de staff debe estar visible
  50 |     const staffTable = page.locator('app-staff-table, [class*="staff-table"], table').first();
  51 |     await expect(staffTable).toBeVisible();
  52 |   });
  53 | 
  54 |   test('CASHIER no puede acceder a /vendor/analytics', async ({ page }) => {
  55 |     await loginAs(page, CASHIER);
  56 |     await page.waitForLoadState('networkidle');
  57 | 
  58 |     // Intentar navegar a analytics (requiere STORE_OWNER o MANAGER)
  59 |     await page.goto('/vendor/analytics');
  60 |     await page.waitForLoadState('networkidle');
  61 | 
  62 |     // El roleGuard retorna false → la navegación no ocurre.
  63 |     // El router puede quedarse en el dashboard o en la URL anterior.
  64 |     // Lo que NO debe pasar es cargar el contenido de analytics.
  65 |     // Verificamos que la URL NO sea /vendor/analytics
  66 |     const currentURL = page.url();
  67 |     expect(currentURL).not.toMatch(/\/vendor\/analytics$/);
  68 |   });
  69 | 
  70 |   test('CASHIER no puede acceder a /vendor/staff', async ({ page }) => {
  71 |     await loginAs(page, CASHIER);
  72 |     await page.waitForLoadState('networkidle');
  73 | 
  74 |     await page.goto('/vendor/staff');
  75 |     await page.waitForLoadState('networkidle');
  76 | 
  77 |     // Igual que analytics — la URL no debe ser /vendor/staff
  78 |     const currentURL = page.url();
> 79 |     expect(currentURL).not.toMatch(/\/vendor\/staff$/);
     |                            ^ Error: expect(received).not.toMatch(expected)
  80 |   });
  81 | 
  82 |   test('auditoría a11y en página de staff — 0 violaciones críticas/serias', async ({ page }) => {
  83 |     await loginAs(page, OWNER);
  84 |     await page.goto('/vendor/staff');
  85 |     await page.waitForLoadState('networkidle');
  86 |     await expect(page.locator('text=Cargando equipo...')).toHaveCount(0);
  87 | 
  88 |     const violations = await checkA11y(page, 'Staff');
  89 |     const severe = filterSevere(violations);
  90 |     expect(severe, `Violaciones graves: ${JSON.stringify(severe, null, 2)}`).toHaveLength(0);
  91 |   });
  92 | });
  93 | 
```