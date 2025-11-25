# Esquema de Base de Datos - Tiendi

## Diagrama Relacional

```
users (1) -----> (N) stores
stores (1) -----> (N) products
stores (1) -----> (N) orders
stores (1) -----> (1) store_subscriptions
users (1) -----> (N) orders [as customer]
orders (1) -----> (N) order_items
products (1) -----> (N) order_items
categories (1) -----> (N) products
categories (1) -----> (N) categories [self-reference]
subscription_plans (1) -----> (N) store_subscriptions
```

---

## Tablas Principales

### users

Almacena todos los usuarios del sistema (super admins, vendedores, empleados, clientes).

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  avatar_url TEXT,

  role VARCHAR(50) NOT NULL DEFAULT 'customer',
  -- Roles: 'super_admin', 'store_owner', 'employee', 'customer'

  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'active',
  -- Status: 'active', 'suspended', 'deleted'

  -- OAuth fields
  google_id VARCHAR(255),
  facebook_id VARCHAR(255),

  -- Preferences
  preferences JSONB DEFAULT '{}',
  -- { "language": "es", "currency": "PEN", "notifications": {...} }

  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
```

---

### stores

Tiendas creadas por vendedores.

```sql
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,

  -- Contact
  phone VARCHAR(20),
  email VARCHAR(255),
  whatsapp VARCHAR(20),
  website TEXT,

  -- Location
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'PE',
  postal_code VARCHAR(20),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  delivery_radius INTEGER DEFAULT 5, -- km

  -- Business hours
  opening_hours JSONB,
  -- {
  --   "monday": { "open": "09:00", "close": "18:00", "closed": false },
  --   "tuesday": { "open": "09:00", "close": "18:00", "closed": false },
  --   ...
  --   "24_hours": false
  -- }

  -- Settings
  payment_methods JSONB DEFAULT '["cash"]',
  -- ["cash", "card", "transfer", "yape", "plin"]

  shipping_methods JSONB DEFAULT '["pickup"]',
  -- ["pickup", "delivery"]

  settings JSONB DEFAULT '{}',
  -- {
  --   "theme": { "primary_color": "#6B46C1", "secondary_color": "#00D4AA" },
  --   "notifications": { "email": true, "sms": true, "whatsapp": true },
  --   "policies": { "terms_url": "", "privacy_url": "", "returns_url": "" }
  -- }

  -- Status
  status VARCHAR(50) DEFAULT 'pending',
  -- Status: 'pending', 'active', 'suspended', 'deleted'

  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id),

  -- Stats (cache)
  total_products INTEGER DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  total_sales DECIMAL(10, 2) DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_stores_owner ON stores(owner_id);
CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_status ON stores(status);
CREATE INDEX idx_stores_location ON stores USING GIST(
  ll_to_earth(latitude, longitude)
);
```

---

### categories

Categorías de productos (jerárquicas).

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,

  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(100), -- nombre del icono o URL
  image_url TEXT,

  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(slug, parent_id)
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_active ON categories(is_active);
```

---

### products

Productos de cada tienda.

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  short_description VARCHAR(500),

  -- Pricing
  price DECIMAL(10, 2) NOT NULL,
  sale_price DECIMAL(10, 2),
  cost DECIMAL(10, 2), -- costo para el vendedor

  -- Inventory
  sku VARCHAR(100),
  barcode VARCHAR(100),
  stock INTEGER DEFAULT 0,
  low_stock_alert INTEGER DEFAULT 10,
  track_inventory BOOLEAN DEFAULT TRUE,

  -- Media
  images JSONB DEFAULT '[]',
  -- [
  --   { "url": "...", "alt": "...", "order": 0, "is_primary": true },
  --   { "url": "...", "alt": "...", "order": 1, "is_primary": false }
  -- ]

  -- Attributes
  brand VARCHAR(100),
  unit VARCHAR(50), -- 'unit', 'kg', 'g', 'l', 'ml'
  weight DECIMAL(10, 2),
  dimensions JSONB,
  -- { "length": 10, "width": 10, "height": 10, "unit": "cm" }

  -- Variants (opcional para v2)
  has_variants BOOLEAN DEFAULT FALSE,

  -- SEO
  meta_title VARCHAR(255),
  meta_description TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,

  -- Stats (cache)
  views_count INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(store_id, slug)
);

