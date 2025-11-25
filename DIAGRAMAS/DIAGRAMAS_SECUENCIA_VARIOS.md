# Diagramas de Secuencia - Operaciones Varias - Sistema Tiendi

Este documento contiene diagramas de secuencia para operaciones adicionales del sistema.

---

## 1. Secuencia de Gestión de Favoritos

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Product as Product Service
    participant DB as PostgreSQL
    participant Redis as Redis Cache

    User->>Web: Click en ícono de favorito

    Web->>Web: Check si usuario autenticado

    alt Usuario no autenticado
        Web-->>User: Mostrar mensaje<br/>"Debe iniciar sesión"
        User->>Web: Ir a login
    else Usuario autenticado
        Web->>Gateway: POST /favorites<br/>{productId}
        Gateway->>Product: Toggle favorite

        Product->>DB: SELECT * FROM favorites<br/>WHERE user_id=? AND product_id=?
        DB-->>Product: Check existence

        alt Ya es favorito
            Product->>DB: DELETE FROM favorites<br/>WHERE user_id=? AND product_id=?
            DB-->>Product: Deleted
            Product->>Redis: SREM favorites:{userId} {productId}
            Product-->>Gateway: 200 OK<br/>{action: "removed"}
            Gateway-->>Web: Removed from favorites
            Web->>Web: Icono corazón vacío
            Web->>Web: Decrementar contador
            Web-->>User: Actualizar UI
        else No es favorito
            Product->>DB: INSERT INTO favorites<br/>{user_id, product_id}
            DB-->>Product: Created
            Product->>Redis: SADD favorites:{userId} {productId}
            Product-->>Gateway: 201 Created<br/>{action: "added"}
            Gateway-->>Web: Added to favorites
            Web->>Web: Icono corazón lleno
            Web->>Web: Incrementar contador
            Web-->>User: Actualizar UI
        end
    end

    User->>Web: Ir a página de favoritos
    Web->>Gateway: GET /favorites
    Gateway->>Product: Get user favorites

    Product->>Redis: GET favorites:{userId}

    alt Cache hit
        Redis-->>Product: Product IDs
        Product->>DB: SELECT products<br/>WHERE id IN (?)
        DB-->>Product: Product list
    else Cache miss
        Product->>DB: SELECT * FROM favorites<br/>JOIN products<br/>WHERE user_id=?
        DB-->>Product: Favorites with products
        Product->>Redis: SADD favorites:{userId}
    end

    Product-->>Gateway: 200 OK<br/>{favorites: [...]}
    Gateway-->>Web: Favorites list
    Web-->>User: Mostrar productos favoritos
```

---

## 2. Secuencia de Suscripción a Newsletter

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Newsletter as Newsletter Service
    participant DB as PostgreSQL
    participant Email as Email Service
    participant Marketing as Marketing Platform<br/>(Mailchimp/SendGrid)

    User->>Web: Click en "Suscríbete"
    Web-->>User: Mostrar campo de email

    User->>Web: Ingresar email
    Web->>Web: Validar formato de email

    alt Email inválido
        Web-->>User: Mostrar error de validación
    else Email válido
        Web->>Gateway: POST /newsletter/subscribe<br/>{email}
        Gateway->>Newsletter: Subscribe email

        Newsletter->>DB: SELECT * FROM newsletter<br/>WHERE email=?
        DB-->>Newsletter: Check if exists

        alt Ya suscrito
            Newsletter-->>Gateway: 200 OK<br/>{message: "Ya estás suscrito"}
            Gateway-->>Web: Already subscribed
            Web-->>User: "Ya estás suscrito"
        else Nuevo suscriptor
            Newsletter->>DB: INSERT INTO newsletter<br/>{email, subscribed_at}
            DB-->>Newsletter: Inserted

            par Integraciones
                Newsletter->>Marketing: Add to mailing list<br/>{email, source: "web"}
                Marketing-->>Newsletter: Contact added
            and
                Newsletter->>Email: Send welcome email
                Email-->>User: Email de bienvenida
            end

            Newsletter-->>Gateway: 201 Created
            Gateway-->>Web: Subscribed successfully
            Web-->>User: "✓ Gracias por suscribirte"
        end
    end
```

---

## 3. Secuencia de Registro de Lead de Vendedor

