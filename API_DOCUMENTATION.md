# Documentación API - Tiendi

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Autenticación](#2-autenticación)
3. [Endpoints por Módulo](#3-endpoints-por-módulo)
4. [Modelos de Datos](#4-modelos-de-datos)
5. [Rate Limiting](#5-rate-limiting)
6. [Versionado](#6-versionado)
7. [Formatos de Error](#7-formatos-de-error)
8. [Webhooks](#8-webhooks)
9. [SDKs y Librerías](#9-sdks-y-librerías)
10. [Ambientes](#10-ambientes)

---

## 1. Visión General

### 1.1 Base URL

```
Production:  https://api.tiendi.pe/v1
Staging:     https://api-staging.tiendi.pe/v1
Development: https://api-dev.tiendi.pe/v1
```

### 1.2 Formato de Respuestas

Todas las respuestas de la API siguen el formato JSON y utilizan códigos de estado HTTP estándar.

**Respuesta Exitosa:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-here",
    "name": "Product Name"
  },
  "meta": {
    "timestamp": "2025-11-25T10:30:00Z",
    "request_id": "req-123456"
  }
}
```

**Respuesta con Paginación:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 150,
    "page": 1,
    "per_page": 20,
    "total_pages": 8
  },
  "links": {
    "first": "/v1/products?page=1",
    "last": "/v1/products?page=8",
    "prev": null,
    "next": "/v1/products?page=2"
  }
}
```

### 1.3 Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| 200    | OK - Solicitud exitosa |
| 201    | Created - Recurso creado exitosamente |
| 204    | No Content - Operación exitosa sin contenido |
| 400    | Bad Request - Error en la solicitud |
| 401    | Unauthorized - Autenticación requerida |
| 403    | Forbidden - Sin permisos |
| 404    | Not Found - Recurso no encontrado |
| 409    | Conflict - Conflicto con el estado actual |
| 422    | Unprocessable Entity - Error de validación |
| 429    | Too Many Requests - Rate limit excedido |
| 500    | Internal Server Error - Error del servidor |
| 503    | Service Unavailable - Servicio temporalmente no disponible |

---

## 2. Autenticación

### 2.1 Flujo OAuth2

Tiendi utiliza OAuth2 con el flujo Authorization Code + PKCE para autenticación segura.

**Paso 1: Obtener Authorization Code**

```http
GET /v1/oauth/authorize
```

**Parámetros:**
```
response_type=code
client_id={CLIENT_ID}
redirect_uri={REDIRECT_URI}
scope=read:products write:orders read:profile
state={RANDOM_STATE}
code_challenge={CODE_CHALLENGE}
code_challenge_method=S256
```

**Paso 2: Intercambiar Code por Token**

```http
POST /v1/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "AUTH_CODE",
  "redirect_uri": "https://yourapp.com/callback",
  "client_id": "CLIENT_ID",
  "code_verifier": "CODE_VERIFIER"
}
```

**Respuesta:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "scope": "read:products write:orders read:profile"
}
```

### 2.2 JWT Access Token

**Estructura del Token:**
```json
{
  "sub": "user-uuid-123",
  "email": "user@example.com",
  "role": "store_owner",
  "store_id": "store-uuid-456",
  "permissions": [
    "products:read",
    "products:write",
    "orders:read",
    "orders:write"
  ],
  "iat": 1700000000,
  "exp": 1700003600,
  "jti": "token-id-789"
}
```

**Uso del Token:**
```http
GET /v1/products
Authorization: Bearer {ACCESS_TOKEN}
```

### 2.3 Refresh Token

```http
POST /v1/oauth/token
Content-Type: application/json

{
  "grant_type": "refresh_token",
  "refresh_token": "REFRESH_TOKEN",
  "client_id": "CLIENT_ID"
}
```

**Respuesta:**
```json
{
  "access_token": "NEW_ACCESS_TOKEN",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "NEW_REFRESH_TOKEN"
}
```

### 2.4 API Keys (Para Integraciones)

Para integraciones server-to-server, se pueden usar API Keys:

```http
GET /v1/products
X-API-Key: tiendi_live_sk_abcdef123456
```

**Obtener API Key:**
```http
POST /v1/api-keys
Authorization: Bearer {ACCESS_TOKEN}
Content-Type: application/json

{
  "name": "Integration with ERP",
  "scopes": ["products:read", "orders:write"],
  "expires_at": "2026-11-25T00:00:00Z"
}
```

---

## 3. Endpoints por Módulo

### 3.1 Autenticación y Usuarios

#### POST /v1/auth/register
Registrar un nuevo usuario.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "first_name": "Juan",
  "last_name": "Pérez",
  "phone": "+51987654321",
  "user_type": "customer"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid-123",
    "email": "user@example.com",
    "first_name": "Juan",
    "last_name": "Pérez",
    "user_type": "customer",
    "email_verified": false,
    "created_at": "2025-11-25T10:30:00Z"
  },
  "meta": {
    "message": "Verification email sent to user@example.com"
  }
}
```

#### POST /v1/auth/login
Iniciar sesión.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "device_info": {
    "device_id": "device-123",
    "device_name": "iPhone 14 Pro",
    "os": "iOS 16.0",
    "app_version": "1.2.3"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": "user-uuid-123",
      "email": "user@example.com",
      "first_name": "Juan",
      "role": "customer"
    }
  }
}
```

#### GET /v1/auth/me
Obtener perfil del usuario autenticado.

**Headers:**
```
Authorization: Bearer {ACCESS_TOKEN}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid-123",
    "email": "user@example.com",
    "first_name": "Juan",
    "last_name": "Pérez",
    "phone": "+51987654321",
    "user_type": "customer",
    "email_verified": true,
    "addresses": [
      {
        "id": "addr-123",
        "type": "home",
        "street": "Av. Arequipa 123",
        "district": "Miraflores",
        "city": "Lima",
        "postal_code": "15074",
        "coordinates": {
          "lat": -12.1191,
          "lng": -77.0348
        }
      }
    ],
    "created_at": "2025-11-25T10:30:00Z"
  }
}
```

#### PATCH /v1/users/{user_id}
Actualizar perfil de usuario.

**Request:**
```json
{
  "first_name": "Juan Carlos",
  "phone": "+51987654322",
  "preferences": {
    "notifications": {
      "email": true,
      "push": true,
      "sms": false
    },
    "language": "es-PE"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid-123",
    "first_name": "Juan Carlos",
    "phone": "+51987654322",
    "updated_at": "2025-11-25T11:00:00Z"
  }
}
```

---

### 3.2 Tiendas (Stores)

#### GET /v1/stores
Listar tiendas con filtros geográficos.

**Query Parameters:**
```
lat=-12.1191            # Latitud del usuario
lng=-77.0348            # Longitud del usuario
radius=5                # Radio en km (default: 5)
category=groceries      # Categoría de tienda
open_now=true           # Solo tiendas abiertas
page=1
per_page=20
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "store-uuid-456",
      "name": "Bodega Mi Vecino",
      "slug": "bodega-mi-vecino-miraflores",
      "category": "groceries",
      "logo_url": "https://cdn.tiendi.pe/stores/logo-456.jpg",
      "banner_url": "https://cdn.tiendi.pe/stores/banner-456.jpg",
      "rating": 4.5,
      "total_reviews": 127,
      "distance_km": 0.8,
      "delivery_time_minutes": 20,
      "minimum_order": 15.00,
      "delivery_fee": 3.50,
      "address": {
        "street": "Calle Las Begonias 234",
        "district": "Miraflores",
        "city": "Lima",
        "coordinates": {
          "lat": -12.1205,
          "lng": -77.0355
        }
      },
      "schedule": {
        "monday": { "open": "08:00", "close": "22:00" },
        "tuesday": { "open": "08:00", "close": "22:00" },
        "sunday": { "open": "09:00", "close": "20:00" }
      },
      "is_open_now": true,
      "features": ["delivery", "pickup", "payment_on_delivery"]
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "per_page": 20,
    "total_pages": 3,
    "user_location": {
      "lat": -12.1191,
      "lng": -77.0348
    }
  }
}
```

#### GET /v1/stores/{store_id}
Obtener detalles de una tienda específica.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "store-uuid-456",
    "name": "Bodega Mi Vecino",
    "description": "Tu bodega de confianza en Miraflores",
    "category": "groceries",
    "logo_url": "https://cdn.tiendi.pe/stores/logo-456.jpg",
    "banner_url": "https://cdn.tiendi.pe/stores/banner-456.jpg",
    "gallery": [
      "https://cdn.tiendi.pe/stores/gallery-456-1.jpg",
      "https://cdn.tiendi.pe/stores/gallery-456-2.jpg"
    ],
    "rating": 4.5,
    "total_reviews": 127,
    "owner": {
      "id": "owner-uuid-789",
      "name": "María González",
      "verified": true,
      "member_since": "2023-01-15"
    },
    "contact": {
      "phone": "+51987654321",
      "email": "contacto@mivecino.pe",
      "whatsapp": "+51987654321"
    },
    "address": {
      "street": "Calle Las Begonias 234",
      "district": "Miraflores",
      "city": "Lima",
      "postal_code": "15074",
      "coordinates": {
        "lat": -12.1205,
        "lng": -77.0355
      }
    },
    "schedule": {
      "monday": { "open": "08:00", "close": "22:00" },
      "tuesday": { "open": "08:00", "close": "22:00" },
      "wednesday": { "open": "08:00", "close": "22:00" },
      "thursday": { "open": "08:00", "close": "22:00" },
      "friday": { "open": "08:00", "close": "23:00" },
      "saturday": { "open": "08:00", "close": "23:00" },
      "sunday": { "open": "09:00", "close": "20:00" }
    },
    "delivery": {
      "available": true,
      "minimum_order": 15.00,
      "delivery_fee": 3.50,
      "free_delivery_over": 50.00,
      "estimated_time_minutes": 20,
      "coverage_radius_km": 3
    },
    "payment_methods": ["cash", "card", "yape", "plin", "niubiz"],
    "features": ["delivery", "pickup", "payment_on_delivery", "loyalty_program"],
    "created_at": "2023-01-15T10:00:00Z"
  }
}
```

