# Diagramas de Secuencia - Sistema de Chat - Sistema Tiendi

Este documento contiene los diagramas de secuencia relacionados con el sistema de mensajería y chat en tiempo real.

---

## 1. Secuencia de Chat en Tiempo Real

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Socket as Socket.io Server
    participant Chat as Chat Service
    participant Store as Store App
    participant MongoDB as MongoDB
    participant Redis as Redis PubSub
    participant Notif as Notification Service

    User->>Web: Abrir chat con tienda
    Web->>Socket: Connect WebSocket
    Socket-->>Web: Connection established

    Web->>Socket: EMIT join_room<br/>{orderId}
    Socket->>Redis: SUBSCRIBE room:{orderId}
    Socket-->>Web: EMIT room_joined

    Web->>Socket: EMIT get_messages<br/>{orderId}
    Socket->>Chat: Get message history
    Chat->>MongoDB: SELECT messages<br/>WHERE order_id=?<br/>ORDER BY created_at
    MongoDB-->>Chat: Message list
    Chat-->>Socket: Messages
    Socket-->>Web: EMIT messages_history
    Web-->>User: Mostrar historial

    User->>Web: Escribir mensaje: "¿Cuándo llega?"
    Web->>Socket: EMIT send_message<br/>{orderId, content, type}

    Socket->>Chat: Save message
    Chat->>MongoDB: INSERT message<br/>{orderId, senderId, content, timestamp}
    MongoDB-->>Chat: Message saved

    Chat->>Redis: PUBLISH room:{orderId}<br/>{message data}

    Redis-->>Socket: Message broadcasted
    Socket-->>Web: EMIT new_message<br/>{message}
    Socket-->>Store: EMIT new_message<br/>{message}

    Web-->>User: Mostrar mensaje enviado
    Store-->>Store: Mostrar nuevo mensaje

    par Notificaciones
        Socket->>Notif: Send notification to store
        Notif->>Notif: Push notification
        Notif->>Store: Notify
    end

    Store->>Socket: EMIT send_message<br/>{orderId, content, type: "store"}
    Socket->>Chat: Save message
    Chat->>MongoDB: INSERT message
    Chat->>Redis: PUBLISH room:{orderId}
    Redis-->>Socket: Broadcast
    Socket-->>Web: EMIT new_message
    Web-->>User: Mostrar respuesta de tienda

    par Notificación a usuario
        Socket->>Notif: Send notification to user
        Notif->>Notif: Push notification
        Notif-->>Web: Notify
        Web->>Web: Update badge count
    end
```

---

## 2. Secuencia de Conexión WebSocket

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Socket as Socket.io Server
    participant Auth as Auth Service
    participant Redis as Redis

    User->>Web: Usuario autenticado navega
    Web->>Socket: Connect WebSocket<br/>auth: {token}
    Socket->>Auth: Validate JWT token
    Auth-->>Socket: Token valid + userId

    alt Token inválido
        Socket-->>Web: Connection refused
        Web->>Web: Retry connection with refresh
    else Token válido
        Socket->>Socket: Create socket session
        Socket->>Redis: SET socket:{userId}<br/>{socketId, connectedAt}
        Socket-->>Web: Connection successful<br/>{socketId}

        Socket->>Redis: SUBSCRIBE user:{userId}
        Note over Socket,Redis: Suscribirse a eventos del usuario

        Socket-->>Web: EMIT connected<br/>{userId, socketId}
        Web->>Web: Mark as online
        Web-->>User: Chat disponible
    end

    Note over User,Redis: Usuario activo en la app

    User->>Web: Cerrar app/tab
    Web->>Socket: Disconnect
    Socket->>Redis: DEL socket:{userId}
    Socket->>Redis: UNSUBSCRIBE user:{userId}
    Socket->>Socket: Cleanup session
```

---

