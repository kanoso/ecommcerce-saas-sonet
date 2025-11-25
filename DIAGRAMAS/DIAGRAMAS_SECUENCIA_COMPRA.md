# Diagramas de Secuencia - Proceso de Compra - Sistema Tiendi

Este documento contiene los diagramas de secuencia relacionados con el proceso de compra y pago.

---

## 1. Secuencia de Proceso de Compra Completo

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Product as Product Service
    participant Cart as Cart Service
    participant Order as Order Service
    participant Payment as Payment Service
    participant Queue as Message Queue
    participant Notif as Notification Service
    participant DB as PostgreSQL
    participant Redis as Redis Cache

    User->>Web: Seleccionar producto
    Web->>Gateway: GET /products/{id}
    Gateway->>Product: Get product details
    Product->>DB: SELECT product + stock
    DB-->>Product: Product data
    Product->>Redis: Check cache for images
    Redis-->>Product: Cached data
    Product-->>Gateway: Product details
    Gateway-->>Web: 200 OK + product
    Web-->>User: Mostrar detalle

    User->>Web: Agregar al carrito (cantidad: 2)
    Web->>Gateway: POST /cart/items<br/>{productId, quantity: 2}
    Gateway->>Cart: Add to cart
    Cart->>DB: SELECT stock WHERE product_id=?
    DB-->>Cart: Available stock

    alt Stock insuficiente
        Cart-->>Gateway: 400 Bad Request
        Gateway-->>Web: Error: Stock insuficiente
        Web-->>User: Mostrar error
    else Stock disponible
        Cart->>DB: INSERT cart_item
        Cart->>Redis: SET cart:{userId}
        Cart-->>Gateway: 201 Created
        Gateway-->>Web: Success
        Web->>Web: Actualizar contador carrito
        Web-->>User: Mostrar notificación "Agregado"
    end

    User->>Web: Ir al checkout
    Web->>Gateway: GET /cart
    Gateway->>Cart: Get cart items
    Cart->>Redis: GET cart:{userId}
    Cart->>DB: SELECT cart items with products
    DB-->>Cart: Cart data
    Cart-->>Gateway: Cart items
    Gateway-->>Web: 200 OK + items
    Web-->>User: Mostrar paso 1: Productos

    User->>Web: Continuar a despacho
    Web-->>User: Mostrar paso 2

    User->>Web: Seleccionar despacho + pago<br/>Aceptar términos
    Web->>Gateway: POST /orders<br/>{items, delivery, payment}
    Gateway->>Order: Create order

    Order->>DB: BEGIN TRANSACTION
    Order->>DB: INSERT order
    Order->>DB: INSERT order_items

    Order->>DB: UPDATE products<br/>SET stock = stock - quantity

    alt Stock verification failed
        Order->>DB: ROLLBACK
        Order-->>Gateway: 409 Conflict
        Gateway-->>Web: Error: Producto agotado
        Web-->>User: Mostrar error
    else Stock OK
        Order->>DB: DELETE cart_items
        Order->>DB: COMMIT

        Order->>Queue: Publish message<br/>{event: "order.created", orderId}

        par Procesamiento asíncrono
            Queue->>Payment: Process payment
            Payment->>Payment: Validate payment method
            Payment-->>Queue: Payment processed
        and
            Queue->>Notif: Send notifications
            Notif->>Notif: Email a usuario
            Notif->>Notif: Email a tienda
            Notif->>Notif: Push notification
        end

        Order->>Redis: DEL cart:{userId}
        Order-->>Gateway: 201 Created<br/>{orderId, orderNumber}
        Gateway-->>Web: Success
        Web->>Web: Limpiar carrito local
        Web-->>User: Mostrar confirmación<br/>"Pedido enviado"
    end