#### POST /v1/stores
Crear una nueva tienda (solo store_owners).

**Request:**
```json
{
  "name": "Mi Nueva Bodega",
  "category": "groceries",
  "description": "Bodega familiar en San Isidro",
  "address": {
    "street": "Av. Conquistadores 456",
    "district": "San Isidro",
    "city": "Lima",
    "postal_code": "15073",
    "coordinates": {
      "lat": -12.0931,
      "lng": -77.0465
    }
  },
  "contact": {
    "phone": "+51912345678",
    "email": "contacto@minuevabodega.pe"
  },
  "schedule": {
    "monday": { "open": "07:00", "close": "22:00" },
    "tuesday": { "open": "07:00", "close": "22:00" },
    "wednesday": { "open": "07:00", "close": "22:00" },
    "thursday": { "open": "07:00", "close": "22:00" },
    "friday": { "open": "07:00", "close": "23:00" },
    "saturday": { "open": "07:00", "close": "23:00" },
    "sunday": { "open": "08:00", "close": "21:00" }
  },
  "delivery": {
    "available": true,
    "minimum_order": 20.00,
    "delivery_fee": 5.00,
    "coverage_radius_km": 2
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "store-uuid-new",
    "name": "Mi Nueva Bodega",
    "slug": "mi-nueva-bodega-san-isidro",
    "status": "pending_verification",
    "created_at": "2025-11-25T12:00:00Z"
  },
  "meta": {
    "message": "Store created successfully. Awaiting verification."
  }
}
```

---

### 3.3 Productos

#### GET /v1/stores/{store_id}/products
Listar productos de una tienda.

**Query Parameters:**
```
category=beverages      # Filtrar por categoría
search=coca cola        # Búsqueda por texto
min_price=5.00         # Precio mínimo
max_price=50.00        # Precio máximo
in_stock=true          # Solo productos disponibles
sort=price_asc         # price_asc, price_desc, name_asc, popular
page=1
per_page=20
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "prod-uuid-123",
      "sku": "COCA-500-001",
      "name": "Coca Cola 500ml",
      "description": "Bebida gaseosa sabor cola",
      "category": "beverages",
      "subcategory": "soft_drinks",
      "brand": "Coca Cola",
      "price": 3.50,
      "compare_at_price": 4.00,
      "discount_percentage": 12.5,
      "stock": 45,
      "stock_status": "in_stock",
      "images": [
        {
          "url": "https://cdn.tiendi.pe/products/coca-500-1.jpg",
          "alt": "Coca Cola 500ml",
          "order": 1
        }
      ],
      "unit": "unit",
      "weight": 500,
      "weight_unit": "ml",
      "barcode": "7750182003148",
      "tags": ["beverage", "soda", "refreshing"],
      "rating": 4.7,
      "total_reviews": 89,
      "featured": true,
      "created_at": "2025-01-10T08:00:00Z"
    }
  ],
  "meta": {
    "total": 234,
    "page": 1,
    "per_page": 20,
    "total_pages": 12,
    "filters_applied": {
      "category": "beverages",
      "in_stock": true
    }
  }
}
```

