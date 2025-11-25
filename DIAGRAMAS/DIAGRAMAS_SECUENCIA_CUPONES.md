# Diagramas de Secuencia - Sistema de Cupones - Sistema Tiendi

Sistema de cupones de descuento y promociones.

---

## 1. Aplicar Cupón en Checkout

```mermaid
sequenceDiagram
    actor Customer as Cliente
    participant Web as Web App
    participant Gateway as API Gateway
    participant Coupon as Coupon Service
    participant Cart as Cart Service
    participant DB as PostgreSQL

    Customer->>Web: Ingresar código: "VERANO2025"

    Web->>Gateway: POST /cart/apply-coupon<br/>{code: "VERANO2025"}

    Gateway->>Coupon: Validate and apply coupon

    Coupon->>DB: SELECT * FROM coupons<br/>WHERE code = 'VERANO2025'<br/>AND is_active = TRUE
    DB-->>Coupon: Coupon data

    alt Cupón no encontrado
        Coupon-->>Gateway: 404 Not Found
        Gateway-->>Web: Error
        Web-->>Customer: Cupón inválido
    else Cupón encontrado
        Coupon->>Coupon: Validar condiciones

        alt Expirado
            Coupon-->>Gateway: 400 Bad Request<br/>"Cupón expirado"
            Gateway-->>Web: Error
            Web-->>Customer: Este cupón ha expirado
        else Límite de usos alcanzado
            Coupon-->>Gateway: 400 Bad Request<br/>"Cupón agotado"
            Gateway-->>Web: Error
            Web-->>Customer: Cupón ya no disponible
        else Usuario ya lo usó (límite por usuario)
            Coupon->>DB: SELECT COUNT(*)<br/>FROM coupon_usages<br/>WHERE coupon_id = ?<br/>AND user_id = ?
            DB-->>Coupon: count: 1
            Coupon-->>Gateway: 400 Bad Request<br/>"Ya usaste este cupón"
            Gateway-->>Web: Error
            Web-->>Customer: Ya usaste este cupón
        else Monto mínimo no alcanzado
            Coupon-->>Gateway: 400 Bad Request<br/>"Compra mínima: S/ 50"
            Gateway-->>Web: Error
            Web-->>Customer: Compra mínima S/ 50
        else Válido
            Coupon->>Cart: Calculate discount

            alt Tipo: Porcentaje
                Cart->>Cart: Descuento = Subtotal × 10%<br/>S/ 100 × 10% = S/ 10
            else Tipo: Monto fijo
                Cart->>Cart: Descuento = S/ 20
            end

            Cart->>Cart: Calcular nuevo total:<br/>Subtotal: S/ 100<br/>Descuento: -S/ 10<br/>Delivery: S/ 5<br/>Total: S/ 95

            Cart->>DB: UPDATE cart<br/>SET coupon_id = ?,<br/>discount_amount = 10,<br/>total = 95

            Coupon-->>Gateway: 200 OK<br/>{discount: 10, new_total: 95}
            Gateway-->>Web: Coupon applied
            Web-->>Customer: ¡Cupón aplicado!<br/>Ahorro: S/ 10
        end
    end
```

---

## 2. Crear Cupón (Vendedor)

```mermaid
sequenceDiagram
    actor Vendor as Vendedor
    participant Web as Vendor Dashboard
    participant Gateway as API Gateway
    participant Coupon as Coupon Service
    participant DB as PostgreSQL

    Vendor->>Web: Crear nuevo cupón

    Web-->>Vendor: Formulario

    Vendor->>Web: Completar:<br/>- Código: PROMO10<br/>- Tipo: Porcentaje<br/>- Valor: 10%<br/>- Mínimo: S/ 50<br/>- Inicio: 2025-12-01<br/>- Fin: 2025-12-31<br/>- Límite total: 100<br/>- Por usuario: 1

    Web->>Gateway: POST /vendor/coupons<br/>{...data}

    Gateway->>Coupon: Create coupon

    Coupon->>DB: SELECT * FROM coupons<br/>WHERE code = 'PROMO10'<br/>AND store_id = ?

    DB-->>Coupon: Existing coupon

    alt Código ya existe
        Coupon-->>Gateway: 409 Conflict
        Gateway-->>Web: Error
        Web-->>Vendor: Código ya en uso
    else Código disponible
        Coupon->>DB: INSERT INTO coupons<br/>{code, type, value,<br/>min_amount, valid_from,<br/>valid_until, max_uses,<br/>max_uses_per_user,<br/>store_id, is_active: true}

        DB-->>Coupon: Coupon created

        Coupon-->>Gateway: 201 Created
        Gateway-->>Web: Success
        Web-->>Vendor: Cupón creado
    end
```

---

## Tablas

```sql
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  store_id UUID NOT NULL REFERENCES stores(id),
  code VARCHAR(50) NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed_amount'
  value DECIMAL(10,2) NOT NULL,
  min_amount DECIMAL(10,2) DEFAULT 0,
  max_discount DECIMAL(10,2), -- Descuento máximo para porcentajes
  valid_from TIMESTAMP NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  max_uses INTEGER, -- NULL = ilimitado
  max_uses_per_user INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  applicable_to VARCHAR(20) DEFAULT 'all', -- 'all', 'specific_products', 'specific_categories'
  product_ids UUID[], -- Array de product IDs si aplica
  category_ids UUID[], -- Array de category IDs si aplica
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(store_id, code)
);

CREATE TABLE coupon_usages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES coupons(id),
  user_id UUID NOT NULL REFERENCES users(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  discount_amount DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_coupon_usages_coupon_user ON coupon_usages(coupon_id, user_id);
```

---

**Fecha de creación:** 2025-11-24
**Versión:** 1.0
