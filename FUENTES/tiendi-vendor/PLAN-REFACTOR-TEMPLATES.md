# Plan: Refactor de Templates Inline → Archivos Separados

**Objetivo:** Extraer templates HTML (y estilos SCSS) de componentes con templates grandes, manteniendo inline solo para componentes pequeños. Formalizar la convención en el tooling.

**Estado actual:** 92/92 componentes usan `template` + `styles` inline. Cero archivos `.html` o `.scss` separados.

**Regla de decisión:**
| Tamaño template | Acción |
|---|---|
| < 20 líneas | Mantener inline |
| 20-80 líneas | Opcional — criterio del dev |
| > 80 líneas | Extraer a `.component.html` + `.component.scss` |

---

## Fase 1: Formalizar Convención

- [x] Agregar `"inlineTemplate": true` en `angular.json` → `@schematics/angular:component`
- [x] Agregar `"inlineStyle": true` en `angular.json` → `@schematics/angular:component`
- [x] Verificar que `ng generate component` respete los defaults

---

## Fase 2: Refactorizar Componentes LARGE (>80 líneas)

Cada componente se extrae a:
- `nombre.component.html` — el template
- `nombre.component.scss` — los estilos
- El `.ts` cambia `template: \`...\`` → `templateUrl: './nombre.component.html'` y `styles: [\`...\`]` → `styleUrl: './nombre.component.scss'`

### Products (4 componentes)

- [x] `product-form-info.component.ts` — 210 líneas template + 185 estilos ✓ (474 → 81 líneas)
- [x] `product-list-table.component.ts` — 125 líneas template + 181 estilos ✓ (356 → 53 líneas)
- [x] `product-grid.component.ts` — 121 líneas template + 188 estilos ✓ (359 → 53 líneas)
- [x] `product-categories.component.ts` — 110 líneas template + 260 estilos ✓ (415 → 53 líneas)

### Orders (3 componentes)

- [x] `order-actions.component.ts` — 184 líneas template + 191 estilos ✓ (426 → 53 líneas)
- [x] `order-list-table.component.ts` — 151 líneas template + 201 estilos ✓ (427 → 53 líneas)
- [ ] `order-status-timeline.component.ts` — 46 líneas template (está en MEDIUM, revisar)

### Store Config (4 componentes)

- [x] `store-info-tab.component.ts` — 147 líneas template + 65 estilos ✓ (274 → 53 líneas)
- [x] `store-appearance-tab.component.ts` — 108 líneas template + 58 estilos ✓ (237 → 55 líneas)
- [x] `store-invoicing-tab.component.ts` — 92 líneas template + 45 estilos ✓ (176 → 53 líneas)
- [x] `complaints-tab.component.ts` — 131 líneas template + 108 estilos ✓ (296 → 63 líneas)
- [x] `sunat-config-tab.component.ts` — 115 líneas template + 102 estilos ✓ (282 → 57 líneas)
- [x] `invoices-tab.component.ts` — 82 líneas template + 68 estilos ✓ (186 → 48 líneas)
- [x] `customers-table.component.ts` — 90 líneas template + 217 estilos ✓ (361 → 53 líneas)
- [x] `onboarding-step1.component.ts` — 91 líneas template + 125 estilos ✓ (292 → 57 líneas)
- [x] `onboarding-step2.component.ts` — 88 líneas template + 120 estilos ✓ (284 → 57 líneas)
- [x] `onboarding-step3.component.ts` — 102 líneas template + 215 estilos ✓ (386 → 71 líneas)

### Dashboard (1 componente)

- [x] `low-stock-widget.component.ts` — 90 líneas template + 158 estilos ✓ (295 → 55 líneas)

### Shared UI (1 componente)

- [x] `data-table.component.ts` — 96 líneas template + 80 estilos ✓ (260 → 65 líneas)

### Shared Layout (1 componente)

- [x] `topbar.component.ts` — 105 líneas template + 215 estilos ✓ (354 → 57 líneas)

---

## Fase 3: Opcional — Componentes MEDIUM (20-80 líneas)

Estos quedan a criterio. Si el template se siente difícil de leer o editar, extraer. Si no, mantener inline.

