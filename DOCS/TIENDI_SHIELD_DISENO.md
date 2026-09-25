# Tiendi Shield — especificación visual del launcher

**Objetivo:** diseñar una entrada memorable, clara y liviana al ecosistema Tiendi. Debe parecer un producto cuidado, no un panel administrativo ni una colección de botones genéricos.

**Estado:** propuesta visual pendiente de aprobación humana (C03). El usuario pidió **solo el diseño**: este documento no encarga desarrollo, autenticación, arquitectura ni despliegues. Paleta, composición y textos son propuestas; no se presentan como marca oficial aprobada.

## 1. Qué debe comunicar

Shield es un launcher público: permite elegir una aplicación y continuar hacia su destino. No requiere una cuenta para mostrar sus accesos.

| Tipo de tarjeta | Acción que debe entender la persona |
|---|---|
| Aplicación web | Abrir su sitio oficial; el destino conserva su propio ingreso |
| Kipu / Go | Ir a la descarga oficial de su APK para Android |

No prometer «una cuenta para todo», «sesión unificada» ni acceso concedido. No incluir formularios de registro, perfil, métricas, sidebar, actividad reciente o pantalla de identidad.

**Inventario visual inicial propuesto:** Tiendi Web, Tiendi Vendor, Kipu y Tiendi Go. Nombres públicos, orden definitivo y publicación se confirman con el responsable (C02). Admin no aparece en el diseño público por defecto. No añadir productos o funciones no confirmados.

## 2. Dirección creativa: editorial cálida

Una sola dirección: **fondo marfil cálido + tipografía de tinta profunda + acento terracota + geometría de gran escala**. La identidad surge del contraste entre un titular expresivo, mucho espacio y tarjetas precisas.

- Sensación: cercana, sólida y contemporánea; no tecnológica fría ni financiera.
- Elemento memorable: composición geométrica estática en el hero, con un arco coral, un rectángulo inclinado y una cápsula marfil sobre tinta. Sugiere puertas de entrada sin simular pantallas ni logos oficiales.
- Las formas acompañan el titular; no son botones, indicadores de estado ni un gráfico de datos.
- Las tarjetas diferencian aplicaciones con ícono, nombre y una pequeña franja cromática; mantienen estructura común.
- Sin video de fondo, efecto 3D, partículas, carruseles, vidrio difuminado o animación continua.

**Marca:** revisar los activos reales antes de dibujar. Logos y convenciones autorizados tienen prioridad; cualquier adaptación debe volver a aprobación. Mientras no existan activos confirmados, usar un wordmark tipográfico «Tiendi Shield» y monogramas claramente identificados como provisionales en la entrega de diseño, nunca como logos oficiales.

## 3. Composición de la página

### Encabezado compacto

- Marca a la izquierda; un único enlace «Aplicaciones» a la derecha, dirigido a la sección de tarjetas.
- Alto propuesto: 80 px en escritorio y 64 px en móvil. Sin posición fija por defecto.
- Separación inferior por línea tenue o espacio, no por sombra pesada.
- No agregar menú hamburguesa para un solo enlace ni botones «Ingresar» / «Crear cuenta».
- Incluir acceso por teclado «Saltar a las aplicaciones», visible al recibir foco.

### Hero editorial

| Elemento | Texto / tratamiento propuesto |
|---|---|
| Antetítulo | «TIENDI SHIELD»; 12 px, peso 600, espaciado moderado |
| Título principal | «Tu mundo Tiendi.\nUn punto de partida.» |
| Apoyo | «Abre las aplicaciones web o descarga Kipu y Go para Android.» |
| Nota de contexto | «Cada aplicación conserva su propio acceso.» |
| Visual lateral | Geometría editorial estática; sin estadísticas ni interfaces ficticias |

El título usa un máximo de dos líneas en escritorio; en móvil admite tres o cuatro sin reducirlo a tamaño de cuerpo. La frase es propuesta de copy, no slogan oficial.

No repetir un gran CTA «Comenzar» que no explica destino: las tarjetas son la acción principal. El enlace de navegación permite saltar a ellas. El hero no debe ocupar una pantalla completa ni esconder el inicio del directorio.

### Sección de aplicaciones

- Título: **«Elige tu aplicación»**.
- Bajada: «Accesos web y descargas para Android.»
- Grilla de cuatro tarjetas: dos columnas en escritorio y tablet; una en móvil.
- Orden propuesto, tanto visual como de lectura: Tiendi Web → Tiendi Vendor → Kipu → Tiendi Go.
- No filtros, búsqueda ni pestañas para cuatro destinos.
- Las tarjetas web ocupan la primera fila; Android la segunda. Las etiquetas y CTA distinguen el tipo sin depender del color.

