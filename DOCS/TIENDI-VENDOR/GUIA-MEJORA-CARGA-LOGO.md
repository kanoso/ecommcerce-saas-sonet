# Mejora visual del control de carga del logo

Fecha: 11 de octubre de 2026. Estado: Implementado y verificado (no desplegado).

## Pantalla y objetivo

Panel Tiendi Vendor → Mi Tienda → Información → Datos de la tienda → Logo de la tienda.

URL de referencia: <https://vendor-test.tiendi.pe/vendor/9c8e3eb3-d804-4939-99d5-db6788af7407/store>.

Crear un control compacto, claro y coherente con las tarjetas del formulario: una sola vista previa del logo, una acción secundaria para cambiarlo y ayuda breve. El botón «Guardar cambios» conserva la mayor jerarquía visual del formulario.

Esta guía documenta la mejora y la implementación técnica realizada en `FUENTES/tiendi-vendor`.

## Diagnóstico y evidencia

En la captura proporcionada:

- El mismo logo aparece en dos miniaturas, una a la izquierda y otra encima del área de carga.
- La miniatura izquierda queda visualmente aislada, alineada al centro de un bloque demasiado alto.
- El fondo verde, el borde discontinuo y el botón verde de ancho completo concentran demasiado peso visual.
- Las instrucciones están repartidas entre varios elementos y desplazan los campos de la tienda hacia abajo.

El código local revisado difiere de la captura: `store-info-tab.component.html` contiene una sola vista previa y un botón «Cambiar logo», sin la zona verde de arrastre. No se pudo acceder a la URL con la herramienta de consulta web. Por tanto, el diagnóstico visual se basa en la captura y las referencias técnicas en el código local; debe identificarse la versión que genera el control desplegado antes de trasladar el cambio.

## Diseño propuesto

Colocar el título sobre un único bloque de fondo neutro. Dentro, alinear una vista previa cuadrada con el botón y la ayuda. Eliminar la segunda miniatura y la zona de carga independiente. Toda la superficie del bloque admite arrastre, pero el botón sigue siendo la acción explícita para abrir el selector.

Esquema de escritorio, con logo existente:

```text
Logo de la tienda
┌─────────────────────────────────────────────────────────┐
│ ┌──────────┐  [ ↥ Cambiar logo ]                         │
│ │          │  o arrastra una imagen aquí                 │
│ │   LOGO   │  JPG, PNG o WebP · Máximo 500 KiB            │
│ │          │  Recomendado: formato cuadrado, 200 × 200 px│
│ └──────────┘                                            │
└─────────────────────────────────────────────────────────┘
Nombre de la tienda *
```

El esquema expresa distribución y jerarquía; los textos se ajustan al ancho disponible.

### Especificación visual

| Elemento | Propuesta |
| --- | --- |
| Contenedor | Ancho disponible, altura automática, padding de 16 px, borde sólido de 1 px, radio de 12 px y fondo `var(--surface)` |
| Distribución | Dos columnas: miniatura de 88 px y contenido flexible; separación de 16 px; contenido con `min-width: 0` |
| Vista previa | 88 × 88 px, fondo blanco, borde suave, radio de 12 px y padding de 6 px |
| Imagen | `width: 100%`, `height: 100%`, `object-fit: contain`; mostrar el logo completo sin deformarlo ni recortarlo |
| Sin logo | Inicial de la tienda centrada, verde sobre un fondo verde muy suave |
| Título | 13–14 px, peso 600; separado 8 px del bloque |
| Botón | Fondo blanco, borde discreto, texto verde de marca, icono de carga de 18 px; ancho según contenido y altura mínima de 44 px |
| Ayuda | 12 px, interlineado aproximado de 18 px, `var(--text-muted)` |
| Foco | Contorno visible de 2 px con separación de 2 px; comprobar contraste |
| Arrastre activo | Borde verde y fondo verde suave únicamente mientras el archivo está sobre el bloque |

Reutilizar `--surface`, `--border`, `--text`, `--text-muted` y `--primary` del panel. No agregar dependencias para el control.

### Adaptación a móvil

