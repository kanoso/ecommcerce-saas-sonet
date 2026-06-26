---
tags:
  - tiendi-vendor
  - tiendi-go
  - tiendi-api
  - feature/riders
  - plan
  - modulo/riders
aliases:
  - Plan Gestión Riders
  - Riders por Tienda
  - Mis Repartidores
---

# Plan: Gestión de Riders por Tienda

Implementación de la sección "Mis Repartidores" en tiendi-vendor y el flujo de invitación/aceptación en tiendi-go.

---

## Estado actual

> **Última actualización:** 2026-06-26 — Feature completa ✅

| Pieza | Estado |
|---|---|
| Modelo `TrustedRider` en DB (PENDING / ACTIVE / SUSPENDED / REVOKED) | ✅ existe |
| Matching Phase 1: riders de confianza de la tienda (radio 5 km) | ✅ existe |
| Matching Phase 2: cualquier rider disponible si Phase 1 falla (radio 10 km) | ✅ existe |
| `OfferCard` en tiendi-go con accept/reject + timer 30 s | ✅ existe |
| Rider asignado visible en detalle de pedido (tiendi-vendor) | ✅ implementado |
| Actualización en tiempo real al aceptar/rechazar oferta (tiendi-vendor) | ✅ implementado |
| API endpoints para que la tienda gestione sus riders | ✅ implementado (PR 1) |
| UI "Mis Repartidores" en tiendi-vendor | ✅ implementado (PR 2) |
| Pantalla de invitaciones en tiendi-go | ✅ implementado (PR 3) |

---

## Flujo completo (happy path)

```
[STORE_OWNER en tiendi-vendor]
  → ingresa teléfono del rider en "Mis Repartidores"
  → API busca el rider por teléfono
  → crea TrustedRider { status: PENDING }
  → envía FCM push al rider (type: STORE_INVITE)

[RIDER en tiendi-go]
  → recibe notificación push
  → abre pantalla "Invitaciones de tiendas"
  → ve card con nombre/logo de la tienda
  → toca Aceptar → TrustedRider { status: ACTIVE }
    o Rechazar → TrustedRider { status: REVOKED }

[MATCHING ENGINE - sin cambios]
  → Phase 1 usa riders con status ACTIVE de esa tienda
  → Phase 2 escala a cualquier rider disponible si Phase 1 falla
```

---

## PR 1 — Backend (tiendi-api) ✅ COMPLETO

### Módulo: `store-riders`

Módulo `src/modules/store-riders/` implementado con controller, service y DTOs.

### Endpoints

```
GET    /stores/:storeId/riders
       → lista TrustedRider[] con nombre, teléfono, rating, foto, estado op. (ONLINE/OFFLINE), status del vínculo
       → guard: STORE_OWNER (storeId debe coincidir con el store del usuario) | SUPER_ADMIN

POST   /stores/:storeId/riders
       body: { phone: string }
       → busca User por phone → busca Rider por userId
       → si no existe rider: 404 "Este número no corresponde a un repartidor"
       → si ya tiene TrustedRider ACTIVE: 409 "Este repartidor ya está vinculado"
       → crea TrustedRider { status: PENDING }
       → envía FCM push al rider: { type: 'STORE_INVITE', storeId, storeName }
       → guard: STORE_OWNER | SUPER_ADMIN

DELETE /stores/:storeId/riders/:riderId
       → set TrustedRider.status = REVOKED
       → guard: STORE_OWNER | SUPER_ADMIN

PATCH  /stores/:storeId/riders/:riderId
       body: { status: 'ACTIVE' | 'SUSPENDED' }
       → actualiza TrustedRider.status
       → guard: STORE_OWNER | SUPER_ADMIN

GET    /riders/me/invitations
       → lista TrustedRider[] con status PENDING para el rider autenticado
       → incluye store: { name, logoUrl, address }
       → guard: RIDER

PATCH  /riders/me/invitations/:trustedRiderId
       body: { accept: boolean }
       → accept = true  → status ACTIVE,  acceptedAt = now()
       → accept = false → status REVOKED
       → guard: RIDER (solo puede responder sus propias invitaciones)
```

### DTOs

```typescript
// add-store-rider.dto.ts
export class AddStoreRiderDto {
  @IsPhoneNumber('PE')
  phone: string;
}

// update-store-rider-status.dto.ts
export class UpdateStoreRiderStatusDto {
  @IsEnum(['ACTIVE', 'SUSPENDED'])
  status: 'ACTIVE' | 'SUSPENDED';
}

// respond-invitation.dto.ts
export class RespondInvitationDto {
  @IsBoolean()
  accept: boolean;
}
```

---

## PR 2 — tiendi-vendor (Angular 21) ✅ COMPLETO

### Ruta implementada

Opción B elegida: ruta separada `/vendor/store-riders`

### Estructura de archivos (implementada)

