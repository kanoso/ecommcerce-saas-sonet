/**
 * Tiendi Shield — cliente del registro (E2.3, C05 aprobado).
 * Sesión LIMITADA al registro: tokens en localStorage (mismo patrón que el
 * resto del ecosistema, sin BFF), rotación de refresh con un solo reintento.
 * Estos tokens NO autentican en ninguna aplicación (iss/aud Shield).
 */
(function () {
  'use strict';

  var KEYS = {
    access: 'shield.accessToken',
    refresh: 'shield.refreshToken',
  };

  function storage() {
    try { return window.localStorage; } catch (e) { return null; }
  }

  function getAccess() {
    var s = storage();
    return s ? s.getItem(KEYS.access) : null;
  }

  function getRefresh() {
    var s = storage();
    return s ? s.getItem(KEYS.refresh) : null;
  }

  function setTokens(access, refresh) {
    var s = storage();
    if (!s) return;
    if (access) s.setItem(KEYS.access, access);
    if (refresh) s.setItem(KEYS.refresh, refresh);
  }

  function clearTokens() {
    var s = storage();
    if (!s) return;
    s.removeItem(KEYS.access);
    s.removeItem(KEYS.refresh);
  }

  /** POST /shield/identity/refresh — rotación. Devuelve true si renovó. */
  async function rotate() {
    var refresh = getRefresh();
    if (!refresh) return false;
    try {
      var res = await fetch(window.SHIELD_CONFIG.API_BASE + '/shield/identity/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) return false;
      var data = await res.json();
      if (!data.accessToken) return false;
      setTokens(data.accessToken, data.refreshToken);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * fetch con auth del registro. Si da 401 con sesión, intenta UNA rotación
   * de refresh y reintenta una vez. Si la rotación falla, limpia la sesión.
   */
  async function apiFetch(path, opts) {
    opts = opts || {};
    var doFetch = function (token) {
      return fetch(window.SHIELD_CONFIG.API_BASE + path, {
        method: opts.method || 'GET',
        headers: Object.assign(
          { 'Content-Type': 'application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}
        ),
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    };

    var res = await doFetch(opts.auth === false ? null : getAccess());

    if (res.status === 401 && opts.auth !== false) {
      var renewed = await rotate();
      if (renewed) {
        res = await doFetch(getAccess());
      } else {
        clearTokens();
      }
    }

    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }

    if (!res.ok) {
      var message = (data && (data.message || data.error)) || ('HTTP ' + res.status);
      var err = new Error(message);
      err.status = res.status;
      err.unauthorized = res.status === 401;
      throw err;
    }
    return data;
  }

  window.ShieldAuth = {
    getAccess: getAccess,
    getRefresh: getRefresh,
    setTokens: setTokens,
    clearTokens: clearTokens,
    apiFetch: apiFetch,
    hasSession: function () { return Boolean(getAccess()); },
  };
})();