### Pie de página

Wordmark discreto y texto «Aplicaciones del ecosistema Tiendi». No inventar enlaces legales, soporte, redes sociales o cifras de confianza. Incluirlos únicamente si existen y están aprobados. Sin footer de varias columnas.

## 4. Wireframes y adaptación

### Escritorio — referencia de 1440 px

Contenedor centrado de máximo 1200 px; margen resultante de 120 px. Hero en proporción aproximada 7:5 con separación de 48 px. Tarjetas con separación de 24 px.

```text
┌──────────────────────────────────────────────────────────────┐
│  Tiendi Shield                                Aplicaciones   │
│                                                              │
│  TIENDI SHIELD                     ┌───────────────────────┐ │
│  Tu mundo Tiendi.                  │   Arco / cápsula /    │ │
│  Un punto de partida.              │   plano geométrico    │ │
│  Abre las aplicaciones web…        │   estático            │ │
│  Cada aplicación conserva…        └───────────────────────┘ │
│                                                              │
│  Elige tu aplicación                                         │
│  Accesos web y descargas para Android.                        │
│  ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│  │ [ícono] Tiendi Web  Web  │ │ [ícono] Tiendi Vendor  Web  │ │
│  │ Descripción breve       │ │ Descripción breve           │ │
│  │ [Abrir Tiendi Web  ↗]   │ │ [Abrir Tiendi Vendor  ↗]     │ │
│  └─────────────────────────┘ └─────────────────────────────┘ │
│  ┌─────────────────────────┐ ┌─────────────────────────────┐ │
│  │ [ícono] Kipu    Android │ │ [ícono] Tiendi Go   Android │ │
│  │ Descripción breve       │ │ Descripción breve           │ │
│  │ [Ver descarga de Kipu]  │ │ [Ver descarga de Tiendi Go] │ │
│  └─────────────────────────┘ └─────────────────────────────┘ │
│  Tiendi Shield             Aplicaciones del ecosistema Tiendi │
└──────────────────────────────────────────────────────────────┘
```

### Móvil — referencia de 390 px

Márgenes de 20 px (16 px a 320 px). Hero de una columna. Reducir la geometría a una banda decorativa de hasta 96 px debajo del texto; ocultarla a 320 px si desplaza demasiado las tarjetas. Nunca desplazar el texto fuera de pantalla para conservar el dibujo.

```text
┌──────────────────────────────┐
│ Tiendi Shield   Aplicaciones │
│                              │
│ TIENDI SHIELD                │
│ Tu mundo Tiendi.             │
│ Un punto de                 │
│ partida.                    │
│ Abre las aplicaciones web   │
│ o descarga Kipu y Go…       │
│ Cada aplicación conserva…  │
│ ─── geometría compacta ─── │
│                              │
│ Elige tu aplicación          │
│ Accesos web y descargas…    │
│ ┌──────────────────────────┐ │
│ │ [ícono] Tiendi Web   Web │ │
│ │ Descripción breve       │ │
│ │ [Abrir Tiendi Web     ↗]│ │
│ └──────────────────────────┘ │
│ [Tarjeta Tiendi Vendor]      │
│ [Tarjeta Kipu / Android]     │
│ [Tarjeta Tiendi Go / Android]│
│ Tiendi Shield                │
└──────────────────────────────┘
```

**Reglas responsive:** por debajo de 768 px, una columna; desde 768 px, dos columnas de tarjetas y márgenes mínimos de 32 px. Mantener hero de una columna hasta 1024 px. Sin alturas fijas de texto, truncamientos de CTA ni desplazamiento horizontal. El orden de lectura no cambia entre tamaños.

## 5. Tokens visuales propuestos

### Color

| Token conceptual | Valor | Uso |
|---|---|---|
| Fondo cálido | `#FFF8F3` | Lienzo principal |
| Superficie | `#FFFFFF` | Tarjetas |
| Tinta | `#18212F` | Títulos, wordmark, foco |
| Texto | `#4B5563` | Descripciones y metadatos |
| Acción | `#C83B23` | CTA relleno con texto blanco |
| Acción hover | `#A92E1B` | Estado hover del CTA |
| Coral decorativo | `#FF5A3D` | Formas y detalles; no texto blanco pequeño encima |
| Borde suave | `#E6DCD5` | Separadores decorativos, no único indicador de control |
| Fondo alterno | `#F3EBE4` | Geometría secundaria y etiquetas |