## 3. Secuencia de Mensajes con Plantillas

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Socket as Socket.io Server
    participant Chat as Chat Service
    participant Template as Template Service
    participant MongoDB as MongoDB
    participant Redis as Redis

    User->>Web: Abrir chat
    Web->>Socket: EMIT get_templates<br/>{orderId, storeId}
    Socket->>Template: Get message templates
    Template->>Redis: GET templates:{storeId}

    alt Templates en cache
        Redis-->>Template: Template list
    else No en cache
        Template->>MongoDB: SELECT templates<br/>WHERE store_id=?
        MongoDB-->>Template: Templates
        Template->>Redis: SET templates:{storeId}
    end

    Template-->>Socket: Template list
    Socket-->>Web: EMIT templates<br/>[{id, text, type}]
    Web-->>User: Mostrar botones rápidos

    User->>Web: Click en template<br/>"Mensaje para realizar pedido"
    Web->>Socket: EMIT send_template<br/>{orderId, templateId}

    Socket->>Template: Get template content
    Template->>Template: Render template<br/>Replace variables
    Template-->>Socket: Rendered message

    Socket->>Chat: Save message
    Chat->>MongoDB: INSERT message<br/>{orderId, content, type: "template"}
    Chat->>Redis: PUBLISH room:{orderId}

    Socket-->>Web: EMIT new_message
    Web-->>User: Mostrar mensaje enviado
```

---

## 4. Secuencia de Indicador de Escritura (Typing Indicator)

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Socket as Socket.io Server
    participant Redis as Redis
    participant Store as Store App

    User->>Web: Empezar a escribir
    Web->>Socket: EMIT typing_start<br/>{orderId, userId}

    Socket->>Redis: SETEX typing:{orderId}:{userId}<br/>{isTyping: true}<br/>TTL: 5s

    Socket-->>Store: EMIT user_typing<br/>{orderId, userId, userName}
    Store-->>Store: Mostrar "Usuario está escribiendo..."

    Note over User,Store: Usuario sigue escribiendo

    Web->>Socket: EMIT typing_start<br/>(cada 3 segundos)
    Socket->>Redis: SETEX typing:{orderId}:{userId}<br/>TTL: 5s (renovar)

    alt Usuario deja de escribir
        Note over Web: Sin actividad por 5s
        Redis->>Redis: Expirar key typing:{orderId}:{userId}
        Socket-->>Store: EMIT user_stopped_typing<br/>{orderId, userId}
        Store-->>Store: Ocultar indicador
    else Usuario envía mensaje
        User->>Web: Enviar mensaje
        Web->>Socket: EMIT send_message
        Socket->>Redis: DEL typing:{orderId}:{userId}
        Socket-->>Store: EMIT user_stopped_typing
        Socket-->>Store: EMIT new_message
        Store-->>Store: Mostrar mensaje
    end
```

---

## 5. Secuencia de Mensajes del Sistema

```mermaid
sequenceDiagram
    participant Order as Order Service
    participant Chat as Chat Service
    participant MongoDB as MongoDB
    participant Socket as Socket.io
    participant Web as User Web App
    participant StoreApp as Store App
    actor User as Usuario
    actor Store as Tienda

    Note over Order: Evento: Pedido creado

    Order->>Chat: Create system message<br/>{orderId, type: "order_created"}
    Chat->>Chat: Generate message:<br/>"Pedido #OBI-00123 creado"
    Chat->>MongoDB: INSERT message<br/>{orderId, type: "system", content}
    MongoDB-->>Chat: Message saved

    Chat->>Socket: Broadcast system message
    Socket-->>Web: EMIT system_message<br/>{orderId, content}
    Socket-->>StoreApp: EMIT system_message

    Web-->>User: Mostrar mensaje del sistema
    StoreApp-->>Store: Mostrar mensaje del sistema

    Note over Order: Evento: Estado cambiado a CONFIRMADO

    Order->>Chat: Create system message<br/>{orderId, type: "status_changed"}
    Chat->>Chat: Generate message:<br/>"Tu pedido ha sido confirmado"
    Chat->>MongoDB: INSERT message
    Chat->>Socket: Broadcast
    Socket-->>Web: EMIT system_message
    Web-->>User: Notificación en chat

    Note over Order: Evento: Pedido en camino

    Order->>Chat: Create system message<br/>{orderId, type: "out_for_delivery"}
    Chat->>Chat: Generate message:<br/>"Tu pedido está en camino"
    Chat->>MongoDB: INSERT message
    Chat->>Socket: Broadcast
    Socket-->>Web: EMIT system_message
    Web-->>User: Notificación en chat
```

