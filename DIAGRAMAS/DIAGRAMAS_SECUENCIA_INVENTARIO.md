# Diagramas de Secuencia - Gestión de Inventario - Sistema Tiendi

Este documento contiene diagramas de secuencia para la gestión de inventario en tiempo real, incluyendo reservas, locks y prevención de sobreventa.

---

## 1. Agregar Producto al Carrito con Reserva de Stock

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Cart as Cart Service
    participant Product as Product Service
    participant DB as PostgreSQL
    participant Redis as Redis Cache

    User->>Web: Click "Agregar al carrito"<br/>Cantidad: 2

    Web->>Gateway: POST /cart/items<br/>{productId, quantity: 2}
    Gateway->>Cart: Add to cart

    Cart->>Product: Check stock availability
    Product->>DB: SELECT stock, reserved_stock<br/>FROM products<br/>WHERE id = ? FOR UPDATE
    Note over DB: Pessimistic lock<br/>Bloquea la fila

    DB-->>Product: stock: 10<br/>reserved_stock: 3<br/>available: 7

    alt Stock suficiente (available >= quantity)
        Product->>DB: UPDATE products<br/>SET reserved_stock = reserved_stock + 2<br/>WHERE id = ?
        DB-->>Product: Updated

        Product->>Redis: HSET cart:{userId}:reservations<br/>{productId}: {quantity: 2, expires_at: now+15min}
        Redis-->>Product: Reservation saved

        Product-->>Cart: Stock reserved
        Cart->>DB: INSERT INTO cart_items<br/>{user_id, product_id, quantity: 2}
        DB-->>Cart: Cart item created

        Cart-->>Gateway: 201 Created
        Gateway-->>Web: Item added
        Web-->>User: Producto agregado<br/>Notificación

        Note over Redis: Iniciar timer de 15 minutos<br/>para liberar reserva
    else Stock insuficiente
        Product-->>Cart: 409 Conflict<br/>"Stock insuficiente"
        Cart-->>Gateway: 409 Conflict
        Gateway-->>Web: Error
        Web-->>User: "Lo sentimos, solo quedan 7 unidades"
    end
```

---

## 2. Liberación Automática de Stock Reservado

```mermaid
sequenceDiagram
    participant Cron as Cron Job<br/>(Cada 1 min)
    participant Worker as Cleanup Worker
    participant Redis as Redis Cache
    participant DB as PostgreSQL
    participant Notif as Notification Service

    Cron->>Worker: Check expired reservations

    Worker->>Redis: SCAN cart:*:reservations

    loop Para cada reserva
        Redis-->>Worker: {userId, productId, quantity, expires_at}

        Worker->>Worker: Check if expired<br/>(expires_at < now)

        alt Reserva expirada
            Worker->>DB: BEGIN TRANSACTION

            Worker->>DB: UPDATE products<br/>SET reserved_stock = reserved_stock - quantity<br/>WHERE id = productId
            DB-->>Worker: Updated

            Worker->>DB: DELETE FROM cart_items<br/>WHERE user_id = userId<br/>AND product_id = productId
            DB-->>Worker: Deleted

            Worker->>DB: COMMIT

            Worker->>Redis: HDEL cart:{userId}:reservations productId
            Redis-->>Worker: Deleted

            Worker->>Notif: Send notification<br/>"Producto eliminado del carrito (tiempo expirado)"
            Notif-->>Worker: Sent

            Worker->>Worker: Log: Reservation released<br/>User: {userId}, Product: {productId}
        else Reserva aún válida
            Worker->>Worker: Skip (no expired yet)
        end
    end

    Worker-->>Cron: Cleanup completed