#### GET /v1/products/{product_id}
Obtener detalles de un producto.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "prod-uuid-123",
    "sku": "COCA-500-001",
    "name": "Coca Cola 500ml",
    "description": "Bebida gaseosa sabor cola, ideal para cualquier ocasión",
    "long_description": "Coca-Cola es la bebida gaseosa más popular del mundo...",
    "category": "beverages",
    "subcategory": "soft_drinks",
    "brand": "Coca Cola",
    "price": 3.50,
    "compare_at_price": 4.00,
    "discount_percentage": 12.5,
    "stock": 45,
    "stock_status": "in_stock",
    "low_stock_threshold": 10,
    "images": [
      {
        "url": "https://cdn.tiendi.pe/products/coca-500-1.jpg",
        "alt": "Coca Cola 500ml frente",
        "order": 1
      },
      {
        "url": "https://cdn.tiendi.pe/products/coca-500-2.jpg",
        "alt": "Coca Cola 500ml lateral",
        "order": 2
      }
    ],
    "unit": "unit",
    "weight": 500,
    "weight_unit": "ml",
    "dimensions": {
      "height": 20,
      "width": 6,
      "depth": 6,
      "unit": "cm"
    },
    "barcode": "7750182003148",
    "tags": ["beverage", "soda", "refreshing", "cold"],
    "nutritional_info": {
      "calories": 210,
      "sugars": 55,
      "sodium": 45
    },
    "allergens": [],
    "rating": 4.7,
    "total_reviews": 89,
    "featured": true,
    "store": {
      "id": "store-uuid-456",
      "name": "Bodega Mi Vecino",
      "slug": "bodega-mi-vecino-miraflores"
    },
    "variants": [
      {
        "id": "prod-uuid-124",
        "name": "Coca Cola 1L",
        "price": 5.50
      }
    ],
    "related_products": ["prod-uuid-125", "prod-uuid-126"],
    "created_at": "2025-01-10T08:00:00Z",
    "updated_at": "2025-11-20T15:30:00Z"
  }
}
```

#### POST /v1/stores/{store_id}/products
Crear un nuevo producto.

**Request:**
```json
{
  "sku": "INCA-600-001",
  "name": "Inca Kola 600ml",
  "description": "Bebida gaseosa sabor único",
  "category": "beverages",
  "subcategory": "soft_drinks",
  "brand": "Inca Kola",
  "price": 3.00,
  "compare_at_price": 3.50,
  "stock": 100,
  "images": [
    {
      "url": "https://cdn.tiendi.pe/products/inca-600-1.jpg",
      "alt": "Inca Kola 600ml",
      "order": 1
    }
  ],
  "unit": "unit",
  "weight": 600,
  "weight_unit": "ml",
  "barcode": "7750885000956",
  "tags": ["beverage", "soda", "peruvian"]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "prod-uuid-new",
    "sku": "INCA-600-001",
    "name": "Inca Kola 600ml",
    "price": 3.00,
    "stock": 100,
    "created_at": "2025-11-25T13:00:00Z"
  }
}
```

#### PATCH /v1/products/{product_id}
Actualizar un producto existente.

**Request:**
```json
{
  "price": 3.20,
  "stock": 80,
  "featured": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "prod-uuid-123",
    "price": 3.20,
    "stock": 80,
    "featured": true,
    "updated_at": "2025-11-25T13:30:00Z"
  }
}
```

#### DELETE /v1/products/{product_id}
Eliminar un producto (soft delete).

**Response (204):**
```
No Content
```

---

### 3.4 Carrito de Compras

#### GET /v1/cart
Obtener carrito del usuario autenticado.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "cart-uuid-123",
    "user_id": "user-uuid-123",
    "store_id": "store-uuid-456",
    "items": [
      {
        "id": "cart-item-1",
        "product_id": "prod-uuid-123",
        "product": {
          "id": "prod-uuid-123",
          "name": "Coca Cola 500ml",
          "price": 3.50,
          "image_url": "https://cdn.tiendi.pe/products/coca-500-1.jpg",
          "stock": 45
        },
        "quantity": 2,
        "unit_price": 3.50,
        "subtotal": 7.00
      },
      {
        "id": "cart-item-2",
        "product_id": "prod-uuid-125",
        "product": {
          "id": "prod-uuid-125",
          "name": "Pan Integral",
          "price": 5.50,
          "image_url": "https://cdn.tiendi.pe/products/pan-1.jpg",
          "stock": 15
        },
        "quantity": 1,
        "unit_price": 5.50,
        "subtotal": 5.50
      }
    ],
    "summary": {
      "subtotal": 12.50,
      "delivery_fee": 3.50,
      "discount": 0.00,
      "tax": 0.00,
      "total": 16.00
    },
    "store": {
      "id": "store-uuid-456",
      "name": "Bodega Mi Vecino",
      "minimum_order": 15.00,
      "meets_minimum": true
    },
    "created_at": "2025-11-25T10:00:00Z",
    "updated_at": "2025-11-25T13:00:00Z"
  }
}
```

#### POST /v1/cart/items
Agregar producto al carrito.

**Request:**
```json
{
  "product_id": "prod-uuid-123",
  "quantity": 2,
  "store_id": "store-uuid-456"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "cart-item-1",
    "product_id": "prod-uuid-123",
    "quantity": 2,
    "unit_price": 3.50,
    "subtotal": 7.00,
    "added_at": "2025-11-25T13:00:00Z"
  }
}
```

#### PATCH /v1/cart/items/{item_id}
Actualizar cantidad de un item en el carrito.

