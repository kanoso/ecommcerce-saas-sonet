---
tags:
  - tiendi-go
  - prototipo
  - modulo/auth
  - mobile
  - react-native
  - diseño/ux
aliases:
  - Prototipos Auth
  - M01 Auth
---

# Tiendi Go — Definición de Prototipos
# Módulo 1: Autenticación y Registro

> **Plataforma:** React Native (Expo) — Mobile only  
> **Referencia funcional:** [`FUNCIONALIDADES.md §1`](./FUNCIONALIDADES.md)  
> **Checklist:** [`PROTOTIPOS-CHECKLIST.md`](./PROTOTIPOS-CHECKLIST.md)

---

## Convenciones

- Diseño **mobile-first**, resolución base: 390×844px (iPhone 14 / equivalente Android)
- Sistema de colores: primario `#FF6B00` (naranja Tiendi), fondo `#FFFFFF`, texto `#1A1A1A`
- Tipografía: Inter — H1 24px bold / H2 18px semibold / Body 16px regular / Caption 13px regular
- Bordes de inputs: `1px #E0E0E0` → activo `2px #FF6B00` → error `2px #E53935`
- Botón primario: `bg #FF6B00`, texto blanco, `border-radius 12px`, altura `52px`
- Botón secundario: borde `1px #FF6B00`, texto `#FF6B00`, fondo transparente

---

## P01-01 — Splash / Carga inicial

**Propósito:** verificar token almacenado y redirigir sin fricción al destino correcto.

### Layout

```
┌─────────────────────────────┐
│                             │
│                             │
│                             │
│         [LOGO]              │  ← centrado vertical y horizontal
│       tiendi go             │  ← subtítulo en Caption, color #FF6B00
│                             │
│                             │
│       ●  ●  ●               │  ← loading dots animados (no spinner)
│                             │
│                             │
└─────────────────────────────┘
```

### Lógica de navegación

| Condición | Destino |
|---|---|
| Token válido + rider aprobado | Home (Módulo 3) |
| Token válido + rider pendiente | P01-06 Pendiente de revisión |
| Token válido + rider suspendido | P01-07 Cuenta suspendida |
| Sin token / token expirado | P01-02 Login |

### Estados

- **Único estado:** carga silenciosa, sin interacción del usuario
- Duración máxima: 2s; si el check falla, redirige a Login con error toast

> [!NOTE]
> Sin status bar de contenido — pantalla full screen.

> [!TIP]
> Fondo blanco puro; el logo ocupa ~40% del ancho de pantalla.

> [!TIP]
> La animación de dots debe ser suave (ease-in-out, 400ms por dot).

---

## P01-02 — Login

**Propósito:** autenticación recurrente con email/teléfono + contraseña o biométrico.

### Layout

```
┌─────────────────────────────┐
│  [logo pequeño]   tiendi go │  ← header compacto, 48px alto
├─────────────────────────────┤
│                             │
│   Bienvenido de nuevo       │  ← H1
│   Ingresá para continuar    │  ← caption, gris #757575
│                             │
│  ┌───────────────────────┐  │
│  │ 📧 Email o teléfono   │  │  ← input con ícono izquierda
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🔒 Contraseña      👁 │  │  ← ícono de toggle visibilidad
│  └───────────────────────┘  │
│                             │
│              Olvidé mi clave│  ← link alineado a la derecha
│                             │
│  ┌───────────────────────┐  │
│  │      Ingresar         │  │  ← botón primario
│  └───────────────────────┘  │
│                             │
│  ─────────── o ───────────  │
│                             │
│  ┌───────────────────────┐  │
│  │  🔑  Usar huella / Face│  │  ← botón secundario, visible solo si habilitado
│  └───────────────────────┘  │
│                             │
│  ¿No tenés cuenta?  Registrate│  ← footer link
│                             │
└─────────────────────────────┘
```

### Estados del formulario