```

---

## 2. Secuencia de Integración de Pago con Tarjeta

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Order as Order Service
    participant Payment as Payment Service
    participant PayGate as Payment Gateway<br/>(Visa/Mastercard)
    participant DB as PostgreSQL
    participant Queue as Message Queue
    participant Notif as Notification Service

    User->>Web: Seleccionar "Pago con tarjeta"
    Web-->>User: Formulario de tarjeta

    User->>Web: Ingresar datos de tarjeta
    Web->>Web: Validación frontend<br/>(número, CVV, fecha)

    Web->>Gateway: POST /orders/payment<br/>{orderId, cardData, amount}
    Gateway->>Payment: Process payment

    Payment->>Payment: Encriptar datos sensibles
    Payment->>DB: INSERT payment_attempt<br/>{orderId, status: "pending"}

    Payment->>PayGate: POST /charge<br/>{cardToken, amount, metadata}
    PayGate->>PayGate: Validar tarjeta
    PayGate->>PayGate: Verificar fondos

    alt Pago rechazado
        PayGate-->>Payment: 402 Payment Required<br/>{error: "Fondos insuficientes"}
        Payment->>DB: UPDATE payment_attempt<br/>SET status = "failed"
        Payment-->>Gateway: 402 Payment Failed
        Gateway-->>Web: Error de pago
        Web-->>User: Mostrar error:<br/>"Pago rechazado"
    else Pago exitoso
        PayGate-->>Payment: 200 OK<br/>{transactionId, status: "approved"}

        Payment->>DB: BEGIN TRANSACTION
        Payment->>DB: UPDATE payment_attempt<br/>SET status = "completed"
        Payment->>DB: INSERT payment<br/>{orderId, transactionId, amount}
        Payment->>Order: Update order payment status
        Order->>DB: UPDATE orders<br/>SET payment_status = "paid"
        Payment->>DB: COMMIT

        Payment->>Queue: Publish event<br/>{event: "payment.completed", orderId}

        par Notificaciones
            Queue->>Notif: Send payment confirmation
            Notif->>Notif: Email a usuario
            Notif->>Notif: Email a tienda
            Notif-->>User: Confirmación recibida
        end

        Payment-->>Gateway: 200 OK<br/>{paymentId, transactionId}
        Gateway-->>Web: Payment success
        Web-->>User: Mostrar confirmación<br/>"Pago procesado exitosamente"
    end
```

---

## 3. Secuencia de Pago con Transferencia Bancaria

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Order as Order Service
    participant Payment as Payment Service
    participant DB as PostgreSQL
    participant Email as Email Service

    User->>Web: Seleccionar "Transferencia bancaria"
    Web-->>User: Formulario de checkout

    User->>Web: Confirmar pedido
    Web->>Gateway: POST /orders<br/>{items, delivery, payment: "transfer"}
    Gateway->>Order: Create order

    Order->>DB: BEGIN TRANSACTION
    Order->>DB: INSERT order<br/>{status: "pending_payment"}
    Order->>DB: INSERT order_items
    Order->>DB: UPDATE products stock
    Order->>DB: COMMIT

    Order->>Payment: Register pending payment
    Payment->>DB: INSERT payment<br/>{orderId, method: "transfer", status: "pending"}

    Order-->>Gateway: 201 Created<br/>{orderId, orderNumber}
    Gateway-->>Web: Success + order details

    Web-->>User: Mostrar instrucciones de pago

    par Envío de instrucciones
        Order->>Email: Send payment instructions
        Email-->>User: Email con datos bancarios:<br/>- Banco<br/>- Cuenta<br/>- Monto exacto<br/>- Número de pedido
    end

    Note over User: Usuario realiza transferencia offline

    User->>Web: Subir comprobante de pago
    Web->>Gateway: POST /orders/{id}/payment-proof<br/>{image}
    Gateway->>Payment: Upload proof

    Payment->>DB: UPDATE payment<br/>SET proof_url=?, status="verifying"
    Payment-->>Gateway: 200 OK
    Gateway-->>Web: Success
    Web-->>User: "Comprobante recibido<br/>En verificación"

    Note over Payment: Admin verifica el pago manualmente

    Payment->>DB: UPDATE payment<br/>SET status="approved"
    Payment->>Order: Update order status
    Order->>DB: UPDATE orders<br/>SET payment_status="paid"<br/>status="confirmed"

    par Notificación de confirmación
        Order->>Email: Send confirmation
        Email-->>User: Email: "Pago confirmado"
    end
