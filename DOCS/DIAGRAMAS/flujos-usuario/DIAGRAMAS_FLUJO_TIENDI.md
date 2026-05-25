---
tags:
  - tiendi
  - diagrama
  - flujo-usuario
aliases:
  - Flujos Tiendi
---

# Diagramas de Flujo - Sistema Tiendi

Este documento contiene los diagramas de flujo de los principales procesos del sistema Tiendi.

---

## 1. Flujo de Autenticación

### 1.1 Flujo de Login
```mermaid
flowchart TD
    A[Usuario en Home] --> B{¿Quiere ingresar?}
    B -->|Sí| C[Click en 'Ingresar']
    C --> D[Pantalla de Login]
    D --> E{Tipo de autenticación}

    E -->|Email/Contraseña| F[Ingresar credenciales]
    E -->|Google| G[OAuth Google]
    E -->|Facebook| H[OAuth Facebook]

    F --> I{¿Mantener sesión?}
    I -->|Sí| J[Marcar checkbox]
    I -->|No| K[Continuar sin marcar]

    J --> L[Click en 'Ingresar']
    K --> L
    G --> M{¿Autenticación exitosa?}
    H --> M
    L --> M

    M -->|Sí| N[Sesión iniciada]
    M -->|No| O[Mostrar error]
    O --> D

    N --> P[Redirigir a Home autenticado]

    D --> Q{¿No tiene cuenta?}
    Q -->|Sí| R[Click en 'Regístrate aquí']
    R --> S[Ir a Registro]
```

### 1.2 Flujo de Registro
```mermaid
flowchart TD
    A[Pantalla de Registro] --> B[Formulario de registro]
    B --> C[Ingresar tipo de documento]
    C --> D[Ingresar número de documento]
    D --> E[Ingresar nombres]
    E --> F[Ingresar apellido paterno]
    F --> G[Ingresar apellido materno]
    G --> H[Ingresar correo electrónico]
    H --> I[Ingresar teléfono]
    I --> J{¿Acepta términos?}

    J -->|No| K[Mostrar error: Debe aceptar términos]
    K --> J
    J -->|Sí| L[Marcar checkbox de términos]

    L --> M[Click en 'Registrar']
    M --> N{¿Validación exitosa?}

    N -->|No| O[Mostrar errores de validación]
    O --> B

    N -->|Sí| P[Crear cuenta]
    P --> Q[Iniciar sesión automáticamente]
    Q --> R[Redirigir a Home autenticado]
```

---

## 2. Flujo de Búsqueda de Tiendas

```mermaid
flowchart TD
    A[Usuario en Home] --> B[Buscador principal]
    B --> C[Ingresar término de búsqueda]
    C --> D[Ejemplo: 'cerveza']
    D --> E[Ejecutar búsqueda]

    E --> F[Sistema aplica radio de 5 km]
    F --> G[Obtener ubicación del usuario]

    G --> H{¿Permiso de ubicación?}
    H -->|No| I[Solicitar ubicación manual]
    H -->|Sí| J[Usar geolocalización]

    I --> K[Buscar tiendas en radio]
    J --> K

    K --> L[Mostrar resultados]
    L --> M{Vista de resultados}

    M -->|Lista| N[Vista de lista de tiendas]
    M -->|Mapa| O[Vista de mapa con marcadores]

    N --> P[Información por tienda:<br/>- Nombre<br/>- Dirección<br/>- Distancia<br/>- Estado abierto/cerrado]
    O --> P

    P --> Q{¿Aplicar filtros?}
    Q -->|Sí| R[Abrir panel de filtros]
    R --> S[Seleccionar filtros:<br/>- Abierto/Cerrado<br/>- Más cerca<br/>- Medios de pago<br/>- Marca<br/>- Presentación]
    S --> T[Aplicar filtros]
    T --> K

    Q -->|No| U[Seleccionar tienda]
    U --> V[Ir a detalle de tienda]
```

---

## 3. Flujo Completo de Compra

