# Diagramas de Secuencia — Matching de Riders

Mapeo del flujo real de asignación de riders a partir de la lectura directa del código (`tiendi-api`), desde el `dispatch` del pedido hasta que el rider acepta la entrega. Incluye la rama automática (matching por score) y la rama manual (selección directa por el vendor).

Última actualización: 2026-09-08.

## Índice

- [1. Dispatch del pedido → creación de la Delivery](#1-dispatch-del-pedido--creación-de-la-delivery)
- [2. Matching automático (AUTO) con escalamiento](#2-matching-automático-auto-con-escalamiento)
- [3. Asignación manual (MANUAL) por el vendor](#3-asignación-manual-manual-por-el-vendor)
- [4. Aceptación del rider (`acceptDelivery`)](#4-aceptación-del-rider-acceptdelivery)
- [Fuera de alcance](#fuera-de-alcance)

---

## 1. Dispatch del pedido → creación de la Delivery

Fuente: `tiendi-api/src/modules/orders/orders.controller.ts` (`dispatch`), `tiendi-api/src/modules/orders/orders.service.ts` (`updateStatus`, `kickoffMatchingForOrder`).

```mermaid
sequenceDiagram
    actor Vendor
    participant OC as OrdersController
    participant OS as OrdersService
    participant DB as Prisma/DB
    participant MS as MatchingService

    Vendor->>OC: POST /orders/:id/dispatch
    OC->>OS: updateStatus(orderId, 'dispatch')
    OS->>OS: valida ALLOWED_TRANSITIONS
    OS->>DB: Order.update(status=DISPATCHED)
    OS->>DB: Delivery.create(status=ASSIGNED, pickupCode 4 dígitos)
    OS->>DB: lee store.assignmentMode

    alt assignmentMode = AUTO (default)
        OS->>OS: kickoffMatchingForOrder(orderId) [fire-and-forget]
        OS-->>MS: initiateMatching(deliveryId)
        Note over OS,MS: errores del kickoff solo se loguean,<br/>no bloquean la respuesta del dispatch
    else assignmentMode = MANUAL
        OS->>OS: log — delivery lista para selección manual
        Note over OS,Vendor: ver diagrama 3
    end

    OC-->>Vendor: 200 OK
```

---

## 2. Matching automático (AUTO) con escalamiento

Fuente: `tiendi-api/src/modules/matching/matching.service.ts` — `initiateMatching`, `offerToRider`, `handleRiderTimeout`, `handleRiderReject`, `escalateToNextCandidate`, `emitVendorMatchingStatus`.

```mermaid
sequenceDiagram
    participant MS as MatchingService
    participant DB as Prisma/DB
    participant BQ as BullMQ
    participant Rider
    participant WS as Socket.IO
    actor Vendor

    MS->>DB: findPhase1Candidates(storeId, lat, lng)
    Note right of MS: riders "de confianza" cerca de la tienda

    opt Phase1 vacío
        MS->>DB: findPhase2Candidates(lat, lng, excl. phase1, paymentMethod)
        Note right of MS: fallback ONLINE/ON_BREAK
    end

    alt sin candidatos (Phase1 y Phase2 vacíos)
        MS->>DB: Delivery.update(status=NO_RIDER)
        MS->>WS: emitVendorMatchingStatus(deliveryId, 'no_candidates')
        WS-->>Vendor: vendor:matching-status
        MS->>MS: alertAdminNoRider(deliveryId)
        Note over MS: fin — no hay a quién ofertar
    else hay candidatos
        MS->>MS: sort candidateIds por score desc
        MS->>BQ: schedule job "admin-alert" (delay=ADMIN_ALERT_DELAY_MS)
        Note right of BQ: red de seguridad de ~5 min si<br/>nadie resuelve la entrega
        MS->>MS: offerToRider(deliveryId, candidateIds[0], candidateIds, 0)
    end

    loop escalamiento — por cada índice de candidateIds
        MS->>WS: oferta al rider actual
        WS-->>Rider: delivery:offer
        MS->>BQ: schedule job rider-timeout (~30s)

        alt rider acepta
            Note over Rider,MS: sale del loop → diagrama 4 (acceptDelivery)
        else rider rechaza (rejectDelivery)
            Rider->>MS: handleRiderReject(deliveryId, riderId, candidateIds, nextIndex)
            MS->>DB: DeliveryEvent(type=OFFER_REJECTED)
            MS->>MS: escalateToNextCandidate(deliveryId, candidateIds, nextIndex)
        else timeout de 30s vence
            BQ->>MS: handleRiderTimeout(job)
            alt MANUAL_ASSIGN_MODE
                MS->>DB: DeliveryEvent(type=RIDER_REJECTED_OFFER)
                MS->>WS: notifica vendor
                Note over MS: no escala — modo manual no tiene<br/>más candidatos que ofrecer
            else modo legacy (AUTO)
                MS->>DB: penaliza acceptanceRate (-5, piso 0) y MonthlyScore
                MS->>MS: escalateToNextCandidate(deliveryId, candidateIds, nextIndex)
            end
        end
    end

    Note over BQ,MS: si el job "admin-alert" (~5 min) vence<br/>sin que la delivery se haya resuelto → alertAdminNoRider(deliveryId)
```

---

## 3. Asignación manual (MANUAL) por el vendor

Fuente: `tiendi-api/src/modules/vendor-delivery/vendor-delivery.controller.ts` (`assignRider`), `tiendi-api/src/modules/vendor-delivery/vendor-delivery.service.ts` (`assignRider`, líneas 212-289).

```mermaid
sequenceDiagram
    actor Vendor
    participant VDC as VendorDeliveryController
    participant VDS as VendorDeliveryService
    participant DB as Prisma/DB
    participant MS as MatchingService
    participant WS as Socket.IO
    participant Rider

    Vendor->>VDC: (candidatos Phase1/Phase2 ya listados en pantalla)
    Vendor->>VDC: POST /vendor-delivery/:orderId/assign-rider {riderId}
    VDC->>VDS: assignRider(orderId, userId, userRole, riderId)

    VDS->>DB: Order.findUnique(storeId, store.ownerId)
    alt no existe
        VDS-->>VDC: 404 Order not found
    end

    VDS->>VDS: resolveStoreAccess (SUPER_ADMIN bypasea)
    alt sin acceso a la tienda
        VDS-->>VDC: 403 Forbidden
    end

    VDS->>DB: Delivery.findFirst(orderId) [la más reciente]
    alt delivery.riderId !== null
        VDS-->>VDC: 409 DELIVERY_ALREADY_ASSIGNED
    end

    VDS->>DB: Rider.findUnique(riderId)
    alt rider inexistente o status != ACTIVE
        VDS-->>VDC: 422 RIDER_NOT_VALID_CANDIDATE
    end

    VDS->>DB: DeliveryEvent.create(type=VENDOR_SELECTED,<br/>{riderId, vendorUserId, storeId, selectedAt})
    VDS->>MS: offerToRider(deliveryId, riderId, [riderId], 0)
    Note right of MS: candidateIds tiene un solo elemento —<br/>mismo mecanismo de oferta + timeout 30s del diagrama 2,<br/>pero sin lista para escalar
    MS->>WS: oferta al rider
    WS-->>Rider: delivery:offer

    VDC-->>Vendor: 200 OK

    Note over Rider,Vendor: si el rider rechaza o vence el timeout,<br/>handleRiderTimeout detecta MANUAL_ASSIGN_MODE y NO escala —<br/>solo notifica al vendor para que elija otro rider manualmente
```

---

## 4. Aceptación del rider (`acceptDelivery`)

Fuente: `tiendi-api/src/modules/delivery/delivery.service.ts` (`acceptDelivery`, líneas 200-319).

```mermaid
sequenceDiagram
    actor Rider
    participant DS as DeliveryService
    participant DB as Prisma/DB
    participant MS as MatchingService
    participant WS as Socket.IO
    actor Vendor

    Rider->>DS: acceptDelivery(deliveryId, userId)
    DS->>DB: Rider.findUnique(userId)
    alt rider no encontrado
        DS-->>Rider: 403 Forbidden
    end

    DS->>DB: Delivery.updateMany(where: id, riderId=null → riderId, status=HEADING_TO_STORE)
    Note right of DB: optimistic lock — solo pega si nadie<br/>lo había tomado todavía

    alt count === 0
        DS-->>Rider: 409 DELIVERY_ALREADY_ASSIGNED
    end

    DS->>DB: Delivery.findUnique(deliveryId) [enriquecida]
    alt delivery null (borrado concurrente)
        DS-->>Rider: 404 Not Found
    end

    DS->>MS: cancelPendingTimeout(deliveryId, riderId)
    Note right of MS: cancela el job rider-timeout (30s)<br/>y el job admin-alert (5min) pendientes

    DS->>DB: DeliveryEvent.create(type=STATUS_CHANGE)
    DS->>WS: broadcastToDelivery(deliveryId, 'delivery:accepted')
    DS->>WS: emitVendorStatusUpdate(deliveryId, HEADING_TO_STORE)

    alt assignmentMode = MANUAL
        DS->>DB: busca evento VENDOR_SELECTED más reciente
        DS->>WS: emitToVendor('vendor:rider-accepted')
        DS->>Vendor: notifyVendorRiderAccepted (FCM)
    end

    alt order.paymentMethod = CASH
        DS->>DB: Wallet.findUnique(riderId).cashOnHand
        alt cashOnHand >= 200
            DS->>DB: ROLLBACK — Delivery.updateMany(riderId=null, status=ASSIGNED)
            DS-->>Rider: 422 CASH_ON_HAND_LIMIT_EXCEEDED
        end
    end

    DS-->>Rider: 200 RiderDeliveryDto (status=HEADING_TO_STORE)
```

---

## Fuera de alcance

El ciclo de vida posterior a `HEADING_TO_STORE` (llegada a la tienda, recogida, en camino al cliente, entrega/POD) no fue relevado en esta sesión — no está incluido para evitar documentar nombres de métodos sin verificar contra el código real.