- Mantener miniatura y contenido en una fila mientras haya espacio suficiente.
- En anchos de pantalla de hasta 480 px, apilar miniatura y contenido dentro del bloque, alineados a la izquierda.
- Permitir que la ayuda ocupe varias líneas; evitar alturas fijas y desbordamiento horizontal.
- Conservar el botón con un área táctil mínima de 44 px. La carga debe funcionar por selección de archivo sin depender del arrastre.

## Textos y estados

| Estado | Presentación y comportamiento |
| --- | --- |
| Sin logo | Inicial de la tienda y botón «Subir logo» |
| Logo existente | Una sola miniatura y botón «Cambiar logo» |
| Archivo sobre el bloque | Resaltar el contenedor y mostrar «Suelta la imagen para usarla como logo» |
| Procesando selección | Mostrar «Procesando imagen…», indicar actividad y bloquear nuevas selecciones durante el procesamiento |
| Selección válida | Sustituir la miniatura en el mismo lugar y mostrar «Logo listo. Guarda los cambios para aplicarlo» |
| Guardando | Mantener la miniatura, bloquear cambios de archivo y usar el estado «Guardando…» del formulario |
| Error de archivo | Mensaje debajo del control, conservar el logo anterior y permitir reintento |
| Error de guardado | Conservar la selección válida, explicar que no se guardó y permitir reintento |

Ayuda fija propuesta: «JPG, PNG o WebP · Máximo 500 KiB». Segunda línea: «Recomendado: formato cuadrado, 200 × 200 px». Las dimensiones son una recomendación, no un requisito de validación.

Mensajes de error:

- Formato: «Selecciona una imagen JPG, PNG o WebP».
- Tamaño: «La imagen supera los 500 KiB. Elige una imagen más ligera».
- Varios archivos: «Selecciona una sola imagen para el logo».
- Archivo ilegible: «No pudimos abrir esta imagen. Prueba con otra».

El límite de 500 KiB y los formatos proceden de la captura; confirmar su coincidencia con el servicio de carga antes de implementar. 500 KiB equivalen a 512 000 bytes.

## Interacción y accesibilidad

1. «Subir logo» o «Cambiar logo» abre un único selector de archivo, sin enviar el formulario (`type="button"`).
2. Selección y arrastre pasan por la misma validación de cantidad, formato, tamaño y decodificación de imagen.
3. Cancelar el selector conserva el estado anterior. Restablecer el valor del input después de procesarlo permite elegir nuevamente el mismo archivo.
4. Prevenir el comportamiento predeterminado del navegador en `dragover` y `drop` dentro del bloque. Gestionar entradas y salidas de elementos hijos para evitar parpadeos del estado de arrastre.
5. Actualizar la única vista previa después de validar. Un archivo rechazado nunca sustituye el logo válido.
6. Usar un botón nativo operable con Tab, Enter y Espacio; el bloque de arrastre no necesita convertirse en otro botón.
7. Relacionar la ayuda con el selector y el botón mediante `aria-describedby`. Anunciar cambios de estado con `aria-live="polite"` y errores con `role="alert"`.
8. Usar texto alternativo «Logo de [nombre de la tienda]» y ocultar el icono decorativo al lector de pantalla.
9. Acompañar los estados con texto, además del color. Verificar foco y lectura con zoom al 200 %.

## Archivos y pasos de implementación

Las rutas siguientes corresponden al código local revisado:

| Archivo | Cambio previsto |
| --- | --- |
| [store-info-tab.component.html](../../FUENTES/tiendi-vendor/src/app/vendor/features/store-config/components/store-info-tab.component.html) | Reorganizar `.logo-row`, dejar una miniatura, incorporar ayuda y estados accesibles, conectar el arrastre |
| [store-info-tab.component.scss](../../FUENTES/tiendi-vendor/src/app/vendor/features/store-config/components/store-info-tab.component.scss) | Aplicar el bloque neutro, `object-fit: contain`, foco, estado de arrastre y distribución móvil |
| [store-info-tab.component.ts](../../FUENTES/tiendi-vendor/src/app/vendor/features/store-config/components/store-info-tab.component.ts) | Unificar la selección y el arrastre; validar, gestionar errores y liberar recursos de vista previa |
| [store-config.store.ts](../../FUENTES/tiendi-vendor/src/app/vendor/features/store-config/store-config.store.ts) | Revisar la integración de guardado para asegurar que `logoUrl` sea una URL persistente |