| Estado | Comportamiento visual |
|---|---|
| Idle | Inputs con borde gris, botón naranja activo |
| Loading | Botón con spinner, inputs deshabilitados |
| Error credenciales | Toast rojo inferior: "Email o contraseña incorrectos" |
| Error cuenta pendiente | Navega a P01-06 con banner informativo |
| Error cuenta suspendida | Navega a P01-07 |
| Error red | Toast: "Sin conexión. Revisá tu internet." |

### Validaciones inline

- Email: formato válido al perder foco
- Teléfono: 9 dígitos, empieza con 9 (Perú)
- Contraseña: mínimo 8 caracteres (solo validado al submit)

> [!IMPORTANT]
> El botón biométrico solo se renderiza si el rider lo habilitó previamente en Configuración.

> [!NOTE]
> El link "Olvidé mi clave" abre un bottom sheet, no navega a otra pantalla.

> [!TIP]
> El teclado numérico aparece automáticamente si el campo detecta que empieza con dígito.

---

## P01-03 — Registro: Paso 1 — Datos personales

**Propósito:** capturar identidad básica del rider para crear la cuenta.

### Layout

```
┌─────────────────────────────┐
│ ←   Crear cuenta        1/3 │  ← header con back arrow + step indicator
├─────────────────────────────┤
│  ━━━━━━━━━━━━━              │  ← progress bar, 33% naranja
│                             │
│   Tus datos personales      │  ← H1
│   Los usamos para verificar │  ← caption gris
│   tu identidad.             │
│                             │
│  ┌───────────────────────┐  │
│  │ Nombre completo       │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 🇵🇪 +51  Teléfono     │  │  ← prefijo fijo, no editable
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Email                 │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Contraseña         👁 │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Repetir contraseña 👁 │  │
│  └───────────────────────┘  │
│                             │
│  [ ] Acepto los Términos    │  ← checkbox + link a documento legal
│      y condiciones          │
│                             │
│  ┌───────────────────────┐  │
│  │      Continuar →      │  │
│  └───────────────────────┘  │
│                             │
│  ¿Ya tenés cuenta?  Ingresá │
└─────────────────────────────┘
```

### Validaciones

| Campo | Regla |
|---|---|
| Nombre completo | Mínimo 2 palabras, solo letras y espacios |
| Teléfono | 9 dígitos, empieza con 9 |
| Email | Formato RFC |
| Contraseña | Mín. 8 chars, al menos 1 número |
| Confirmar contraseña | Debe coincidir |
| Términos | Requerido para habilitar el botón |

### Indicador de fortaleza de contraseña

Barra de 3 segmentos debajo del input de contraseña:
- 1 segmento rojo: débil
- 2 segmentos amarillos: media
- 3 segmentos verdes: fuerte

> [!IMPORTANT]
> El botón "Continuar" está deshabilitado hasta que el checkbox esté marcado.

> [!NOTE]
> Los errores aparecen debajo de cada input, no como toast global.

> [!TIP]
> La pantalla es scrollable cuando el teclado sube — asegurar que el botón siempre quede visible.

---

## P01-04 — Registro: Paso 2 — Datos del vehículo

**Propósito:** registrar el medio de transporte que el rider usará para las entregas.

### Layout

```
┌─────────────────────────────┐
│ ←   Crear cuenta        2/3 │
├─────────────────────────────┤
│  ━━━━━━━━━━━━━━━━━━━━━━━    │  ← progress bar 66%
│                             │
│   Tu vehículo               │  ← H1
│   Seleccioná cómo vas a     │  ← caption
│   hacer las entregas.       │
│                             │
│   Tipo de vehículo          │  ← label
│  ┌──────┐┌──────┐┌──────┐  │
│  │ 🛵   ││ 🚲   ││ 🚗   │  │  ← selector de cards (tap para elegir)
│  │ Moto ││ Bici ││ Auto │  │
│  └──────┘└──────┘└──────┘  │
│         ┌──────┐            │
│         │ 🚶   │            │
│         │ A pie│            │
│         └──────┘            │
│                             │
│  [campos condicionales]     │  ← aparecen si tipo ≠ A pie
│  ┌───────────────────────┐  │
│  │ Marca / Modelo        │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Placa (ej: ABC-123)   │  │  ← oculto si tipo = Bici o A pie
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ Color                 │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │      Continuar →      │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Campos condicionales por tipo de vehículo

| Campo | Moto | Bici | Auto | A pie |
|---|---|---|---|---|
| Marca / Modelo | ✅ | ✅ | ✅ | ❌ |
| Placa | ✅ | ❌ | ✅ | ❌ |
| Color | ✅ | ✅ | ✅ | ❌ |

> [!TIP]
> El card seleccionado tiene borde naranja `2px #FF6B00` y fondo `#FFF3E0`.

