# Panel del Vendedor — Tiendi Vendor

Aplicación Angular standalone para la gestión de tiendas en Tiendi.

## Stack

- **Angular 21** — standalone components, OnPush, Signal Store
- **SCSS + Tailwind CSS v4** — theming con CSS custom properties
- **Chart.js** — analytics y reportes
- **Playwright** — tests E2E
- **Vitest** — tests unitarios

## Requisitos previos

- Node.js ≥ 18
- Backend API corriendo en `http://localhost:4000/api/v1` (ver `tiendi-api/`)

## Desarrollo

```bash
npm install
ng serve --open
```

La app se levanta en `http://localhost:4201/`.

## Build producción

```bash
ng build
```

## Tests

```bash
# Unitarios
ng test

# E2E (requiere backend corriendo)
ng e2e

# Lint
ng lint
```

## Estructura del proyecto

```
src/app/vendor/
├── core/           # Guards, interceptors, servicios core
├── shared/ui/      # Componentes reutilizables (átomos, moléculas, organismos)
├── shared/layout/  # Shell, topbar, sidebar, bottom-nav
└── features/       # Módulos funcionales
    ├── analytics/
    ├── customers/
    ├── dashboard/
    ├── legal/
    ├── notifications/
    ├── onboarding/
    ├── orders/
    ├── products/
    ├── staff/
    ├── store-config/
    └── subscription/
```

## Convenciones

- **Selectores:** prefijo `td-` (componentes shared), `app-` (componentes feature)
- **Componentes < 20 líneas de template:** inline (`template: \`...\``)
- **Componentes > 80 líneas de template:** archivo separado (`templateUrl`)
- **Schematics default:** `standalone: true`, `OnPush`, `inlineTemplate: true`, `inlineStyle: true`