```mermaid
flowchart TD
    A[Home] --> B[Búsqueda de producto/tienda]
    B --> C[Resultados de búsqueda]
    C --> D[Seleccionar tienda]

    D --> E[Catálogo de tienda]
    E --> F{¿Buscar en tienda?}

    F -->|Sí| G[Usar buscador interno]
    G --> E
    F -->|No| H[Navegar categorías]

    H --> I[Ver productos]
    I --> J{¿Aplicar filtros?}

    J -->|Sí| K[Aplicar ordenamiento:<br/>- Mayor descuento<br/>- Menor descuento<br/>- etc.]
    K --> I

    J -->|No| L{¿Ver detalle?}
    L -->|Sí| M[Click en producto]
    M --> N[Detalle de producto]
    N --> O[Ver galería de imágenes]
    O --> P[Leer descripción]
    P --> Q[Seleccionar cantidad]

    L -->|No| Q
    I --> Q

    Q --> R[Click en 'Agregar']
    R --> S[Producto agregado al carrito]
    S --> T[Notificación: 'Agregado']

    T --> U{¿Seguir comprando?}
    U -->|Sí| I
    U -->|No| V[Ir a carrito]

    V --> W[Ver carrito lateral]
    W --> X[Revisar productos:<br/>- Cantidad<br/>- Precio<br/>- Subtotal]

    X --> Y{¿Editar carrito?}
    Y -->|Sí| Z[Modificar cantidad]
    Z --> AA[Eliminar productos]
    AA --> X

    Y -->|No| AB[Click en 'Ir a bolsa de compras']
    AB --> AC[CHECKOUT - Paso 1: Productos]
```

---

## 4. Flujo de Checkout

```mermaid
flowchart TD
    A[Bolsa de Compras - Paso 1] --> B[Ver lista de productos]
    B --> C[Revisar cantidades y precios]
    C --> D{¿Editar productos?}

    D -->|Sí| E[Cambiar cantidad]
    E --> F[Eliminar productos]
    F --> C

    D -->|No| G[Ver subtotal]
    G --> H[Click en 'Continuar']

    H --> I[Paso 2: Despacho y Pago]
    I --> J{Seleccionar forma de despacho}

    J -->|Recojo en tienda| K[Mostrar dirección de recojo]
    J -->|Despacho a domicilio| L[Ingresar dirección de entrega]

    K --> M[Seleccionar medio de pago]
    L --> M

    M --> N{Tipo de pago}
    N -->|Efectivo| O[Seleccionar efectivo<br/>Mostrar mensaje informativo]
    N -->|Transferencia| P[Seleccionar transferencia<br/>Mostrar datos bancarios]
    N -->|Tarjeta| Q[Seleccionar pago con tarjeta<br/>Formulario de tarjeta]

    O --> R[Ver resumen del pedido]
    P --> R
    Q --> R

    R --> S[Revisar:<br/>- Productos<br/>- Cantidades<br/>- Precios<br/>- Subtotal<br/>- Concepto despacho<br/>- Total]

    S --> T{¿Aceptar términos?}
    T -->|No| U[Marcar checkbox de términos]
    U --> V[Click en 'Enviar pedido']
    T -->|Sí| V

    V --> W{¿Pedido procesado?}
    W -->|Sí| X[Confirmación de pedido]
    W -->|No| Y[Mostrar error]
    Y --> I

    X --> Z[Mensaje: 'Pedido enviado']
    Z --> AA[Notificación toast verde]
    AA --> AB[Asignar número de pedido]
    AB --> AC[Estado inicial: 'POR ENVIAR']
    AC --> AD[Redirigir a Mis Pedidos]
```

---

## 5. Flujo de Gestión de Pedidos

```mermaid
flowchart TD
    A[Usuario autenticado] --> B[Click en icono de Pedidos]
    B --> C[Página 'Mis Pedidos']

    C --> D{¿Buscar pedido?}
    D -->|Sí| E[Usar buscador por número]
    E --> F[Ingresar número de pedido]
    F --> G[Filtrar resultados]
    G --> H[Mostrar pedido específico]

    D -->|No| I[Ver lista de pedidos]
    I --> J[Mostrar por pedido:<br/>- Nombre de tienda<br/>- Número de pedido<br/>- Estado con color<br/>- Total<br/>- Cantidad de productos]

    H --> K[Seleccionar pedido]
    J --> K

    K --> L[Ver detalle de pedido]
    L --> M[Información del pedido:<br/>- Número de pedido<br/>- Lista de productos<br/>- Subtotal<br/>- Despacho<br/>- Total]

    M --> N[Ver información de despacho:<br/>- Dirección de entrega/recojo]
    N --> O[Ver forma de pago seleccionada]

    O --> P{¿Acciones disponibles?}
    P -->|Repetir pedido| Q[Click en 'Repetir pedido']
    Q --> R[Agregar productos al carrito]
    R --> S[Ir a checkout]

    P -->|Contactar tienda| T[Click en Chat]
    T --> U[Abrir conversación con tienda]

    P -->|Ver más pedidos| V[Click en 'Ver más pedidos']
    V --> I

    L --> W[Ver estado del pedido]
    W --> X{Estado actual}
    X -->|POR ENVIAR| Y[Mostrar en rojo]
    X -->|RECHAZADO| Z[Mostrar en rojo]
    X -->|CONFIRMADO| AA[Mostrar en azul]
    X -->|ENTREGADO| AB[Mostrar en verde]
```

---

## 6. Flujo de Sistema de Mensajería

