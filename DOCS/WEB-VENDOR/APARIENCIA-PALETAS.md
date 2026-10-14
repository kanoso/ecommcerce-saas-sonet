# Apariencia de tienda: identidad, paleta y portada

La sección Apariencia de Vendor configura el diseño existente de Web. No cambia la distribución, dimensiones, favoritos ni lógica de compra de los productos.

- Identidad: nombre visible y logo, usando los campos existentes `name` y `logoUrl`.
- Paleta: cuatro combinaciones predefinidas y edición individual de `primaryColor`, `secondaryColor`, `backgroundColor` y `textColor`.
- Portada: banner, `bannerVisible`, `bannerHeight` y mensaje de bienvenida.
- Vista previa ilustrativa en escritorio y móvil con productos de ejemplo y la estructura actual de cabecera, búsqueda, categorías, portada y catálogo.

Los colores adicionales y la altura son opcionales. Las tiendas existentes conservan sus valores y estilos anteriores hasta guardar su configuración. La altura automática usa los estilos responsive actuales; una altura explícita acepta 100–400 px y se limita a 160 px en móvil. Ocultar el banner conserva su URL y el mensaje de bienvenida.

La API valida los colores `#RRGGBB`, normaliza su escritura a mayúsculas y expone los nuevos campos tanto en la consulta pública por slug como en la consulta de Vendor por ID. Web limpia la paleta al cambiar a una tienda sin configuración o abandonar el catálogo.

## Publicación

Antes de publicar la nueva API, aplicar desde `FUENTES/tiendi-api` la migración incluida:

```powershell
npx prisma migrate deploy
npx prisma generate
```

La migración `20261014000000_store_appearance_palette` es aditiva. Fue aplicada correctamente en TEST el 2026-10-14, antes de activar la API nueva.

Publicar primero la API compatible y después Vendor y Web. Los uploads de logo y banner conservan el flujo existente, que persiste el archivo al subirlo; el botón Guardar apariencia guarda la identidad y el resto de la configuración.

## Validación

Pruebas de API, editor y estado de Vendor, tema y portada de Web; compilación de las tres aplicaciones; revisión del editor Angular real en navegador a 1250 y 390 px. Se verificó el cambio de paleta sin alterar el nombre, el guardado, ocultar el banner sin perderlo, el aislamiento entre tiendas y el modo de solo lectura.

## Despliegue TEST verificado: 2026-10-14

Servidor Ubuntu `192.168.1.51`, acceso SSH `tiendi-admin`. Se incorporaron las fuentes recientes de API (`c3bbbc1`) y Vendor (`4c0782a`) antes de desplegar, preservando chat y notificaciones. Web parte de `0c7e0e1`. API y Vendor volvieron a superar sus 64 pruebas afectadas y builds; las 16 pruebas de Web ya habían pasado sobre el mismo código.

El primer despliegue utilizó snapshots de las fuentes locales modificadas. Los identificadores siguientes son identificadores de artefacto, no SHA de Git. Posteriormente, los cambios se publicaron en `master` de cada aplicación para desplegarlos mediante CI/CD (ver abajo).

| Aplicación | Release |
|---|---|
| API | `appearance-fbfd35b5f23deed3` |
| Web | `appearance-109cbd34c55238de` |
| Vendor | `appearance-f883a7c0c10c3fb5` |

- Paquetes, hashes SHA-256 completos, fuentes anteriores y logs: `/opt/tiendi/staging/appearance-20261014/`.
- Respaldo previo de PostgreSQL: `/opt/tiendi/backups/appearance-20261014-before.dump`, legibilidad comprobada con `pg_restore --list`; no se hizo un ensayo completo de restauración.
- El despliegue existente creó además su respaldo previo y registró releases en `/opt/tiendi/releases/history.jsonl` y `/opt/tiendi/source-manifest.json`.
- Migración aplicada: únicamente `20261014000000_store_appearance_palette`; no había migraciones fallidas pendientes.
- API saludable por acceso directo y proxy LAN; endpoint público de Tienda Test2 devuelve los nuevos campos y conserva sus valores previos.
- Web y Vendor responden por sus URLs públicas; Vendor sirve el bundle nuevo y la sección de paletas.
- Playwright sobre Web desplegada: logo, buscador y banner visibles; paleta secundaria y banner oculto verificados mediante respuesta simulada solo en el navegador, en escritorio y móvil, sin modificar datos guardados. Sin errores JavaScript capturados. No se probó un guardado autenticado de Vendor contra TEST.
- Capturas locales: `outputs/appearance-test-deployed.png`, `outputs/appearance-test-palette-fixture.png`, `outputs/appearance-test-mobile.png`.

## Publicación en GitHub

| Aplicación | Commit publicado en master | Pipeline TEST |
|---|---|---|
| API | `f375bd1ff3d415c0a2bcdf20e588ec4a5f14ab5d` | [Run 38521764948](https://github.com/kanoso/tiendi-api/actions/runs/38521764948) |
| Web | `fdf0b884664f47f48436ceef032e27e66e128824` | [Run 38521749105](https://github.com/kanoso/tiendi-web/actions/runs/38521749105) |
| Vendor | `8f01264f5cae8a71ce108040c06423a41864b0e6` | [Run 38521768437](https://github.com/kanoso/tiendi-vendor/actions/runs/38521768437) |

La comprobación local previa al push incluyó lint de los tres repositorios y las 311 pruebas completas de Vendor. Se corrigió el formato de una prueba de API para cumplir su regla Prettier.

Los tres pipelines anteriores completaron las validaciones y el despliegue con resultado `success`. En la comprobación posterior, TEST ya tenía commits más recientes que incluyen los commits de apariencia como antecesores:

| Aplicación | Commit activo verificado | Último despliegue exitoso |
|---|---|---|
| API | `608be33e25edf67207f09bd0bd705498060b907f` | [Run 38526101843](https://github.com/kanoso/tiendi-api/actions/runs/38526101843) |
| Web | `7b479f70f8806b7438c8bc58e6baff5c609bf2c3` | [Run 38532448564](https://github.com/kanoso/tiendi-web/actions/runs/38532448564) |
| Vendor | `727f07e6acf508e0d7440afcbbaadc54d4830a82` | [Run 38529202255](https://github.com/kanoso/tiendi-vendor/actions/runs/38529202255) |

El manifiesto del servidor coincide con esos commits. La API responde saludable y la revisión Playwright de Web desplegada volvió a pasar en escritorio y móvil, incluyendo buscador, logo, paleta y visibilidad del banner mediante la simulación de navegador descrita arriba.