**Request:**
```json
{
  "quantity": 3
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "cart-item-1",
    "quantity": 3,
    "subtotal": 10.50,
    "updated_at": "2025-11-25T13:30:00Z"
  }
}
```

#### DELETE /v1/cart/items/{item_id}
Eliminar un item del carrito.

**Response (204):**
```
No Content
```

#### DELETE /v1/cart
Vaciar el carrito completo.

**Response (204):**
```
No Content
```

---

### 3.5 Pedidos (Orders)

#### POST /v1/orders
Crear un nuevo pedido.

**Request:**
```json
{
  "store_id": "store-uuid-456",
  "delivery_address_id": "addr-123",
  "delivery_type": "delivery",
  "payment_method": "card",
  "items": [
    {
      "product_id": "prod-uuid-123",
      "quantity": 2,
      "unit_price": 3.50
    },
    {
      "product_id": "prod-uuid-125",
      "quantity": 1,
      "unit_price": 5.50
    }
  ],
  "notes": "Por favor tocar el timbre dos veces"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "order-uuid-789",
    "order_number": "TND-2025-000123",
    "status": "pending_payment",
    "store": {
      "id": "store-uuid-456",
      "name": "Bodega Mi Vecino"
    },
    "customer": {
      "id": "user-uuid-123",
      "name": "Juan Pérez"
    },
    "items": [
      {
        "product_id": "prod-uuid-123",
        "name": "Coca Cola 500ml",
        "quantity": 2,
        "unit_price": 3.50,
        "subtotal": 7.00
      },
      {
        "product_id": "prod-uuid-125",
        "name": "Pan Integral",
        "quantity": 1,
        "unit_price": 5.50,
        "subtotal": 5.50
      }
    ],
    "delivery_address": {
      "street": "Av. Arequipa 123",
      "district": "Miraflores",
      "city": "Lima",
      "coordinates": {
        "lat": -12.1191,
        "lng": -77.0348
      }
    },
    "pricing": {
      "subtotal": 12.50,
      "delivery_fee": 3.50,
      "discount": 0.00,
      "tax": 0.00,
      "total": 16.00,
      "currency": "PEN"
    },
    "payment": {
      "method": "card",
      "status": "pending",
      "payment_url": "https://payments.tiendi.pe/pay/order-uuid-789"
    },
    "delivery_type": "delivery",
    "estimated_delivery_time": "2025-11-25T14:30:00Z",
    "notes": "Por favor tocar el timbre dos veces",
    "created_at": "2025-11-25T13:45:00Z"
  },
  "meta": {
    "message": "Order created successfully. Please complete payment.",
    "next_action": "complete_payment"
  }
}
```

#### GET /v1/orders
Listar pedidos del usuario autenticado.

**Query Parameters:**
```
status=completed        # pending_payment, confirmed, in_transit, delivered, cancelled
start_date=2025-11-01  # Fecha inicio
end_date=2025-11-30    # Fecha fin
store_id=store-uuid-456 # Filtrar por tienda
page=1
per_page=20
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "order-uuid-789",
      "order_number": "TND-2025-000123",
      "status": "delivered",
      "store": {
        "id": "store-uuid-456",
        "name": "Bodega Mi Vecino",
        "logo_url": "https://cdn.tiendi.pe/stores/logo-456.jpg"
      },
      "total": 16.00,
      "currency": "PEN",
      "items_count": 3,
      "delivery_type": "delivery",
      "created_at": "2025-11-25T13:45:00Z",
      "delivered_at": "2025-11-25T14:25:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "per_page": 20,
    "total_pages": 1
  }
}
```