---

## 6. Secuencia de Envío de Archivo/Imagen en Chat

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Upload as Upload Service
    participant CDN as CDN/S3
    participant Socket as Socket.io
    participant Chat as Chat Service
    participant MongoDB as MongoDB
    participant Store as Store App

    User->>Web: Seleccionar imagen
    Web->>Web: Validar archivo<br/>(tipo, tamaño)

    alt Archivo inválido
        Web-->>User: Error: Archivo no válido
    else Archivo válido
        Web->>Upload: POST /upload<br/>{file, orderId}
        Upload->>Upload: Generar nombre único
        Upload->>Upload: Optimizar imagen<br/>(resize, compress)
        Upload->>CDN: Upload file
        CDN-->>Upload: File URL

        Upload->>MongoDB: INSERT file_metadata<br/>{url, size, type}
        Upload-->>Web: 200 OK<br/>{fileUrl, thumbnailUrl}

        Web->>Socket: EMIT send_message<br/>{orderId, type: "image", fileUrl}
        Socket->>Chat: Save message
        Chat->>MongoDB: INSERT message<br/>{orderId, type: "image", content: fileUrl}

        Socket-->>Web: EMIT new_message
        Socket-->>Store: EMIT new_message

        Web-->>User: Mostrar imagen enviada
        Store-->>Store: Mostrar imagen recibida
    end
```

---

## 7. Secuencia de Sincronización de Mensajes Offline

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant ServiceWorker as Service Worker
    participant Socket as Socket.io
    participant Chat as Chat Service
    participant MongoDB as MongoDB

    Note over User: Usuario pierde conexión

    User->>Web: Escribir mensaje
    Web->>Web: Detectar offline
    Web->>ServiceWorker: Store pending message<br/>{orderId, content, timestamp}
    ServiceWorker->>ServiceWorker: Save to IndexedDB
    Web-->>User: Mensaje marcado como "pendiente"

    Note over User: Usuario recupera conexión

    Web->>Socket: Reconnect
    Socket-->>Web: Connection restored

    Web->>ServiceWorker: GET pending messages
    ServiceWorker-->>Web: Pending message list

    loop Para cada mensaje pendiente
        Web->>Socket: EMIT send_message<br/>{orderId, content, clientId}
        Socket->>Chat: Save message
        Chat->>MongoDB: INSERT message
        MongoDB-->>Chat: Message saved

        Socket-->>Web: EMIT message_sent<br/>{clientId, serverId}
        Web->>Web: Replace temp ID with server ID
        Web->>ServiceWorker: DELETE pending message
    end

    Web-->>User: Todos los mensajes enviados
```

---

## 8. Secuencia de Moderación de Mensajes

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Socket as Socket.io
    participant Chat as Chat Service
    participant Moderation as Moderation Service
    participant MongoDB as MongoDB
    participant Admin as Admin Panel

    User->>Web: Enviar mensaje
    Web->>Socket: EMIT send_message<br/>{orderId, content}

    Socket->>Moderation: Analyze message
    Moderation->>Moderation: Check for:<br/>- Spam<br/>- Profanity<br/>- Inappropriate content<br/>- Links/URLs

    alt Contenido inapropiado
        Moderation-->>Socket: Message flagged
        Socket->>Chat: Save flagged message
        Chat->>MongoDB: INSERT message<br/>{status: "flagged", flags}

        Socket-->>Web: EMIT message_blocked<br/>{reason}
        Web-->>User: "Mensaje bloqueado"

        par Notificar admin
            Socket->>Admin: EMIT flagged_message<br/>{orderId, userId, content}
            Admin-->>Admin: Mostrar en panel de moderación
        end

    else Contenido apropiado
        Socket->>Chat: Save message
        Chat->>MongoDB: INSERT message<br/>{status: "approved"}
        Socket-->>Web: EMIT new_message
        Web-->>User: Mostrar mensaje enviado
    end
