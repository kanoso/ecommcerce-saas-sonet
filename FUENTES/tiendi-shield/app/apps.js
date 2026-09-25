/**
 * Tiendi Shield — static app directory registry.
 *
 * Rules (DOCS/TIENDI_LAUNCHER_IMPLEMENTACION.md §3):
 * - `url` must be a previously validated official HTTPS URL, or null.
 * - url === null  -> the card renders as "no disponible"; never invent a link.
 * - No credentials, tokens or query params in URLs.
 * - type: "web" opens the official URL; type "android" downloads a verified
 *   APK only when `download.url` is verified (version + checksum + signature),
 *   otherwise the download stays disabled.
 */
window.SHIELD_APPS = [
  {
    appId: "tiendi-web",
    name: "Tiendi Web",
    type: "web",
    icon: "web",
    description: "Tienda online para comprar en los comercios de tu barrio desde el navegador.",
    loginNote: "Login propio de la tienda",
    cta: "Abrir tienda",
    url: "https://web.tiendi.pe", // Aprobada por el usuario (C02)
    status: "available"
  },
  {
    appId: "tiendi-vendor",
    name: "Tiendi Vendor",
    type: "web",
    icon: "store",
    description: "Panel del comerciante: pedidos, productos, personal y pagos de tu tienda.",
    loginNote: "Login propio del panel",
    cta: "Abrir panel",
    url: "https://vendor.tiendi.pe", // Aprobada por el usuario (C02)
    status: "available"
  },
  {
    appId: "kipu",
    name: "Kipu",
    type: "android",
    icon: "wallet",
    description: "Gastos, fiados y préstamos de tu negocio, disponibles también sin internet.",
    download: {
      // PENDIENTE: generar APK release firmada (la build existente es debug,
      // no publicable). Al generarla: publicar en hosting, calcular checksum
      // SHA-256 y registrar versión. Bloqueado por C02.
      url: null,
      version: null,
      checksumSha256: null,
      pendingReason: "Generar el APK release firmado"
    },
    status: "unavailable"
  },
  {
    appId: "tiendi-go",
    name: "Tiendi Go",
    type: "android",
    icon: "rider",
    description: "App del repartidor: pedidos, entregas y ganancias en tu celular.",
    download: {
      // PENDIENTE: generar APK release firmada (existe app-release.apk sin
      // firma verificada). Al generarla: publicar en hosting, calcular
      // checksum SHA-256 y registrar versión. Bloqueado por C02.
      url: null,
      version: null,
      checksumSha256: null,
      pendingReason: "Generar el APK release firmado"
    },
    status: "unavailable"
  }
];