> [!TIP]
> Los campos condicionales aparecen con animación de slide-down (200ms).

> [!IMPORTANT]
> El botón "Continuar" deshabilita si el tipo de vehículo no está seleccionado.

---

## P01-05 — Registro: Paso 3 — Documentos

**Propósito:** recopilar documentos de identidad y habilitación para la validación por el admin.

### Layout

```
┌─────────────────────────────┐
│ ←   Crear cuenta        3/3 │
├─────────────────────────────┤
│  ━━━━━━━━━━━━━━━━━━━━━━━━━  │  ← progress bar 100%
│                             │
│   Documentos                │  ← H1
│   Subí fotos claras y       │  ← caption
│   sin recortes.             │
│                             │
│  ┌───────────────────────┐  │
│  │ 📷 Foto de perfil     │  │
│  │ [preview o placeholder│  │  ← toca para abrir cámara/galería
│  │      + agregar]       │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 🪪 DNI — Frente       │  │
│  │      [+ agregar]      │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 🪪 DNI — Dorso        │  │
│  │      [+ agregar]      │  │
│  └───────────────────────┘  │
│                             │
│  [documentos condicionales] │
│  ┌───────────────────────┐  │
│  │ 📄 Licencia de conducir│ │  ← solo si tipo = Moto o Auto
│  │      [+ agregar]      │  │
│  └───────────────────────┘  │
│  ┌───────────────────────┐  │
│  │ 📄 SOAT vigente       │  │  ← solo si tipo = Moto o Auto
│  │      [+ agregar]      │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │   Enviar solicitud ✓  │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Comportamiento de cada slot de documento

```
Estado vacío:   [ ícono + texto "Toca para agregar" ] borde punteado gris
Estado cargando: spinner centrado + barra de progreso de upload
Estado listo:   preview de imagen con ícono ✓ verde + botón "cambiar"
Estado error:   borde rojo + mensaje "Imagen demasiado pequeña o borrosa"
```

### Sheet de selección de fuente (al tocar un slot)

Bottom sheet con dos opciones:
- 📷 Tomar foto
- 🖼️ Elegir de galería

### Documentos requeridos por tipo de vehículo

| Documento | Moto | Bici | Auto | A pie |
|---|---|---|---|---|
| Foto de perfil | ✅ | ✅ | ✅ | ✅ |
| DNI frente | ✅ | ✅ | ✅ | ✅ |
| DNI dorso | ✅ | ✅ | ✅ | ✅ |
| Licencia | ✅ | ❌ | ✅ | ❌ |
| SOAT | ✅ | ❌ | ✅ | ❌ |

> [!IMPORTANT]
> Máximo tamaño de archivo: 10MB por imagen. Se aplica compresión automática antes del upload.

> [!IMPORTANT]
> El botón "Enviar solicitud" solo se activa cuando todos los documentos requeridos están subidos.

> [!NOTE]
> Al presionar "Enviar" se muestra un loading overlay y luego navega a P01-06.

---

## P01-06 — Pendiente de revisión

**Propósito:** informar al rider que su solicitud fue recibida y está siendo revisada.

### Layout

```
┌─────────────────────────────┐
│                             │
│                             │
│       [ilustración]         │  ← rider con reloj de arena, color naranja
│                             │
│   ¡Solicitud enviada!       │  ← H1, centrado
│                             │
│  Estamos revisando tus      │  ← body text centrado
│  documentos. Te avisamos    │
│  por WhatsApp y email       │
│  cuando estés aprobado.     │
│                             │
│  ┌───────────────────────┐  │
│  │ Tiempo estimado: 24-48h│ │  ← card informativo, fondo #FFF3E0
│  └───────────────────────┘  │
│                             │
│  Qué pasa ahora:            │  ← H2
│  1. Revisamos tus datos     │
│  2. Validamos tus documentos│
│  3. Te notificamos          │
│                             │
│  ┌───────────────────────┐  │
│  │  Contactar soporte    │  │  ← botón secundario
│  └───────────────────────┘  │
│                             │
│         Cerrar sesión       │  ← link texto, color gris
│                             │
└─────────────────────────────┘
```

### Estados posibles al abrir la app estando en este estado

- El rider puede volver a esta pantalla haciendo login
- Si el admin aprobó → navega automáticamente al Onboarding (P01-08)
- Si el admin rechazó → muestra bottom sheet con motivo de rechazo + opción de re-enviar documentos

> [!IMPORTANT]
> No hay navegación hacia atrás — el back button está deshabilitado en esta pantalla.

> [!NOTE]
> "Contactar soporte" abre WhatsApp con número predefinido y mensaje pre-cargado.

> [!NOTE]
> Esta pantalla se actualiza en cada login para re-verificar el estado del rider.

---

## P01-07 — Cuenta suspendida

**Propósito:** notificar al rider que su cuenta fue suspendida por el administrador.

### Layout

```
┌─────────────────────────────┐
│                             │
│                             │
│       [ilustración]         │  ← candado o señal de stop, color rojo #E53935
│                             │
│   Cuenta suspendida         │  ← H1, centrado
│                             │
│  ┌───────────────────────┐  │
│  │ Motivo:               │  │  ← card con borde rojo izquierdo
│  │ [motivo del admin]    │  │
│  └───────────────────────┘  │
│                             │
│  Si creés que es un error,  │  ← body text
│  contactá a soporte.        │
│                             │
│  ┌───────────────────────┐  │
│  │  Contactar soporte    │  │  ← botón primario
│  └───────────────────────┘  │
│                             │
│         Cerrar sesión       │  ← link texto
│                             │
└─────────────────────────────┘
```

> [!NOTE]
> El motivo de suspensión viene del campo `suspensionReason` del API.

> [!NOTE]
> Si el motivo está vacío, mostrar el texto: "No se especificó un motivo."

> [!IMPORTANT]
> No hay forma de reactivar la cuenta desde la app — solo soporte puede hacerlo.

> [!IMPORTANT]
> El back button está deshabilitado en esta pantalla.

---

## P01-08 — Onboarding post-aprobación

**Propósito:** dar la bienvenida al rider aprobado y enseñarle los conceptos clave antes de su primera entrega.

### Estructura general

Carousel de 4 slides con navegación por swipe y dots indicadores.

```
┌─────────────────────────────┐
│                    Saltar   │  ← link en esquina superior derecha
├─────────────────────────────┤
│                             │
│       [ilustración]         │  ← ilustración específica por slide
│                             │
│   Título del slide          │  ← H1 centrado
│                             │
│   Descripción breve del     │  ← body centrado, máximo 3 líneas
│   concepto.                 │
│                             │
│         ●  ○  ○  ○          │  ← dots de progreso
│                             │
│  ┌───────────────────────┐  │
│  │       Siguiente       │  │  ← en el último slide: "¡Empezar!"
│  └───────────────────────┘  │
└─────────────────────────────┘
```

### Contenido de cada slide

| Slide | Ilustración | Título | Descripción |
|---|---|---|---|
| 1/4 | Rider con casco celebrando | ¡Bienvenido a Tiendi Go! | Sos parte de la red de repartidores. Cada entrega que hacés ayuda a negocios locales a crecer. |
| 2/4 | Teléfono con notificación | Así recibís pedidos | Cuando haya un pedido cerca, te llega una oferta. Tenés 30 segundos para aceptarla. |
| 3/4 | Wallet con monedas | Tus ganancias, transparentes | Ves el desglose exacto de cada entrega: distancia, bonos y propinas en tiempo real. |
| 4/4 | Toggle de disponibilidad | Vos manejás tu tiempo | Activá tu disponibilidad cuando quieras trabajar. Desactivala cuando necesites un descanso. |

### Slide final — acción

Al tocar "¡Empezar!" en el slide 4:
1. Marca el onboarding como completado (API PATCH /riders/me/onboarding)
2. Navega a Home con el toggle de disponibilidad en OFF y un tooltip: "Activá tu disponibilidad para empezar a recibir pedidos"

> [!NOTE]
> "Saltar" solo es visible en los slides 1–3; desaparece en el slide 4.

> [!IMPORTANT]
> Tanto "Saltar" como "¡Empezar!" ejecutan la misma acción: marcar el onboarding como completado.

> [!TIP]
> Las ilustraciones deben ser de estilo flat, no fotografías.

> [!TIP]
> El swipe horizontal entre slides debe ser fluido — evitar paginación brusca.

---

## Flujo de navegación completo — Módulo 1

```
Splash (P01-01)
    ├── Token OK + aprobado ──────────────────────────→ Home
    ├── Token OK + pendiente ─────────────────────────→ P01-06
    ├── Token OK + suspendido ────────────────────────→ P01-07
    └── Sin token ────────────────────────────────────→ P01-02 Login
                                                              │
                        ┌─────────────────────────────────────┤
                        │                                     │
                   Registrarse                           Ingresar
                        │                                     │
                  P01-03 Paso 1                         [verifica API]
                        │                                     │
                  P01-04 Paso 2                ┌──────────────┼──────────────┐
                        │                      │              │              │
                  P01-05 Paso 3           aprobado        pendiente     suspendido
                        │                      │              │              │
                  P01-06 Pendiente         P01-08         P01-06         P01-07
                                         Onboarding
                                               │
                                             Home