```
src/app/vendor/features/store-riders/
  store-riders.store.ts               ← NgRx Signals (signalStore, providedIn: root)
  pages/
    store-riders-list.page.ts         ← container
    store-riders-list.page.html
    store-riders-list.page.scss
  components/
    rider-card.component.ts           ← card individual con acciones
    rider-card.component.html
    rider-card.component.scss
    invite-rider-dialog.component.ts  ← búsqueda por nombre + invite-by-id
    invite-rider-dialog.component.html
    invite-rider-dialog.component.scss
```

### `StoreRidersStore`

```typescript
interface StoreRider {
  trustedRiderId: string;
  riderId: string;
  name: string;
  phone: string | null;
  photoUrl: string | null;
  rating: number | null;
  isOnline: boolean;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  acceptedAt: string | null;
}

interface StoreRidersState {
  riders: StoreRider[];
  isLoading: boolean;
  isAdding: boolean;
  error: string | null;
}

// Métodos
loadRiders(): Promise<void>
addRider(phone: string): Promise<void>    // POST - crea la invitación
removeRider(riderId: string): Promise<void> // DELETE - revoca
updateStatus(riderId: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<void>
```

### UI — `store-riders-page`

```
┌─────────────────────────────────────────────────────┐
│ Mis Repartidores                    [+ Invitar]      │
├─────────────────────────────────────────────────────┤
│ [foto] Juan García        ACTIVO  ● Online           │
│        📞 +51 999 888 777  ⭐ 4.8         [Suspender] [Quitar] │
├─────────────────────────────────────────────────────┤
│ [foto] María López        PENDIENTE  ○ Offline       │
│        📞 +51 977 666 555  ⭐ 4.5     [Esperando respuesta...]  │
├─────────────────────────────────────────────────────┤
│ [foto] Pedro Rojas        SUSPENDIDO ● Offline       │
│        📞 +51 955 444 333  ⭐ 4.1     [Activar] [Quitar]       │
└─────────────────────────────────────────────────────┘
```

### Dialog "Invitar Repartidor"

```
┌─────────────────────────────────┐
│ Invitar Repartidor              │
│                                 │
│ Teléfono del repartidor         │
│ [+51 _________________]         │
│                                 │
│ El repartidor recibirá una      │
│ notificación para aceptar.      │
│                                 │
│              [Cancelar] [Invitar]│
└─────────────────────────────────┘
```

### Sidebar

Agregar en `sidebar.component.ts` (roles: STORE_OWNER, MANAGER):
```typescript
{
  label: 'Mis Repartidores',
  icon: 'directions_bike',
  route: '/vendor/store-riders',   // o como tab dentro de /vendor/staff
  roles: ['STORE_OWNER', 'MANAGER', 'SUPER_ADMIN'],
}
```

---

## PR 3 — tiendi-go (Expo / React Native) ✅ COMPLETO — 27/27 tests

### Pantalla nueva: `RiderInvitationsScreen`

```
src/screens/rider/
  RiderInvitationsScreen.tsx
  components/
    StoreInviteCard.tsx
```

### `StoreInviteCard`

```
┌──────────────────────────────────┐
│  [logo]  Bodega Del Sol          │
│          Av. Larco 123, Miraflores│
│          ● 3.2 km                │
│                                  │
│    [Rechazar]    [Aceptar]       │
└──────────────────────────────────┘
```

Sin timer (las invitaciones no expiran automáticamente, a diferencia de las ofertas de delivery).

### Navegación

- Tab "Invitaciones" en el stack del rider (ícono: `store` o `handshake`)
- Badge con contador de invitaciones PENDING
- Al recibir FCM `type: STORE_INVITE` → navegar a esta pantalla

### Hook `useStoreInvitations`

```typescript
// GET /riders/me/invitations → lista invitaciones PENDING
// PATCH /riders/me/invitations/:id → { accept: boolean }

const { invitations, respond, isLoading } = useStoreInvitations();
```

### FCM handling

En el handler de notificaciones push existente, agregar:
```typescript
if (notification.data?.type === 'STORE_INVITE') {
  navigation.navigate('RiderInvitations');
}
```

---

## Secuencia de entrega ✅ COMPLETADA

```
PR 1 ✅ → tiendi-api: módulo store-riders (endpoints GET/POST/DELETE/PATCH + invitaciones rider)
PR 2 ✅ → tiendi-vendor: UI "Mis Repartidores" (lista + invite con búsqueda + suspender + quitar)
PR 3 ✅ → tiendi-go: pantalla de invitaciones (StoreInviteCard + hook + FCM routing) — 27/27 tests
```

---

## Ver también

- [[PLAN-REFACTOR-TEMPLATES]] — plan de refactor de templates en tiendi-vendor
- [[DOCUMENTACION_CHECKLIST]] — checklist de documentación del proyecto