```

---

## 4. Secuencia de Pago en Efectivo

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Order as Order Service
    participant Payment as Payment Service
    participant DB as PostgreSQL
    participant Notif as Notification Service

    User->>Web: Seleccionar "Efectivo"
    Web-->>User: Mensaje: "Pago contra entrega"

    User->>Web: Confirmar pedido
    Web->>Gateway: POST /orders<br/>{items, delivery, payment: "cash"}
    Gateway->>Order: Create order

    Order->>DB: BEGIN TRANSACTION
    Order->>DB: INSERT order<br/>{status: "pending"}
    Order->>DB: INSERT order_items
    Order->>DB: UPDATE products stock
    Order->>DB: COMMIT

    Order->>Payment: Register cash payment
    Payment->>DB: INSERT payment<br/>{orderId, method: "cash", status: "pending"}

    Order-->>Gateway: 201 Created<br/>{orderId, orderNumber}
    Gateway-->>Web: Success
    Web-->>User: Mostrar confirmación<br/>"Prepara el efectivo exacto"

    par Notificaciones
        Order->>Notif: Notify user
        Notif-->>User: Email con detalles del pedido
    and
        Order->>Notif: Notify store
        Notif-->>Notif: Email a tienda
    end

    Note over User: Tienda entrega el pedido

    Note over Order: Tienda confirma pago recibido

    Order->>Payment: Confirm cash payment
    Payment->>DB: UPDATE payment<br/>SET status="completed"
    Payment->>Order: Update order
    Order->>DB: UPDATE orders<br/>SET status="delivered"

    par Confirmación de entrega
        Order->>Notif: Send confirmation
        Notif-->>User: Email: "Pedido entregado"
    end
```

---

## 5. Secuencia de Búsqueda Geolocalizada con Productos

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Browser as Browser API
    participant Gateway as API Gateway
    participant Search as Search Service
    participant Maps as Google Maps API
    participant Elastic as Elasticsearch
    participant StoreDB as Store DB

    User->>Web: Ingresar búsqueda: "cerveza"
    Web->>Browser: getCurrentPosition()
    Browser-->>Web: {lat, lng}

    alt Permiso denegado
        Web->>User: Solicitar ubicación manual
        User->>Web: Ingresar dirección
        Web->>Maps: Geocode dirección
        Maps-->>Web: {lat, lng}
    end

    Web->>Gateway: GET /search/stores<br/>?q=cerveza&lat=-12.04&lng=-77.03&radius=5000
    Gateway->>Search: Forward request

    par Búsqueda en Elasticsearch
        Search->>Elastic: Search query<br/>match: "cerveza"<br/>geo_distance: 5km
        Elastic-->>Search: Product matches
    and Búsqueda en DB
        Search->>StoreDB: SELECT stores<br/>WHERE has products<br/>AND ST_DWithin(location, point, 5000)
        StoreDB-->>Search: Store list
    end

    Search->>Search: Join results<br/>Calculate distances<br/>Sort by relevance & distance

    Search->>Maps: Reverse geocode store locations
    Maps-->>Search: Store addresses

    Search-->>Gateway: Results:<br/>[{store, products, distance, isOpen}]
    Gateway-->>Web: 200 OK + results

    Web->>Web: Renderizar lista
    Web->>Maps: Renderizar mapa con markers
    Maps-->>Web: Mapa interactivo
    Web-->>User: Mostrar resultados
```

---

## 6. Secuencia de Aplicación de Cupón de Descuento

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Order as Order Service
    participant Coupon as Coupon Service
    participant DB as PostgreSQL
    participant Redis as Redis Cache

    User->>Web: En checkout, ingresar código cupón
    Web->>Gateway: POST /coupons/validate<br/>{code, userId, storeId, total}
    Gateway->>Coupon: Validate coupon

    Coupon->>Redis: GET coupon:{code}

    alt Cupón en cache
        Redis-->>Coupon: Coupon data
    else No en cache
        Coupon->>DB: SELECT * FROM coupons<br/>WHERE code=?
        DB-->>Coupon: Coupon data
        Coupon->>Redis: SET coupon:{code}<br/>TTL: 1h
    end

    alt Cupón no existe
        Coupon-->>Gateway: 404 Not Found
        Gateway-->>Web: Error: Cupón inválido
        Web-->>User: Mostrar error
    else Cupón existe
        Coupon->>Coupon: Validar condiciones:<br/>- Fechas válidas<br/>- Tienda aplicable<br/>- Monto mínimo<br/>- Usos disponibles<br/>- Usuario elegible

        alt Condiciones no cumplidas
            Coupon-->>Gateway: 400 Bad Request<br/>{reason}
            Gateway-->>Web: Error con motivo
            Web-->>User: Mostrar error específico
        else Condiciones cumplidas
            Coupon->>Coupon: Calcular descuento
            Coupon-->>Gateway: 200 OK<br/>{discount, newTotal}
            Gateway-->>Web: Cupón válido
            Web->>Web: Actualizar total mostrado
            Web-->>User: Mostrar descuento aplicado

            Note over User: Usuario confirma pedido

            User->>Web: Confirmar pedido con cupón
            Web->>Gateway: POST /orders<br/>{items, couponCode}
            Gateway->>Order: Create order

            Order->>Coupon: Apply coupon
            Coupon->>DB: BEGIN TRANSACTION
            Coupon->>DB: INSERT coupon_usage<br/>{couponId, userId, orderId}
            Coupon->>DB: UPDATE coupons<br/>SET uses = uses + 1
            Coupon->>DB: COMMIT

            Order->>DB: INSERT order<br/>{total_discount, coupon_id}
            Order-->>Gateway: 201 Created
            Gateway-->>Web: Success
            Web-->>User: Pedido creado con descuento
        end
    end
```