#### GET /v1/orders/{order_id}
Obtener detalles de un pedido específico.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "order-uuid-789",
    "order_number": "TND-2025-000123",
    "status": "in_transit",
    "store": {
      "id": "store-uuid-456",
      "name": "Bodega Mi Vecino",
      "logo_url": "https://cdn.tiendi.pe/stores/logo-456.jpg",
      "phone": "+51987654321"
    },
    "customer": {
      "id": "user-uuid-123",
      "name": "Juan Pérez",
      "phone": "+51987654321"
    },
    "items": [
      {
        "id": "order-item-1",
        "product_id": "prod-uuid-123",
        "name": "Coca Cola 500ml",
        "image_url": "https://cdn.tiendi.pe/products/coca-500-1.jpg",
        "quantity": 2,
        "unit_price": 3.50,
        "subtotal": 7.00
      },
      {
        "id": "order-item-2",
        "product_id": "prod-uuid-125",
        "name": "Pan Integral",
        "image_url": "https://cdn.tiendi.pe/products/pan-1.jpg",
        "quantity": 1,
        "unit_price": 5.50,
        "subtotal": 5.50
      }
    ],
    "delivery_address": {
      "street": "Av. Arequipa 123",
      "district": "Miraflores",
      "city": "Lima",
      "postal_code": "15074",
      "coordinates": {
        "lat": -12.1191,
        "lng": -77.0348
      },
      "reference": "Edificio blanco, 3er piso, departamento 302"
    },
    "pricing": {
      "subtotal": 12.50,
      "delivery_fee": 3.50,
      "discount": 0.00,
      "tax": 0.00,
      "total": 16.00,
      "currency": "PEN"
    },
    "payment": {
      "method": "card",
      "status": "completed",
      "transaction_id": "niubiz-tx-123456",
      "paid_at": "2025-11-25T13:50:00Z",
      "last_four_digits": "1234",
      "card_brand": "Visa"
    },
    "delivery_type": "delivery",
    "delivery": {
      "driver_id": "driver-uuid-555",
      "driver_name": "Carlos Ramírez",
      "driver_phone": "+51912345678",
      "vehicle": "Moto - ABC-123",
      "current_location": {
        "lat": -12.1180,
        "lng": -77.0340,
        "updated_at": "2025-11-25T14:10:00Z"
      },
      "estimated_arrival": "2025-11-25T14:20:00Z"
    },
    "timeline": [
      {
        "status": "pending_payment",
        "timestamp": "2025-11-25T13:45:00Z",
        "message": "Pedido creado"
      },
      {
        "status": "confirmed",
        "timestamp": "2025-11-25T13:50:00Z",
        "message": "Pago confirmado"
      },
      {
        "status": "preparing",
        "timestamp": "2025-11-25T13:55:00Z",
        "message": "Pedido en preparación"
      },
      {
        "status": "in_transit",
        "timestamp": "2025-11-25T14:05:00Z",
        "message": "Pedido en camino"
      }
    ],
    "notes": "Por favor tocar el timbre dos veces",
    "can_cancel": false,
    "can_review": false,
    "created_at": "2025-11-25T13:45:00Z",
    "updated_at": "2025-11-25T14:10:00Z"
  }
}
```

#### PATCH /v1/orders/{order_id}/status
Actualizar estado del pedido (solo store_owner o admin).

**Request:**
```json
{
  "status": "in_transit",
  "notes": "Pedido salió para entrega"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "order-uuid-789",
    "status": "in_transit",
    "updated_at": "2025-11-25T14:05:00Z"
  }
}
```

#### POST /v1/orders/{order_id}/cancel
Cancelar un pedido.

**Request:**
```json
{
  "reason": "customer_request",
  "notes": "Cliente cambió de opinión"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "order-uuid-789",
    "status": "cancelled",
    "cancellation": {
      "reason": "customer_request",
      "notes": "Cliente cambió de opinión",
      "cancelled_by": "user-uuid-123",
      "cancelled_at": "2025-11-25T14:00:00Z"
    },
    "refund": {
      "status": "processing",
      "amount": 16.00,
      "expected_date": "2025-11-30T00:00:00Z"
    }
  }
}
```

---

### 3.6 Pagos

#### POST /v1/payments/create-session
Crear sesión de pago (Niubiz/Culqi).

**Request:**
```json
{
  "order_id": "order-uuid-789",
  "payment_method": "card",
  "return_url": "https://tiendi.pe/orders/order-uuid-789",
  "cancel_url": "https://tiendi.pe/checkout"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "session_id": "payment-session-123",
    "payment_url": "https://payments.niubiz.com.pe/pay/session-123",
    "expires_at": "2025-11-25T14:45:00Z",
    "order_id": "order-uuid-789",
    "amount": 16.00,
    "currency": "PEN"
  }
}
```

#### POST /v1/payments/webhook
Webhook para recibir notificaciones de pagos (Niubiz/Culqi).

**Request (Niubiz):**
```json
{
  "event": "payment.completed",
  "transaction_id": "niubiz-tx-123456",
  "order_id": "order-uuid-789",
  "amount": 16.00,
  "currency": "PEN",
  "status": "success",
  "payment_method": "card",
  "card": {
    "brand": "Visa",
    "last_four": "1234"
  },
  "timestamp": "2025-11-25T13:50:00Z"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

#### GET /v1/payments/{payment_id}
Obtener detalles de un pago.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "payment-uuid-123",
    "order_id": "order-uuid-789",
    "transaction_id": "niubiz-tx-123456",
    "amount": 16.00,
    "currency": "PEN",
    "status": "completed",
    "payment_method": "card",
    "card": {
      "brand": "Visa",
      "last_four": "1234",
      "exp_month": 12,
      "exp_year": 2026
    },
    "created_at": "2025-11-25T13:45:00Z",
    "completed_at": "2025-11-25T13:50:00Z"
  }
}
```

---

### 3.7 Búsqueda

#### GET /v1/search
Búsqueda global de productos y tiendas.

**Query Parameters:**
```
q=coca cola             # Query de búsqueda
type=products           # products, stores, all
lat=-12.1191
lng=-77.0348
radius=5
page=1
per_page=20
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prod-uuid-123",
        "name": "Coca Cola 500ml",
        "price": 3.50,
        "image_url": "https://cdn.tiendi.pe/products/coca-500-1.jpg",
        "store": {
          "id": "store-uuid-456",
          "name": "Bodega Mi Vecino",
          "distance_km": 0.8
        },
        "relevance_score": 0.95
      }
    ],
    "stores": [
      {
        "id": "store-uuid-456",
        "name": "Bodega Mi Vecino",
        "logo_url": "https://cdn.tiendi.pe/stores/logo-456.jpg",
        "rating": 4.5,
        "distance_km": 0.8,
        "relevance_score": 0.88
      }
    ]
  },
  "meta": {
    "query": "coca cola",
    "total_results": 23,
    "search_time_ms": 45
  }
}
```

---

### 3.8 Reseñas y Calificaciones

#### GET /v1/stores/{store_id}/reviews
Obtener reseñas de una tienda.

**Query Parameters:**
```
rating=5                # Filtrar por calificación
sort=recent             # recent, helpful, rating_high, rating_low
page=1
per_page=20
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "review-uuid-123",
      "user": {
        "id": "user-uuid-456",
        "name": "María L.",
        "avatar_url": "https://cdn.tiendi.pe/avatars/456.jpg",
        "total_reviews": 15
      },
      "rating": 5,
      "title": "Excelente atención",
      "comment": "Muy buena bodega, productos frescos y entrega rápida.",
      "helpful_count": 12,
      "images": [
        "https://cdn.tiendi.pe/reviews/review-123-1.jpg"
      ],
      "order_id": "order-uuid-999",
      "verified_purchase": true,
      "created_at": "2025-11-20T10:00:00Z",
      "updated_at": "2025-11-20T10:00:00Z"
    }
  ],
  "meta": {
    "total": 127,
    "average_rating": 4.5,
    "rating_distribution": {
      "5": 78,
      "4": 32,
      "3": 10,
      "2": 5,
      "1": 2
    },
    "page": 1,
    "per_page": 20
  }
}
```

#### POST /v1/orders/{order_id}/review
Crear reseña para un pedido.

**Request:**
```json
{
  "rating": 5,
  "title": "Excelente servicio",
  "comment": "Todo llegó en perfecto estado y a tiempo",
  "images": [
    "https://cdn.tiendi.pe/temp/user-upload-1.jpg"
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "review-uuid-new",
    "rating": 5,
    "title": "Excelente servicio",
    "verified_purchase": true,
    "created_at": "2025-11-25T15:00:00Z"
  }
}
```

---

### 3.9 Notificaciones

#### GET /v1/notifications
Listar notificaciones del usuario.

**Query Parameters:**
```
read=false              # Filtrar por leídas/no leídas
type=order_update       # Tipo de notificación
page=1
per_page=20
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "notif-uuid-123",
      "type": "order_update",
      "title": "Pedido en camino",
      "message": "Tu pedido #TND-2025-000123 está en camino",
      "data": {
        "order_id": "order-uuid-789",
        "order_number": "TND-2025-000123",
        "status": "in_transit"
      },
      "read": false,
      "created_at": "2025-11-25T14:05:00Z"
    },
    {
      "id": "notif-uuid-124",
      "type": "promotion",
      "title": "Descuento especial",
      "message": "20% de descuento en bebidas hoy",
      "data": {
        "store_id": "store-uuid-456",
        "promotion_code": "BEBIDAS20"
      },
      "read": true,
      "created_at": "2025-11-25T08:00:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "unread_count": 12,
    "page": 1,
    "per_page": 20
  }
}
```

#### PATCH /v1/notifications/{notification_id}/read
Marcar notificación como leída.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "notif-uuid-123",
    "read": true,
    "read_at": "2025-11-25T15:00:00Z"
  }
}
```

