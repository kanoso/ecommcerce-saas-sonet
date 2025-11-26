# Diagramas de Secuencia - Sistema de Valoraciones y Reseñas - Sistema Tiendi

Este documento describe el sistema de valoraciones de productos y reputación de tiendas.

---

## 1. Crear Valoración de Producto

```mermaid
sequenceDiagram
    actor Customer as Cliente
    participant Web as Web App
    participant Gateway as API Gateway
    participant Review as Review Service
    participant Order as Order Service
    participant DB as PostgreSQL
    participant Moderation as Moderation Service
    participant Notif as Notification Service

    Customer->>Web: Ver producto comprado<br/>Click "Valorar"

    Web->>Gateway: GET /orders/verify-purchase<br/>{product_id}
    Gateway->>Order: Check purchase

    Order->>DB: SELECT * FROM order_items oi<br/>JOIN orders o ON oi.order_id = o.id<br/>WHERE o.user_id = ?<br/>AND oi.product_id = ?<br/>AND o.status = 'ENTREGADO'
    DB-->>Order: Purchase verified

    alt Usuario compró el producto
        Order-->>Gateway: Purchase: YES
        Gateway-->>Web: Can review

        Web-->>Customer: Formulario de valoración

        Customer->>Web: Completar:<br/>- Rating: 4/5 ⭐<br/>- Título<br/>- Comentario<br/>- Fotos (opcional)

        Web->>Gateway: POST /reviews<br/>{product_id, rating: 4,<br/>title, comment, images}

        Gateway->>Review: Create review

        Review->>DB: CHECK si ya valoró
        DB-->>Review: Existing review

        alt Ya valoró este producto
            Review-->>Gateway: 409 Conflict<br/>"Ya valoraste este producto"
            Gateway-->>Web: Error
            Web-->>Customer: Mensaje: Ya valoraste
        else Primera valoración
            Review->>DB: BEGIN TRANSACTION

            Review->>DB: INSERT INTO reviews<br/>{user_id, product_id,<br/>rating, title, comment,<br/>status: 'pending'}
            DB-->>Review: Review created: rev_123

            loop Para cada imagen
                Review->>DB: INSERT INTO review_images<br/>{review_id, image_url}
            end

            Review->>Moderation: Queue for moderation
            Moderation->>Moderation: Auto-moderate:<br/>- Detectar lenguaje ofensivo<br/>- Verificar spam

            alt Auto-aprobado
                Moderation->>DB: UPDATE reviews<br/>SET status = 'approved'
            else Requiere revisión manual
                Moderation->>DB: SET status = 'pending'
                Moderation->>Notif: Notify moderator
            end

            Review->>DB: UPDATE products<br/>SET rating_count = rating_count + 1,<br/>rating_sum = rating_sum + 4,<br/>avg_rating = rating_sum / rating_count

            Review->>DB: COMMIT

            Review-->>Gateway: 201 Created
            Gateway-->>Web: Review created
            Web-->>Customer: Gracias por tu valoración

            Review->>Notif: Notify store owner
            Notif-->>Review: Notification sent
        end
    else Usuario NO compró
        Order-->>Gateway: Purchase: NO
        Gateway-->>Web: Cannot review
        Web-->>Customer: Debes comprar el producto<br/>para poder valorarlo
    end
```

---

## 2. Moderación de Reseñas

```mermaid
sequenceDiagram
    actor Moderator as Moderador (Super Admin)
    participant Admin as Admin Panel
    participant Gateway as API Gateway
    participant Moderation as Moderation Service
    participant DB as PostgreSQL
    participant Notif as Notification Service

    Moderator->>Admin: Ver cola de moderación

    Admin->>Gateway: GET /admin/reviews/pending

    Gateway->>Moderation: Get pending reviews

    Moderation->>DB: SELECT r.*, u.name as user_name,<br/>p.name as product_name,<br/>s.name as store_name<br/>FROM reviews r<br/>WHERE status = 'pending'<br/>ORDER BY created_at ASC

    DB-->>Moderation: Pending reviews list

    Moderation-->>Gateway: Reviews

    Gateway-->>Admin: Review list

    Admin-->>Moderator: Mostrar reseñas pendientes

    Moderator->>Admin: Revisar reseña específica

    Admin->>Admin: Mostrar:<br/>- Rating<br/>- Comentario<br/>- Imágenes<br/>- Producto<br/>- Usuario

    Moderator->>Admin: Decisión

    alt Aprobar
        Admin->>Gateway: POST /admin/reviews/{id}/approve

        Gateway->>Moderation: Approve review

        Moderation->>DB: UPDATE reviews<br/>SET status = 'approved',<br/>approved_at = NOW(),<br/>approved_by = ?

        Moderation->>Notif: Notify user
        Notif-->>Moderation: Notification sent

        Moderation-->>Gateway: 200 OK
        Gateway-->>Admin: Approved
        Admin-->>Moderator: Reseña aprobada
    else Rechazar
        Admin->>Gateway: POST /admin/reviews/{id}/reject<br/>{reason}

        Gateway->>Moderation: Reject review

        Moderation->>DB: UPDATE reviews<br/>SET status = 'rejected',<br/>rejection_reason = ?,<br/>rejected_at = NOW()

        Moderation->>Notif: Notify user with reason
        Notif-->>Moderation: Notification sent

        Moderation-->>Gateway: 200 OK
        Gateway-->>Admin: Rejected
        Admin-->>Moderator: Reseña rechazada
    else Marcar como spam
        Admin->>Gateway: POST /admin/reviews/{id}/spam

        Gateway->>Moderation: Mark as spam

        Moderation->>DB: UPDATE reviews<br/>SET status = 'spam'

        Moderation->>DB: INSERT INTO spam_reports<br/>{review_id, reported_by}

        Moderation-->>Gateway: 200 OK
        Gateway-->>Admin: Marked as spam
        Admin-->>Moderator: Marcado como spam
    end
```