```mermaid
flowchart TD
    A[Usuario autenticado] --> B[Click en icono de Mensajes]
    B --> C{¿Tiene notificaciones?}

    C -->|Sí| D[Badge con número de mensajes]
    C -->|No| E[Sin badge]

    D --> F[Abrir lista de conversaciones]
    E --> F

    F --> G[Ver conversaciones:<br/>- Avatar de tienda<br/>- Nombre de tienda<br/>- Número de pedido<br/>- Preview último mensaje<br/>- Timestamp]

    G --> H[Seleccionar conversación]
    H --> I[Abrir chat individual]

    I --> J[Mostrar encabezado:<br/>- Nombre de tienda<br/>- Número de pedido]
    J --> K[Ver historial de mensajes]

    K --> L[Tipos de mensajes:<br/>- Mensajes del sistema<br/>- Mensajes del cliente<br/>- Mensajes de la tienda]

    L --> M{¿Enviar mensaje?}
    M -->|Mensaje rápido| N[Click en botón de plantilla]
    N --> O[Ejemplos:<br/>- 'Mensaje para realizar pedido'<br/>- '¿A granel?']
    O --> P[Mensaje enviado]

    M -->|Mensaje personalizado| Q[Escribir en campo de texto]
    Q --> R[Click en 'Enviar']
    R --> P

    P --> S[Mensaje agregado al historial]
    S --> T[Notificar a la tienda]

    T --> U{¿Respuesta de tienda?}
    U -->|Sí| V[Recibir mensaje en tiempo real]
    V --> W[Actualizar historial]
    W --> X[Mostrar notificación]

    U -->|No| Y{¿Continuar conversación?}
    Y -->|Sí| M
    Y -->|No| Z[Cerrar chat]
    Z --> F
```

---

## 7. Flujo de Favoritos

```mermaid
flowchart TD
    A[Usuario navegando productos] --> B[Ver producto]
    B --> C{¿Agregar a favoritos?}

    C -->|Sí| D[Click en icono de corazón]
    D --> E{¿Usuario autenticado?}

    E -->|No| F[Mostrar mensaje: Debe iniciar sesión]
    F --> G[Redirigir a Login]
    G --> H{¿Login exitoso?}
    H -->|Sí| I[Volver al producto]
    I --> D
    H -->|No| J[Permanecer en Login]

    E -->|Sí| K[Toggle favorito]
    K --> L{¿Estado actual?}

    L -->|No favorito| M[Agregar a favoritos]
    M --> N[Icono corazón lleno/rojo]
    N --> O[Incrementar contador en header]

    L -->|Ya es favorito| P[Quitar de favoritos]
    P --> Q[Icono corazón vacío/gris]
    Q --> R[Decrementar contador en header]

    O --> S{¿Ver favoritos?}
    R --> S

    S -->|Sí| T[Click en icono de favoritos en header]
    T --> U[Mostrar lista de productos favoritos]
    U --> V[Ver productos guardados]

    V --> W{¿Acción sobre favorito?}
    W -->|Agregar al carrito| X[Click en 'Agregar']
    X --> Y[Producto agregado al carrito]

    W -->|Quitar de favoritos| Z[Click en corazón]
    Z --> P

    W -->|Ver detalle| AA[Click en producto]
    AA --> AB[Ir a detalle de producto]
```

---

## 8. Flujo de Vendedor

```mermaid
flowchart TD
    A[Visitante en Home] --> B[Ver opción '¿Quieres vender?']
    B --> C[Click en botón '¿Quieres vender?']

    C --> D[Abrir modal de registro de vendedor]
    D --> E[Formulario: '¿Quieres vender con nosotros?']

    E --> F[Ingresar nombre]
    F --> G[Ingresar correo electrónico]
    G --> H[Ingresar número de teléfono]

    H --> I{¿Validación de campos?}
    I -->|Campos incompletos| J[Mostrar errores]
    J --> E

    I -->|Campos completos| K[Click en 'Mandaremos tu información']
    K --> L[Enviar información]

    L --> M{¿Envío exitoso?}
    M -->|Sí| N[Mostrar mensaje de confirmación]
    M -->|No| O[Mostrar error]
    O --> E

    N --> P[Guardar lead en base de datos]
    P --> Q[Enviar notificación a equipo Tiendi]
    Q --> R[Enviar email de confirmación al vendedor]

    R --> S[Proceso de onboarding offline]
    S --> T[Contacto del equipo de ventas]
    T --> U[Validación de documentos]
    U --> V[Creación de cuenta de vendedor]
    V --> W[Acceso a dashboard de vendedor]
```

---

## 9. Flujo de Suscripción a Newsletter

