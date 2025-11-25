# Diagrama de Componentes - Sistema Tiendi

Este documento contiene los diagramas de componentes que muestran la estructura modular del sistema Tiendi y las relaciones entre componentes.

---

## 1. Diagrama de Componentes - Vista General

```mermaid
graph TB
    subgraph "Cliente Layer"
        WEB_APP[Web Application<br/>Next.js]
        MOBILE_APP[Mobile App<br/>React Native]
        PWA[Progressive Web App]
    end

    subgraph "API Gateway Layer"
        API_GW[API Gateway Component]
        AUTH_MW[Authentication Middleware]
        RATE_LIM[Rate Limiter]
        LOGGER[Request Logger]
    end

    subgraph "Business Logic Layer"
        USER_SVC[User Service Component]
        STORE_SVC[Store Service Component]
        PRODUCT_SVC[Product Service Component]
        ORDER_SVC[Order Service Component]
        PAYMENT_SVC[Payment Service Component]
        CHAT_SVC[Chat Service Component]
        NOTIF_SVC[Notification Service Component]
        SEARCH_SVC[Search Service Component]
    end

    subgraph "Data Access Layer"
        USER_REPO[User Repository]
        STORE_REPO[Store Repository]
        PRODUCT_REPO[Product Repository]
        ORDER_REPO[Order Repository]
        PAYMENT_REPO[Payment Repository]
        CHAT_REPO[Chat Repository]
    end

    subgraph "Data Storage Layer"
        POSTGRES[(PostgreSQL)]
        MONGODB[(MongoDB)]
        REDIS[(Redis Cache)]
        ELASTIC[(Elasticsearch)]
    end

    subgraph "External Services Layer"
        MAPS_API[Google Maps API]
        PAYMENT_GW[Payment Gateway]
        EMAIL_SVC[Email Service]
        WHATSAPP[WhatsApp API]
        FCM[Firebase FCM]
    end

    subgraph "Infrastructure Layer"
        QUEUE[Message Queue]
        WORKER[Background Workers]
        MONITOR[Monitoring System]
        LOGS[Logging System]
    end

    %% Connections - Client to Gateway
    WEB_APP --> API_GW
    MOBILE_APP --> API_GW
    PWA --> API_GW

    %% Gateway to Middleware
    API_GW --> AUTH_MW
    API_GW --> RATE_LIM
    API_GW --> LOGGER

    %% Middleware to Services
    AUTH_MW --> USER_SVC
    AUTH_MW --> STORE_SVC
    AUTH_MW --> PRODUCT_SVC
    AUTH_MW --> ORDER_SVC
    AUTH_MW --> PAYMENT_SVC
    AUTH_MW --> CHAT_SVC
    AUTH_MW --> NOTIF_SVC
    AUTH_MW --> SEARCH_SVC

    %% Services to Repositories
    USER_SVC --> USER_REPO
    STORE_SVC --> STORE_REPO
    PRODUCT_SVC --> PRODUCT_REPO
    ORDER_SVC --> ORDER_REPO
    PAYMENT_SVC --> PAYMENT_REPO
    CHAT_SVC --> CHAT_REPO

    %% Repositories to Databases
    USER_REPO --> POSTGRES
    STORE_REPO --> POSTGRES
    PRODUCT_REPO --> POSTGRES
    ORDER_REPO --> POSTGRES
    PAYMENT_REPO --> POSTGRES
    CHAT_REPO --> MONGODB

    %% Services to Cache
    USER_SVC --> REDIS
    PRODUCT_SVC --> REDIS
    ORDER_SVC --> REDIS

    %% Services to Search
    PRODUCT_SVC --> ELASTIC
    STORE_SVC --> ELASTIC
    SEARCH_SVC --> ELASTIC

    %% Services to External APIs
    STORE_SVC --> MAPS_API
    SEARCH_SVC --> MAPS_API
    PAYMENT_SVC --> PAYMENT_GW
    NOTIF_SVC --> EMAIL_SVC
    NOTIF_SVC --> FCM
    CHAT_SVC --> WHATSAPP

    %% Services to Infrastructure
    ORDER_SVC --> QUEUE
    PAYMENT_SVC --> QUEUE
    NOTIF_SVC --> QUEUE
    QUEUE --> WORKER

    API_GW --> MONITOR
    USER_SVC --> LOGS
    ORDER_SVC --> LOGS
```

