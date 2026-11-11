---
tags:
  - tiendi
  - migracion
aliases:
  - Migración JSON Server API
---

# Migración: json-server → API REST (NestJS)

> Objetivo: reemplazar json-server (`localhost:3000`) por la API real (`localhost:4000/api/v1`) en el frontend Angular (tiendi-web).

---

## Índice

- [Fase A — Infraestructura base](#fase-a--infraestructura-base)
- [Fase B — Autenticación con JWT](#fase-b--autenticación-con-jwt)
- [Fase C — Modelo de usuario](#fase-c--modelo-de-usuario)
- [Fase D — Servicios de datos](#fase-d--servicios-de-datos)
- [Fase E — Tiendas](#fase-e--tiendas)
- [Fase F — Productos](#fase-f--productos)
- [Fase G — Carrito y pedidos](#fase-g--carrito-y-pedidos)
- [Fase H — Limpieza](#fase-h--limpieza)

---

## Leyenda

| Símbolo | Significado |
|---------|-------------|
| `[ ]` | Pendiente |
| `[x]` | Completado |
| `[~]` | En progreso |
| `[-]` | Descartado / no aplica |

---

## Fase A — Infraestructura base

- [x] Actualizar `environment.ts` — `apiUrl` → `http://localhost:4000/api/v1`
- [x] Actualizar `environment.prod.ts` — `apiUrl` → `https://api.tiendi.app/api/v1`
- [x] Crear `TokenService` — guarda/lee/borra access token y refresh token en `localStorage`
- [x] Crear `authInterceptor` — adjunta `Authorization: Bearer {token}` en cada request
- [x] Crear `authErrorInterceptor` — intercepta 401 y dispara refresh token automático
- [x] Registrar ambos interceptores en `app.config.ts` con `withInterceptors()`

---

## Fase B — Autenticación con JWT

### B.1 Login

- [x] Reescribir `LandingAuthService.login()` → `POST /auth/login` con `{ email, password }`
- [x] Guardar `accessToken` y `refreshToken` en `TokenService`
- [x] El backend ya devuelve `user` en la respuesta — no hace falta llamada extra a `/auth/me`
- [x] Eliminar comparación de passwords en texto plano contra json-server

### B.2 Registro

- [x] Agregar campo `password` y `confirmarPassword` al register form (template + lógica)
- [x] Reescribir `LandingAuthService.register()` → `POST /auth/register`
- [x] Mapear: `nombres` → `firstName`, `apellidoPaterno + apellidoMaterno` → `lastName`, `telefono` → `phone`
- [x] Eliminar llamada `POST /usuarios` a json-server

### B.3 Logout

- [x] Reescribir `LandingAuthService.logout()` → `POST /auth/logout` con Bearer token
- [x] Limpiar tokens del `TokenService` al cerrar sesión
- [x] Limpiar `localStorage` (sesión, comprador, tienda)

### B.4 Refresh token

- [x] Implementado en `authErrorInterceptor` (Fase A) — automático y transparente

### B.5 Sesión persistente

- [x] `restoreSession()` en `App.ngOnInit()` — llama `GET /auth/me` si hay token
- [x] Si el token es inválido: limpia sesión y tokens locales

---

## Fase C — Modelo de usuario

- [x] Actualizar `ICurrentUser` — `firstName`, `lastName`, `phone`, `role` + aliases `nombre` y `tieneTienda`
- [x] Crear `mapApiUser()` en `LandingAuthService` para convertir respuesta del backend
- [x] Actualizar `authState` computed: `tieneTienda` → `role === 'STORE_OWNER'`
- [x] Revisar todos los componentes que usan `ICurrentUser`:
  - [-] `landing-navbar` — usa `userName` y `avatarUrl` (computed), sin cambios
  - [-] `auth-panel` — solo orquesta login/register, sin cambios
  - [-] `login-form` — `ILoginPayload` no cambió
  - [x] `register-form` — agregado campo `password` al payload e interfaz
  - [x] `landing-page` — `telefono` → `phone`, `fechaRegistro` eliminado, `idTienda` con TODO
  - [x] `user-profile` — `nombres/telefono` → `firstName/phone` con retrocompatibilidad

---

## Fase D — Servicios de datos

- [x] Actualizar `DataService` — usa `environment.apiUrl` (`localhost:4000/api/v1`) como base
- [x] Eliminar header `Access-Control-Allow-Origin: *` (lo maneja el backend con CORS)
- [x] Actualizar `execGetJson` para manejar `HttpParams` correctamente
- [x] Eliminar `ApiService` — sin usuarios, eliminado del barrel y del disco
- [x] Actualizar `LandingService.subscribir()` — placeholder hasta crear endpoint en backend
- [x] Actualizar `LandingService.fetchCollection()` — extrae `data.data` del response paginado
- [~] Eliminar `DataService` — sigue en disco pero ya no lo inyecta ningún servicio de negocio (limpieza pendiente)

---

## Fase E — Tiendas

- [x] Reemplazar llamadas a `/tiendas` (json-server) por `GET /stores`
- [x] Reemplazar llamada a `/tiendas/:id` por `GET /stores/:slug`
- [x] Actualizar `ITienda` — agregar `id`, `slug`, `logoUrl`, `bannerUrl`, `city`, `whatsapp`, `openingHours`, `paymentMethods`
- [x] Reescribir `TiendaService` con mapper `apiStore → ITienda` (mantiene compatibilidad legacy)
- [x] Reescribir `LandingService` — usa `TiendaService`, elimina fetch a json-server
- [x] Actualizar navegación en `landing-page` — usa `slug` en lugar de `IDTienda` numérico
- [-] Búsqueda por ciudad — cubierta con el filtro en memoria del `LandingService`
- [-] Tiendas cercanas por API — Haversine en memoria es suficiente para MVP

---

## Fase F — Productos

- [x] Reemplazar llamadas a `/productos` (json-server) por `GET /stores/:storeId/products`
- [x] Reemplazar llamada a `/productos/:id` por `GET /products/:id`
- [x] Adaptar modelo de producto al schema del backend (`salePrice`, `images`, `isActive`, etc.)
- [x] Conectar filtros del catálogo (categoría, precio, búsqueda) a los query params del backend
- [x] Conectar `GET /categories` para el listado de categorías del catálogo
- [x] Actualizar `layout.ts` — resuelve slug → UUID antes de cargar categorías/productos
- [x] Reescribir `CategoriaService` — usa `GET /categories`, mapea UUID↔numericId con dos Maps
- [x] Reescribir `ProductService` — usa `GET /stores/:uuid/products`, soporta filtros (categoría, búsqueda, featured)

---

## Fase G — Carrito y pedidos

- [x] Agregar `productIndexMap` (UUID→numericId) en `ProductService` + métodos `getProductUuid()` / `getProductNumericId()`
- [x] Reescribir `PedidoService` — elimina `DataService`, usa `HttpClient` + `TokenService` + `ProductService`
  - [x] `createPedido()` — sincroniza localStorage→Redis (`DELETE /cart` + `POST /cart/items`) y crea orden (`POST /orders`)
  - [x] `getPedidos()` — `GET /orders`, mapea respuesta backend a `IPedido[]`
  - [x] `searchPedidos()` — `GET /orders` + filtro client-side por número
  - [x] Carrito local (add/remove/set/clear en localStorage) — sin cambios
  - [x] Fallback gracioso: sin token → éxito local sin llamar al backend
- [x] Reescribir `FavoritoService` — usa `HttpClient` + `TokenService` + `ProductService`
  - [x] `getFavoritos()` / `getFavoritosByComprador()` → `GET /favorites`, mapea UUID→numericId
  - [x] `addFavorito()` → `POST /favorites { productId: uuid }`, dispara `favoritosChanged`
  - [x] `removeFavorito()` → `DELETE /favorites/:uuid`, dispara `favoritosChanged`
  - [x] Sin token → no-op silencioso en todos los métodos
  - [x] `applyFavoritos()` — sin cambios, sigue marcando `producto.Favorito`

---

## Fase H — Limpieza

- [x] Eliminar `db.json` del proyecto
- [x] Eliminar dependencia `json-server` del `package.json`
- [x] Eliminar script `"api"` del `package.json`
- [-] Eliminar `server.ts` — es el SSR de Angular, no tiene relación con json-server
- [-] Actualizar `README.md` — no tenía referencias a json-server

---

## Notas técnicas

- **API base URL**: `http://localhost:4000/api/v1`
- **Auth**: JWT — access token en `localStorage`, refresh token en `localStorage`
- **Headers requeridos**: `Authorization: Bearer {accessToken}` en rutas protegidas
- **Campos renombrados**:
  - `nombres` → `firstName`
  - `apellidoPaterno` → `lastName` (concatenado)
  - `telefono` → `phone`
  - `tieneTienda` → derivado de `role === 'STORE_OWNER'`

---

*Última actualización: 2026-04-15 — Migración completada ✓*

---

## Ver también

- [[API_DOCUMENTATION]] — documentación completa de la API REST
- [[TAREAS]] — lista de tareas por fase con estado de avance
- [[WEB-VENDOR/DIFERENCIAS-MOCK-REAL]] — diferencias entre mock y API real
- [[WEB-VENDOR/FASE-14-MIGRACION]] — fase 14 de migración del panel de vendedor
- [[ARCHITECTURE-SONNET]] — arquitectura técnica del sistema