```

---

## 3. Proceso de Checkout con Confirmación de Stock

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Order as Order Service
    participant Product as Product Service
    participant Payment as Payment Service
    participant DB as PostgreSQL
    participant Redis as Redis Cache
    participant Queue as Message Queue

    User->>Web: Click "Enviar pedido"
    Web->>Gateway: POST /orders<br/>{cart_items, payment_method}
    Gateway->>Order: Create order

    Order->>DB: BEGIN TRANSACTION

    Order->>Product: Validate and confirm stock

    loop Para cada producto en el carrito
        Product->>DB: SELECT stock, reserved_stock<br/>FROM products<br/>WHERE id = ? FOR UPDATE
        DB-->>Product: stock: 10<br/>reserved_stock: 5

        alt Stock disponible >= cantidad
            Product->>DB: UPDATE products SET<br/>stock = stock - quantity,<br/>reserved_stock = reserved_stock - quantity<br/>WHERE id = ?
            DB-->>Product: Stock updated

            Product->>Redis: HDEL cart:{userId}:reservations productId
            Redis-->>Product: Reservation removed
        else Stock insuficiente
            Product-->>Order: 409 Conflict<br/>"Stock insuficiente para {product}"
            Order->>DB: ROLLBACK
            DB-->>Order: Transaction rolled back

            Order->>Product: Release all reserved stock
            Product->>DB: UPDATE products<br/>SET reserved_stock = reserved_stock - released_quantity
            DB-->>Product: Released

            Order-->>Gateway: 409 Conflict
            Gateway-->>Web: Error
            Web-->>User: "Stock insuficiente para algunos productos"
            Note over Web: Mostrar qué productos<br/>no tienen stock
        end
    end

    alt Todos los productos confirmados
        Order->>DB: INSERT INTO orders<br/>{user_id, store_id, status: 'PENDING', total}
        DB-->>Order: Order created: order_123

        Order->>DB: INSERT INTO order_items<br/>{order_id, product_id, quantity, price}
        DB-->>Order: Order items created

        Order->>DB: DELETE FROM cart_items<br/>WHERE user_id = ?
        DB-->>Order: Cart cleared

        Order->>DB: COMMIT
        DB-->>Order: Transaction committed

        Order->>Queue: Publish event<br/>"OrderCreated"
        Queue-->>Order: Event published

        Order-->>Gateway: 201 Created<br/>{order_id, order_number}
        Gateway-->>Web: Order created
        Web-->>User: Pedido confirmado<br/>Número: OBI-00123

        Queue->>Payment: Process payment
        Queue->>Product: Update product analytics
    end
```

---

## 4. Prevención de Sobreventa con Lock Optimista

```mermaid
sequenceDiagram
    actor User1 as Usuario 1
    actor User2 as Usuario 2
    participant Web1 as Web App 1
    participant Web2 as Web App 2
    participant Gateway as API Gateway
    participant Product as Product Service
    participant DB as PostgreSQL

    Note over DB: Producto con stock: 1<br/>version: 5

    par Ambos usuarios intentan comprar al mismo tiempo
        User1->>Web1: Agregar al carrito
        and
        User2->>Web2: Agregar al carrito
    end

    par Requests paralelos
        Web1->>Gateway: POST /cart/items<br/>{productId, quantity: 1}
        and
        Web2->>Gateway: POST /cart/items<br/>{productId, quantity: 1}
    end

    Gateway->>Product: Request 1: Add to cart
    Gateway->>Product: Request 2: Add to cart

    Product->>DB: SELECT stock, version<br/>FROM products<br/>WHERE id = ?
    DB-->>Product: stock: 1, version: 5

    Product->>DB: SELECT stock, version<br/>FROM products<br/>WHERE id = ?
    DB-->>Product: stock: 1, version: 5

    Note over Product: Ambas requests ven stock: 1

    Product->>DB: UPDATE products SET<br/>stock = 0,<br/>reserved_stock = 1,<br/>version = 6<br/>WHERE id = ? AND version = 5
    DB-->>Product: 1 row updated ✓

    Product->>DB: UPDATE products SET<br/>stock = 0,<br/>reserved_stock = 1,<br/>version = 6<br/>WHERE id = ? AND version = 5
    DB-->>Product: 0 rows updated ✗<br/>(version changed)

    Product-->>Gateway: Request 1: Success
    Gateway-->>Web1: 201 Created
    Web1-->>User1: Producto agregado ✓

    Product-->>Gateway: Request 2: 409 Conflict<br/>"Stock no disponible"
    Gateway-->>Web2: 409 Conflict
    Web2-->>User2: Lo sentimos, producto agotado ✗
```

---

## 5. Ajuste Manual de Inventario por Vendedor