---

## 2. Componentes del Backend - User Service

```mermaid
graph TB
    subgraph "User Service Component"
        subgraph "Controllers Layer"
            USER_CTRL[UserController]
            AUTH_CTRL[AuthController]
            PROFILE_CTRL[ProfileController]
        end

        subgraph "Business Logic Layer"
            USER_SVC[UserService]
            AUTH_SVC[AuthService]
            PROFILE_SVC[ProfileService]
        end

        subgraph "Domain Layer"
            USER_ENT[User Entity]
            TOKEN_ENT[Token Entity]
            SESSION_ENT[Session Entity]
        end

        subgraph "Data Access Layer"
            USER_REPO[UserRepository]
            TOKEN_REPO[TokenRepository]
            SESSION_REPO[SessionRepository]
        end

        subgraph "External Integrations"
            OAUTH[OAuth Provider]
            EMAIL[Email Service]
            CACHE[Redis Cache]
        end
    end

    USER_CTRL --> USER_SVC
    AUTH_CTRL --> AUTH_SVC
    PROFILE_CTRL --> PROFILE_SVC

    USER_SVC --> USER_ENT
    AUTH_SVC --> TOKEN_ENT
    AUTH_SVC --> SESSION_ENT
    PROFILE_SVC --> USER_ENT

    USER_SVC --> USER_REPO
    AUTH_SVC --> TOKEN_REPO
    AUTH_SVC --> SESSION_REPO

    USER_REPO --> DB[(Database)]
    TOKEN_REPO --> DB
    SESSION_REPO --> CACHE

    AUTH_SVC --> OAUTH
    PROFILE_SVC --> EMAIL
```

---

## 3. Componentes del Backend - Order Service

```mermaid
graph TB
    subgraph "Order Service Component"
        subgraph "API Layer"
            ORDER_CTRL[OrderController]
            CART_CTRL[CartController]
            CHECKOUT_CTRL[CheckoutController]
        end

        subgraph "Business Logic"
            ORDER_SVC[OrderService]
            CART_SVC[CartService]
            CHECKOUT_SVC[CheckoutService]
            STATUS_SVC[OrderStatusService]
        end

        subgraph "Domain Models"
            ORDER_ENT[Order Entity]
            ORDER_ITEM[OrderItem Entity]
            CART_ENT[Cart Entity]
            STATUS_ENT[OrderStatus Entity]
        end

        subgraph "Repositories"
            ORDER_REPO[OrderRepository]
            CART_REPO[CartRepository]
            STATUS_REPO[StatusRepository]
        end

        subgraph "Event Publishers"
            ORDER_EVENTS[Order Events Publisher]
        end

        subgraph "External Services"
            PRODUCT_API[Product Service API]
            PAYMENT_API[Payment Service API]
            NOTIF_API[Notification Service API]
        end
    end

    ORDER_CTRL --> ORDER_SVC
    CART_CTRL --> CART_SVC
    CHECKOUT_CTRL --> CHECKOUT_SVC

    ORDER_SVC --> ORDER_ENT
    ORDER_SVC --> ORDER_ITEM
    CART_SVC --> CART_ENT
    ORDER_SVC --> STATUS_ENT

    ORDER_SVC --> ORDER_REPO
    CART_SVC --> CART_REPO
    ORDER_SVC --> STATUS_REPO

    ORDER_REPO --> DB[(PostgreSQL)]
    CART_REPO --> CACHE[(Redis)]

    CHECKOUT_SVC --> PRODUCT_API
    CHECKOUT_SVC --> PAYMENT_API
    ORDER_SVC --> ORDER_EVENTS

    ORDER_EVENTS --> QUEUE[Message Queue]
    QUEUE --> NOTIF_API
```

---

## 4. Componentes del Frontend - Web Application

