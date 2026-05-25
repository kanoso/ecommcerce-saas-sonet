---
tags:
  - tiendi-go
  - prototipo
  - checklist
  - mobile
  - diseño/ux
aliases:
  - Checklist Prototipos
  - Prototipos Tiendi Go
---

# Tiendi Go — Checklist de Prototipos de Pantallas

> Marcar con `[x]` cuando el prototipo esté creado en Figma/Pencil.
> Referencia funcional: [`FUNCIONALIDADES.md`](./FUNCIONALIDADES.md)

---

## Módulo 1 — Autenticación y Registro

- [x] **Splash / Carga inicial** — logo + verificación de token (< 1s)
- [x] **Login** — email/teléfono + contraseña + acceso biométrico
- [x] **Registro — Paso 1: Datos personales** — nombre, teléfono, email, contraseña
- [x] **Registro — Paso 2: Datos del vehículo** — tipo, marca, placa, color
- [x] **Registro — Paso 3: Documentos** — DNI, licencia, SOAT (upload foto)
- [x] **Registro — Paso 4: Pendiente de revisión** — estado de solicitud + estimado
- [x] **Cuenta suspendida** — motivo visible + contacto de soporte
- [x] **Onboarding post-aprobación** — bienvenida + tutorial de primeros pasos (carousel/steps)

---

## Módulo 2 — Perfil y Estado

- [x] **Perfil principal** — foto, nombre, nivel, métricas resumen, secciones colapsables
- [x] **Editar perfil** — campos editables vs. campos con re-validación
- [x] **Cambio de vehículo** — flujo: selección → upload documentos → estado pendiente
- [x] **Toggle de disponibilidad** — On/Off con confirmación y estado `EnPausa`

---

## Módulo 3 — Recepción y Gestión de Pedidos

- [x] **Tarjeta de oferta de pedido** — modal/overlay con mapa, distancia, pago estimado, timer 30s
- [x] **Cola de pedidos activos** — lista cuando hay múltiples asignados (plan Premium)
- [x] **Detalle del pedido** — dirección tienda, dirección cliente, items, instrucciones, mapa

---

## Módulo 4 — Flujo de Entrega

- [x] **Pantalla de entrega activa** — mapa + estado actual + botón de acción principal
- [x] **Confirmación de recogida en tienda** — checklist de ítems + botón "Recogí el pedido"
- [x] **POD — Captura de foto** — cámara + preview + confirm (evidencia de entrega)
- [x] **POD — Ingreso de OTP** — teclado numérico + campo de 4-6 dígitos
- [x] **POD — Firma digital** *(opcional)* — canvas de firma en pantalla
- [x] **POD — Modo offline / QR fallback** — escaneo de QR generado por la app del cliente
- [x] **Reporte de incidente durante entrega** — categorías + descripción + foto adjunta
- [x] **Cancelación por el rider** — motivo + confirmación + penalización advertida

---

## Módulo 5 — Navegación y Geolocalización

- [x] **Pantalla de navegación** — mapa turn-by-turn + ETA + dirección actual
- [x] **Pantalla de consentimiento GPS** — qué datos, por qué, cómo se almacenan
- [x] **Modo sin señal / offline** — banner de advertencia + última ruta conocida

---

## Módulo 6 — Comunicación

- [x] **Chat in-app con cliente** — burbuja de mensajes + quick replies predefinidos
- [x] **Chat in-app con tienda** — mismo componente, contexto diferente
- [x] **Lista de notificaciones** — historial de pushes recibidos

---

## Módulo 7 — Ganancias y Pagos

- [x] **Dashboard de ganancias** — resumen hoy / semana / mes + gráfico de barras
- [x] **Detalle de comisión por entrega** — desglose: base + distancia + bono + propina - fee
- [x] **Wallet** — saldo disponible / efectivo en mano / fondos retenidos
- [x] **Solicitud de retiro** — monto + cuenta bancaria + confirmación
- [x] **Manejo de efectivo** — cobro de COD + declaración de monto + reconciliación

---

## Módulo 8 — Historial y Estadísticas

- [x] **Historial de pedidos** — lista con filtros (fecha, estado, tienda)
- [x] **Detalle de entrega histórica** — resumen, duración, earnings, ruta, rating recibido
- [x] **Estadísticas personales** — métricas KPI: tasa de aceptación, tiempo promedio, cancelaciones
- [x] **Gráficos de desempeño** — línea/barra: ingresos diarios, entregas por semana
- [x] **Mapa de calor de zonas** — hexágonos H3 con densidad de pedidos
- [x] **Sugerencias de horarios pico** — tabla/calendario con franjas de mayor demanda

---

## Módulo 9 — Calificaciones

- [x] **Pantalla de calificación post-entrega** — estrellas + etiquetas rápidas + comentario opcional
- [x] **Mi puntuación / historial de ratings** — promedio, distribución, últimas calificaciones recibidas

---

## Módulo 10 — Configuración

- [x] **Zonas de cobertura** — mapa con polígonos seleccionables
- [x] **Preferencias de pedidos** — distancia máxima, tipos de vehículo, COD on/off
- [x] **Horarios de trabajo** — grilla de días y franjas horarias
- [x] **Configuración de notificaciones** — toggles por tipo de notificación
- [x] **Privacidad y cuenta** — opciones de datos, eliminar cuenta, cerrar sesión
- [x] **Apariencia** — modo oscuro / claro / sistema