```mermaid
sequenceDiagram
    actor Seller as Vendedor
    participant Web as Vendor Dashboard
    participant Gateway as API Gateway
    participant Inventory as Inventory Service
    participant Product as Product Service
    participant DB as PostgreSQL
    participant Audit as Audit Service
    participant Notif as Notification Service

    Seller->>Web: Ver inventario
    Web->>Gateway: GET /vendor/inventory
    Gateway->>Inventory: Get inventory

    Inventory->>DB: SELECT p.*, <br/>(p.stock - p.reserved_stock) as available<br/>FROM products p<br/>WHERE store_id = ?
    DB-->>Inventory: Product list with stock

    Inventory-->>Gateway: Inventory data
    Gateway-->>Web: Products
    Web-->>Seller: Mostrar lista de productos<br/>con stock actual

    Seller->>Web: Editar stock de producto<br/>Nuevo valor: 50

    Web->>Gateway: PUT /vendor/inventory/{productId}<br/>{adjustment: +20, reason: "Recepción"}
    Gateway->>Inventory: Adjust inventory

    Inventory->>Product: Validate product ownership
    Product->>DB: SELECT store_id<br/>FROM products<br/>WHERE id = ?
    DB-->>Product: store_id

    alt Vendedor es dueño del producto
        Product-->>Inventory: Authorized

        Inventory->>DB: BEGIN TRANSACTION

        Inventory->>DB: SELECT stock, reserved_stock<br/>FROM products<br/>WHERE id = ? FOR UPDATE
        DB-->>Inventory: stock: 30<br/>reserved_stock: 5

        alt Ajuste positivo (+20)
            Inventory->>DB: UPDATE products<br/>SET stock = stock + 20<br/>WHERE id = ?
            DB-->>Inventory: Stock: 30 → 50
        else Ajuste negativo (-10)
            Inventory->>Inventory: Validar: new_stock >= reserved_stock

            alt Válido (stock suficiente para reservas)
                Inventory->>DB: UPDATE products<br/>SET stock = stock - 10<br/>WHERE id = ?
                DB-->>Inventory: Stock: 30 → 20
            else Inválido
                Inventory-->>Gateway: 400 Bad Request<br/>"No puede reducir stock por debajo de reservas"
                Inventory->>DB: ROLLBACK
            end
        end

        Inventory->>DB: INSERT INTO inventory_adjustments<br/>{product_id, adjustment, reason,<br/>old_stock, new_stock, user_id}
        DB-->>Inventory: Log created

        Inventory->>DB: COMMIT

        Inventory->>Audit: Log adjustment
        Audit->>DB: INSERT INTO audit_logs
        DB-->>Audit: Audit logged

        alt Stock bajo (< 10)
            Inventory->>Notif: Send low stock alert
            Notif-->>Seller: Email: "Stock bajo en {product}"
        end

        Inventory-->>Gateway: 200 OK<br/>{new_stock: 50}
        Gateway-->>Web: Updated
        Web-->>Seller: Stock actualizado<br/>Nuevo valor: 50
    else Vendedor NO es dueño
        Product-->>Inventory: 403 Forbidden
        Inventory-->>Gateway: 403 Forbidden
        Gateway-->>Web: Error
        Web-->>Seller: "No tiene permisos"
    end
```

---

## 6. Cancelación de Pedido con Devolución de Stock

```mermaid
sequenceDiagram
    actor User as Usuario/Vendedor
    participant Web as Web App
    participant Gateway as API Gateway
    participant Order as Order Service
    participant Product as Product Service
    participant DB as PostgreSQL
    participant Notif as Notification Service
    participant Queue as Message Queue

    User->>Web: Cancelar pedido<br/>Order: OBI-00123

    Web->>Gateway: POST /orders/{orderId}/cancel<br/>{reason: "Cliente canceló"}
    Gateway->>Order: Cancel order

    Order->>DB: BEGIN TRANSACTION

    Order->>DB: SELECT status, user_id, store_id<br/>FROM orders<br/>WHERE id = ? FOR UPDATE
    DB-->>Order: status: 'CONFIRMADO'

    alt Estado permite cancelación
        Order->>DB: SELECT product_id, quantity<br/>FROM order_items<br/>WHERE order_id = ?
        DB-->>Order: [{product_1, qty: 2}, {product_2, qty: 1}]

        loop Para cada item del pedido
            Order->>Product: Return stock
            Product->>DB: UPDATE products<br/>SET stock = stock + quantity<br/>WHERE id = ?
            DB-->>Product: Stock devuelto
        end

        Order->>DB: UPDATE orders<br/>SET status_id = 'CANCELADO',<br/>canceled_at = NOW(),<br/>cancel_reason = ?<br/>WHERE id = ?
        DB-->>Order: Order cancelled

        Order->>DB: INSERT INTO order_history<br/>{order_id, old_status, new_status,<br/>changed_by, reason}
        DB-->>Order: History logged

        Order->>DB: COMMIT
        DB-->>Order: Transaction committed

        Order->>Queue: Publish event<br/>"OrderCancelled"
        Queue-->>Order: Event published

        Order->>Notif: Notify user and store
        par Notificaciones
            Notif->>User: "Tu pedido ha sido cancelado"
            and
            Notif->>User: "Vendedor: Pedido {orderNumber} cancelado"
        end

        Order-->>Gateway: 200 OK
        Gateway-->>Web: Order cancelled
        Web-->>User: Pedido cancelado<br/>Stock devuelto
    else Estado no permite cancelación
        Order-->>Gateway: 400 Bad Request<br/>"No se puede cancelar en estado ENTREGADO"
        Order->>DB: ROLLBACK
        Gateway-->>Web: Error
        Web-->>User: "No se puede cancelar este pedido"
    end
```