```mermaid
graph TB
    subgraph "Web Application Component"
        subgraph "Presentation Layer"
            PAGES[Pages/Routes]
            LAYOUTS[Layouts]
            COMPONENTS[UI Components]
        end

        subgraph "State Management"
            REDUX[Redux Store]
            SLICES[State Slices]
            REACT_QUERY[React Query]
        end

        subgraph "Business Logic"
            HOOKS[Custom Hooks]
            SERVICES[API Services]
            UTILS[Utilities]
        end

        subgraph "Integration Layer"
            API_CLIENT[API Client]
            SOCKET_CLIENT[WebSocket Client]
            MAP_CLIENT[Maps Client]
            AUTH_CLIENT[Auth Client]
        end

        subgraph "External Libraries"
            MAPS_LIB[Google Maps SDK]
            SOCKET_LIB[Socket.io Client]
            PAYMENT_LIB[Payment SDK]
        end
    end

    PAGES --> COMPONENTS
    PAGES --> LAYOUTS
    COMPONENTS --> HOOKS

    HOOKS --> REDUX
    HOOKS --> REACT_QUERY
    HOOKS --> SERVICES

    REDUX --> SLICES

    SERVICES --> API_CLIENT
    SERVICES --> SOCKET_CLIENT
    SERVICES --> MAP_CLIENT
    SERVICES --> AUTH_CLIENT

    API_CLIENT --> BACKEND[Backend API]
    SOCKET_CLIENT --> SOCKET_LIB
    MAP_CLIENT --> MAPS_LIB
    AUTH_CLIENT --> BACKEND

    SOCKET_CLIENT --> WS_SERVER[WebSocket Server]
```

---

## 5. Componentes del Frontend - Feature Modules

```mermaid
graph TB
    subgraph "Authentication Module"
        LOGIN_PAGE[Login Page]
        REGISTER_PAGE[Register Page]
        AUTH_FORM[Auth Forms]
        AUTH_HOOK[useAuth Hook]
        AUTH_SERVICE[Auth Service]
    end

    subgraph "Product Catalog Module"
        CATALOG_PAGE[Catalog Page]
        PRODUCT_DETAIL[Product Detail]
        PRODUCT_CARD[Product Card]
        PRODUCT_HOOK[useProducts Hook]
        PRODUCT_SERVICE[Product Service]
    end

    subgraph "Shopping Cart Module"
        CART_PAGE[Cart Page]
        CART_SIDEBAR[Cart Sidebar]
        CART_ITEM[Cart Item]
        CART_HOOK[useCart Hook]
        CART_SERVICE[Cart Service]
    end

    subgraph "Checkout Module"
        CHECKOUT_PAGE[Checkout Page]
        DELIVERY_FORM[Delivery Form]
        PAYMENT_FORM[Payment Form]
        CHECKOUT_HOOK[useCheckout Hook]
        ORDER_SERVICE[Order Service]
    end

    subgraph "Chat Module"
        CHAT_PAGE[Chat Page]
        CHAT_WIDGET[Chat Widget]
        MESSAGE_LIST[Message List]
        CHAT_HOOK[useChat Hook]
        SOCKET_SERVICE[Socket Service]
    end

    LOGIN_PAGE --> AUTH_FORM
    AUTH_FORM --> AUTH_HOOK
    AUTH_HOOK --> AUTH_SERVICE
    AUTH_SERVICE --> API[API Backend]

    CATALOG_PAGE --> PRODUCT_CARD
    PRODUCT_CARD --> PRODUCT_HOOK
    PRODUCT_HOOK --> PRODUCT_SERVICE
    PRODUCT_SERVICE --> API

    CART_PAGE --> CART_ITEM
    CART_SIDEBAR --> CART_ITEM
    CART_ITEM --> CART_HOOK
    CART_HOOK --> CART_SERVICE
    CART_SERVICE --> API

    CHECKOUT_PAGE --> DELIVERY_FORM
    CHECKOUT_PAGE --> PAYMENT_FORM
    PAYMENT_FORM --> CHECKOUT_HOOK
    CHECKOUT_HOOK --> ORDER_SERVICE
    ORDER_SERVICE --> API

    CHAT_PAGE --> CHAT_WIDGET
    CHAT_WIDGET --> MESSAGE_LIST
    MESSAGE_LIST --> CHAT_HOOK
    CHAT_HOOK --> SOCKET_SERVICE
    SOCKET_SERVICE --> WS[WebSocket Server]
```

---

## 6. Componentes de Infraestructura