---

## Módulo 11 — Soporte y Ayuda

- [x] **Centro de ayuda (FAQ)** — artículos por categoría + buscador
- [x] **Reporte de problema** — formulario: categoría + descripción + captura de pantalla
- [x] **Estado de ticket activo** — conversación + estado + historial de respuestas
- [x] **Documentos legales** — Términos y condiciones, Política de privacidad

---

## Módulo 12 — Programa de Incentivos

- [x] **Desafío diario** — barra de progreso hacia cada meta + bono por tramo
- [x] **Bono por horario pico** — banner/badge activo + multiplicador vigente
- [x] **Mapa de zona caliente** — overlay de zona activa + contador de tiempo restante
- [x] **Programa de referidos** — link personal + contador de referidos activos + ganancias acumuladas
- [x] **Bonos nivel Diamante** — pantalla exclusiva con beneficios desbloqueados

---

## Módulo 13 — Sistema de Puntuación

- [x] **Mi nivel y puntos** — nivel actual, barra de progreso al siguiente, puntos del mes
- [x] **Logros desbloqueables** — grid de badges: bloqueados / desbloqueados / en progreso
- [x] **Ranking** — posición del rider en el ranking + top riders (anónimos)

---

## Módulo 14 — Repartidores de Confianza

- [x] **Mis tiendas de confianza** — lista de tiendas vinculadas + estado de vínculo
- [x] **Gestión de invitaciones** — invitaciones pendientes + aceptar / rechazar

---

## Módulo 15 — Admin de Flota *(experiencia del rider)*

> El panel de administración de flota vive en **tiendi-vendor**. En tiendi-go, el rider solo ve su pertenencia.

- [x] **Badge de flota en perfil** — logo de flota + nombre + porcentaje de comisión asignado
- [x] **Notificación de invitación a flota** — push + pantalla de detalle antes de aceptar/rechazar

---

## Pantallas transversales / Sistema

- [x] **PT-01 — Error genérico** — 3 variantes: app completa, boundary de componente, 404
- [x] **PT-02 — Sin conexión** — pantalla bloqueante + toasts de reconexión/pérdida
- [x] **PT-03 — Loading skeleton** — 3 variantes: card pedido, lista historial, dashboard
- [x] **PT-04 — Empty state** — 5 variantes: sin pedidos, sin historial, sin notifs, sin resultados, sin logros
- [x] **PT-05 — Modal de confirmación** — bottom sheet estándar + variante crítica con campo textual

---

## Resumen de progreso

| Módulo | Total pantallas | Completadas |
|--------|----------------|-------------|
| 1 — Auth & Registro | 8 | 8 |
| 2 — Perfil y Estado | 4 | 4 |
| 3 — Recepción de Pedidos | 3 | 3 |
| 4 — Flujo de Entrega | 8 | 8 |
| 5 — Navegación / GPS | 3 | 3 |
| 6 — Comunicación | 3 | 3 |
| 7 — Ganancias y Pagos | 5 | 5 |
| 8 — Historial y Stats | 6 | 6 |
| 9 — Calificaciones | 2 | 2 |
| 10 — Configuración | 6 | 6 |
| 11 — Soporte | 4 | 4 |
| 12 — Incentivos | 5 | 5 |
| 13 — Puntuación | 3 | 3 |
| 14 — Repartidores de Confianza | 2 | 2 |
| 15 — Flota (rider view) | 2 | 2 |
| Transversales | 5 | 5 |
| **Total** | **73** | **73** |

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-MODULO-01-AUTH]] — Definición de prototipos: Autenticación y Registro
- [[PROTOTIPOS-MODULO-02-PERFIL]] — Definición de prototipos: Perfil y Estado
- [[PROTOTIPOS-MODULO-03-PEDIDOS]] — Definición de prototipos: Recepción de Pedidos
- [[PROTOTIPOS-MODULO-04-ENTREGA]] — Definición de prototipos: Flujo de Entrega
- [[PROTOTIPOS-MODULO-05-NAVEGACION]] — Definición de prototipos: Navegación y GPS
- [[PROTOTIPOS-MODULO-06-COMUNICACION]] — Definición de prototipos: Comunicación
- [[PROTOTIPOS-MODULO-07-GANANCIAS]] — Definición de prototipos: Ganancias y Pagos
- [[PROTOTIPOS-MODULO-08-HISTORIAL]] — Definición de prototipos: Historial y Stats
- [[PROTOTIPOS-MODULO-09-CALIFICACIONES]] — Definición de prototipos: Calificaciones
- [[PROTOTIPOS-MODULO-10-CONFIGURACION]] — Definición de prototipos: Configuración
- [[PROTOTIPOS-MODULO-11-SOPORTE]] — Definición de prototipos: Soporte y Ayuda
- [[PROTOTIPOS-MODULO-12-INCENTIVOS]] — Definición de prototipos: Incentivos
- [[PROTOTIPOS-MODULO-13-PUNTUACION]] — Definición de prototipos: Puntuación
- [[PROTOTIPOS-MODULO-14-CONFIANZA]] — Definición de prototipos: Repartidores de Confianza
- [[PROTOTIPOS-MODULO-15-FLOTA]] — Definición de prototipos: Flota (rider view)
- [[PROTOTIPOS-TRANSVERSALES]] — Definición de prototipos: Pantallas transversales / Sistema
