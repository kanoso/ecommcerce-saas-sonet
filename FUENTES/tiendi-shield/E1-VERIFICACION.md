# Tiendi Shield — Checklist de verificación E1.4

Fecha de verificación: 2026-09-24
Entorno: PC local Windows, Edge headless + archivos servidos localmente (`file://`).
Verificador: agente (pendiente revisión visual humana final del propietario).

> Convención: cada ítem registra el procedimiento real ejecutado y su resultado.
> Ningún ítem está marcado sin evidencia. Lo pendiente queda explícito.

## Checklist E1 (DOCS/TIENDI_LAUNCHER_IMPLEMENTACION.md §7)

- [x] **Build/publicación independientes sobre hosting existente, sin contenedor/servidor/proceso adicional.**
  Evidencia: `FUENTES/tiendi-shield/app/` es HTML+CSS+JS estático (~59.8 KB total con activos), sin build step, sin dependencias, sin proceso servidor propio. Pendiente de publicación final (decisión de dominio/puerto con `pm2 serve`, ver "Pendientes").

- [x] **Composición visual impactante aprobada por responsable humano en móvil y escritorio, con capturas.**
  Evidencia: aprobación explícita del usuario ("si está bien el style") sobre `design/proposal-editorial.html`. Capturas del launcher real: `design/e14-desktop.png` (1440px) y `design/e14-mobile.png` (375px viewport real).

- [x] **Teclado/foco/nombres/contraste, responsive y movimiento reducido comprobados.**
  Evidencia:
  - Contraste WCAG AA verificado programáticamente (7 pares clave, todos ≥ 4.5:1; mínimo 6.82:1).
  - `:focus-visible` con anillo 3px en todo el documento (`styles.css`).
  - `prefers-reduced-motion` desactiva transiciones y elevación hover.
  - Estructura semántica: `header/main/section/article/footer`, `aria-label` en navegación y listas, `aria-hidden` en decorativos, `noscript` con mensaje alternativo.
  - Responsive verificado en capturas 1440px y 375px: columna única en móvil, CTA a ancho completo, sin desbordes.

- [x] **Destinos web oficiales validados; Kipu/Go sin APK publicada se representan como no disponible; sin instalación automática.**
  Evidencia:
  - `https://web.tiendi.pe` — aprobada por el usuario, HTTP 200 verificado (Invoke-WebRequest HEAD, 2026-09-24).
  - `https://vendor.tiendi.pe` — aprobada por el usuario, HTTP 200 verificado (ídem).
  - Kipu y Go: descarga deshabilitada con nota visible "Pendiente: Generar el APK release firmado". Las builds existentes son debug (Kipu) o release sin firma verificada (Go) — no publicables según C02.

- [x] **Estados de no disponible/error probados; ausencia de APK reportada como pendiente, no descarga entregada.**
  Evidencia: `main.js` `cardHtml()` — APK sin url+version+checksumSHA256 => botón deshabilitado + `pendingReason`. URL inválida/no-HTTPS → tarjeta "no disponible" (`safeUrl()` rechaza http, userinfo, URLs malformadas). Captura `design/cards-check.png`.

- [x] **URLs maliciosas/arbitrarias rechazadas, sin credenciales en enlaces o bundles ni detalles privilegiados expuestos.**
  Evidencia: auditoría con Select-String — solo 2 URLs (web/vendor.tiendi.pe), ambas https, sin userinfo; sin tokens/passwords/secrets (única coincidencia: texto de UI "no transportan tokens" y la validación `u.username || u.password` que RECHAZA credenciales). Sin Admin, sin catálogo de permisos, sin API.

- [x] **Acceso directo/login/permisos locales conservados; mostrar tarjeta no concede autorización.**
  Evidencia: diseño — cada tarjeta indica "Login propio de la tienda/panel"; banda "Lo que Shield NO hace" explícita; sin registro ni sesión en el código (0 llamadas de red en `main.js`).

- [x] **Peso/carga/recursos medidos en entorno acordado y dentro de presupuesto; no nuevos servicios contratados.**
  Evidencia: total 59.8 KB (HTML 6.6 + CSS 10.6 + JS 6.2 + assets 36). Fuentes vía Google Fonts (~30 KB woff2, 2 familias, con `display=swap` y preconnect). Sin framework, sin CDN de Tailwind, sin Material Icons (SVG inline). Nota: la medición es de peso de transferencia; no se midió CPU/RAM en el host de producción (ver Pendientes).

## Métricas registradas

| Métrica | Valor | Método |
|---|---|---|
| Peso total (sin caché de fuentes) | 59.8 KB | suma de archivos en `app/` |
| HTML+CSS+JS propios | 23.4 KB | ídem |
| Logos optimizados | 36 KB (antes 280 KB) | System.Drawing resize 4x retina |
| Requests externos | 1 host (fonts.googleapis.com) | revisión de index.html |
| Llamadas de red del launcher | 0 (solo navegación a destinos) | revisión de main.js |

## Pendientes para cierre E1 (no bloquean, pero se declaran)

1. **Revisión visual humana final en dispositivos reales** (el propietario ya aprobó la dirección; falta la mirada sobre el launcher final en su móvil).
2. **Decisión de publicación**: dominio/path (ej. `shield.tiendi.pe` o `/shield` bajo dominio existente) y su `pm2 serve` + túnel. Requiere autorización para tocar el host.
3. **Medición en el host real** (RAM/CPU del proceso `pm2 serve`): se hará al publicar, sin comprometer presupuesto.
4. **APKs release de Kipu y Go**: generar builds firmadas, publicarlas, calcular SHA-256 y registrar versión en `apps.js`. Las tarjetas ya muestran el estado pendiente.