```mermaid
graph TB
    subgraph "Infrastructure Components"
        subgraph "Container Orchestration"
            K8S[Kubernetes Cluster]
            INGRESS[Ingress Controller]
            SERVICE_MESH[Service Mesh<br/>Istio/Linkerd]
        end

        subgraph "Monitoring Stack"
            PROMETHEUS[Prometheus]
            GRAFANA[Grafana]
            ALERTMANAGER[Alert Manager]
        end

        subgraph "Logging Stack"
            FILEBEAT[Filebeat]
            LOGSTASH[Logstash]
            ELASTICSEARCH[Elasticsearch]
            KIBANA[Kibana]
        end

        subgraph "Tracing"
            JAEGER[Jaeger]
            ZIPKIN[Zipkin]
        end

        subgraph "Message Queue"
            RABBITMQ[RabbitMQ]
            KAFKA[Apache Kafka]
        end

        subgraph "Cache & Session"
            REDIS_CLUSTER[Redis Cluster]
            MEMCACHED[Memcached]
        end

        subgraph "Storage"
            PV[Persistent Volumes]
            S3[Object Storage S3]
        end
    end

    K8S --> INGRESS
    K8S --> SERVICE_MESH

    APPS[Applications] --> K8S
    APPS --> PROMETHEUS
    APPS --> FILEBEAT
    APPS --> JAEGER

    PROMETHEUS --> GRAFANA
    PROMETHEUS --> ALERTMANAGER

    FILEBEAT --> LOGSTASH
    LOGSTASH --> ELASTICSEARCH
    ELASTICSEARCH --> KIBANA

    APPS --> RABBITMQ
    APPS --> REDIS_CLUSTER

    APPS --> S3
    K8S --> PV
```

---

## 7. Componentes por Microservicio - Product Service

```mermaid
graph TB
    subgraph "Product Service Component Architecture"
        subgraph "API Layer"
            PRODUCT_CTRL[Product Controller]
            CATEGORY_CTRL[Category Controller]
            BRAND_CTRL[Brand Controller]
        end

        subgraph "Application Layer"
            PRODUCT_SVC[Product Service]
            CATEGORY_SVC[Category Service]
            INVENTORY_SVC[Inventory Service]
            PRICING_SVC[Pricing Service]
        end

        subgraph "Domain Layer"
            PRODUCT_AGG[Product Aggregate]
            CATEGORY_ENT[Category Entity]
            BRAND_ENT[Brand Entity]
            PRICE_VO[Price Value Object]
            DISCOUNT_VO[Discount Value Object]
        end

        subgraph "Infrastructure Layer"
            PRODUCT_REPO[Product Repository]
            CACHE_REPO[Cache Repository]
            SEARCH_REPO[Search Repository]
        end

        subgraph "Event Layer"
            PRODUCT_EVENTS[Product Events]
            EVENT_BUS[Event Bus]
        end
    end

    PRODUCT_CTRL --> PRODUCT_SVC
    CATEGORY_CTRL --> CATEGORY_SVC
    BRAND_CTRL --> CATEGORY_SVC

    PRODUCT_SVC --> PRODUCT_AGG
    PRODUCT_SVC --> INVENTORY_SVC
    PRODUCT_SVC --> PRICING_SVC

    CATEGORY_SVC --> CATEGORY_ENT
    CATEGORY_SVC --> BRAND_ENT

    PRICING_SVC --> PRICE_VO
    PRICING_SVC --> DISCOUNT_VO

    PRODUCT_SVC --> PRODUCT_REPO
    PRODUCT_SVC --> CACHE_REPO
    PRODUCT_SVC --> SEARCH_REPO

    PRODUCT_REPO --> DB[(PostgreSQL)]
    CACHE_REPO --> REDIS[(Redis)]
    SEARCH_REPO --> ELASTIC[(Elasticsearch)]

    PRODUCT_SVC --> PRODUCT_EVENTS
    PRODUCT_EVENTS --> EVENT_BUS
    EVENT_BUS --> QUEUE[Message Queue]
```

---

## 8. Componentes de Integración - Payment Service

