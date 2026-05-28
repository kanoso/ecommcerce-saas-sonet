---
tags:
  - tiendi-go
  - desarrollo
  - checklist
aliases:
  - Checklist de Desarrollo Tiendi Go
---

# Tiendi Go — Checklist de Desarrollo

> Lista de funcionalidades ordenadas por fase de implementación.
> Marcar cada ítem cuando esté **en producción**, no cuando esté en desarrollo.

---

## Índice

- [Antes de empezar](#antes-de-empezar)
- [MVP — Fase 1](#mvp--fase-1)
- [Fase 2](#fase-2)
- [Fase 3](#fase-3)

---

## Antes de empezar

Decisiones de producto que deben estar resueltas **antes de escribir una sola línea de código**:

- [x] **Modelo laboral**: riders asociados (marketplace) — la plataforma es intermediaria, sin relación de dependencia
- [x] **Riesgo de efectivo**: lo asume la tienda — el rider devuelve el pedido y cobra tarifa mínima de compensación
- [x] **Algoritmo de asignación**: score ponderado — distancia 40% + rating 30% + tasa aceptación 20% + carga actual 10%
- [x] **Tarifas y comisión**: configurables por zona en el backend — se definen antes del lanzamiento, no son constantes del código
- [x] **SLA de revisión de documentos**: 48hs hábiles máximo para aprobar/rechazar un rider nuevo

---

> [!IMPORTANT]
> **Antes de implementar cada módulo**:
> - Revisar la sección correspondiente en [[FUNCIONALIDADES]] para entender el detalle completo de reglas de negocio, estados, flujos y restricciones.
> - **Mobile**: revisar el prototipo HTML correspondiente en `DOCS/TIENDI-GO/prototipos-html/` antes de escribir cualquier pantalla. El prototipo es la fuente visual de verdad para layouts, colores y flujos de navegación.
>
> Este checklist es una guía de avance, no reemplaza la especificación.

## MVP — Fase 1

> Objetivo: primera versión funcional operativa con riders reales. ~5 meses.
> Módulos incluidos: Auth, Perfil, Pedidos (básico), Entrega, Navegación, Ganancias, Configuración, Soporte.

---

### 🏗️ Setup del proyecto

#### Backend (tiendi-api)
- [x] Crear módulo `delivery` en NestJS (skeleton — endpoints en Módulo 3)
- [x] Diseñar y migrar esquema de base de datos: `Rider`, `Vehicle`, `Wallet`, `OtpCode`, `Delivery`, `DeliveryEvent`, `Transaction`
- [x] Configurar Socket.IO para tracking GPS en tiempo real (`TrackingGateway` + `IoAdapter`)
- [x] Configurar BullMQ para la cola de matching de pedidos (queues: `matching`, `notifications`)
- [x] Integrar Firebase Admin SDK para FCM (`FirebaseService` — credenciales en `.env`)
- [x] Configurar Twilio Verify para OTP por SMS (`TwilioService` — real con fallback mock en dev)
- [x] Configurar Cloudinary con carpetas privadas (`CloudinaryService` — real con fallback mock en dev)
- [x] Variables de entorno documentadas y en `.env.example`

#### Mobile (React Native + Expo)
- [x] Inicializar proyecto con `npx create-expo-app --template` + TypeScript strict
- [x] Configurar Expo Router con estructura de carpetas `(auth)` / `(app)`
- [x] Configurar `app.json`: bundle ID iOS (`com.tiendi.go`), package Android (`com.tiendi.go`), permisos GPS y cámara
- [x] Configurar `eas.json` con perfiles `development`, `preview` y `production`
- [x] Instalar y configurar dependencias base: `zustand`, `axios`, `socket.io-client`, `react-native-maps`, `expo-location`, `expo-camera`, `expo-notifications`, `expo-secure-store`, `expo-local-authentication`, `react-hook-form`, `zod`, `date-fns`, `react-native-mmkv`, `react-native-reanimated`, `react-native-gesture-handler`
- [x] Crear stores de Zustand: `useAuthStore`, `useDeliveryStore`, `useLocationStore`, `useWalletStore`
- [x] Configurar instancia de axios con interceptors para JWT y refresh token
- [x] Configurar cliente Socket.IO con reconexión automática
- [x] Google Maps SDK configurado con API key en `app.json` (Android + iOS)

---

### 🔐 Módulo 1 — Autenticación y Registro

#### Backend
- [x] `POST /riders/register/step1` — datos personales + OTP por SMS (mocked console.log)
- [x] `POST /riders/register/verify-otp` — verificación de código OTP
- [x] `POST /riders/register/step2` — datos del vehículo
- [x] `POST /riders/register/step3` — subida de documentos (mocked Cloudinary URLs)
- [x] `POST /auth/login` — email + contraseña → JWT access + refresh token (módulo auth existente, role-agnostic)
- [x] `POST /auth/refresh` — refresh token → nuevo access token (módulo auth existente)
- [ ] `POST /auth/forgot-password` / `POST /auth/reset-password`
- [x] `GET /riders/me` — datos del rider autenticado
- [x] Máquina de estados del rider: `PENDING_DOCUMENTS → UNDER_REVIEW → APPROVED/REJECTED → ACTIVE`
- [ ] Integración real Twilio Verify para OTP
- [ ] Integración real Cloudinary para documentos
- [ ] Panel de admin en tiendi-vendor para revisar y aprobar/rechazar riders
- [ ] Push + email al rider en cada cambio de estado (aprobado, rechazado)

#### Mobile
- [x] Pantalla de bienvenida / splash (ActivityIndicator mientras hidrata el store)
- [x] Registro Paso 1: datos personales (nombre, documento, email, teléfono)
- [x] Verificación OTP por SMS al completar Paso 1 (6 dígitos con auto-avance y reenvío 60s)
- [x] Registro Paso 2: datos del vehículo (tipo, placa, marca, color)
- [x] Registro Paso 3: subida de documentos con `expo-camera` / `expo-document-picker`
- [x] Pantalla de espera "En revisión" con estado visible
- [x] Pantalla de rechazo con motivo + opción de corregir y re-enviar
- [x] Login con email + contraseña (react-hook-form + zod)
- [x] Configuración de biometría (`expo-local-authentication` + flag en SecureStore)
- [x] Login biométrico (huella / Face ID)
- [x] Recuperación de contraseña
- [x] Onboarding post-aprobación: tutorial 3 pasos + permisos GPS (bloqueante) + cuenta bancaria (opcional)
- [x] Auth guard en Expo Router: redirige a `(auth)` si no hay token válido

---

### 👤 Módulo 2 — Perfil y Estado del Repartidor

#### Backend
- [x] `GET /riders/me` — perfil completo (rider + user + vehicle + wallet + pendingUpdate)
- [x] `PATCH /riders/me` — edición de campos libres (avatarUrl, coverageZone)
- [x] `POST /riders/me/update-request` — campos con re-validación → almacena en pendingUpdate (no aplica directo)
- [x] `GET /riders/me/vehicles` — lista de vehículos
- [ ] `POST /riders/me/vehicle-change-request` — solicitud de cambio de vehículo con nuevos documentos
- [x] `PATCH /riders/me/status` — cambiar estado operativo (`ONLINE` / `OFFLINE` / `ON_BREAK`)
- [ ] Cron: pausa que expira después de 4hs → pasa automáticamente a `OFFLINE`
- [ ] Push 15 min antes del vencimiento de la pausa
- [ ] Cron: rider sin actividad 30 días → estado `INACTIVE`

#### Mobile
- [x] Pantalla de perfil: avatar con iniciales, datos personales, vehículo, métricas, logout
- [x] Toggle operativo Disponible / Pausa / No disponible (solo si status === ACTIVE)
- [x] Banner "Cambios pendientes de aprobación" cuando pendingUpdateStatus === PENDING
- [x] Edición de campos libres (avatarUrl URL, coverageZone)
- [x] Solicitud de cambios con re-validación (nombre, teléfono, email → pendiente admin)
- [x] Pantalla de vehículos con tipo, placa, estado activo
- [ ] Estado "En Pausa" con countdown visible y botón de reanudar (requiere Cron backend)
- [ ] Solicitud de cambio de vehículo con upload de documentos
- [ ] Métricas completas: pedidos del mes (Módulo 8), nivel de puntuación (Módulo 13)

---

### 📥 Módulo 3 — Recepción y Gestión de Pedidos

#### Backend
- [ ] Matching engine Fase 1: oferta a riders de confianza en radio ≤ X km (60s timeout)
- [ ] Matching engine Fase 2: filtrado por distancia (40%), rating (30%), tasa aceptación (20%), carga actual (10%)
- [ ] Timer de 30s por rider con escalada al siguiente candidato
- [ ] `POST /deliveries/{id}/accept` — con lock optimista (`UPDATE WHERE rider_id IS NULL`)
- [ ] `POST /deliveries/{id}/reject`
- [ ] `POST /deliveries/{id}/timeout`
- [ ] Registro del impacto en tasa de aceptación por timeout (-5 pts)
- [ ] Alerta al admin si el pedido no se asigna en 5 min
- [ ] Socket.IO: evento `order:offer` al rider seleccionado

#### Mobile
- [ ] Listener de Socket.IO para evento `order:offer`
- [ ] Tarjeta de oferta emergente con: datos de tienda, destino, comisión estimada, ítems, timer 30s
- [ ] Sonido + vibración al recibir oferta (funciona con app cerrada via FCM high-priority)
- [ ] Botones Aceptar / Rechazar con feedback inmediato
- [ ] Pantalla de detalle del pedido activo: tienda, cliente, ítems, instrucciones, mapa
- [ ] Manejo de `409 Conflict` (pedido ya asignado a otro rider)
- [ ] FCM en foreground: banner in-app; en background: notificación del SO con deep link

---

### 🚚 Módulo 4 — Flujo de Entrega

#### Backend
- [ ] Máquina de estados del delivery: `Asignado → EnCaminoTienda → EnTienda → Recogido → EnCaminoCliente → EnDestino → Entregado`
- [ ] Geofence server-side: detectar cuando rider entra a 150m de tienda y 200m de cliente
- [ ] `POST /deliveries/{id}/pickup` — verificación por QR o código de 4 dígitos (máx 3 intentos)
- [ ] `POST /deliveries/{id}/complete` — POD: foto URL + OTP + firma opcional + nota
- [ ] OTP por SMS al cliente al entrar al geofence de destino
- [ ] Subida de foto POD a Cloudinary (`/pod/delivery/`) con hash SHA256
- [ ] `POST /deliveries/{id}/incident` — crear incidente con tipo y evidencia
- [ ] `POST /deliveries/{id}/cancel` — cancelación con validación de estado y penalización
- [ ] Flujo de devolución si rider tiene el pedido físicamente
- [ ] Notificaciones automáticas a tienda y cliente en cada cambio de estado
- [ ] Cálculo y acreditación de comisión al completar entrega (server-side)

#### Mobile
- [ ] Pantalla de entrega activa con máquina de estados visible
- [ ] Botón "Iniciar ruta a tienda" → deep link a Google Maps / Waze / Apple Maps
- [ ] Activación del botón "Confirmar recogida" solo dentro del geofence (150m)
- [ ] Escáner QR con `expo-camera` para confirmar recogida
- [ ] Input manual de código de 4 dígitos como fallback
- [ ] Captura de foto del paquete en la tienda (opcional)
- [ ] Botón "Iniciar ruta al cliente" → deep link a app de navegación
- [ ] Activación de POD solo dentro del geofence (200m)
- [ ] Pantalla de POD: captura foto + input OTP + firma digital (opcional) + nota
- [ ] Pantalla de incidente con 6 tipos seleccionables + foto obligatoria según tipo
- [ ] Pantalla de cancelación con motivo obligatorio + advertencias según estado
- [ ] Notificación push recibida al completar: comisión acreditada

---

### 🗺️ Módulo 5 — Navegación y Geolocalización

#### Backend
- [ ] Endpoint para guardar coordenadas: guardado en `DELIVERY_EVENT`
- [ ] Broadcast de posición del rider a tienda y cliente via Socket.IO
- [ ] Geocoding de direcciones de tienda y cliente (Google Geocoding API)
- [ ] Cálculo de ruta (Google Directions API) para ruta tienda → cliente

#### Mobile
- [ ] `MapView` (react-native-maps) en pantalla principal con marcadores de tienda y cliente
- [ ] Marcador animado de posición del rider con heading
- [ ] Polyline de ruta activa sobre el mapa
- [ ] Círculos de geofence visuales (150m tienda, 200m cliente)
- [ ] Tracking GPS en background con `expo-location` (permiso `Always`)
- [ ] Throttling adaptativo: sin pedido 30s / en tránsito 10s / cerca destino 3s
- [ ] Pantalla de solicitud de permisos GPS con explicación clara (antes del onboarding)
- [ ] Indicador "Señal débil" cuando GPS error > 50m
- [ ] Deep links de navegación: Google Maps, Waze, Apple Maps con fallback a browser
- [ ] Cola offline: si no hay conexión, los eventos GPS se encolan en MMKV y se sincronizan al reconectar

---

### 💰 Módulo 7 — Ganancias y Pagos

#### Backend
- [ ] Motor de cálculo de comisión server-side: base + distancia + multiplicador + bono de nivel + propina - fee
- [ ] `GET /wallet/me` — balance disponible, efectivo en mano, pendiente
- [ ] `GET /wallet/me/transactions` — historial de transacciones paginado
- [ ] `POST /wallet/me/withdraw` — solicitud de retiro con OTP si supera umbral
- [ ] `POST /wallet/me/cash-deposit` — confirmar depósito de efectivo con foto del voucher
- [ ] Bloqueo automático de pedidos en efectivo cuando `cashOnHand ≥ S/ 200`
- [ ] Cron de reconciliación diaria (23:59) para detectar efectivo sin depositar
- [ ] Generación de comprobante PDF por retiro
- [ ] Push al rider cuando el dinero llega a la cuenta

#### Mobile
- [ ] Pantalla de wallet: balance disponible, efectivo en mano, pendiente
- [ ] Vista de ganancias: hoy / semana / mes / histórico
- [ ] Gráfico de barras de pedidos por día (CSS puro — sin librerías de gráficos)
- [ ] Proyección de cierre del mes
- [ ] Pantalla de retiro: monto + método + confirmación OTP si supera umbral
- [ ] Historial de transacciones con filtros
- [ ] Alerta cuando efectivo en mano se acerca al límite
- [ ] Flujo de confirmación de depósito en efectivo: foto del voucher + monto
- [ ] Exportar reporte mensual como PDF

---

### ⚙️ Módulo 10 — Configuración

#### Backend
- [ ] `PATCH /riders/me/coverage-zones` — guardar zonas de cobertura (radio o polígono)
- [ ] `PATCH /riders/me/preferences` — método de pago, radio de aceptación, multi-pedido
- [ ] `PATCH /riders/me/schedule` — horarios programados por día
- [ ] `PATCH /riders/me/notifications` — preferencias de notificaciones
- [ ] Matching engine: filtrar por zona activa y preferencias del rider antes de ofrecer

#### Mobile
- [ ] Pantalla de zonas de cobertura con `MapView` interactivo (dibujar radio o polígono)
- [ ] Selector de zona activa (si tiene más de una)
- [ ] Preferencias de pedidos: método de pago, radio, tipo de vehículo, multi-pedido
- [ ] Horarios de trabajo por día con franjas horarias
- [ ] Preferencias de notificaciones con toggle por tipo
- [ ] Selector de tema (claro / oscuro / sistema)
- [ ] Privacidad: compartir ubicación entre pedidos (toggle)
- [ ] Descargar mis datos (GDPR)
- [ ] Eliminar cuenta (confirmación en 2 pasos con anonimización)
- [ ] Cerrar sesión en todos los dispositivos

---

### 🆘 Módulo 11 — Soporte y Ayuda

#### Backend
- [ ] `GET /support/faqs` — lista de FAQs por categoría
- [ ] `POST /support/tickets` — crear ticket con tipo, descripción y evidencia (foto)
- [ ] `GET /support/tickets/me` — tickets del rider con estado
- [ ] Captura automática de contexto al reportar: versión de app, OS, pedido activo, GPS coords
- [ ] Escalado de ticket a soporte humano según tipo

#### Mobile
- [ ] Centro de ayuda con categorías y artículos (FAQs)
- [ ] Búsqueda en el centro de ayuda
- [ ] Formulario de reporte de problema con selector de tipo y adjunto de foto
- [ ] Captura automática del contexto del dispositivo al abrir el reporte
- [ ] Pantalla de ticket activo con estado y mensajes del soporte
- [ ] Botón de emergencia (accesible desde la pantalla de entrega activa)

---

### 🔔 Push Notifications (transversal MVP)

#### Backend
- [ ] FCM high-priority para: nueva oferta de pedido, cancelación de pedido
- [ ] FCM normal-priority para: comisión acreditada, mensaje de chat, logro desbloqueado, vínculo de confianza

#### Mobile
- [ ] Solicitud de permisos de notificación con `expo-notifications`
- [ ] Handler en foreground: banner in-app personalizado
- [ ] Handler en background/cerrada: tap abre la pantalla correcta (deep link)
- [ ] Centro de notificaciones in-app: últimas 30 con estado leída/no leída

---

### ✅ Testing y lanzamiento beta (MVP)

- [ ] Tests unitarios de stores de Zustand (cobertura ≥ 90%)
- [ ] Tests de schemas Zod (cobertura 100%)
- [ ] E2E con Detox: happy path de entrega completa
- [ ] E2E con Detox: OTP incorrecto en POD
- [ ] E2E con Detox: timeout de oferta de pedido
- [ ] Build de preview con EAS (`eas build --profile preview`)
- [ ] Beta cerrada con 10–20 riders reales
- [ ] Crashlytics configurado y monitoreado
- [ ] Build de producción y submit a App Store + Play Store (`eas submit`)

---

## Fase 2

> Objetivo: mejoras de retención y herramientas de crecimiento. ~4-5 meses post-MVP.
> Módulos: Multi-pedido, Comunicación, Historial/Estadísticas, Calificaciones, Liquidación avanzada, Puntuación, Confianza.

---

### 📋 Multi-pedido (batching)

#### Backend
- [ ] Límites de batching por tipo de vehículo (a pie:1, bici:2, moto:3, auto:4)
- [ ] Algoritmo de ruta optimizada multi-waypoint (Google Directions API `optimize:waypoints`)
- [ ] Oferta de segundo pedido solo si es compatible con la ruta activa

#### Mobile
- [ ] Cola de pedidos activos: lista con estado de cada uno
- [ ] Ruta optimizada visualizada en el mapa con marcadores numerados ①②③④
- [ ] Reordenamiento manual de la cola con advertencia de ineficiencia
- [ ] Recálculo automático si un pedido se cancela durante la ruta

---

### 💬 Módulo 6 — Comunicación

#### Backend
- [ ] Crear `CHAT_THREAD` por pedido (2 hilos: rider↔tienda, rider↔cliente)
- [ ] `GET /deliveries/{id}/chat/{threadType}` — historial de mensajes
- [ ] Socket.IO: eventos `chat:message` y `chat:typing`
- [ ] `POST /deliveries/{id}/call/initiate` — crear número proxy Twilio
- [ ] Webhook Twilio para conectar llamada al número real
- [ ] Límite de 3 llamadas por pedido
- [ ] Archivado del hilo 48hs post-entrega

#### Mobile
- [ ] Pantalla de chat por pedido con 2 tabs (Tienda / Cliente)
- [ ] Mensajes predefinidos (quick replies) por estado del rider
- [ ] Bloqueo de tipeo libre en estados de conducción (`EnCaminoTienda`, `EnCaminoCliente`)
- [ ] Indicador "escribiendo…" y "visto"
- [ ] Adjuntar foto en el chat (solo cuando no está conduciendo)
- [ ] Botón de llamada proxy desde la pantalla de detalle del pedido
- [ ] Centro de notificaciones: badge de mensajes no leídos

---

### 📊 Módulo 8 — Historial y Estadísticas

#### Backend
- [ ] `GET /riders/me/deliveries` — historial paginado con filtros (fecha, estado, tienda, pago, rating)
- [ ] `GET /riders/me/deliveries/{id}` — detalle completo con ruta GPS recorrida
- [ ] `GET /riders/me/stats` — estadísticas de performance y ganancias por período
- [ ] `GET /riders/me/heatmap` — datos agregados por zona (demanda histórica, actividad actual, rentabilidad, densidad)
- [ ] `GET /riders/me/schedule-suggestions` — sugerencias de horarios basadas en historial
- [ ] Export CSV del historial filtrado
- [ ] Export PDF del reporte mensual de ganancias

#### Mobile
- [ ] Historial de pedidos con scroll infinito y filtros
- [ ] Detalle de entrega: ítems, ruta en mapa (polyline del GPS real), timestamps, comisión desglosada, POD archivado
- [ ] Estadísticas con selector de período (hoy / semana / mes / histórico)
- [ ] Gráficos de barras (pedidos por día), línea (ganancias acumuladas), torta (top 5 tiendas)
- [ ] Mapa de calor con 4 capas seleccionables: demanda histórica, actividad ahora, rentabilidad, densidad de riders
- [ ] Filtro del mapa de calor por franja horaria y día de la semana
- [ ] Sugerencias de horarios pico en card de home

---

### ⭐ Módulo 9 — Calificaciones

#### Backend
- [ ] `POST /deliveries/{id}/rate` — calificación por el rider (a tienda y a cliente)
- [ ] Calificación ciega: no revelar hasta que ambas partes califiquen o expire la ventana (24hs)
- [ ] Cron: cerrar calificaciones vencidas y revelar las disponibles
- [ ] Cálculo de `ratingAvg` ponderado: últimas 30 tienen peso 2×, descarte outliers 5%
- [ ] Mínimo 5 calificaciones para mostrar rating público
- [ ] Integración con `MONTHLY_SCORE`: puntos según score recibido (ver Módulo 13)
- [ ] Suspensión automática si rating < 2.0 con 10+ calificaciones → revisión de cuenta

#### Mobile
- [ ] Prompt de calificación post-entrega (push + pantalla al volver a la app)
- [ ] Formulario: 5 estrellas + etiquetas según score + comentario libre (280 chars)
- [ ] Pantalla de calificación recibida (visible después de la ventana de 24hs)
- [ ] Rating visible en perfil con historial de evolución

---

### 💰 Liquidación automatizada (Módulo 7 avanzado)

#### Backend
- [ ] Retiro express (instantáneo) para niveles Oro y Diamante
- [ ] Retiro programado (cada lunes 8am)
- [ ] Máximo 3 retiros por día (control de fraude)
- [ ] Hold de seguridad: fondos retenidos en primera cuenta bancaria registrada

---

### 🎯 Módulo 13 — Sistema de Puntuación y Logros

#### Backend
- [ ] Tabla `MONTHLY_SCORE`: puntos por acción (entregas, rating 5⭐, etc.) y penalizaciones (timeout, cancelación)
- [ ] Reset de puntos el primer día del mes
- [ ] Umbrales de nivel: Bronce / Plata / Oro / Diamante
- [ ] Multiplicadores de comisión por nivel: +0% / +5% / +10% / +15%
- [ ] 20 logros desbloqueables en 4 raridades (Común / Raro / Épico / Legendario)
- [ ] `POST /achievements/{id}/check` — evaluar si el rider desbloqueó un logro
- [ ] Push al rider al desbloquear un logro
- [ ] Ranking mensual de riders con ventana ±1 posición

#### Mobile
- [ ] Pantalla de nivel y puntos con barra de progreso al siguiente nivel
- [ ] Pantalla de logros: filtro por desbloqueados / bloqueados / raridad
- [ ] Animación de confetti al desbloquear un logro
- [ ] Pantalla de ranking mensual con posición del rider destacada
- [ ] Indicador de nivel visible en perfil y home

---

### 🤝 Módulo 14 — Repartidores de Confianza

#### Backend
- [ ] `POST /trust/invite` — tienda invita a rider (o rider solicita vínculo)
- [ ] `POST /trust/invitations/{id}/accept` / `/reject`
- [ ] `DELETE /trust/{id}` — revocar vínculo (desde cualquiera de los dos lados)
- [ ] `GET /riders/me/trusted-stores` — tiendas vinculadas al rider
- [ ] Límites: máximo 10 tiendas por rider, máximo 5 riders por tienda
- [ ] Integración con matching engine: Fase 1 prioriza riders de confianza (60s timeout)
- [ ] Historial y auditoría de vínculos
- [ ] Push al rider al recibir invitación

#### Mobile
- [ ] Pantalla de tiendas de confianza: lista con estado de vínculo
- [ ] Pantalla de invitaciones recibidas: aceptar o rechazar con detalle de la tienda
- [ ] Flujo de baja del vínculo con confirmación
- [ ] Indicador en la tarjeta de oferta: "Pedido de tienda de confianza"

---

## Fase 3

> Objetivo: crecimiento con herramientas de retención avanzadas y escalado a flotas. ~4-5 meses post-Fase 2.
> Módulos: Incentivos, Heatmaps IA, Admin de Flota.

---

### 🏆 Módulo 12 — Programa de Incentivos

#### Backend
- [ ] Desafíos diarios: configuración de tramos (cantidad de entregas → bono)
- [ ] Multiplicadores de zona y hora pico: activación manual por admin o automática por umbral
- [ ] Zonas calientes: polígonos en el mapa con multiplicador activo
- [ ] Sistema de referidos: código único por rider, validación de primer pedido del referido, acreditación de bono
- [ ] Cap de referidos por mes (configurable por región)
- [ ] Push 30 min antes del inicio de una ventana de hora pico

#### Mobile
- [ ] Pantalla de desafíos diarios con tramos y progreso en tiempo real
- [ ] Pantalla de hora pico: countdown de la ventana activa
- [ ] Mapa con zonas calientes resaltadas (naranja pulsante)
- [ ] Pantalla de referidos: código copiable, historial de referidos y estado de bono
- [ ] Pantalla de nivel Diamante con beneficios desbloqueados

---

### 🔥 Heatmaps avanzados (Módulo 8 — Fase 3)

#### Backend
- [ ] Reemplazar sugerencias por reglas fijas con modelo ML personalizado por rider, zona y contexto
- [ ] API de eventos externos (clima, eventos locales) integrada en las sugerencias

#### Mobile
- [ ] Sugerencias de horarios personalizadas por ML (mismo contrato de UI, distinto motor)
- [ ] Alerta proactiva de evento especial en la zona del rider

---

### 🚢 Módulo 15 — Admin de Flota

#### Backend
- [ ] Tabla `FLEET` con datos de la empresa y seguro de flota
- [ ] `POST /fleets` — crear flota (requiere seguro aprobado)
- [ ] `POST /fleets/{id}/invite` — invitar riders a la flota
- [ ] Split de comisión configurable: rider recibe ≥ 65% del neto (por contrato)
- [ ] Matching engine Fase 1: riders de la flota compiten con riders de confianza individuales (simultáneo)
- [ ] `GET /fleets/{id}/riders` — lista con estado en tiempo real para el admin
- [ ] `GET /fleets/{id}/stats` — métricas de la flota: entregas, ingresos, tiempo promedio
- [ ] Alertas: riders con incidentes abiertos, documentos por vencer, inactividad

#### Mobile (rider)
- [ ] Pantalla "Mi flota": nombre de la empresa, comisión acordada, estado
- [ ] Pantalla de invitación a flota: detalle de la empresa, comisión, aceptar / rechazar
- [ ] Indicador en el perfil del rider: "Rider de flota [Empresa]"
- [ ] Baja de la flota con confirmación

---

## Ver también

- [[FUNCIONALIDADES]] — especificación completa de módulos y pantallas
- [[STACK-TECNOLOGICO]] — stack definido (React Native + Expo)
- [[PROTOTIPOS-CHECKLIST]] — prototipos HTML por módulo