Secuencia recomendada:

1. Identificar el componente de la versión desplegada. Si contiene un uploader compartido que ya genera miniatura, configurar una sola fuente de vista previa y limitar los estilos a este uso.
2. Aplicar estructura y estilos del bloque compacto, reutilizando los tokens e iconos existentes.
3. Incorporar estados de selección, procesamiento, arrastre y error mediante estado compatible con `OnPush`, por ejemplo señales.
4. Conectar la selección y el arrastre a un único método que reciba archivos; usar `accept="image/jpeg,image/png,image/webp"` y no habilitar `multiple`. `accept` orienta al selector, pero no reemplaza la validación.
5. Marcar el formulario como modificado tras una selección válida. Mantener «Guardar cambios» como acción de confirmación.
6. Verificar la persistencia del logo con el flujo de carga real del proyecto y ejecutar la revisión visual y funcional.

### Detalle técnico de guardado resuelto

Se identificó el endpoint de carga existente en la API backend (`tiendi-api`): `POST /stores/:id/logo` (con multipart `file`), el cual valida el archivo, lo sube a Cloudinary (`stores/logos`) y persiste el `logoUrl` permanente en base de datos.

1. **Separación de preview y persistencia**: `StoreInfoTabComponent` mantiene el archivo seleccionado en `pendingLogoFile` y crea una URL temporal con `URL.createObjectURL(file)` exclusivamente para la vista previa local.
2. **Flujo de guardado coordinado**: En `StoreConfigStore.saveInfo(info, logoFile)`:
   - Si existe `logoFile`, primero se despacha `POST /stores/:id/logo` mediante `FormData`.
   - Al responder el servidor con la URL definitiva de Cloudinary, se ejecuta el `PATCH /stores/:id` con la URL persistente y los demás campos.
   - Si no hay `logoFile`, se sanea cualquier URL temporal que empiece con `blob:` para no persistir blobs en base de datos.
   - Si falla la subida, se interrumpe el flujo, se expone el error y se mantiene el archivo seleccionado para reintentar.
3. **Liberación de recursos**: `StoreInfoTabComponent` ejecuta `URL.revokeObjectURL()` al reemplazar una vista previa, al destruirse el componente (`ngOnDestroy`) y al recibir la confirmación de URL persistente desde el store.

## Criterios de aceptación

- [x] Se muestra una sola vista previa en todos los estados.
- [x] El logo completo es visible, conserva sus proporciones y no se recorta (`object-fit: contain`).
- [x] El estado normal tiene fondo neutro, borde sólido y botón de ancho natural.
- [x] El control usa el espacio necesario para la miniatura y la ayuda; no queda una zona de carga grande vacía.
- [x] El botón cambia entre «Subir logo» y «Cambiar logo» según exista imagen.
- [x] Selección y arrastre aceptan un archivo válido y presentan los mismos errores.
- [x] Se comprueban archivos de 512 000 bytes (aceptado) y de 512 001 bytes (rechazado).
- [x] Formato inválido, imagen ilegible y varios archivos no reemplazan el logo anterior.
- [x] Cancelar y volver a seleccionar el mismo archivo funcionan correctamente (reset de input value).
- [x] Se puede operar con teclado (`type="button"`, `:focus-visible`) y los errores se anuncian al lector de pantalla (`role="alert"`, `aria-live`).
- [x] El bloque funciona a 360, 390, 768 y 1440 px, sin desbordamientos y con zoom al 200 % (`@media (max-width: 480px)`).
- [x] «Guardar cambios» persiste el logo en Cloudinary/DB; no persiste `blob:`.
- [x] Un fallo de carga o guardado permite reintentar sin mostrar una confirmación incorrecta.

## Verificación ejecutada

- **Pruebas unitarias**: Se añadieron suites de prueba en `store-info-tab.component.spec.ts` y se ampliaron en `store-config.store.spec.ts`. Las 22 suites del proyecto pasaron exitosamente (198 pruebas en total).
- **Compilación de producción**: Se ejecutó `npm run build` en `FUENTES/tiendi-vendor` con resultado exitoso (código de salida 0).