```mermaid
sequenceDiagram
    actor Seller as Vendedor
    participant Web as Web App
    participant Gateway as API Gateway
    participant Leads as Leads Service
    participant DB as PostgreSQL
    participant Email as Email Service
    participant CRM as CRM System
    participant Notif as Notification Service

    Seller->>Web: Click "¿Quieres vender?"
    Web-->>Seller: Mostrar modal de formulario

    Seller->>Web: Rellenar formulario:<br/>- Nombre<br/>- Email<br/>- Teléfono

    Web->>Web: Validar campos

    alt Campos inválidos
        Web-->>Seller: Mostrar errores
    else Campos válidos
        Web->>Gateway: POST /seller-leads<br/>{name, email, phone}
        Gateway->>Leads: Create seller lead

        Leads->>DB: INSERT INTO seller_leads<br/>{name, email, phone, status: "new"}
        DB-->>Leads: Lead created

        par Procesamiento asíncrono
            Leads->>Email: Send confirmation to seller
            Email-->>Seller: "Gracias por tu interés"
        and
            Leads->>CRM: Create lead in CRM
            CRM-->>CRM: Add to sales pipeline
        and
            Leads->>Notif: Notify sales team
            Notif-->>Notif: Email/Slack a equipo de ventas
        end

        Leads-->>Gateway: 201 Created
        Gateway-->>Web: Lead created
        Web-->>Seller: "Información enviada"<br/>"Te contactaremos pronto"
    end
```

---

## 4. Secuencia de Búsqueda con Autocompletado

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Search as Search Service
    participant Elastic as Elasticsearch
    participant Redis as Redis Cache

    User->>Web: Escribir en buscador: "cerv"
    Web->>Web: Debounce 300ms

    Web->>Gateway: GET /search/autocomplete?q=cerv
    Gateway->>Search: Get suggestions

    Search->>Redis: GET autocomplete:cerv

    alt Cache hit
        Redis-->>Search: Suggestions cached
    else Cache miss
        Search->>Elastic: Search query<br/>match_phrase_prefix: "cerv"<br/>fields: [name, category, brand]
        Elastic-->>Search: Matching results

        Search->>Search: Group and rank:<br/>- Products<br/>- Categories<br/>- Brands<br/>- Stores

        Search->>Redis: SETEX autocomplete:cerv<br/>TTL: 1 hour
    end

    Search-->>Gateway: Suggestions:<br/>[{type, name, image, matches}]
    Gateway-->>Web: 200 OK + suggestions
    Web-->>User: Mostrar dropdown con sugerencias

    User->>Web: Click en sugerencia "cerveza corona"
    Web->>Web: Ejecutar búsqueda completa
    Web->>Gateway: GET /search?q=cerveza corona
```

---

## 5. Secuencia de Valoración de Producto

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Review as Review Service
    participant Order as Order Service
    participant Product as Product Service
    participant DB as PostgreSQL
    participant Notif as Notification Service

    User->>Web: Ver producto comprado
    Web->>Gateway: GET /orders/{orderId}/products
    Gateway->>Order: Get order products
    Order->>DB: SELECT order with products
    DB-->>Order: Order data
    Order-->>Web: Products + reviewable status

    Web-->>User: Mostrar "Calificar producto"

    User->>Web: Click "Calificar"
    Web-->>User: Modal de valoración

    User->>Web: Ingresar:<br/>- Rating (1-5 estrellas)<br/>- Comentario<br/>- Foto (opcional)

    Web->>Gateway: POST /reviews<br/>{productId, orderId, rating, comment, photos}
    Gateway->>Review: Create review

    Review->>DB: SELECT * FROM reviews<br/>WHERE user_id=? AND product_id=? AND order_id=?
    DB-->>Review: Check if already reviewed

    alt Ya valorado
        Review-->>Gateway: 400 Bad Request
        Gateway-->>Web: Error: Ya valoraste este producto
        Web-->>User: Mostrar error
    else Primera valoración
        Review->>Order: Verify product purchased
        Order->>DB: SELECT order_items<br/>WHERE order_id=? AND product_id=?
        DB-->>Order: Verification

        alt No compró el producto
            Order-->>Review: 403 Forbidden
            Review-->>Gateway: Error
            Gateway-->>Web: No puedes valorar
            Web-->>User: Mostrar error
        else Producto comprado
            Review->>DB: INSERT INTO reviews<br/>{userId, productId, rating, comment}
            DB-->>Review: Review created

            Review->>Product: Update product rating
            Product->>DB: UPDATE products<br/>SET avg_rating = AVG(rating)<br/>reviews_count = COUNT(*)
            DB-->>Product: Updated

            par Notificaciones
                Review->>Notif: Notify store
                Notif-->>Notif: Email a tienda sobre nueva review
            end

            Review-->>Gateway: 201 Created
            Gateway-->>Web: Review created
            Web-->>User: "Gracias por tu valoración"
        end
    end
```