#### POST /v1/notifications/register-device
Registrar dispositivo para notificaciones push.

**Request:**
```json
{
  "device_id": "device-123",
  "device_type": "ios",
  "fcm_token": "fcm-token-abc123xyz",
  "device_info": {
    "model": "iPhone 14 Pro",
    "os_version": "iOS 16.0",
    "app_version": "1.2.3"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "device-registration-123",
    "device_id": "device-123",
    "registered_at": "2025-11-25T15:00:00Z"
  }
}
```

---

### 3.10 Programa de Lealtad

#### GET /v1/loyalty/points
Obtener puntos de lealtad del usuario.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user_id": "user-uuid-123",
    "total_points": 1250,
    "available_points": 1000,
    "pending_points": 250,
    "tier": "gold",
    "next_tier": "platinum",
    "points_to_next_tier": 500,
    "lifetime_points": 5000,
    "rewards_earned": 15
  }
}
```

#### GET /v1/loyalty/history
Historial de puntos de lealtad.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "loyalty-tx-123",
      "type": "earned",
      "points": 50,
      "description": "Compra en Bodega Mi Vecino",
      "order_id": "order-uuid-789",
      "created_at": "2025-11-25T14:00:00Z"
    },
    {
      "id": "loyalty-tx-124",
      "type": "redeemed",
      "points": -100,
      "description": "Descuento de S/ 10",
      "order_id": "order-uuid-788",
      "created_at": "2025-11-20T10:00:00Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "per_page": 20
  }
}
```

#### GET /v1/loyalty/rewards
Obtener recompensas disponibles.

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "reward-uuid-123",
      "title": "Descuento S/ 10",
      "description": "S/ 10 de descuento en tu próxima compra",
      "points_required": 500,
      "type": "discount",
      "value": 10.00,
      "currency": "PEN",
      "terms": "Válido por 30 días. Mínimo de compra S/ 50.",
      "available": true,
      "expires_at": "2025-12-25T23:59:59Z"
    }
  ]
}
```

#### POST /v1/loyalty/redeem
Canjear puntos por recompensa.

**Request:**
```json
{
  "reward_id": "reward-uuid-123"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "voucher-uuid-456",
    "reward_id": "reward-uuid-123",
    "code": "TIENDI-ABC123",
    "points_used": 500,
    "discount_amount": 10.00,
    "expires_at": "2025-12-25T23:59:59Z",
    "created_at": "2025-11-25T15:00:00Z"
  },
  "meta": {
    "remaining_points": 500
  }
}
```

---

## 4. Modelos de Datos

### 4.1 User

```typescript
interface User {
  id: string;                    // UUID
  email: string;                 // Único
  first_name: string;
  last_name: string;
  phone: string;
  user_type: 'customer' | 'store_owner' | 'admin';
  email_verified: boolean;
  phone_verified: boolean;
  avatar_url?: string;
  date_of_birth?: string;        // ISO 8601
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  preferences: {
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
      whatsapp: boolean;
    };
    language: string;            // es-PE, en-US
    currency: string;            // PEN, USD
  };
  addresses: Address[];
  created_at: string;            // ISO 8601
  updated_at: string;
  last_login_at?: string;
}
```

### 4.2 Store

```typescript
interface Store {
  id: string;                    // UUID
  name: string;
  slug: string;                  // Único, URL-friendly
  description: string;
  category: string;              // groceries, pharmacy, restaurant
  subcategory?: string;
  logo_url: string;
  banner_url: string;
  gallery: string[];
  owner_id: string;              // UUID del usuario propietario
  status: 'active' | 'pending_verification' | 'suspended';
  rating: number;                // 0-5
  total_reviews: number;
  address: Address;
  contact: {
    phone: string;
    email: string;
    whatsapp?: string;
  };
  schedule: {
    [day: string]: {             // monday, tuesday, etc.
      open: string;              // HH:mm
      close: string;
      closed?: boolean;
    };
  };
  delivery: {
    available: boolean;
    minimum_order: number;
    delivery_fee: number;
    free_delivery_over?: number;
    estimated_time_minutes: number;
    coverage_radius_km: number;
  };
  payment_methods: string[];     // cash, card, yape, plin
  features: string[];            // delivery, pickup, loyalty_program
  tax_info: {
    ruc: string;                 // RUC Perú
    business_name: string;
    tax_regime: string;
  };
  created_at: string;
  updated_at: string;
}
```

### 4.3 Product

```typescript
interface Product {
  id: string;                    // UUID
  store_id: string;              // UUID
  sku: string;                   // Único por tienda
  name: string;
  description: string;
  long_description?: string;
  category: string;
  subcategory?: string;
  brand?: string;
  price: number;
  compare_at_price?: number;     // Precio original para mostrar descuento
  discount_percentage?: number;
  stock: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  low_stock_threshold: number;
  images: ProductImage[];
  unit: string;                  // unit, kg, lb, pack
  weight?: number;
  weight_unit?: string;          // g, kg, ml, l
  dimensions?: {
    height: number;
    width: number;
    depth: number;
    unit: string;                // cm, in
  };
  barcode?: string;              // EAN, UPC
  tags: string[];
  nutritional_info?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    sugars?: number;
    sodium?: number;
  };
  allergens?: string[];
  rating: number;
  total_reviews: number;
  featured: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at?: string;           // Soft delete
}