---

## 7. Secuencia de Actualización de Estado de Pedido

```mermaid
sequenceDiagram
    actor Store as Tienda
    participant StoreApp as Store Dashboard
    participant Gateway as API Gateway
    participant Order as Order Service
    participant DB as PostgreSQL
    participant Queue as Message Queue
    participant Notif as Notification Service
    participant Socket as Socket.io
    participant Web as User Web App
    actor User as Usuario

    Store->>StoreApp: Seleccionar pedido
    StoreApp->>Gateway: GET /orders/{orderId}
    Gateway->>Order: Get order details
    Order->>DB: SELECT order
    DB-->>Order: Order data
    Order-->>Gateway: Order details
    Gateway-->>StoreApp: 200 OK
    StoreApp-->>Store: Mostrar detalles

    Store->>StoreApp: Cambiar estado a "CONFIRMADO"
    StoreApp->>Gateway: PATCH /orders/{orderId}/status<br/>{status: "CONFIRMADO"}
    Gateway->>Order: Update order status

    Order->>DB: BEGIN TRANSACTION
    Order->>DB: UPDATE orders<br/>SET status_id = ?<br/>WHERE id = ?
    Order->>DB: INSERT order_status_history<br/>{orderId, oldStatus, newStatus, changedBy}
    Order->>DB: COMMIT

    Order->>Queue: Publish event<br/>{event: "order.status_changed", orderId, newStatus}

    par Procesamiento asíncrono
        Queue->>Notif: Send email notification
        Notif->>Notif: Generate email template
        Notif->>Notif: Send email to user
        Notif-->>User: Email recibido
    and
        Queue->>Notif: Send push notification
        Notif->>Notif: Create push message
        Notif->>Socket: Emit to user
        Socket-->>Web: EMIT order_updated<br/>{orderId, status}
        Web->>Web: Update UI
        Web-->>User: Mostrar notificación
    end

    Order-->>Gateway: 200 OK<br/>{order}
    Gateway-->>StoreApp: Success
    StoreApp-->>Store: Confirmar cambio
```

---

## 8. Secuencia de Cancelación de Pedido

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Order as Order Service
    participant Payment as Payment Service
    participant Product as Product Service
    participant DB as PostgreSQL
    participant Queue as Message Queue
    participant Notif as Notification Service

    User->>Web: Click "Cancelar pedido"
    Web-->>User: Confirmar cancelación

    User->>Web: Confirmar
    Web->>Gateway: POST /orders/{orderId}/cancel<br/>{reason}
    Gateway->>Order: Cancel order

    Order->>DB: SELECT order WHERE id=?
    DB-->>Order: Order data

    alt Pedido no cancelable
        Order-->>Gateway: 400 Bad Request<br/>"No se puede cancelar"
        Gateway-->>Web: Error
        Web-->>User: Mostrar error
    else Pedido cancelable
        Order->>DB: BEGIN TRANSACTION

        Order->>Product: Restore stock
        Product->>DB: UPDATE products<br/>SET stock = stock + quantity

        alt Pago con tarjeta
            Order->>Payment: Process refund
            Payment->>Payment: Initiate refund to card
        end

        Order->>DB: UPDATE orders<br/>SET status = "cancelled"
        Order->>DB: INSERT order_status_history
        Order->>DB: COMMIT

        Order->>Queue: Publish event<br/>{event: "order.cancelled", orderId}

        par Notificaciones
            Queue->>Notif: Notify user
            Notif-->>User: Email confirmando cancelación
        and
            Queue->>Notif: Notify store
            Notif-->>Notif: Email a tienda
        end

        Order-->>Gateway: 200 OK
        Gateway-->>Web: Success
        Web-->>User: "Pedido cancelado"
    end
```

---

**Fecha de creación:** 2025-11-24
**Versión:** 1.0