Una sola apariencia clara, sin duplicar diseño oscuro. Cálculo sRGB de pares sólidos: blanco sobre acción terracota, **5.11:1**; tinta sobre fondo cálido, **15.39:1**; texto sobre fondo cálido, **7.19:1**. Blanco sobre coral decorativo alcanza **3.10:1**, por eso no se usa para texto pequeño. Medir también sobre los fondos reales y estados antes de aprobar; estos cálculos no equivalen a una comprobación de accesibilidad de la interfaz.

### Tipografía y espacio

| Elemento | Escritorio | Móvil |
|---|---|---|
| Familia | Sans del sistema; activo tipográfico local autorizado si existe | La misma |
| H1 | 64 / 68 px, peso 700, tracking −0.03 em | 40 / 44 px; 36 / 40 px a 320 px |
| Título de sección | 32 / 38 px, peso 650–700 | 28 / 34 px |
| Nombre de aplicación | 24 / 30 px, peso 650–700 | 22 / 28 px |
| Texto introductorio | 18 / 28 px | 16 / 25 px |
| Cuerpo / CTA | 16 / 24 px; CTA peso 600 | Lo mismo |
| Texto auxiliar | 14 / 21 px | Lo mismo |

- Escala de espacio: 4, 8, 12, 16, 24, 32, 48, 64 y 80 px.
- Padding de tarjeta: 28 px escritorio / 24 px móvil; separación interior de 12–16 px.
- Radio: tarjetas 24 px; CTA 12 px; insignias compactas en cápsula.
- Ícono de app: caja de 48 × 48 px, sin deformar proporciones del logo.
- CTA: altura mínima de 48 px; ancho completo en móvil, ajustado al texto en escritorio.
- Sombra única y tenue propuesta: desplazamiento vertical 8 px, desenfoque 24 px, tinta al 6 %. El borde mantiene separación sin depender de la sombra.
- Separación entre hero y directorio: 64 px escritorio / 40 px móvil. Footer a 64 / 40 px de las tarjetas.

## 6. Anatomía y contenido de las tarjetas

Cada tarjeta contiene: **ícono → nombre + etiqueta → descripción → estado si corresponde → CTA**. Alinear las acciones al pie en filas de escritorio; permitir crecimiento natural del contenido. No convertir toda la tarjeta en un enlace si contiene otra acción.

| Aplicación propuesta | Etiqueta | Descripción de borrador | CTA |
|---|---|---|---|
| Tiendi Web | Web | «Accede a Tiendi desde tu navegador.» | «Abrir Tiendi Web» |
| Tiendi Vendor | Web | «Abre el espacio web de Tiendi Vendor.» | «Abrir Tiendi Vendor» |
| Kipu | Android | «Consulta la descarga oficial de Kipu para Android.» | «Ver descarga de Kipu» |
| Tiendi Go | Android | «Consulta la descarga oficial de Tiendi Go para Android.» | «Ver descarga de Tiendi Go» |

Las descripciones son intencionalmente prudentes: mejorar la propuesta de valor solo después de confirmar funciones y público reales. No inventar ofertas ni capacidades.

Si el destino aprobado es directamente el archivo, sustituir el CTA por **«Descargar APK de Kipu»** / **«Descargar APK de Tiendi Go»**. «Ver descarga» significa ir a una página; «Descargar APK» significa solicitar un archivo. Mostrar indicador de enlace web o descarga junto al texto, sin usar el ícono como único nombre accesible.

Todos los CTA de navegación se representan como enlaces, misma pestaña por defecto. Si un destino requiere una nueva pestaña, explicitarlo en la etiqueta accesible y con señal visual; no abrir ventanas emergentes.

### Detalle de descarga, solo cuando sea necesario

Si ya existe una landing oficial suficiente, no diseñar otra. Si se requiere una superficie propia, reutilizar header, ancho de lectura de 720 px y una tarjeta de descarga con:

1. Enlace «Volver a las aplicaciones», logo verificado, nombre y etiqueta Android.
2. Descripción breve y CTA inequívoco «Descargar APK de [nombre]».
3. Versión, tamaño, origen oficial y acceso a checksum / información de firma, únicamente con datos confirmados por el publicador. No rellenar valores ficticios en una entrega final.
4. Aviso: «Archivo para Android. No es una aplicación para iOS ni una versión de escritorio.» No ofrecer falso botón iOS ni ocultar el aviso según detección invasiva del dispositivo.
5. Nota: «El navegador gestiona la descarga. La instalación se realiza en Android.» No dibujar progreso o éxito de instalación que Shield no puede observar ni instrucciones para desactivar protecciones del dispositivo.

En una maqueta, todo metadato todavía desconocido se rotula como «Por confirmar» y la descarga permanece no disponible. No usar sellos «verificado» o «seguro» sin validación real del publicador.

## 7. Estados e interacción