---

## 7. Sincronización de Stock en Tiempo Real (WebSocket)

```mermaid
sequenceDiagram
    participant Admin as Vendedor
    participant Client1 as Cliente 1
    participant Client2 as Cliente 2
    participant WS as WebSocket Server
    participant Product as Product Service
    participant DB as PostgreSQL
    participant Redis as Redis PubSub

    Note over Client1,Client2: Clientes viendo producto

    Client1->>WS: Subscribe to product:123
    WS->>Redis: SUBSCRIBE product:123:stock
    WS-->>Client1: Subscribed

    Client2->>WS: Subscribe to product:123
    WS-->>Client2: Subscribed

    Admin->>Product: Actualizar stock<br/>Product 123: +50
    Product->>DB: UPDATE products<br/>SET stock = stock + 50<br/>WHERE id = 123
    DB-->>Product: Updated: stock = 100

    Product->>Redis: PUBLISH product:123:stock<br/>{stock: 100, available: 95}
    Redis->>WS: Message received

    WS->>WS: Broadcast to subscribers

    par Actualización en tiempo real
        WS-->>Client1: {type: "stock_update",<br/>productId: 123,<br/>stock: 100,<br/>available: 95}
        and
        WS-->>Client2: {type: "stock_update",<br/>productId: 123,<br/>stock: 100,<br/>available: 95}
    end

    Client1->>Client1: Update UI<br/>"100 unidades disponibles"
    Client2->>Client2: Update UI<br/>"100 unidades disponibles"

    Note over Client1,Client2: Otro usuario compra 10 unidades

    Product->>DB: UPDATE products<br/>SET stock = stock - 10<br/>WHERE id = 123
    DB-->>Product: stock = 90

    Product->>Redis: PUBLISH product:123:stock<br/>{stock: 90, available: 85}
    Redis->>WS: Message

    par Actualización automática
        WS-->>Client1: {stock: 90, available: 85}
        WS-->>Client2: {stock: 90, available: 85}
    end

    Client1->>Client1: Update UI<br/>"90 unidades disponibles"
    Client2->>Client2: Update UI<br/>"90 unidades disponibles"
```

---

## 8. Alertas de Stock Bajo