```mermaid
graph TB
    subgraph "Payment Service Component"
        subgraph "API Layer"
            PAYMENT_CTRL[Payment Controller]
        end

        subgraph "Business Logic"
            PAYMENT_SVC[Payment Service]
            CARD_PROCESSOR[Card Processor]
            TRANSFER_PROCESSOR[Transfer Processor]
            CASH_PROCESSOR[Cash Processor]
        end

        subgraph "Payment Adapters"
            VISA_ADAPTER[Visa Adapter]
            MASTERCARD_ADAPTER[Mastercard Adapter]
            PAYPAL_ADAPTER[PayPal Adapter]
        end

        subgraph "Security Components"
            ENCRYPTION[Encryption Service]
            TOKENIZATION[Tokenization Service]
            PCI_COMPLIANCE[PCI Compliance Module]
        end

        subgraph "Repositories"
            PAYMENT_REPO[Payment Repository]
            TRANSACTION_REPO[Transaction Repository]
        end

        subgraph "External Gateways"
            VISA_GW[Visa Gateway]
            MASTERCARD_GW[Mastercard Gateway]
            PAYPAL_GW[PayPal Gateway]
        end
    end

    PAYMENT_CTRL --> PAYMENT_SVC

    PAYMENT_SVC --> CARD_PROCESSOR
    PAYMENT_SVC --> TRANSFER_PROCESSOR
    PAYMENT_SVC --> CASH_PROCESSOR

    CARD_PROCESSOR --> VISA_ADAPTER
    CARD_PROCESSOR --> MASTERCARD_ADAPTER
    CARD_PROCESSOR --> PAYPAL_ADAPTER

    VISA_ADAPTER --> ENCRYPTION
    MASTERCARD_ADAPTER --> TOKENIZATION
    CARD_PROCESSOR --> PCI_COMPLIANCE

    PAYMENT_SVC --> PAYMENT_REPO
    PAYMENT_SVC --> TRANSACTION_REPO

    PAYMENT_REPO --> DB[(PostgreSQL)]
    TRANSACTION_REPO --> DB

    VISA_ADAPTER --> VISA_GW
    MASTERCARD_ADAPTER --> MASTERCARD_GW
    PAYPAL_ADAPTER --> PAYPAL_GW
```

---

## 9. Componentes de Comunicación - Chat Service

```mermaid
graph TB
    subgraph "Chat Service Component"
        subgraph "WebSocket Layer"
            WS_SERVER[WebSocket Server]
            WS_HANDLER[Connection Handler]
            WS_AUTH[WebSocket Auth]
        end

        subgraph "Business Logic"
            CHAT_SVC[Chat Service]
            MESSAGE_SVC[Message Service]
            ROOM_SVC[Room Service]
            TYPING_SVC[Typing Indicator Service]
        end

        subgraph "Domain Layer"
            MESSAGE_ENT[Message Entity]
            ROOM_ENT[Room Entity]
            PARTICIPANT_ENT[Participant Entity]
        end

        subgraph "Data Access"
            MESSAGE_REPO[Message Repository]
            ROOM_REPO[Room Repository]
        end

        subgraph "PubSub Layer"
            REDIS_PUBSUB[Redis Pub/Sub]
            EVENT_EMITTER[Event Emitter]
        end

        subgraph "Storage"
            MONGODB[(MongoDB)]
            REDIS[(Redis Cache)]
        end
    end

    WS_SERVER --> WS_HANDLER
    WS_HANDLER --> WS_AUTH
    WS_AUTH --> CHAT_SVC

    CHAT_SVC --> MESSAGE_SVC
    CHAT_SVC --> ROOM_SVC
    CHAT_SVC --> TYPING_SVC

    MESSAGE_SVC --> MESSAGE_ENT
    ROOM_SVC --> ROOM_ENT
    ROOM_SVC --> PARTICIPANT_ENT

    MESSAGE_SVC --> MESSAGE_REPO
    ROOM_SVC --> ROOM_REPO

    MESSAGE_REPO --> MONGODB
    ROOM_REPO --> REDIS

    MESSAGE_SVC --> REDIS_PUBSUB
    TYPING_SVC --> REDIS_PUBSUB
    REDIS_PUBSUB --> EVENT_EMITTER
    EVENT_EMITTER --> WS_SERVER
```

---

## 10. Componentes de Búsqueda - Search Service