```

---

## Checklist de este módulo

- [ ] P01-01 — Splash
- [ ] P01-02 — Login
- [ ] P01-03 — Registro Paso 1: Datos personales
- [ ] P01-04 — Registro Paso 2: Datos del vehículo
- [ ] P01-05 — Registro Paso 3: Documentos
- [ ] P01-06 — Pendiente de revisión
- [ ] P01-07 — Cuenta suspendida
- [ ] P01-08 — Onboarding post-aprobación

---

## Ver también

- [[FUNCIONALIDADES]] — Especificación funcional completa de Tiendi Go
- [[PROTOTIPOS-CHECKLIST]] — Checklist global de prototipos (todos los módulos)
- [[PROTOTIPOS-MODULO-02-PERFIL]] — Módulo 2: Perfil y Estado del Repartidor
- [[PROTOTIPOS-MODULO-03-PEDIDOS]] — Módulo 3: Recepción y Gestión de Pedidos
- [[PROTOTIPOS-MODULO-04-ENTREGA]] — Módulo 4: Flujo de Entrega
- [[PROTOTIPOS-MODULO-05-NAVEGACION]] — Módulo 5: Navegación y Geolocalización
- [[PROTOTIPOS-MODULO-06-COMUNICACION]] — Módulo 6: Comunicación
- [[PROTOTIPOS-MODULO-07-GANANCIAS]] — Módulo 7: Ganancias y Pagos
- [[PROTOTIPOS-MODULO-08-HISTORIAL]] — Módulo 8: Historial y Estadísticas
- [[PROTOTIPOS-MODULO-09-CALIFICACIONES]] — Módulo 9: Calificaciones
- [[PROTOTIPOS-MODULO-10-CONFIGURACION]] — Módulo 10: Configuración
- [[PROTOTIPOS-MODULO-11-SOPORTE]] — Módulo 11: Soporte y Ayuda
- [[PROTOTIPOS-MODULO-12-INCENTIVOS]] — Módulo 12: Programa de Incentivos
- [[PROTOTIPOS-MODULO-13-PUNTUACION]] — Módulo 13: Sistema de Puntuación
- [[PROTOTIPOS-MODULO-14-CONFIANZA]] — Módulo 14: Repartidores de Confianza
- [[PROTOTIPOS-MODULO-15-FLOTA]] — Módulo 15: Admin de Flota (rider view)