- [x] `plans-grid.component.ts` — 79 líneas ✓
- [x] `notification-settings-card.component.ts` — 77 líneas ✓
- [x] `analytics-kpi-grid.component.ts` — 75 líneas ✓
- [x] `product-toolbar.component.ts` — 74 líneas ✓
- [x] `staff-table.component.ts` — 69 líneas ✓
- [ ] `order-filters.component.ts` — 63 líneas
- [ ] `recent-orders-widget.component.ts` — 61 líneas
- [ ] `current-plan-card.component.ts` — 61 líneas
- [ ] `customers-kpi-bar.component.ts` — 55 líneas
- [ ] `product-image-upload.component.ts` — 54 líneas
- [ ] `payment-history-table.component.ts` — 54 líneas
- [ ] `order-items-list.component.ts` — 52 líneas
- [ ] `pagination.component.ts` — 52 líneas
- [ ] `notification-list.component.ts` — 51 líneas
- [ ] `store-payments-tab.component.ts` — 49 líneas
- [ ] `kpi-card.component.ts` — 46 líneas
- [ ] `period-selector.component.ts` — 46 líneas
- [ ] `onboarding-nav.component.ts` — 44 líneas
- [ ] `staff-roles-info.component.ts` — 43 líneas
- [ ] `sidebar.component.ts` — 42 líneas
- [ ] `top-products-list.component.ts` — 42 líneas
- [ ] `form-field.component.ts` — 42 líneas
- [ ] `dashboard-kpi-grid.component.ts` — 40 líneas
- [ ] `payment-method-card.component.ts` — 40 líneas
- [ ] `bottom-nav.component.ts` — 40 líneas
- [ ] `onboarding-step4.component.ts` — 39 líneas
- [ ] `dialog.component.ts` — 39 líneas
- [ ] `mobile-shell.component.ts` — 38 líneas
- [ ] `product-preview-card.component.ts` — 36 líneas
- [ ] `drawer.component.ts` — 36 líneas
- [ ] `order-customer-info.component.ts` — 35 líneas
- [ ] `plan-usage-bar.component.ts` — 35 líneas
- [ ] `confirm-dialog.component.ts` — 33 líneas
- [ ] `shell.component.ts` — 32 líneas
- [ ] `category-chart.component.ts` — 32 líneas
- [ ] `usage-bar.component.ts` — 30 líneas
- [ ] `store-schedule-tab.component.ts` — 30 líneas
- [ ] `chart-card.component.ts` — 29 líneas
- [ ] `toast.component.ts` — 29 líneas
- [ ] `order-delivery-info.component.ts` — 28 líneas
- [ ] `welcome-checklist.component.ts` — 28 líneas
- [ ] `stepper.component.ts` — 27 líneas
- [ ] `search-bar.component.ts` — 25 líneas
- [ ] `status-transition.component.ts` — 25 líneas
- [ ] `button.component.ts` — 25 líneas
- [ ] `avatar.component.ts` — 25 líneas
- [ ] `order-status-tabs.component.ts` — 25 líneas
- [ ] `usage-bar.component.ts` (subscription) — 24 líneas
- [ ] `sales-chart.component.ts` — 23 líneas
- [ ] `sales-chart-widget.component.ts` — 23 líneas
- [ ] `order-payment-info.component.ts` — 21 líneas
- [ ] `bottom-sheet.component.ts` — 21 líneas
- [ ] `billing-cycle-toggle.component.ts` — 21 líneas
- [ ] `hourly-chart.component.ts` — 20 líneas
- [ ] `onboarding-stepper.component.ts` — 20 líneas

---

## Fase 4: Verificación

- [x] `ng build` — compila sin errores (budget warning preexistente, 529 kB > 400 kB)
- [x] `ng lint` — sin warnings ni errores
- [ ] `ng test` — tests pasan (si los hay)
- [ ] Revisar que los imports en cada `.ts` sigan siendo correctos (los componentes hijos referenciados en el template deben estar en `imports` o ser standalone)
- [ ] Revisar que los selectores de los `.scss` no necesiten encapsulación extra (Angular usa `ViewEncapsulation.Emulated` por default, los estilos extraídos funcionan igual que inline)

---

## Notas

- **No cambiar la lógica de negocio.** Solo mover strings de template y estilos a archivos.
- **Orden sugerido:** empezar por los más grandes (product-form-info, order-actions, order-list-table, customer-detail-modal) para sentir el beneficio rápido.
- **Commits atómicos:** un commit por componente extraído, con mensaje tipo `refactor(product-form-info): extraer template y estilos a archivos separados`.