```mermaid
graph TB
    subgraph "Search Service Component"
        subgraph "API Layer"
            SEARCH_CTRL[Search Controller]
            AUTOCOMPLETE_CTRL[Autocomplete Controller]
            FILTER_CTRL[Filter Controller]
        end

        subgraph "Business Logic"
            SEARCH_SVC[Search Service]
            INDEX_SVC[Indexing Service]
            QUERY_BUILDER[Query Builder]
            RELEVANCE_SVC[Relevance Service]
        end

        subgraph "Search Strategy"
            TEXT_SEARCH[Text Search Strategy]
            GEO_SEARCH[Geo Search Strategy]
            FACETED_SEARCH[Faceted Search Strategy]
            FUZZY_SEARCH[Fuzzy Search Strategy]
        end

        subgraph "Data Sync"
            SYNC_WORKER[Sync Worker]
            REINDEX_WORKER[Reindex Worker]
        end

        subgraph "Storage"
            ELASTIC[(Elasticsearch)]
            REDIS[(Redis Cache)]
            POSTGRES[(PostgreSQL)]
        end
    end

    SEARCH_CTRL --> SEARCH_SVC
    AUTOCOMPLETE_CTRL --> SEARCH_SVC
    FILTER_CTRL --> SEARCH_SVC

    SEARCH_SVC --> QUERY_BUILDER
    SEARCH_SVC --> RELEVANCE_SVC

    QUERY_BUILDER --> TEXT_SEARCH
    QUERY_BUILDER --> GEO_SEARCH
    QUERY_BUILDER --> FACETED_SEARCH
    QUERY_BUILDER --> FUZZY_SEARCH

    TEXT_SEARCH --> ELASTIC
    GEO_SEARCH --> ELASTIC
    FACETED_SEARCH --> ELASTIC

    SEARCH_SVC --> REDIS
    INDEX_SVC --> ELASTIC

    SYNC_WORKER --> POSTGRES
    SYNC_WORKER --> ELASTIC
    REINDEX_WORKER --> ELASTIC
```

---

## 11. Componentes de Notificación - Notification Service

```mermaid
graph TB
    subgraph "Notification Service Component"
        subgraph "API Layer"
            NOTIF_CTRL[Notification Controller]
        end

        subgraph "Business Logic"
            NOTIF_SVC[Notification Service]
            TEMPLATE_SVC[Template Service]
            PREFERENCE_SVC[Preference Service]
        end

        subgraph "Channel Handlers"
            EMAIL_HANDLER[Email Handler]
            PUSH_HANDLER[Push Handler]
            SMS_HANDLER[SMS Handler]
            WHATSAPP_HANDLER[WhatsApp Handler]
        end

        subgraph "Queue Consumers"
            NOTIF_CONSUMER[Notification Consumer]
            RETRY_CONSUMER[Retry Consumer]
        end

        subgraph "Templates"
            EMAIL_TMPL[Email Templates]
            PUSH_TMPL[Push Templates]
            SMS_TMPL[SMS Templates]
        end

        subgraph "External Services"
            SENDGRID[SendGrid]
            FCM[Firebase FCM]
            TWILIO[Twilio]
            WHATSAPP_API[WhatsApp Business API]
        end

        subgraph "Storage"
            QUEUE[Message Queue]
            DB[(PostgreSQL)]
        end
    end

    NOTIF_CTRL --> NOTIF_SVC
    NOTIF_SVC --> TEMPLATE_SVC
    NOTIF_SVC --> PREFERENCE_SVC

    NOTIF_SVC --> QUEUE
    QUEUE --> NOTIF_CONSUMER

    NOTIF_CONSUMER --> EMAIL_HANDLER
    NOTIF_CONSUMER --> PUSH_HANDLER
    NOTIF_CONSUMER --> SMS_HANDLER
    NOTIF_CONSUMER --> WHATSAPP_HANDLER

    EMAIL_HANDLER --> EMAIL_TMPL
    PUSH_HANDLER --> PUSH_TMPL
    SMS_HANDLER --> SMS_TMPL

    EMAIL_HANDLER --> SENDGRID
    PUSH_HANDLER --> FCM
    SMS_HANDLER --> TWILIO
    WHATSAPP_HANDLER --> WHATSAPP_API

    TEMPLATE_SVC --> DB
    PREFERENCE_SVC --> DB
```

---

## 12. Diagrama C4 - Context Level