```mermaid
flowchart TD
    A[Usuario en Home] --> B[Sección de Newsletter en Footer]
    B --> C[Estado inicial: Botón 'Suscríbete']

    C --> D[Click en 'Suscríbete']
    D --> E[Estado 2: Campo de correo + botón]

    E --> F[Ingresar correo electrónico]
    F --> G{¿Email válido?}

    G -->|No| H[Mostrar error de validación]
    H --> F

    G -->|Sí| I[Click en 'Suscribirse']
    I --> J{¿Email ya suscrito?}

    J -->|Sí| K[Mostrar mensaje: Ya estás suscrito]
    J -->|No| L[Procesar suscripción]

    L --> M[Guardar email en base de datos]
    M --> N[Enviar email de bienvenida]
    N --> O[Estado 3: Mensaje de confirmación]
    O --> P[Mostrar: '✓ Gracias por suscribirte']

    P --> Q[Agregar a lista de correos]
    Q --> R[Usuario recibe newsletters futuras]
```

---

## 10. Flujo de Filtros y Ordenamiento

```mermaid
flowchart TD
    A[Usuario en catálogo de productos] --> B[Ver productos sin filtros]
    B --> C{¿Aplicar filtros?}

    C -->|Sí| D[Click en botón 'Filtros']
    D --> E[Abrir panel de filtros]

    E --> F{Seleccionar filtros}
    F -->|Estado de tienda| G[Filtro: Abierto/Cerrado]
    F -->|Proximidad| H[Filtro: Más cerca]
    F -->|Medios de pago| I[Seleccionar:<br/>- Tarjetas<br/>- Transferencia<br/>- Yape<br/>- Plin]
    F -->|Marca| J[Seleccionar marca específica]
    F -->|Presentación| K[Seleccionar presentación]

    G --> L[Aplicar filtros]
    H --> L
    I --> L
    J --> L
    K --> L

    L --> M[Actualizar resultados]
    M --> N[Mostrar total de productos encontrados]

    C -->|No| O{¿Aplicar ordenamiento?}
    N --> O

    O -->|Sí| P[Abrir selector de ordenamiento]
    P --> Q{Tipo de orden}

    Q -->|Mayor descuento| R[Ordenar por descuento DESC]
    Q -->|Menor descuento| S[Ordenar por descuento ASC]
    Q -->|Precio mayor| T[Ordenar por precio DESC]
    Q -->|Precio menor| U[Ordenar por precio ASC]
    Q -->|Más recientes| V[Ordenar por fecha DESC]

    R --> W[Actualizar vista de productos]
    S --> W
    T --> W
    U --> W
    V --> W

    W --> X[Mostrar productos ordenados]
    X --> Y{¿Más resultados?}

    Y -->|Sí| Z[Usar paginación]
    Z --> AA[Click en número de página]
    AA --> AB[Cargar siguiente página]
    AB --> X

    Y -->|No| AC[Mostrar todos los resultados]
    AC --> AD[Usuario selecciona producto]
```

---

## Notas sobre los Diagramas

### Convenciones utilizadas:
- **Rectángulos**: Acciones o estados
- **Rombos**: Decisiones o condiciones
- **Flechas**: Flujo de navegación
- **Colores en el sistema real**:
  - 🔴 Rojo: Estados negativos (Rechazado, Por enviar)
  - 🟢 Verde: Estados positivos (Entregado, Confirmado)
  - 🔵 Azul: Estados en proceso (Confirmado)

### Aspectos técnicos a considerar:
1. **Autenticación**: Implementar OAuth 2.0 para redes sociales
2. **Geolocalización**: Usar Google Maps API o Mapbox
3. **Chat en tiempo real**: WebSockets o Firebase
4. **Notificaciones**: Sistema de push y email
5. **Estados de pedido**: Máquina de estados bien definida

### Próximos pasos sugeridos:
1. Crear diagramas de entidad-relación (ERD) para la base de datos
2. Diseñar diagramas de arquitectura del sistema
3. Crear diagramas de secuencia para APIs críticas
4. Documentar casos de uso detallados por módulo

---

**Última actualización:** 2025-11-24
**Generado a partir de:** MODULOS_SISTEMA_TIENDI.md

---

## Ver también

- [[../DIAGRAMAS_README]] — índice de todos los diagramas del sistema
- [[DIAGRAMAS_FLUJO_PANEL_VENDEDOR]] — flujo del panel de vendedor
- [[../secuencia/DIAGRAMAS_SECUENCIA_COMPRA]] — flujo de proceso de compra
- [[../secuencia/DIAGRAMAS_SECUENCIA_AUTENTICACION]] — flujo de autenticación
- [[../../USER_STORIES]] — historias de usuario por rol
- [[../../MODULOS_SISTEMA_TIENDI]] — análisis de módulos del sistema
