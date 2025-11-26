# Diagramas de Secuencia - Sistema de Devoluciones y Disputas - Sistema Tiendi

Sistema de devoluciones, reembolsos y resolución de disputas.

---

## 1. Solicitud de Devolución (Cliente)

```mermaid
sequenceDiagram
    actor Customer as Cliente
    participant Web as Web App
    participant Gateway as API Gateway
    participant Return as Return Service
    participant Order as Order Service
    participant DB as PostgreSQL
    participant Notif as Notification Service

    Customer->>Web: Ver pedido entregado<br/>Click "Solicitar devolución"

    Web->>Gateway: GET /orders/{id}/can-return

    Gateway->>Order: Check return eligibility

    Order->>DB: SELECT * FROM orders<br/>WHERE id = ?
    DB-->>Order: Order data

    alt Fuera del período de devolución (>7 días)
        Order-->>Gateway: 400 Bad Request<br/>"Período de devolución expirado"
        Gateway-->>Web: Cannot return
        Web-->>Customer: Ya no puedes devolver este pedido
    else Dentro del período
        Order-->>Gateway: 200 OK
        Gateway-->>Web: Can return

        Web-->>Customer: Formulario de devolución

        Customer->>Web: Completar:<br/>- Motivo<br/>- Descripción<br/>- Fotos (opcional)

        Web->>Gateway: POST /returns<br/>{order_id, reason, description, images}

        Gateway->>Return: Create return request

        Return->>DB: BEGIN TRANSACTION

        Return->>DB: INSERT INTO returns<br/>{order_id, user_id, reason,<br/>description, status: 'pending'}
        DB-->>Return: Return created: ret_123

        loop Para cada imagen
            Return->>DB: INSERT INTO return_images
        end

        Return->>DB: UPDATE orders<br/>SET has_return_request = TRUE

        Return->>DB: COMMIT

        Return->>Notif: Notify store owner
        Notif-->>Return: Notification sent

        Return-->>Gateway: 201 Created
        Gateway-->>Web: Return request created
        Web-->>Customer: Solicitud enviada<br/>El vendedor la revisará
    end
```

---

## 2. Evaluación de Devolución (Vendedor)

```mermaid
sequenceDiagram
    actor Vendor as Vendedor
    participant Web as Vendor Dashboard
    participant Gateway as API Gateway
    participant Return as Return Service
    participant Payment as Payment Service
    participant DB as PostgreSQL
    participant Notif as Notification Service

    Vendor->>Web: Ver solicitudes de devolución

    Web->>Gateway: GET /vendor/returns

    Gateway->>Return: Get pending returns

    Return->>DB: SELECT r.*, o.order_number,<br/>u.name as customer_name<br/>FROM returns r<br/>WHERE status = 'pending'

    DB-->>Return: Returns list

    Return-->>Gateway: Returns
    Gateway-->>Web: Data
    Web-->>Vendor: Lista de solicitudes

    Vendor->>Web: Revisar solicitud

    Web-->>Vendor: Detalle completo:<br/>- Pedido<br/>- Productos<br/>- Motivo<br/>- Fotos

    Vendor->>Web: Decisión

    alt Aprobar devolución
        Web->>Gateway: POST /vendor/returns/{id}/approve<br/>{refund_method}

        Gateway->>Return: Approve return

        Return->>DB: UPDATE returns<br/>SET status = 'approved',<br/>approved_at = NOW()

        Return->>Payment: Process refund

        alt Método: Reembolso completo
            Payment->>Payment: Calculate refund:<br/>Total pedido - Delivery
            Payment->>DB: INSERT INTO refunds<br/>{return_id, amount, method}
            Payment-->>Return: Refund processed
        else Método: Crédito en tienda
            Payment->>DB: INSERT INTO store_credits<br/>{user_id, amount}
            Payment-->>Return: Credit issued
        end

        Return->>DB: UPDATE orders<br/>SET status = 'RETURNED'

        Return->>Notif: Notify customer<br/>"Devolución aprobada"
        Notif-->>Return: Sent

        Return-->>Gateway: 200 OK
        Gateway-->>Web: Approved
        Web-->>Vendor: Devolución aprobada
    else Rechazar devolución
        Web->>Gateway: POST /vendor/returns/{id}/reject<br/>{reason}

        Gateway->>Return: Reject return

        Return->>DB: UPDATE returns<br/>SET status = 'rejected',<br/>rejection_reason = ?

        Return->>Notif: Notify customer<br/>con motivo del rechazo
        Notif-->>Return: Sent

        Return-->>Gateway: 200 OK
        Gateway-->>Web: Rejected
        Web-->>Vendor: Solicitud rechazada
    end
```