```mermaid
graph TB
    subgraph "External Users"
        CUSTOMER[Customer]
        STORE_OWNER[Store Owner]
        ADMIN[Administrator]
    end

    subgraph "Tiendi System"
        SYSTEM[Tiendi E-commerce Platform]
    end

    subgraph "External Systems"
        MAPS[Google Maps]
        PAYMENT[Payment Gateways<br/>Visa/Mastercard/PayPal]
        EMAIL[Email Service<br/>SendGrid]
        WHATSAPP[WhatsApp Business]
        SMS[SMS Service<br/>Twilio]
    end

    CUSTOMER -->|Browse products,<br/>Place orders,<br/>Chat with stores| SYSTEM
    STORE_OWNER -->|Manage products,<br/>Process orders,<br/>Chat with customers| SYSTEM
    ADMIN -->|Manage system,<br/>View analytics,<br/>Configure settings| SYSTEM

    SYSTEM -->|Get location data,<br/>Display maps| MAPS
    SYSTEM -->|Process payments| PAYMENT
    SYSTEM -->|Send transactional emails| EMAIL
    SYSTEM -->|Send messages| WHATSAPP
    SYSTEM -->|Send SMS notifications| SMS
```

---

## 13. Diagrama de Dependencias entre Componentes

```mermaid
graph LR
    subgraph "Core Components"
        AUTH[Auth Component]
        USER[User Component]
    end

    subgraph "Business Components"
        STORE[Store Component]
        PRODUCT[Product Component]
        ORDER[Order Component]
        CART[Cart Component]
    end

    subgraph "Support Components"
        PAYMENT[Payment Component]
        NOTIF[Notification Component]
        CHAT[Chat Component]
        SEARCH[Search Component]
    end

    USER --> AUTH
    STORE --> AUTH
    PRODUCT --> STORE
    CART --> PRODUCT
    CART --> USER
    ORDER --> CART
    ORDER --> USER
    ORDER --> PAYMENT
    PAYMENT --> NOTIF
    ORDER --> NOTIF
    CHAT --> ORDER
    CHAT --> USER
    SEARCH --> PRODUCT
    SEARCH --> STORE
```

---

## Descripción de Componentes Principales

### Componentes de Negocio

#### User Component
- **Responsabilidad**: Gestión de usuarios y perfiles
- **Interfaces**: UserController, AuthController
- **Dependencias**: Auth Component, Email Service
- **Tecnologías**: NestJS, TypeORM, JWT

#### Product Component
- **Responsabilidad**: Catálogo de productos
- **Interfaces**: ProductController, CategoryController
- **Dependencias**: Store Component, Search Component
- **Tecnologías**: NestJS, TypeORM, Elasticsearch

#### Order Component
- **Responsabilidad**: Gestión de pedidos
- **Interfaces**: OrderController, CheckoutController
- **Dependencias**: Cart, Payment, Notification
- **Tecnologías**: NestJS, TypeORM, RabbitMQ

#### Payment Component
- **Responsabilidad**: Procesamiento de pagos
- **Interfaces**: PaymentController
- **Dependencias**: Payment Gateways
- **Tecnologías**: NestJS, Stripe/PayPal SDK

### Componentes de Soporte

#### Chat Component
- **Responsabilidad**: Mensajería en tiempo real
- **Interfaces**: WebSocket Server
- **Dependencias**: Order Component, User Component
- **Tecnologías**: Socket.io, MongoDB, Redis Pub/Sub

#### Search Component
- **Responsabilidad**: Búsqueda y filtrado
- **Interfaces**: SearchController
- **Dependencias**: Product, Store
- **Tecnologías**: Elasticsearch, Redis

#### Notification Component
- **Responsabilidad**: Envío de notificaciones
- **Interfaces**: NotificationController
- **Dependencias**: Email Service, FCM, Twilio
- **Tecnologías**: NestJS, Bull Queue, SendGrid

---

## Principios de Diseño de Componentes

### 1. Single Responsibility
Cada componente tiene una única responsabilidad bien definida.

### 2. Dependency Inversion
Los componentes dependen de abstracciones (interfaces), no de implementaciones concretas.

### 3. Interface Segregation
Interfaces específicas para cada cliente en lugar de una interfaz general.

### 4. Low Coupling
Minimizar dependencias entre componentes.

### 5. High Cohesion
Agrupar funcionalidad relacionada dentro del mismo componente.

### 6. Separation of Concerns
Separar responsabilidades en capas: API, Business Logic, Data Access.

---

**Fecha de creación:** 2025-11-24
**Versión:** 1.0