---

## 3. Respuesta del Vendedor a Reseña

```mermaid
sequenceDiagram
    actor Vendor as Vendedor
    participant Web as Vendor Dashboard
    participant Gateway as API Gateway
    participant Review as Review Service
    participant DB as PostgreSQL
    participant Notif as Notification Service

    Vendor->>Web: Ver reseñas de productos

    Web->>Gateway: GET /vendor/reviews

    Gateway->>Review: Get store reviews

    Review->>DB: SELECT r.*, p.name as product_name<br/>FROM reviews r<br/>JOIN products p ON r.product_id = p.id<br/>WHERE p.store_id = ?<br/>AND r.status = 'approved'<br/>ORDER BY r.created_at DESC

    DB-->>Review: Reviews

    Review-->>Gateway: Reviews list

    Gateway-->>Web: Reviews

    Web-->>Vendor: Mostrar reseñas con:<br/>- Rating<br/>- Comentario<br/>- Producto<br/>- Fecha<br/>- Respuesta (si existe)

    Vendor->>Web: Click "Responder" en reseña

    Web-->>Vendor: Campo de texto

    Vendor->>Web: Escribir respuesta

    Web->>Gateway: POST /vendor/reviews/{id}/respond<br/>{response}

    Gateway->>Review: Create response

    Review->>DB: SELECT store_id<br/>FROM products p<br/>JOIN reviews r ON r.product_id = p.id<br/>WHERE r.id = ?

    DB-->>Review: store_id

    alt Vendedor es dueño del producto
        Review->>DB: UPDATE reviews<br/>SET vendor_response = ?,<br/>responded_at = NOW()<br/>WHERE id = ?

        DB-->>Review: Updated

        Review->>Notif: Notify customer<br/>"El vendedor respondió tu reseña"

        Notif-->>Review: Notification sent

        Review-->>Gateway: 200 OK

        Gateway-->>Web: Response saved

        Web-->>Vendor: Respuesta publicada
    else Vendedor NO es dueño
        Review-->>Gateway: 403 Forbidden

        Gateway-->>Web: Error

        Web-->>Vendor: No autorizado
    end
```

---

## 4. Cálculo de Reputación de Tienda

```mermaid
sequenceDiagram
    participant Cron as Cron Job<br/>(Diario)
    participant Reputation as Reputation Service
    participant DB as PostgreSQL

    Cron->>Reputation: Calculate store reputations

    Reputation->>DB: SELECT stores

    DB-->>Reputation: Store list

    loop Para cada tienda
        Reputation->>DB: Calculate metrics

        par Métricas paralelas
            Reputation->>DB: AVG rating de productos
            and
            Reputation->>DB: % pedidos entregados a tiempo
            and
            Reputation->>DB: Tiempo promedio de respuesta
            and
            Reputation->>DB: % pedidos confirmados
            and
            Reputation->>DB: Número de reseñas totales
        end

        DB-->>Reputation: Metrics data

        Reputation->>Reputation: Calculate score:<br/><br/>Score = (<br/>  avg_rating × 0.40 +<br/>  on_time_delivery × 0.25 +<br/>  response_time × 0.15 +<br/>  confirmation_rate × 0.15 +<br/>  review_count_factor × 0.05<br/>) / 5 × 100

        Reputation->>Reputation: Determine badge:<br/>- ⭐ Nuevo: score < 50<br/>- ⭐⭐ Bueno: 50-70<br/>- ⭐⭐⭐ Muy Bueno: 70-85<br/>- ⭐⭐⭐⭐ Excelente: 85-95<br/>- ⭐⭐⭐⭐⭐ Top Seller: 95-100

        Reputation->>DB: UPDATE stores<br/>SET reputation_score = ?,<br/>reputation_badge = ?,<br/>last_reputation_update = NOW()

        DB-->>Reputation: Updated
    end

    Reputation-->>Cron: Reputation calculation completed
```

---

## Tablas de Base de Datos

```sql
-- Tabla de reseñas
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  product_id UUID NOT NULL REFERENCES products(id),
  order_id UUID REFERENCES orders(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title VARCHAR(255),
  comment TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'spam'
  vendor_response TEXT,
  responded_at TIMESTAMP,
  rejection_reason TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  rejected_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Un usuario solo puede valorar un producto una vez
  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_reviews_product ON reviews(product_id, status);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_status ON reviews(status) WHERE status = 'pending';

-- Tabla de imágenes de reseñas
CREATE TABLE review_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_images_review ON review_images(review_id);

-- Tabla de reportes de reseñas
CREATE TABLE review_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES reviews(id),
  reported_by UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(100) NOT NULL, -- 'spam', 'offensive', 'fake', 'other'
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'reviewed', 'dismissed'
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_review_reports_review ON review_reports(review_id);
CREATE INDEX idx_review_reports_status ON review_reports(status);

-- Tabla de reputación de tiendas
CREATE TABLE store_reputation (
  store_id UUID PRIMARY KEY REFERENCES stores(id),
  reputation_score DECIMAL(5,2) DEFAULT 0, -- 0-100
  reputation_badge VARCHAR(50), -- 'new', 'good', 'very_good', 'excellent', 'top_seller'
  avg_product_rating DECIMAL(3,2),
  total_reviews INTEGER DEFAULT 0,
  on_time_delivery_rate DECIMAL(5,2),
  avg_response_time INTEGER, -- en minutos
  order_confirmation_rate DECIMAL(5,2),
  last_reputation_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

**Fecha de creación:** 2025-11-24
**Versión:** 1.0