CREATE INDEX idx_products_store ON products(store_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_slug ON products(store_id, slug);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_featured ON products(is_featured);
```

---

### orders

Pedidos realizados por clientes.

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Order info
  order_number VARCHAR(50) UNIQUE NOT NULL,
  -- Format: ORD-20250123-XXXXX

  status VARCHAR(50) DEFAULT 'pending',
  -- Status: 'pending', 'confirmed', 'preparing', 'in_transit',
  --         'delivered', 'cancelled', 'rejected'

  -- Pricing
  subtotal DECIMAL(10, 2) NOT NULL,
  delivery_fee DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  tax DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,

  -- Payment
  payment_method VARCHAR(50) NOT NULL,
  -- 'cash', 'card', 'transfer', 'yape', 'plin'

  payment_status VARCHAR(50) DEFAULT 'pending',
  -- Status: 'pending', 'paid', 'failed', 'refunded'

  payment_proof_url TEXT, -- para yape/plin

  transaction_id VARCHAR(255), -- Stripe/PayPal transaction ID

  -- Delivery
  delivery_method VARCHAR(50) DEFAULT 'pickup',
  -- 'pickup', 'delivery'

  delivery_address JSONB,
  -- {
  --   "full_name": "...",
  --   "phone": "...",
  --   "address": "...",
  --   "city": "...",
  --   "postal_code": "...",
  --   "notes": "..."
  -- }

  delivery_location POINT, -- coordenadas para cálculo
  delivery_notes TEXT,

  -- Tracking
  tracking_code VARCHAR(100) UNIQUE,
  estimated_delivery_at TIMESTAMP,
  delivered_at TIMESTAMP,

  -- Notes
  customer_notes TEXT,
  store_notes TEXT, -- notas internas del vendedor

  -- Cancellation
  cancelled_at TIMESTAMP,
  cancelled_by UUID REFERENCES users(id),
  cancellation_reason TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_store ON orders(store_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
```

---

### order_items

Items individuales de cada pedido.

```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,

  -- Product snapshot (para mantener historial)
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  product_image_url TEXT,

  -- Pricing
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,

  -- Variant info (para v2)
  variant_info JSONB,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
```

---

### subscription_plans

Planes de suscripción para tiendas.

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,

  -- Pricing
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PEN',
  billing_cycle VARCHAR(50) DEFAULT 'monthly',
  -- 'monthly', 'yearly'

  trial_days INTEGER DEFAULT 0,

  -- Features
  features JSONB NOT NULL,
  -- {
  --   "max_products": 50,
  --   "max_orders_per_month": 100,
  --   "commission_rate": 5, // %
  --   "custom_domain": false,
  --   "advanced_analytics": false,
  --   "priority_support": false,
  --   "api_access": false
  -- }

  -- Display
  is_popular BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_plans_slug ON subscription_plans(slug);
CREATE INDEX idx_plans_active ON subscription_plans(is_active);
```

---

### store_subscriptions

Suscripciones activas de cada tienda.

```sql
CREATE TABLE store_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,

  status VARCHAR(50) DEFAULT 'active',
  -- Status: 'trial', 'active', 'past_due', 'cancelled', 'expired'

  -- Dates
  trial_ends_at TIMESTAMP,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  cancelled_at TIMESTAMP,

  -- Billing
  stripe_subscription_id VARCHAR(255),
  auto_renew BOOLEAN DEFAULT TRUE,

  -- Usage tracking
  usage_stats JSONB DEFAULT '{}',
  -- {
  --   "products_count": 25,
  --   "orders_this_month": 45
  -- }

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_store ON store_subscriptions(store_id);
CREATE INDEX idx_subscriptions_plan ON store_subscriptions(plan_id);
CREATE INDEX idx_subscriptions_status ON store_subscriptions(status);
CREATE INDEX idx_subscriptions_end_date ON store_subscriptions(end_date);
```

---

## Tablas Adicionales

### store_employees

Empleados de cada tienda (relaciona users con stores).

```sql
CREATE TABLE store_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  role VARCHAR(50) DEFAULT 'employee',
  -- 'manager', 'employee', 'cashier'

  permissions JSONB DEFAULT '[]',
  -- ["manage_products", "manage_orders", "manage_employees"]

  is_active BOOLEAN DEFAULT TRUE,

  hired_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(store_id, user_id)
);

CREATE INDEX idx_employees_store ON store_employees(store_id);
CREATE INDEX idx_employees_user ON store_employees(user_id);
```

---

### favorites

Productos favoritos de clientes.

```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, product_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_product ON favorites(product_id);
```

---

### reviews

Reviews de productos (para v2).

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,

  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(255),
  comment TEXT,

  images JSONB DEFAULT '[]',

  is_verified_purchase BOOLEAN DEFAULT FALSE,

  helpful_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(product_id, user_id)
);

CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
```

---

### notifications

Notificaciones para usuarios.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  type VARCHAR(50) NOT NULL,
  -- 'order_placed', 'order_confirmed', 'order_delivered', 'new_message', etc.

  title VARCHAR(255) NOT NULL,
  message TEXT,

  data JSONB,
  -- { "order_id": "...", "store_id": "..." }

  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