```

---

## 9. Secuencia de Cierre de Conversación

```mermaid
sequenceDiagram
    actor User as Usuario
    participant Web as Web App
    participant Socket as Socket.io
    participant Chat as Chat Service
    participant MongoDB as MongoDB
    participant Store as Store App

    User->>Web: Cerrar chat
    Web->>Socket: EMIT leave_room<br/>{orderId}

    Socket->>Socket: Leave room
    Socket->>Redis: UNSUBSCRIBE room:{orderId}

    Socket-->>Web: EMIT room_left
    Web->>Web: Cleanup chat state
    Web-->>User: Chat cerrado

    alt Marcar como leído
        Web->>Socket: EMIT mark_as_read<br/>{orderId}
        Socket->>Chat: Mark messages as read
        Chat->>MongoDB: UPDATE messages<br/>SET is_read = true<br/>WHERE order_id=? AND sender_type="store"
        MongoDB-->>Chat: Updated

        Socket-->>Store: EMIT messages_read<br/>{orderId, userId}
        Store-->>Store: Actualizar UI (✓✓)
    end
```

---

## 10. Secuencia de Notificaciones de Chat

```mermaid
sequenceDiagram
    participant Socket as Socket.io
    participant Notif as Notification Service
    participant User as User
    participant Push as Push Service
    participant Email as Email Service
    participant Web as Web App

    Socket->>Notif: New message event<br/>{orderId, senderId, receiverId, content}

    Notif->>Notif: Check user status

    alt Usuario online
        Notif->>Socket: EMIT notification<br/>{type: "chat", orderId}
        Socket-->>Web: Real-time notification
        Web-->>User: Badge + sound
    else Usuario offline
        par Enviar notificaciones
            Notif->>Push: Send push notification<br/>"Nuevo mensaje de Tienda X"
            Push-->>User: Notificación push
        and
            Notif->>Email: Send email notification
            Email-->>User: Email con preview del mensaje
        end
    end

    alt Múltiples mensajes sin leer
        Notif->>Notif: Check message count
        Notif->>Notif: Aggregate notifications<br/>"Tienes 5 mensajes nuevos"
        Notif->>Push: Send summary notification
        Push-->>User: Notificación agregada
    end
```

---

## Consideraciones Técnicas

### WebSocket Connection Options
```javascript
// Cliente
const socket = io('wss://api.tiendi.com', {
  auth: { token: jwtToken },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
  transports: ['websocket', 'polling']
});
```

### Redis PubSub Channels
```javascript
// Canales de Redis
- room:{orderId}          // Mensajes de una conversación específica
- user:{userId}           // Eventos personales del usuario
- store:{storeId}         // Eventos de la tienda
- typing:{orderId}        // Indicadores de escritura
- broadcast               // Mensajes globales
```

### MongoDB Schema - Messages
```javascript
{
  _id: ObjectId,
  orderId: UUID,
  senderId: UUID,
  senderType: 'user' | 'store' | 'system',
  content: String,
  messageType: 'text' | 'image' | 'template' | 'system',
  fileUrl: String (optional),
  isRead: Boolean,
  isFlagged: Boolean,
  createdAt: DateTime,
  metadata: {
    clientId: String,
    editedAt: DateTime,
    deletedAt: DateTime
  }
}
```

### Rate Limiting
```javascript
// Límites por tipo de operación
{
  sendMessage: '10 per minute',
  uploadFile: '5 per minute',
  typing: '1 per 3 seconds'
}
```

---

**Fecha de creación:** 2025-11-24
**Versión:** 1.0