| Estado | Presentación visual y texto propuesto |
|---|---|
| Disponible | Nombre, descripción, etiqueta y CTA activo; sin punto verde de supuesto uptime |
| APK no publicado | Tarjeta visible; «La descarga todavía no está publicada»; «Descarga no disponible» como texto, sin enlace |
| Enlace retirado | «Este acceso no está disponible por el momento»; retirar acción, conservar explicación |
| Información incompleta | «Estamos confirmando la información de descarga»; sin CTA de descarga habilitado |
| Error observable de una operación real | Mensaje junto a la operación y recuperación pertinente; nunca afirmar monitoreo de destinos externos |

No usar enlaces vacíos, `#` como destino ficticio, skeletons artificiales, barras de carga permanentes ni indicadores de disponibilidad en tiempo real. Un navegador que sale hacia otra web puede no permitir a Shield saber si la navegación falló: no diseñar una falsa confirmación de éxito.

- **Hover:** transición propuesta de 120–180 ms en borde, sombra o color; tarjeta puede elevarse como máximo 2 px. No cambiar dimensiones ni mover el CTA.
- **Foco:** anillo sólido de 3 px, separado 3 px del elemento; verificar visibilidad sobre cada superficie. El foco no depende del hover.
- **Pulsación:** variación tonal discreta, sin rebote ni bloqueo visual permanente.
- **Movimiento reducido:** sin desplazamientos, escalado ni animación de entrada. El contenido se muestra completo desde el inicio.
- **Estado no disponible:** mantener texto legible, no bajar opacidad de toda la tarjeta; explicar la ausencia de acción también para lectores de pantalla.

## 8. Criterios de revisión visual

Estos son criterios del proyecto para aprobar el diseño, no resultados ya comprobados:

- [ ] Capturas completas a 390 y 1440 px, incluyendo estados no disponibles y detalle de descarga si corresponde.
- [ ] Revisiones adicionales a 320 y 768 px; sin solapamientos ni scroll horizontal, con texto ampliado al 200 %.
- [ ] Jerarquía clara: primero propósito, después aplicaciones, finalmente información secundaria.
- [ ] Web y Android se distinguen por texto y acción, no solo color.
- [ ] Orden de teclado lógico; foco visible; controles táctiles de al menos 44 × 44 px.
- [ ] Contraste medido: texto normal al menos 4.5:1; límites/indicadores esenciales de controles y foco al menos 3:1 respecto al fondo adyacente.
- [ ] Un título principal, nombres claros de enlaces, decoraciones ignorables por tecnología asistiva e íconos no redundantes.
- [ ] No UI autenticada, KPIs, testimonios, logos oficiales supuestos ni promesas de SSO.
- [ ] La propuesta no depende de fuentes remotas, videos, fondos pesados o animaciones constantes para ser atractiva.
- [ ] Aprobación humana explícita de móvil/escritorio y activos de marca; distinguir «propuesto», «aprobado» y «verificado».

## 9. Entrega esperada del agente diseñador

Entregar **diseño**, no aplicación: composición móvil/escritorio, variantes de estados, detalle de componentes/tokens y notas de interacción. Puede usar el formato de diseño acordado; no instalar herramientas, generar activos ni escribir código de producto sin un encargo adicional.

Primero contrastar activos y nombres disponibles con este brief; registrar los elementos provisionales. Presentar una sola propuesta coherente y pedir aprobación visual antes de tratarla como definitiva. El esfuerzo visual se concentra en composición, tipografía y proporción, no en agregar funcionalidades.

### Instrucción breve para otro agente

```text
Diseña únicamente la UI/UX del launcher Tiendi Shield siguiendo
DOCS/TIENDI_SHIELD_DISENO.md. Presenta la dirección editorial cálida en
móvil (390 px) y escritorio (1440 px), tarjetas web y Android, y estados.
Usa marca verificada o identifica claramente los activos provisionales.
Respeta el alcance E1: enlaces web y descarga APK de Kipu/Go, sin login.
No construyas la aplicación, backend, registro ni identidad E2.
No inventes funciones, URLs, APK, métricas o resultados de accesibilidad.
Entrega una propuesta visual concreta para aprobación humana C03.
```

## Referencias de alcance

- [Visión del launcher](TIENDI_LAUNCHER.md).
- [Guía vigente E1/E2](TIENDI_LAUNCHER_IMPLEMENTACION.md).
- [Decisiones y gates C02/C03](TIENDI_SHIELD-ADRS-DRAFT.md).

Estas referencias gobiernan el alcance. Este archivo detalla exclusivamente el diseño visual de E1 y no reemplaza sus decisiones ni aprueba contratos pendientes.