```mermaid
sequenceDiagram
    participant Cron as Cron Job<br/>(Diario 9 AM)
    participant Worker as Alert Worker
    participant DB as PostgreSQL
    participant Inventory as Inventory Service
    participant Notif as Notification Service
    participant Email as Email Service
    participant SMS as SMS Service

    Cron->>Worker: Check low stock products

    Worker->>DB: SELECT p.*, s.name as store_name,<br/>s.email as store_email<br/>FROM products p<br/>JOIN stores s ON p.store_id = s.id<br/>WHERE p.stock <= p.min_stock_threshold<br/>AND p.is_active = true

    DB-->>Worker: Low stock products list

    loop Para cada producto con stock bajo
        Worker->>Worker: Check alert history<br/>(no alertar más de 1x por día)

        alt No alertado recientemente
            Worker->>Notif: Create alert

            Notif->>DB: INSERT INTO stock_alerts<br/>{product_id, current_stock,<br/>threshold, alerted_at}
            DB-->>Notif: Alert logged

            par Múltiples canales
                Notif->>Email: Send email alert
                Email-->>Notif: Email sent
                and
                Notif->>SMS: Send SMS (si crítico)
                SMS-->>Notif: SMS sent
                and
                Notif->>Notif: Push notification
            end

            Notif->>DB: UPDATE products<br/>SET last_stock_alert = NOW()<br/>WHERE id = ?
            DB-->>Notif: Updated
        end
    end

    Worker->>Inventory: Generate restock report
    Inventory->>DB: SELECT products with trends
    DB-->>Inventory: Sales data

    Inventory->>Inventory: Calculate suggested restock<br/>based on sales velocity

    Inventory-->>Worker: Restock recommendations

    Worker->>Email: Send summary report<br/>to store owners
    Email-->>Worker: Report sent

    Worker-->>Cron: Alert job completed
```

---

## 9. Importación Masiva de Inventario

```mermaid
sequenceDiagram
    actor Seller as Vendedor
    participant Web as Vendor Dashboard
    participant Gateway as API Gateway
    participant Import as Import Service
    participant Queue as Job Queue
    participant Worker as Background Worker
    participant Product as Product Service
    participant DB as PostgreSQL
    participant Storage as File Storage
    participant Notif as Notification Service

    Seller->>Web: Subir archivo CSV<br/>inventory_update.csv

    Web->>Gateway: POST /vendor/inventory/import<br/>multipart/form-data
    Gateway->>Import: Process import

    Import->>Storage: Upload file
    Storage-->>Import: File URL

    Import->>Import: Validate file format<br/>Headers: SKU, Stock, Price

    alt Formato válido
        Import->>Queue: Enqueue job<br/>{file_url, store_id, user_id}
        Queue-->>Import: Job queued: job_abc123

        Import-->>Gateway: 202 Accepted<br/>{job_id: "job_abc123"}
        Gateway-->>Web: Processing...
        Web-->>Seller: "Importación iniciada<br/>Te notificaremos cuando termine"

        Queue->>Worker: Process import job

        Worker->>Storage: Download file
        Storage-->>Worker: File content

        Worker->>Worker: Parse CSV<br/>200 productos

        Worker->>DB: BEGIN TRANSACTION

        loop Para cada fila del CSV
            Worker->>Product: Update or create product

            alt Producto existe (por SKU)
                Product->>DB: UPDATE products SET<br/>stock = ?, price = ?<br/>WHERE sku = ? AND store_id = ?
                DB-->>Product: Updated
            else Producto no existe
                Product->>DB: INSERT INTO products<br/>{sku, name, stock, price, store_id}
                DB-->>Product: Created
            end

            Worker->>Worker: Increment progress<br/>(150/200 processed)

            alt Error en fila
                Worker->>Worker: Log error<br/>Continue with next row
            end
        end

        Worker->>DB: COMMIT

        Worker->>DB: INSERT INTO import_logs<br/>{job_id, store_id, total: 200,<br/>success: 198, failed: 2}
        DB-->>Worker: Log saved

        Worker->>Notif: Send completion notification
        Notif-->>Seller: "Importación completada<br/>198 productos actualizados<br/>2 errores"

        Worker-->>Queue: Job completed
    else Formato inválido
        Import-->>Gateway: 400 Bad Request<br/>"Formato de archivo inválido"
        Gateway-->>Web: Error
        Web-->>Seller: "Error: formato incorrecto"
    end
```

---

## Tablas de Base de Datos para Inventario

### Tabla: products (ampliada)

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id),
  sku VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,

  -- Gestión de stock
  stock INTEGER NOT NULL DEFAULT 0,
  reserved_stock INTEGER NOT NULL DEFAULT 0,
  min_stock_threshold INTEGER DEFAULT 10,
  max_stock_capacity INTEGER,

  -- Control de versión para lock optimista
  version INTEGER NOT NULL DEFAULT 1,

  -- Alertas
  last_stock_alert TIMESTAMP,

  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT check_stock_positive CHECK (stock >= 0),
  CONSTRAINT check_reserved_valid CHECK (reserved_stock >= 0 AND reserved_stock <= stock)
);

