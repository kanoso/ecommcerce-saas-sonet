# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: flujo4-staff.spec.ts >> Flujo 4 — Staff y roles >> CASHIER no puede acceder a /vendor/analytics
- Location: e2e\flujo4-staff.spec.ts:54:7

# Error details

```
Error: expect(received).not.toMatch(expected)

Expected pattern: not /\/vendor\/analytics$/
Received string:      "http://localhost:4201/vendor/analytics"
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
        - generic [ref=e68]:
          - generic [ref=e69]:
            - heading "Analytics" [level=1] [ref=e70]
            - paragraph [ref=e71]: Monitorea el rendimiento de tu tienda
          - generic [ref=e72]:
            - button "Exportar CSV" [ref=e73] [cursor=pointer]:
              - img [ref=e74]
              - text: Exportar CSV
            - button "PDF" [ref=e76] [cursor=pointer]:
              - img [ref=e77]
              - text: PDF
        - generic [ref=e81]:
          - button "Hoy" [ref=e82] [cursor=pointer]
          - button "Semana" [ref=e83] [cursor=pointer]
          - button "Mes" [ref=e84] [cursor=pointer]
          - button "Año" [ref=e85] [cursor=pointer]
          - button "Rango personalizado" [ref=e86] [cursor=pointer]
        - generic [ref=e88]:
          - generic [ref=e89]:
            - img [ref=e91]
            - generic [ref=e93]:
              - generic [ref=e94]: Ventas totales
              - generic [ref=e95]: —
          - generic [ref=e96]:
            - img [ref=e98]
            - generic [ref=e100]:
              - generic [ref=e101]: Pedidos
              - generic [ref=e102]: —
          - generic [ref=e103]:
            - img [ref=e105]
            - generic [ref=e107]:
              - generic [ref=e108]: Ticket promedio
              - generic [ref=e109]: —
          - generic [ref=e110]:
            - img [ref=e112]
            - generic [ref=e114]:
              - generic [ref=e115]: Clientes nuevos
              - generic [ref=e116]: —
        - generic [ref=e119]:
          - heading "Evolución de ventas" [level=3] [ref=e120]
          - generic [ref=e121]:
            - generic [ref=e123]: Este período
            - generic [ref=e125]: Período anterior
        - generic [ref=e128]:
          - generic [ref=e131]:
            - generic [ref=e132]:
              - heading "Productos más vendidos" [level=3] [ref=e133]
              - link "Ver todos →" [ref=e134] [cursor=pointer]:
                - /url: /vendor/products
            - generic [ref=e135]:
              - img [ref=e136]
              - paragraph [ref=e138]: Sin datos para este período
          - generic [ref=e141]:
            - heading "Ventas por categoría" [level=3] [ref=e143]
            - generic [ref=e144]:
              - img [ref=e145]
              - paragraph [ref=e148]: Sin datos para este período
        - heading "Pedidos por hora del día" [level=3] [ref=e152]
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
> 67 |     expect(currentURL).not.toMatch(/\/vendor\/analytics$/);
     |                            ^ Error: expect(received).not.toMatch(expected)
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
  79 |     expect(currentURL).not.toMatch(/\/vendor\/staff$/);
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