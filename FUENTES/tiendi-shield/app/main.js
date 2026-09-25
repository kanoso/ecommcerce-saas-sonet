/* Tiendi Shield — directory renderer.
 * Static, no network calls, no credentials. Cards render from apps.js only. */
(function () {
  "use strict";

  var ICONS = {
    web: '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 4 5.6 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.6-4-9s1.5-6.4 4-9z"/></svg>',
    store: '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7l1.5-3.5h13L20 7M4 7h16v3.2a2.4 2.4 0 0 1-4.8 0A2.4 2.4 0 0 1 12 12a2.4 2.4 0 0 1-3.2-1.8A2.4 2.4 0 0 1 4 10.2V7zM5.5 13.5V20h13v-6.5M10 20v-4h4v4"/></svg>',
    wallet: '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10.5h18M15.5 15.5h2"/></svg>',
    rider: '<svg class="icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 7.5A1.5 1.5 0 0 1 3.5 6H14a1 1 0 0 1 1 1v9H2.5M15 9.5h3.6l2.9 3.2v3.3H19"/><circle cx="7" cy="18" r="1.9"/><circle cx="17" cy="18" r="1.9"/></svg>',
    login: '<svg class="icon-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l4 4-4 4M14 12H3"/></svg>',
    shieldCheck: '<svg class="icon-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
    arrow: '<svg class="icon-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16m0 0l-6-6m6 6l-6 6"/></svg>',
    download: '<svg class="icon-sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14"/></svg>'
  };

  /** Only https, no userinfo/credentials, no embedded query auth. Returns null otherwise. */
  function safeUrl(raw) {
    if (typeof raw !== "string" || raw.length === 0) return null;
    try {
      var u = new URL(raw);
      if (u.protocol !== "https:") return null;
      if (u.username || u.password) return null;
      return u.href;
    } catch (e) {
      return null;
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function cardHtml(app) {
    var isWeb = app.type === "web";
    var badge = isWeb ? "Acceso web" : "Android · APK";
    var icon = ICONS[app.icon] || ICONS.web;
    var head =
      '<div class="card-head">' +
      '<div class="icon-box" aria-hidden="true">' + icon + "</div>" +
      '<span class="badge' + (isWeb ? "" : " android") + '">' + badge + "</span>" +
      "</div>" +
      "<h3>" + esc(app.name) + "</h3>" +
      '<p class="desc">' + esc(app.description) + "</p>";

    if (isWeb) {
      var url = safeUrl(app.url);
      var footMeta =
        '<span class="meta">' + ICONS.login + " " + esc(app.loginNote) + "</span>";
      var cta = url
        ? '<a class="cta" href="' + esc(url) + '" rel="noopener">' + esc(app.cta) + ICONS.arrow + "</a>"
        : '<button class="cta" type="button" disabled>Enlace no disponible por ahora</button>';
      return head + '<div class="card-foot">' + footMeta + cta + "</div>";
    }

    // Android: download enabled only with verified artifact (url + version + checksum)
    var d = app.download || {};
    var apkUrl = safeUrl(d.url);
    var verified = Boolean(apkUrl && d.version && d.checksumSha256);
    var footMeta =
      '<span class="meta">' + ICONS.shieldCheck + " Origen oficial verificado</span>";
    var cta2 = verified
      ? '<a class="cta" href="' + esc(apkUrl) + '" download rel="noopener">' + ICONS.download + " Descargar APK</a>"
      : '<button class="cta" type="button" disabled>Descarga no disponible por ahora</button>';
    var pendingNote = verified
      ? '<span class="apk-meta">Versión ' + esc(d.version) + " · checksum SHA-256 publicado</span>"
      : (d.pendingReason
          ? '<span class="apk-meta">Pendiente: ' + esc(d.pendingReason) + ".</span>"
          : "");
    return head + '<div class="card-foot">' + footMeta + cta2 + "</div>" + pendingNote;
  }

  function render() {
    var grid = document.getElementById("apps-grid");
    if (!grid || !Array.isArray(window.SHIELD_APPS)) return;
    grid.innerHTML = window.SHIELD_APPS.map(function (app) {
      return '<article class="card" data-app-id="' + esc(app.appId) + '">' + cardHtml(app) + "</article>";
    }).join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