-- Índice para queries frecuentes
CREATE INDEX idx_products_stock ON products(store_id, stock, reserved_stock);

-- Índice para alertas de stock bajo
CREATE INDEX idx_products_low_stock ON products(store_id)
WHERE stock <= min_stock_threshold AND is_active = true;
```

### Tabla: inventory_adjustments

```sql
CREATE TABLE inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  adjustment_type VARCHAR(50) NOT NULL, -- 'manual', 'order', 'return', 'correction'
  quantity_change INTEGER NOT NULL, -- Puede ser negativo
  old_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  reason TEXT,
  adjusted_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inventory_adjustments_product ON inventory_adjustments(product_id, created_at DESC);
```

### Tabla: stock_reservations

```sql
CREATE TABLE stock_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'confirmed', 'expired', 'released'
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT check_quantity_positive CHECK (quantity > 0)
);

CREATE INDEX idx_stock_reservations_expires ON stock_reservations(expires_at)
WHERE status = 'active';

CREATE INDEX idx_stock_reservations_user_product ON stock_reservations(user_id, product_id);
```

### Tabla: stock_alerts

```sql
CREATE TABLE stock_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id),
  alert_type VARCHAR(50) NOT NULL, -- 'low_stock', 'out_of_stock', 'overstocked'
  current_stock INTEGER NOT NULL,
  threshold_value INTEGER,
  alerted_at TIMESTAMP DEFAULT NOW(),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP,
  acknowledged_by UUID REFERENCES users(id)
);

CREATE INDEX idx_stock_alerts_product ON stock_alerts(product_id, alerted_at DESC);
```

---

## Triggers para Gestión Automática

### Trigger: Validar Stock en Actualización

```sql
CREATE OR REPLACE FUNCTION validate_stock_update()
RETURNS TRIGGER AS $$
BEGIN
  -- No permitir stock negativo
  IF NEW.stock < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative';
  END IF;

  -- Validar que reserved_stock no exceda stock
  IF NEW.reserved_stock > NEW.stock THEN
    RAISE EXCEPTION 'Reserved stock cannot exceed total stock';
  END IF;

  -- Incrementar versión para lock optimista
  NEW.version = OLD.version + 1;

  -- Actualizar timestamp
  NEW.updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_stock
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION validate_stock_update();
```

### Trigger: Log de Ajustes de Inventario

```sql
CREATE OR REPLACE FUNCTION log_inventory_adjustment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock <> OLD.stock THEN
    INSERT INTO inventory_adjustments (
      product_id,
      adjustment_type,
      quantity_change,
      old_stock,
      new_stock,
      reason
    ) VALUES (
      NEW.id,
      'automatic',
      NEW.stock - OLD.stock,
      OLD.stock,
      NEW.stock,
      'System adjustment'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_inventory
AFTER UPDATE ON products
FOR EACH ROW
WHEN (NEW.stock IS DISTINCT FROM OLD.stock)
EXECUTE FUNCTION log_inventory_adjustment();
```

---

## Consideraciones de Performance

### Estrategias de Optimización

1. **Lock Granularidad**: Usar `SELECT FOR UPDATE SKIP LOCKED` para evitar bloqueos en productos de alta demanda
2. **Caché de Stock**: Cachear información de stock disponible con TTL corto (30 segundos)
3. **Batch Updates**: Procesar ajustes de inventario en batch cuando sea posible
4. **Índices Apropiados**: Índices en (store_id, stock, reserved_stock) para queries frecuentes
5. **Particionamiento**: Particionar tabla de inventory_adjustments por fecha

### Queries Optimizados

```sql
-- Query optimizado para check de stock
PREPARE check_stock (UUID, INTEGER) AS
SELECT
  (stock - reserved_stock) as available,
  stock,
  reserved_stock
FROM products
WHERE id = $1 AND (stock - reserved_stock) >= $2
FOR UPDATE SKIP LOCKED;

-- Query para productos con stock bajo
PREPARE low_stock_products (UUID) AS
SELECT id, name, stock, min_stock_threshold
FROM products
WHERE store_id = $1
  AND stock <= min_stock_threshold
  AND is_active = true
ORDER BY (stock::float / NULLIF(min_stock_threshold, 0)) ASC;
```

---

**Fecha de creación:** 2025-11-24
**Versión:** 1.0
**Autor:** Sistema Tiendi