```

---

### activity_logs

Log de actividad para auditoría.

```sql
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,

  action VARCHAR(100) NOT NULL,
  -- 'product.created', 'order.updated', 'store.suspended', etc.

  entity_type VARCHAR(50),
  entity_id UUID,

  changes JSONB,
  -- { "before": {...}, "after": {...} }

  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_logs_user ON activity_logs(user_id);
CREATE INDEX idx_logs_store ON activity_logs(store_id);
CREATE INDEX idx_logs_created ON activity_logs(created_at DESC);
```

---

### coupons

Cupones de descuento (para v2).

```sql
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  -- NULL = cupón global de plataforma

  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,

  discount_type VARCHAR(50) NOT NULL,
  -- 'percentage', 'fixed'

  discount_value DECIMAL(10, 2) NOT NULL,

  min_purchase DECIMAL(10, 2),
  max_discount DECIMAL(10, 2),

  usage_limit INTEGER, -- NULL = ilimitado
  usage_count INTEGER DEFAULT 0,

  valid_from TIMESTAMP,
  valid_until TIMESTAMP,

  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code);
CREATE INDEX idx_coupons_store ON coupons(store_id);
CREATE INDEX idx_coupons_active ON coupons(is_active);
```

---

## Funciones y Triggers Útiles

### Trigger: Actualizar updated_at

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar a todas las tablas con updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ... etc
```

### Trigger: Generar order_number

```sql
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                      LPAD(NEXTVAL('order_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE order_number_seq;

CREATE TRIGGER set_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();
```

### Función: Buscar tiendas cercanas

```sql
CREATE OR REPLACE FUNCTION find_nearby_stores(
  user_lat DECIMAL,
  user_lng DECIMAL,
  radius_km INTEGER DEFAULT 10
)
RETURNS TABLE (
  store_id UUID,
  store_name VARCHAR,
  distance_km DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    ROUND(
      earth_distance(
        ll_to_earth(user_lat, user_lng),
        ll_to_earth(s.latitude, s.longitude)
      )::NUMERIC / 1000,
      2
    ) AS distance_km
  FROM stores s
  WHERE
    s.status = 'active' AND
    earth_box(ll_to_earth(user_lat, user_lng), radius_km * 1000) @>
    ll_to_earth(s.latitude, s.longitude)
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- Uso: SELECT * FROM find_nearby_stores(-12.0464, -77.0428, 5);
```

---

## Índices de Performance

### Full-text search

```sql
-- Para búsqueda de productos
CREATE INDEX idx_products_search ON products
USING gin(to_tsvector('spanish',
  coalesce(name, '') || ' ' ||
  coalesce(description, '') || ' ' ||
  coalesce(brand, '')
));

-- Para búsqueda de tiendas
CREATE INDEX idx_stores_search ON stores
USING gin(to_tsvector('spanish',
  coalesce(name, '') || ' ' ||
  coalesce(description, '')
));
```

---

## Datos de Ejemplo (Seeds)

### Planes de suscripción

```sql
INSERT INTO subscription_plans (name, slug, price, billing_cycle, features, order_index) VALUES
('Gratuito', 'free', 0, 'monthly',
  '{"max_products": 50, "max_orders_per_month": 100, "commission_rate": 5, "custom_domain": false, "advanced_analytics": false, "priority_support": false, "api_access": false}', 1),
('Básico', 'basic', 29, 'monthly',
  '{"max_products": 500, "max_orders_per_month": null, "commission_rate": 2, "custom_domain": false, "advanced_analytics": true, "priority_support": true, "api_access": false}', 2),
('Premium', 'premium', 79, 'monthly',
  '{"max_products": null, "max_orders_per_month": null, "commission_rate": 0, "custom_domain": true, "advanced_analytics": true, "priority_support": true, "api_access": true}', 3);
```

### Categorías principales

```sql
INSERT INTO categories (name, slug, icon, order_index) VALUES
('Bebidas y licores', 'bebidas-licores', 'local_bar', 1),
('Snacks', 'snacks', 'fastfood', 2),
('Alimentos', 'alimentos', 'restaurant', 3),
('Tortas y postres', 'tortas-postres', 'cake', 4),
('Limpieza', 'limpieza', 'cleaning_services', 5),
('Cuidado personal', 'cuidado-personal', 'face', 6);

-- Subcategorías de Bebidas
INSERT INTO categories (name, slug, parent_id, order_index) VALUES
('Cervezas', 'cervezas', (SELECT id FROM categories WHERE slug='bebidas-licores'), 1),
('Agua', 'agua', (SELECT id FROM categories WHERE slug='bebidas-licores'), 2),
('Gaseosas', 'gaseosas', (SELECT id FROM categories WHERE slug='bebidas-licores'), 3),
('Vodka', 'vodka', (SELECT id FROM categories WHERE slug='bebidas-licores'), 4);
```

---

**Documento creado:** 2025-11-23
**Versión:** 1.0