---

## 6. Secuencia de Aplicación de Filtros

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Search as Search Service
    participant Elastic as Elasticsearch
    participant Redis as Redis Cache

    User->>Web: Navegar a catálogo
    Web->>Gateway: GET /products
    Gateway->>Search: Get products
    Search->>Elastic: Search all products
    Elastic-->>Search: Products
    Search-->>Web: Product list
    Web-->>User: Mostrar productos

    User->>Web: Abrir panel de filtros
    Web-->>User: Mostrar opciones de filtros

    User->>Web: Seleccionar filtros:<br/>- Categoría: Bebidas<br/>- Precio: S/10-50<br/>- Descuento: > 20%<br/>- Marca: Corona

    Web->>Web: Construir query params
    Web->>Gateway: GET /products?<br/>category=bebidas&<br/>priceMin=10&priceMax=50&<br/>discount>20&brand=corona

    Gateway->>Search: Apply filters
    Search->>Redis: GET filters:{hash}

    alt Cache hit
        Redis-->>Search: Filtered results
    else Cache miss
        Search->>Elastic: Complex query:<br/>bool: {<br/>  must: [category match],<br/>  filter: [price range, brand],<br/>  should: [discount boost]<br/>}
        Elastic-->>Search: Filtered products

        Search->>Search: Apply business logic:<br/>- Boost products in stock<br/>- Boost nearby stores

        Search->>Redis: SETEX filters:{hash}<br/>TTL: 10 minutes
    end

    Search-->>Gateway: Filtered products + facets
    Gateway-->>Web: 200 OK + results

    Web->>Web: Update UI:<br/>- Product grid<br/>- Active filters tags<br/>- Results count<br/>- Available facets

    Web-->>User: Mostrar resultados filtrados

    User->>Web: Cambiar ordenamiento: "Menor precio"
    Web->>Web: Re-order results client-side
    Web-->>User: Productos reordenados
```

---

## 7. Secuencia de Repetir Pedido

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Order as Order Service
    participant Product as Product Service
    participant Cart as Cart Service
    participant DB as PostgreSQL

    User->>Web: Ver historial de pedidos
    Web->>Gateway: GET /orders
    Gateway->>Order: Get user orders
    Order->>DB: SELECT orders WHERE user_id=?
    DB-->>Order: Orders list
    Order-->>Web: Orders
    Web-->>User: Mostrar pedidos

    User->>Web: Click "Repetir pedido"
    Web->>Gateway: POST /orders/{orderId}/repeat
    Gateway->>Order: Repeat order

    Order->>DB: SELECT order_items<br/>WHERE order_id=?
    DB-->>Order: Order items

    loop Para cada item del pedido
        Order->>Product: Check product availability
        Product->>DB: SELECT product<br/>WHERE id=? AND is_active=true
        DB-->>Product: Product data

        alt Producto no disponible
            Product-->>Order: Product unavailable
            Order->>Order: Mark item as unavailable
        else Producto disponible
            Product->>DB: Check stock
            DB-->>Product: Stock quantity

            alt Stock insuficiente
                Order->>Order: Adjust quantity to available stock
            else Stock suficiente
                Order->>Order: Keep original quantity
            end
        end
    end

    Order->>Cart: Add items to cart
    Cart->>DB: INSERT cart_items

    alt Algunos productos no disponibles
        Cart-->>Gateway: 206 Partial Content<br/>{addedItems, unavailableItems}
        Gateway-->>Web: Partial success
        Web-->>User: Mostrar:<br/>"X productos agregados"<br/>"Y productos no disponibles"
    else Todos disponibles
        Cart-->>Gateway: 200 OK<br/>{addedItems}
        Gateway-->>Web: Success
        Web-->>User: "Productos agregados al carrito"
    end

    Web->>Web: Actualizar contador de carrito
    Web-->>User: Opción: "Ir al carrito"
```

---

## 8. Secuencia de Notificaciones Push