---

## 3. Escalamiento a Disputa

```mermaid
sequenceDiagram
    actor Customer as Cliente
    participant Web as Web App
    participant Gateway as API Gateway
    participant Dispute as Dispute Service
    participant Support as Support Service
    participant DB as PostgreSQL
    participant Notif as Notification Service

    Customer->>Web: Devolución rechazada<br/>Click "Abrir disputa"

    Web-->>Customer: Formulario de disputa

    Customer->>Web: Completar:<br/>- Motivo detallado<br/>- Evidencia adicional<br/>- Fotos/documentos

    Web->>Gateway: POST /disputes<br/>{return_id, reason, evidence}

    Gateway->>Dispute: Create dispute

    Dispute->>DB: INSERT INTO disputes<br/>{return_id, user_id,<br/>reason, status: 'open'}
    DB-->>Dispute: Dispute created: disp_456

    Dispute->>DB: UPDATE returns<br/>SET has_dispute = TRUE

    Dispute->>Support: Assign to support team

    Support->>Notif: Notify support agents
    Support->>Notif: Notify vendor
    Notif-->>Support: Notifications sent

    Dispute-->>Gateway: 201 Created
    Gateway-->>Web: Dispute created
    Web-->>Customer: Disputa abierta<br/>Soporte te contactará

    Note over Support: Mediación por equipo Tiendi

    Support->>DB: UPDATE disputes<br/>SET assigned_to = support_agent_id

    Support->>Support: Revisar caso<br/>Contactar partes

    alt Resolución a favor del cliente
        Support->>DB: UPDATE disputes<br/>SET status = 'resolved',<br/>resolution: 'customer_favor'

        Support->>Return: Force approve return
        Support->>Payment: Process refund

        Support->>Notif: Notify both parties
    else Resolución a favor del vendedor
        Support->>DB: UPDATE disputes<br/>SET status = 'resolved',<br/>resolution: 'vendor_favor'

        Support->>Notif: Notify both parties
    end
```

---

## Tablas

```sql
CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id),
  user_id UUID NOT NULL REFERENCES users(id),
  reason VARCHAR(100) NOT NULL, -- 'defective', 'wrong_item', 'not_as_described', 'changed_mind'
  description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  rejection_reason TEXT,
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),
  rejected_at TIMESTAMP,
  has_dispute BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE return_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES returns(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  amount DECIMAL(10,2) NOT NULL,
  method VARCHAR(50) NOT NULL, -- 'original_payment', 'store_credit', 'bank_transfer'
  transaction_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  return_id UUID NOT NULL REFERENCES returns(id),
  user_id UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'in_review', 'resolved', 'closed'
  resolution VARCHAR(50), -- 'customer_favor', 'vendor_favor', 'compromise'
  assigned_to UUID REFERENCES users(id),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE dispute_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispute_id UUID NOT NULL REFERENCES disputes(id),
  sender_id UUID NOT NULL REFERENCES users(id),
  sender_type VARCHAR(20) NOT NULL, -- 'customer', 'vendor', 'support'
  message TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

**Fecha de creación:** 2025-11-24
**Versión:** 1.0
