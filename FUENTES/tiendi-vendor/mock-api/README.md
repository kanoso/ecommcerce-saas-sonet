# Mock API — json-server

Simula el backend del panel vendedor durante el desarrollo frontend.

**Puerto:** `3001`  
**Comando:** `npm run mock`

---

## Credenciales de prueba

| Email | Contraseña | Rol | Acceso |
|-------|-----------|-----|--------|
| `carlos@tiendi.app` | cualquiera | STORE_OWNER | Todo |
| `maria@tiendi.app`  | cualquiera | MANAGER     | Todo excepto staff, plan, facturación |
| `juan@tiendi.app`   | cualquiera | CASHIER     | Solo pedidos |
| `rosa@tiendi.app`   | cualquiera | WAREHOUSE   | Solo productos (stock) |

El token JWT se retorna al hacer `POST /auth/login` y debe enviarse en el header `Authorization: Bearer <token>`.

---

## Colecciones disponibles

| Colección | Ruta | Descripción |
|-----------|------|-------------|
| `users` | `/users` | Usuarios del sistema |
| `stores` | `/stores` | Tiendas (s1 = completa, s2 = sin onboarding) |
| `categories` | `/categories` | Categorías globales de productos |
| `products` | `/products` | Productos de la tienda s1 (10 items) |
| `orders` | `/orders` | Pedidos en todos los estados (6 items) |
| `customers` | `/customers` | Clientes de la tienda s1 (3 items) |
| `employees` | `/employees` | Staff (4 activos + 1 invitación pendiente) |
| `subscription-plans` | `/subscription-plans` | Planes Gratuito / Pro / Enterprise |
| `store-subscriptions` | `/store-subscriptions` | Suscripción activa de s1 (Plan Pro) |
| `notifications` | `/notifications` | Notificaciones mixtas (3 no leídas) |
| `notification-settings` | `/notification-settings` | Config de canales por tipo |
| `invoices` | `/invoices` | Comprobantes emitidos (1 boleta) |
| `complaints` | `/complaints` | Reclamos INDECOPI (pendiente / respondido / cerrado) |
| `payment-history` | `/payment-history` | Historial de pagos (3 meses) |

---

## Lógica del middleware

### Autenticación JWT (simulada)

- `POST /auth/login` → retorna `{ token, refreshToken, user }`
- `POST /auth/refresh` → retorna nuevo `{ token, refreshToken }`
- Cualquier ruta `/vendor/*`, `/stores/*`, `/orders/*`, `/products/*` requiere `Authorization: Bearer <token>`
- Token inválido o ausente → `401`

### Guards de rol

| Ruta | STORE_OWNER | MANAGER | CASHIER | WAREHOUSE |
|------|:-----------:|:-------:|:-------:|:---------:|
| `/vendor/dashboard` | ✅ | ✅ | ✅ | ❌ 403 |
| `/vendor/orders` | ✅ | ✅ | ✅ | ❌ 403 |
| `/vendor/products` | ✅ | ✅ | ❌ 403 | ✅ |
| `/vendor/analytics` | ✅ | ✅ | ❌ 403 | ❌ 403 |
| `/vendor/customers` | ✅ | ✅ | ❌ 403 | ❌ 403 |

### Latencia simulada

Cada request tiene una latencia aleatoria de 100–400ms para simular red real.

---

## Ampliar seed data

Para las fases M2 y M3 se recomienda ampliar:
- `products` → 30 items (distintas categorías, estados y niveles de stock)
- `orders` → 20 pedidos (para probar paginación y filtros)

Editar directamente `db.json` — json-server recarga en caliente con `--watch`.
