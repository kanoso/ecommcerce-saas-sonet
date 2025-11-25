# Diagramas de Secuencia - Sistema de Moderación - Sistema Tiendi

Sistema de moderación y control de calidad de la plataforma.

---

## 1. Onboarding de Vendedor (KYC)

```mermaid
sequenceDiagram
    actor Seller as Vendedor Potencial
    participant Web as Web App
    participant Gateway as API Gateway
    participant Onboarding as Onboarding Service
    participant KYC as KYC Service
    participant DB as PostgreSQL
    participant Email as Email Service
    participant Notif as Notification Service

    Seller->>Web: Completar formulario<br/>"Quiero vender"

    Web->>Gateway: POST /seller-leads<br/>{name, email, phone}

    Gateway->>Onboarding: Create seller lead

    Onboarding->>DB: INSERT INTO seller_leads<br/>{name, email, phone,<br/>status: 'new'}
    DB-->>Onboarding: Lead created

    Onboarding->>Email: Send welcome email<br/>con enlace a onboarding completo
    Email-->>Onboarding: Email sent

    Onboarding-->>Gateway: 201 Created
    Gateway-->>Web: Lead created
    Web-->>Seller: ¡Gracias! Te contactaremos

    Note over Onboarding: Equipo de ventas contacta

    Seller->>Web: Click enlace de onboarding

    Web-->>Seller: Formulario completo:<br/>- Datos de empresa<br/>- RUC<br/>- Dirección<br/>- Documentos legales<br/>- Cuenta bancaria

    Seller->>Web: Subir documentos:<br/>- DNI/CE del representante<br/>- Ficha RUC<br/>- Licencia de funcionamiento<br/>- Foto de local

    Web->>Gateway: POST /seller-applications<br/>{...data, documents}

    Gateway->>Onboarding: Create application

    Onboarding->>DB: INSERT INTO seller_applications<br/>{lead_id, ruc, address,<br/>documents, status: 'submitted'}

    Onboarding->>KYC: Verify identity

    KYC->>KYC: Validaciones:<br/>- Verificar RUC en SUNAT<br/>- Validar DNI en RENIEC<br/>- Análisis de documentos<br/>- Score de riesgo

    alt Documentos válidos
        KYC-->>Onboarding: Verification: PASSED

        Onboarding->>DB: UPDATE applications<br/>SET status = 'kyc_approved'

        Onboarding->>Notif: Notify admin for approval
        Notif-->>Onboarding: Notification sent
    else Documentos inválidos/incompletos
        KYC-->>Onboarding: Verification: FAILED

        Onboarding->>DB: UPDATE applications<br/>SET status = 'kyc_failed',<br/>failure_reason = ?

        Onboarding->>Email: Send email<br/>solicitando correcciones
        Email-->>Onboarding: Email sent
    end
```

---

## 2. Aprobación Manual de Tienda (Super Admin)

```mermaid
sequenceDiagram
    actor Admin as Super Admin
    participant Dashboard as Admin Panel
    participant Gateway as API Gateway
    participant Moderation as Moderation Service
    participant Store as Store Service
    participant User as User Service
    participant DB as PostgreSQL
    participant Email as Email Service

    Admin->>Dashboard: Ver aplicaciones pendientes

    Dashboard->>Gateway: GET /admin/seller-applications/pending

    Gateway->>Moderation: Get pending applications

    Moderation->>DB: SELECT * FROM seller_applications<br/>WHERE status = 'kyc_approved'

    DB-->>Moderation: Applications list

    Moderation-->>Gateway: Applications
    Gateway-->>Dashboard: Data
    Dashboard-->>Admin: Lista de solicitudes

    Admin->>Dashboard: Revisar aplicación

    Dashboard-->>Admin: Ver toda la información:<br/>- Datos del vendedor<br/>- Documentos<br/>- Verificación KYC<br/>- Score de riesgo

    Admin->>Dashboard: Decisión

    alt Aprobar
        Dashboard->>Gateway: POST /admin/applications/{id}/approve

        Gateway->>Moderation: Approve application

        Moderation->>DB: BEGIN TRANSACTION

        Moderation->>Store: Create store
        Store->>DB: INSERT INTO stores<br/>{name, slug, ruc, address,<br/>is_active: true}
        DB-->>Store: Store created: store_123

        Moderation->>User: Create store admin user
        User->>DB: INSERT INTO users<br/>{email, name, is_vendor: true}
        DB-->>User: User created

        User->>DB: INSERT INTO user_roles<br/>{user_id, role: 'store_admin',<br/>store_id: store_123}
        DB-->>User: Role assigned

        Moderation->>DB: INSERT INTO subscriptions<br/>{store_id, plan: 'basic',<br/>status: 'trial'}
        DB-->>Moderation: Subscription created

        Moderation->>DB: UPDATE seller_applications<br/>SET status = 'approved',<br/>store_id = store_123

        Moderation->>DB: COMMIT

        Moderation->>Email: Send welcome email<br/>con credenciales de acceso
        Email-->>Moderation: Email sent

        Moderation-->>Gateway: 200 OK
        Gateway-->>Dashboard: Approved
        Dashboard-->>Admin: Tienda aprobada y creada
    else Rechazar
        Dashboard->>Gateway: POST /admin/applications/{id}/reject<br/>{reason}

        Gateway->>Moderation: Reject application

        Moderation->>DB: UPDATE seller_applications<br/>SET status = 'rejected',<br/>rejection_reason = ?

        Moderation->>Email: Send rejection email<br/>con feedback
        Email-->>Moderation: Email sent

        Moderation-->>Gateway: 200 OK
        Gateway-->>Dashboard: Rejected
        Dashboard-->>Admin: Aplicación rechazada
    end
```

