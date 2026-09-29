# Evidencia — P2: Notificaciones de Chat Interno

## Alcance y revisiones
- Objetivo y tareas cubiertas: Notificaciones push + in-app para destinatarios de mensajes de chat no conectados en vivo (PLAN §5 P2, §6, §9).
- Repositorios y revisiones:
  - `FUENTES/tiendi-api`: `master` `d55adc4`
- Estado: **verificada con tests — código y lógica de presencia realtime, resolución de audiencias (STORE y USER), deduplicación por destinatario, persistencia y resiliencia completas (tiendi-api: 20 suites relacionadas con 160/160 tests; 86/86 suites totales con 871/871 tests; compilación `nest build` limpia).**

## Cambios

### tiendi-api — presencia realtime, resolución de destinatarios e integración con NotificationGateway
| Archivo | Cambio |
|---|---|
| `src/modules/chat/chat.gateway.ts` | **Presencia realtime en salas de conversación**: mapa en memoria `conversationPresence` indexado por `conversationId` y `userId` con sets de `socketId`. Handshake y `chat:join` registran pertenencia; `@SubscribeMessage('chat:leave')` limpia la sala; `handleDisconnect` desvincula todas las salas activas del socket. Método público `isUserInConversation(conversationId, userId): boolean` que valida presencia en memoria y contra el adaptador de namespaces de Socket.IO si está inicializado. |
| `src/modules/chat/chat.gateway.spec.ts` | 3 tests unitarios nuevos cubriendo registro de presencia en join, remoción en leave y limpieza multi-sala en disconnect. (18/18 tests pasando). |
| `src/modules/chat/chat.module.ts` | Importación de `NotificationsModule` sin dependencias circulares. |
| `src/modules/chat/chat.service.ts` | **Integración con NotificationGateway (P2)**: constante exportada `CHAT_CATEGORY = 'chat-messages'`. Inyección de `NotificationGateway`. Método `notifyChatMessageSafe` cableado en `sendMessage` y `sendStoreMessage`: (1) resolución de destinatarios según remitente (cliente → dueño y empleados con `status: 'ACTIVE'`; vendor → cliente); (2) exclusión estricta del remitente; (3) supresión de push e in-app si el destinatario está mirando la conversación en vivo en `conv:${conversationId}`; (4) clave de idempotencia compuesta por destinatario `chat:msg:${message.id}:${recipientId}` que previene colisiones en `sourceApp_idempotencyKey`; (5) emisión de una única entrada de bandeja por mensaje para la tienda (primer destinatario offline recibe `push + in-app`, los siguientes reciben `push`); (6) tolerancia a fallos con log de error sin interrumpir el flujo de chat. |
| `src/modules/chat/chat.service.spec.ts` | 8 tests unitarios nuevos cubriendo: notificación a dueño y empleados activos; supresión si el destinatario está en la sala; presencia parcial (notificación exclusiva a desconectados); notificación a clientes por mensaje de vendor; supresión para cliente activo; no auto-notificación del remitente; notificación vía `sendStoreMessage`; y resiliencia ante errores del gateway. (38/38 tests pasando). |
| `src/modules/notifications/infrastructure/in-app-channel.adapter.ts` | Enriquecimiento de `resolveOwner` para asignar `ownerType: NotificationOwner.STORE` cuando `dto.content.data?.storeId` está presente y el destinatario es staff/vendor, garantizando visibilidad en `/stores/:storeId/notifications` y `/me/notifications`. Destinatarios con rol `CUSTOMER` mantienen `ownerType: NotificationOwner.USER` para `/notifications/inbox`. |
| `src/modules/notifications/infrastructure/in-app-channel.adapter.spec.ts` | 2 tests unitarios nuevos validando la asignación a `STORE` para vendor y a `USER` para cliente cuando `data.storeId` está presente. (5/5 tests pasando). |

## Catálogo de canales por evento (C-decisiones)

| # | Evento | Canales activos | Implementación |
|---|---|---|---|
| C7 | `chat.message-created` | push + in-app | ✅ `ChatService` → `NotificationGateway` (P2: suprime push e in-app si el destinatario está en `conv:${conversationId}`; resolución por lado `STORE`/`USER`; idempotencia durable `chat:msg:${message.id}:${recipientId}`). |

## Matriz de escenarios probados (P2)

| Escenario | Condición del destinatario | Canales entregados | Comportamiento observado |
|---|---|---|---|
| Cliente envía mensaje | Tienda con dueño y empleado offline | Dueño: `push + in-app`<br>Empleado: `push` | Dueño y empleado reciben push; bandeja de la tienda recibe exactamente 1 entrada con `resourceType: 'conversation'`. |
| Cliente envía mensaje | Dueño conectado en `conv:`, empleado offline | Dueño: *ninguno*<br>Empleado: `push + in-app` | El dueño lee en vivo sin push ni notificación fantasma ("no vibra ni acumula bandeja"); el empleado offline recibe push y la tienda conserva el aviso. |
| Cliente envía mensaje | Dueño y empleados conectados en `conv:` | *ninguno* | Todos leen en vivo vía WebSocket `message.new`. Sin push ni acumulación en bandeja. |
| Vendor envía mensaje | Cliente offline | Cliente: `push + in-app` | Cliente recibe push en su dispositivo y entrada en bandeja `/notifications/inbox` con `resourceType: 'conversation'`. |
| Vendor envía mensaje | Cliente conectado en `conv:` | *ninguno* | Cliente lee en vivo. Push e in-app suprimidos. |
| Mensaje del sistema (`sendStoreMessage`) | Cliente offline | Cliente: `push + in-app` | Cliente recibe notificación con título de la tienda y código/cuerpo del mensaje. |
| Cliente es también empleado de la tienda | Escribe como cliente | *No se auto-notifica* | Su propio `userId` queda filtrado de los destinatarios; solo los demás miembros de la tienda reciben notificación. |

## Verificación reproducible

| Caso | Comando o pasos | Esperado | Resultado observado |
|---|---|---|---|
| tiendi-api: tests de chat gateway | `npm test -- src/modules/chat/chat.gateway.spec.ts` | verde | **1 suite, 18/18 tests pasando** |
| tiendi-api: tests de chat service | `npm test -- src/modules/chat/chat.service.spec.ts` | verde | **1 suite, 38/38 tests pasando** |
| tiendi-api: tests de adaptador in-app | `npm test -- src/modules/notifications/infrastructure/in-app-channel.adapter.spec.ts` | verde | **1 suite, 5/5 tests pasando** |
| tiendi-api: suites de chat y notificaciones | `npm test -- src/modules/chat/ src/modules/notifications/` | verde | **20 suites, 160/160 tests pasando** |
| tiendi-api: suite completa del proyecto | `npm test` | verde | **86 suites, 871/871 tests pasando** |
| tiendi-api: compilación de producción | `npm run build` | verde | **exit 0 (nest build limpio, cero errores TypeScript)** |