interface ProductImage {
  url: string;
  alt: string;
  order: number;
  width?: number;
  height?: number;
}
```

### 4.4 Order

```typescript
interface Order {
  id: string;                    // UUID
  order_number: string;          // TND-2025-XXXXXX
  store_id: string;
  customer_id: string;
  status: OrderStatus;
  items: OrderItem[];
  delivery_address: Address;
  delivery_type: 'delivery' | 'pickup';
  pricing: {
    subtotal: number;
    delivery_fee: number;
    discount: number;
    tax: number;
    total: number;
    currency: string;            // PEN
  };
  payment: {
    method: string;              // card, cash, yape, plin
    status: PaymentStatus;
    transaction_id?: string;
    paid_at?: string;
  };
  delivery?: {
    driver_id?: string;
    driver_name?: string;
    driver_phone?: string;
    vehicle?: string;
    current_location?: {
      lat: number;
      lng: number;
      updated_at: string;
    };
    estimated_arrival?: string;
  };
  timeline: OrderTimeline[];
  notes?: string;
  cancellation?: {
    reason: string;
    notes?: string;
    cancelled_by: string;
    cancelled_at: string;
  };
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  delivered_at?: string;
}

type OrderStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded';

interface OrderItem {
  id: string;
  product_id: string;
  name: string;
  image_url?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  notes?: string;
}

interface OrderTimeline {
  status: OrderStatus;
  timestamp: string;
  message: string;
  user_id?: string;
}
```

### 4.5 Address

```typescript
interface Address {
  id: string;                    // UUID
  user_id: string;
  type: 'home' | 'work' | 'other';
  label?: string;                // "Casa de mamá", "Oficina"
  street: string;
  district: string;
  city: string;
  state?: string;
  postal_code?: string;
  country: string;               // PE
  coordinates: {
    lat: number;
    lng: number;
  };
  reference?: string;            // "Edificio blanco, 3er piso"
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
```

---

## 5. Rate Limiting

### 5.1 Límites por Endpoint

| Endpoint Category | Requests | Window | Scope |
|------------------|----------|--------|-------|
| Authentication | 5 | 15 min | IP |
| Read Operations | 100 | 1 min | User |
| Write Operations | 30 | 1 min | User |
| Search | 60 | 1 min | User |
| Webhooks | 1000 | 1 min | IP |

### 5.2 Headers de Rate Limit

Todas las respuestas incluyen headers de rate limiting:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1700000060
```

### 5.3 Respuesta de Rate Limit Excedido

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 60 seconds.",
    "retry_after": 60
  }
}
```

---

## 6. Versionado

### 6.1 Estrategia de Versionado

Tiendi utiliza versionado basado en URL:

```
/v1/products    # Versión actual
/v2/products    # Próxima versión
```

### 6.2 Política de Deprecación

1. **Anuncio**: Nuevas versiones se anuncian 90 días antes
2. **Período de Transición**: Las versiones antiguas se mantienen 180 días después del lanzamiento de la nueva versión
3. **Sunset Header**: Versiones deprecadas incluyen el header `Sunset`:

```http
Sunset: Sat, 31 Dec 2025 23:59:59 GMT
Deprecation: true
Link: <https://docs.tiendi.pe/api/migration-guide-v2>; rel="sunset"
```

### 6.3 Cambios Breaking vs Non-Breaking

**Breaking Changes** (requieren nueva versión):
- Eliminar campos de respuesta
- Cambiar tipos de datos
- Cambiar estructura de respuesta
- Eliminar endpoints
- Cambiar códigos de error

**Non-Breaking Changes** (no requieren nueva versión):
- Agregar nuevos campos opcionales
- Agregar nuevos endpoints
- Agregar nuevos parámetros opcionales
- Mensajes de error más descriptivos

---

## 7. Formatos de Error

### 7.1 Estructura de Error Estándar

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "request_id": "req-123456",
    "timestamp": "2025-11-25T15:00:00Z"
  }
}
```

### 7.2 Códigos de Error Comunes

#### Autenticación y Autorización

```json
{
  "code": "UNAUTHORIZED",
  "message": "Authentication required. Please provide a valid access token."
}
```

```json
{
  "code": "INVALID_TOKEN",
  "message": "The provided access token is invalid or expired."
}
```

```json
{
  "code": "FORBIDDEN",
  "message": "You don't have permission to access this resource."
}
```

#### Validación

```json
{
  "code": "VALIDATION_ERROR",
  "message": "The request contains invalid data.",
  "details": {
    "fields": {
      "email": ["Email is required", "Email format is invalid"],
      "password": ["Password must be at least 8 characters"]
    }
  }
}
```

#### Recursos

```json
{
  "code": "RESOURCE_NOT_FOUND",
  "message": "The requested product was not found.",
  "details": {
    "resource_type": "product",
    "resource_id": "prod-uuid-123"
  }
}
```

```json
{
  "code": "RESOURCE_CONFLICT",
  "message": "A product with this SKU already exists.",
  "details": {
    "field": "sku",
    "value": "COCA-500-001"
  }
}
```

#### Negocio

```json
{
  "code": "INSUFFICIENT_STOCK",
  "message": "Not enough stock available for this product.",
  "details": {
    "product_id": "prod-uuid-123",
    "requested_quantity": 10,
    "available_stock": 5
  }
}
```

```json
{
  "code": "MINIMUM_ORDER_NOT_MET",
  "message": "Order total doesn't meet the minimum order requirement.",
  "details": {
    "current_total": 12.50,
    "minimum_required": 15.00,
    "difference": 2.50
  }
}
```

```json
{
  "code": "PAYMENT_FAILED",
  "message": "Payment processing failed.",
  "details": {
    "payment_method": "card",
    "reason": "insufficient_funds"
  }
}
```

#### Sistema

```json
{
  "code": "INTERNAL_SERVER_ERROR",
  "message": "An unexpected error occurred. Please try again later.",
  "request_id": "req-123456"
}
```

```json
{
  "code": "SERVICE_UNAVAILABLE",
  "message": "The service is temporarily unavailable. Please try again in a few minutes.",
  "retry_after": 300
}
```

---

## 8. Webhooks

### 8.1 Eventos Disponibles

Tiendi puede enviar webhooks para los siguientes eventos:

| Evento | Descripción |
|--------|-------------|
| `order.created` | Nuevo pedido creado |
| `order.confirmed` | Pedido confirmado (pago exitoso) |
| `order.preparing` | Pedido en preparación |
| `order.ready_for_pickup` | Pedido listo para recoger |
| `order.in_transit` | Pedido en camino |
| `order.delivered` | Pedido entregado |
| `order.cancelled` | Pedido cancelado |
| `payment.completed` | Pago completado |
| `payment.failed` | Pago fallido |
| `payment.refunded` | Pago reembolsado |
| `product.out_of_stock` | Producto sin stock |
| `review.created` | Nueva reseña creada |

### 8.2 Configurar Webhooks

#### POST /v1/webhooks
Crear un nuevo webhook.

**Request:**
```json
{
  "url": "https://yourapp.com/webhooks/tiendi",
  "events": ["order.created", "order.confirmed", "payment.completed"],
  "secret": "whsec_your_secret_key_here",
  "active": true
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "webhook-uuid-123",
    "url": "https://yourapp.com/webhooks/tiendi",
    "events": ["order.created", "order.confirmed", "payment.completed"],
    "active": true,
    "created_at": "2025-11-25T15:00:00Z"
  }
}
```

### 8.3 Formato de Payload

```json
{
  "id": "evt-uuid-123",
  "event": "order.confirmed",
  "created_at": "2025-11-25T15:00:00Z",
  "data": {
    "object": "order",
    "id": "order-uuid-789",
    "order_number": "TND-2025-000123",
    "status": "confirmed",
    "total": 16.00,
    "currency": "PEN",
    "store_id": "store-uuid-456",
    "customer_id": "user-uuid-123"
  }
}
```

### 8.4 Verificación de Firma

Todos los webhooks incluyen un header `X-Tiendi-Signature` para verificar autenticidad:

```typescript
import crypto from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Uso en Express
app.post('/webhooks/tiendi', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-tiendi-signature'] as string;
  const payload = req.body.toString();
  const secret = process.env.WEBHOOK_SECRET;

  if (!verifyWebhookSignature(payload, signature, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Procesar webhook
  const event = JSON.parse(payload);
  console.log('Received event:', event.event);

  res.json({ received: true });
});
```

### 8.5 Reintentos

Si el webhook falla (código HTTP != 2xx), Tiendi reintentará con el siguiente esquema:

1. Inmediatamente
2. 5 minutos después
3. 30 minutos después
4. 2 horas después
5. 12 horas después

Después de 5 intentos fallidos, el webhook se marca como fallido y se notifica al propietario.

---

## 9. SDKs y Librerías

### 9.1 SDK Oficial JavaScript/TypeScript

```bash
npm install @tiendi/sdk
```

**Inicialización:**
```typescript
import { TiendiClient } from '@tiendi/sdk';

const tiendi = new TiendiClient({
  apiKey: process.env.TIENDI_API_KEY,
  environment: 'production', // 'production' | 'staging' | 'development'
});
```

**Ejemplos de Uso:**

```typescript
// Listar tiendas cercanas
const stores = await tiendi.stores.list({
  lat: -12.1191,
  lng: -77.0348,
  radius: 5,
});

// Obtener productos de una tienda
const products = await tiendi.products.list('store-uuid-456', {
  category: 'beverages',
  in_stock: true,
});

// Crear un pedido
const order = await tiendi.orders.create({
  store_id: 'store-uuid-456',
  delivery_address_id: 'addr-123',
  items: [
    { product_id: 'prod-uuid-123', quantity: 2 },
  ],
  payment_method: 'card',
});

// Escuchar eventos en tiempo real (WebSocket)
tiendi.on('order.updated', (data) => {
  console.log('Order updated:', data);
});
```

### 9.2 SDK Python

```bash
pip install tiendi-python
```

**Uso:**
```python
from tiendi import TiendiClient

tiendi = TiendiClient(api_key='your_api_key')

# Listar tiendas
stores = tiendi.stores.list(
    lat=-12.1191,
    lng=-77.0348,
    radius=5
)

# Crear pedido
order = tiendi.orders.create(
    store_id='store-uuid-456',
    items=[
        {'product_id': 'prod-uuid-123', 'quantity': 2}
    ],
    payment_method='card'
)
```

### 9.3 Ejemplos de Código

Repositorio de ejemplos: https://github.com/tiendi/api-examples

- Node.js + Express
- React Native
- Flutter
- Python Flask
- PHP Laravel

---

## 10. Ambientes

### 10.1 URLs de Ambiente

| Ambiente | API Base URL | Web Dashboard |
|----------|-------------|---------------|
| Production | `https://api.tiendi.pe/v1` | `https://dashboard.tiendi.pe` |
| Staging | `https://api-staging.tiendi.pe/v1` | `https://dashboard-staging.tiendi.pe` |
| Development | `https://api-dev.tiendi.pe/v1` | `https://dashboard-dev.tiendi.pe` |

### 10.2 Claves de API

**Formato:**
- Production: `tiendi_live_sk_*`
- Staging: `tiendi_test_sk_*`
- Development: `tiendi_dev_sk_*`

**Obtener Claves:**
1. Ingresar al Dashboard
2. Navegar a Settings > API Keys
3. Crear nueva clave con los scopes necesarios

### 10.3 Datos de Prueba (Staging)

**Usuarios de Prueba:**
```
Cliente:
email: test.customer@tiendi.pe
password: TestCustomer123!

Vendedor:
email: test.vendor@tiendi.pe
password: TestVendor123!
```

**Tarjetas de Prueba (Niubiz Sandbox):**
```
Visa Exitosa:
Número: 4111111111111111
CVV: 123
Fecha: 12/26

Visa Rechazada:
Número: 4000000000000002
CVV: 123
Fecha: 12/26
```

---

## Recursos Adicionales

- **Documentación Interactiva (Swagger)**: https://api.tiendi.pe/docs
- **Postman Collection**: https://www.postman.com/tiendi/workspace/tiendi-api
- **Status Page**: https://status.tiendi.pe
- **Developer Forum**: https://forum.tiendi.pe
- **Support Email**: api-support@tiendi.pe

---

## Changelog

### v1.0.0 (2025-11-25)
- Lanzamiento inicial de la API
- Endpoints de autenticación, tiendas, productos, pedidos
- Webhooks para eventos principales
- Rate limiting y versionado

---

**Última actualización**: 2025-11-25
**Versión de API**: v1.0.0