---

## 3. Moderación de Productos

```mermaid
sequenceDiagram
    participant Cron as Cron Job
    participant AI as AI Moderation
    participant DB as PostgreSQL
    participant Notif as Notification Service

    Cron->>AI: Check new products

    AI->>DB: SELECT * FROM products<br/>WHERE moderation_status = 'pending'<br/>AND created_at > NOW() - INTERVAL '1 hour'

    DB-->>AI: New products

    loop Para cada producto
        AI->>AI: Análisis automático:<br/>- Detectar contenido prohibido<br/>- Verificar imágenes<br/>- Validar precio razonable<br/>- Detectar spam

        alt Producto sospechoso
            AI->>DB: UPDATE products<br/>SET moderation_status = 'flagged',<br/>flag_reason = ?

            AI->>Notif: Notify moderators<br/>para revisión manual
        else Producto OK
            AI->>DB: UPDATE products<br/>SET moderation_status = 'approved'
        end
    end
```

---

## 4. Sistema de Reportes

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Gateway as API Gateway
    participant Report as Report Service
    participant DB as PostgreSQL
    participant Notif as Notification Service

    User->>Web: Reportar producto/tienda

    Web-->>User: Formulario de reporte

    User->>Web: Seleccionar motivo:<br/>- Producto falso<br/>- Contenido ofensivo<br/>- Precio engañoso<br/>- Otro

    User->>Web: Agregar descripción<br/>y evidencia (opcional)

    Web->>Gateway: POST /reports<br/>{type, target_id, reason, description}

    Gateway->>Report: Create report

    Report->>DB: INSERT INTO reports<br/>{user_id, target_type,<br/>target_id, reason,<br/>status: 'open'}
    DB-->>Report: Report created

    Report->>DB: INCREMENT report_count<br/>ON target entity

    Report->>Notif: Notify moderators
    Notif-->>Report: Notification sent

    Report-->>Gateway: 201 Created
    Gateway-->>Web: Report submitted
    Web-->>User: Gracias por reportar<br/>Lo revisaremos
```

---

## 5. Suspensión de Tienda

```mermaid
sequenceDiagram
    actor Admin as Super Admin
    participant Dashboard as Admin Panel
    participant Gateway as API Gateway
    participant Moderation as Moderation Service
    participant Store as Store Service
    participant DB as PostgreSQL
    participant Notif as Notification Service

    Admin->>Dashboard: Suspender tienda

    Dashboard->>Gateway: POST /admin/stores/{id}/suspend<br/>{reason, duration}

    Gateway->>Moderation: Suspend store

    Moderation->>DB: BEGIN TRANSACTION

    Moderation->>DB: UPDATE stores<br/>SET is_active = FALSE,<br/>suspended_at = NOW(),<br/>suspension_reason = ?,<br/>suspension_until = ?

    Moderation->>DB: UPDATE products<br/>SET is_active = FALSE<br/>WHERE store_id = ?

    Moderation->>DB: INSERT INTO audit_logs<br/>{action: 'store_suspended',<br/>store_id, admin_id, reason}

    Moderation->>DB: COMMIT

    Moderation->>Notif: Notify store owner
    Notif-->>Moderation: Notification sent

    Moderation-->>Gateway: 200 OK
    Gateway-->>Dashboard: Store suspended
    Dashboard-->>Admin: Tienda suspendida
```

---

## Tablas

```sql
CREATE TABLE seller_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id UUID REFERENCES seller_leads(id),
  ruc VARCHAR(11) NOT NULL,
  business_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  documents JSONB, -- URLs de documentos subidos
  kyc_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'failed'
  kyc_score INTEGER,
  status VARCHAR(20) DEFAULT 'submitted', -- 'submitted', 'kyc_approved', 'approved', 'rejected'
  rejection_reason TEXT,
  store_id UUID REFERENCES stores(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id),
  target_type VARCHAR(50) NOT NULL, -- 'product', 'store', 'review', 'user'
  target_id UUID NOT NULL,
  reason VARCHAR(100) NOT NULL,
  description TEXT,
  evidence JSONB, -- URLs de capturas/evidencia
  status VARCHAR(20) DEFAULT 'open', -- 'open', 'in_review', 'resolved', 'dismissed'
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMP,
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_type VARCHAR(50) NOT NULL,
  target_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'approved', 'rejected', 'flagged', 'suspended', 'deleted'
  reason TEXT,
  performed_by UUID REFERENCES users(id),
  performed_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id UUID,
  user_id UUID REFERENCES users(id),
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
```

---

**Fecha de creación:** 2025-11-24
**Versión:** 1.0