```mermaid
sequenceDiagram
    participant Order as Order Service
    participant Queue as Message Queue
    participant Notif as Notification Service
    participant FCM as Firebase FCM
    participant DB as PostgreSQL
    actor User as Usuario

    Note over Order: Evento: Estado de pedido cambia

    Order->>Queue: Publish event<br/>{event: "order.status_changed", orderId, newStatus}
    Queue->>Notif: Process notification

    Notif->>DB: SELECT user preferences<br/>WHERE user_id=?
    DB-->>Notif: {pushEnabled: true, ...}

    alt Push notifications deshabilitadas
        Notif->>Notif: Skip push notification
    else Push notifications habilitadas
        Notif->>DB: SELECT device_tokens<br/>WHERE user_id=?
        DB-->>Notif: Device tokens

        Notif->>Notif: Build notification:<br/>title: "Estado de pedido actualizado"<br/>body: "Tu pedido #OBI-123 está confirmado"<br/>data: {orderId, status}

        loop Para cada device token
            Notif->>FCM: Send push notification<br/>{token, notification, data}
            FCM-->>Notif: Response

            alt Token inválido/expirado
                FCM-->>Notif: Error: Invalid token
                Notif->>DB: DELETE device_token
            else Enviado exitosamente
                FCM-->>Notif: Success
                Notif->>DB: UPDATE notification_log<br/>{sent: true, sentAt}
            end
        end

        FCM-->>User: Mostrar notificación push
        User->>User: Click en notificación
        User->>User: Abrir app en pedido específico
    end
```

---

## 9. Secuencia de Actualización de Perfil

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant UserService as User Service
    participant DB as PostgreSQL
    participant Redis as Redis Cache
    participant Email as Email Service

    User->>Web: Ir a "Mi perfil"
    Web->>Gateway: GET /users/me
    Gateway->>UserService: Get user profile
    UserService->>DB: SELECT * FROM users WHERE id=?
    DB-->>UserService: User data
    UserService-->>Web: User profile
    Web-->>User: Mostrar formulario con datos

    User->>Web: Editar información:<br/>- Nombres<br/>- Teléfono<br/>- etc.

    Web->>Gateway: PATCH /users/me<br/>{updatedFields}
    Gateway->>UserService: Update profile

    alt Cambio de email
        UserService->>DB: SELECT WHERE email=?<br/>AND id != current_user
        DB-->>UserService: Check email exists

        alt Email ya en uso
            UserService-->>Gateway: 409 Conflict
            Gateway-->>Web: Error: Email ya registrado
            Web-->>User: Mostrar error
        else Email disponible
            UserService->>UserService: Mark email as unverified
            UserService->>Email: Send verification email
            Email-->>User: Email de verificación
        end
    end

    UserService->>DB: UPDATE users SET ... WHERE id=?
    DB-->>UserService: Updated

    UserService->>Redis: DEL user:{userId}
    UserService->>Redis: SET user:{userId}<br/>{updated user data}

    UserService-->>Gateway: 200 OK<br/>{updatedUser}
    Gateway-->>Web: Success
    Web->>Web: Update local state
    Web-->>User: "Perfil actualizado"
```

---

## 10. Secuencia de Eliminación de Cuenta

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant UserService as User Service
    participant Order as Order Service
    participant DB as PostgreSQL
    participant Redis as Redis Cache
    participant Email as Email Service

    User->>Web: Ir a configuración
    User->>Web: Click "Eliminar cuenta"
    Web-->>User: Modal de confirmación

    User->>Web: Confirmar eliminación
    Web->>Gateway: DELETE /users/me
    Gateway->>UserService: Delete account

    UserService->>Order: Check active orders
    Order->>DB: SELECT * FROM orders<br/>WHERE user_id=?<br/>AND status NOT IN ('delivered', 'cancelled')
    DB-->>Order: Active orders

    alt Tiene pedidos activos
        Order-->>UserService: Active orders exist
        UserService-->>Gateway: 400 Bad Request
        Gateway-->>Web: Error: Completa tus pedidos primero
        Web-->>User: Mostrar error con lista de pedidos
    else Sin pedidos activos
        UserService->>DB: BEGIN TRANSACTION

        UserService->>DB: UPDATE users<br/>SET deleted_at = NOW(),<br/>email = email || '_deleted',<br/>is_active = false

        UserService->>DB: DELETE FROM cart_items<br/>WHERE user_id=?
        UserService->>DB: DELETE FROM favorites<br/>WHERE user_id=?
        UserService->>DB: DELETE FROM device_tokens<br/>WHERE user_id=?

        UserService->>DB: COMMIT

        UserService->>Redis: DEL user:{userId}
        UserService->>Redis: DEL session:{userId}
        UserService->>Redis: DEL cart:{userId}
        UserService->>Redis: DEL favorites:{userId}

        UserService->>Email: Send goodbye email
        Email-->>User: Email de despedida

        UserService-->>Gateway: 200 OK
        Gateway-->>Web: Account deleted
        Web->>Web: Clear all local storage
        Web->>Web: Clear Redux store
        Web-->>User: Redirigir a home<br/>"Cuenta eliminada"
    end
```

---

**Fecha de creación:** 2025-11-24
**Versión:** 1.0
