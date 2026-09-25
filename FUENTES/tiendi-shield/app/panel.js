/**
 * Tiendi Shield — panel del registro (E2.3).
 * Vista login si no hay sesión; vista panel con vínculos si la hay.
 * El 401 con rotación fallida vuelve al login (auth.js limpia la sesión).
 */
(function () {
  'use strict';

  var loginView = document.getElementById('login-view');
  var panelView = document.getElementById('panel-view');
  var loginAlert = document.getElementById('login-alert');
  var linkAlert = document.getElementById('link-alert');
  var linkOk = document.getElementById('link-ok');

  function el(id) { return document.getElementById(id); }

  function show(view) {
    loginView.hidden = view !== 'login';
    panelView.hidden = view !== 'panel';
  }

  function showAlert(box, text) {
    box.textContent = text;
    box.hidden = false;
  }

  // ===== LOGIN =====
  el('login-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    loginAlert.hidden = true;
    var btn = el('login-btn');
    btn.disabled = true;
    btn.textContent = 'Ingresando…';
    try {
      var data = await ShieldAuth.apiFetch('/shield/identity/login', {
        method: 'POST',
        auth: false,
        body: {
          email: el('login-email').value.trim(),
          password: el('login-password').value,
        },
      });
      ShieldAuth.setTokens(data.accessToken, data.refreshToken);
      renderPanel();
    } catch (err) {
      showAlert(loginAlert, err.status === 429
        ? 'Demasiados intentos. Esperá un minuto.'
        : 'No se pudo ingresar: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ingresar';
    }
  });

  // ===== PANEL =====
  async function renderPanel() {
    try {
      var me = await ShieldAuth.apiFetch('/shield/identity/me');
      el('panel-email').textContent = me.email;

      var badge = el('panel-status');
      if (me.status === 'ACTIVE') {
        badge.textContent = 'Registro verificado';
        badge.className = 'status-badge active';
        el('panel-note').textContent = 'Este registro solo administra vínculos: no abre aplicaciones ni concede permisos.';
      } else if (me.status === 'SUSPENDED') {
        badge.textContent = 'Registro suspendido';
        badge.className = 'status-badge';
        el('panel-note').textContent = 'No podés crear nuevos vínculos mientras esté suspendido. Tus cuentas de las apps no se ven afectadas.';
      } else {
        badge.textContent = 'Pendiente de verificar email';
        badge.className = 'status-badge';
        el('panel-note').textContent = 'Revisá tu email: necesitás verificar el registro antes de vincular cuentas. Podés reenviar el enlace creando el registro de nuevo con este email.';
      }

      var list = el('links-list');
      list.innerHTML = '';
      if (!me.links.length) {
        var li = document.createElement('li');
        li.textContent = 'Todavía no vinculaste ninguna cuenta.';
        list.appendChild(li);
      } else {
        me.links.forEach(function (link) {
          var li = document.createElement('li');
          var who = document.createElement('span');
          who.className = 'authority';
          who.textContent = link.authority === 'tiendi-api'
            ? 'Cuenta Tiendi'
            : link.authority;
          var id = document.createElement('span');
          id.className = 'meta-id';
          id.textContent = 'ID ' + link.localUserId.slice(0, 8) + '… · desde ' +
            new Date(link.linkedAt).toLocaleDateString('es-PE');
          li.appendChild(who);
          li.appendChild(id);
          list.appendChild(li);
        });
      }

      // La vinculación exige registro verificado (C05).
      var canLink = me.status === 'ACTIVE';
      el('link-form').hidden = !canLink;
      el('link-note').hidden = !canLink;

      show('panel');
    } catch (err) {
      // Sesión vencida y sin refresh válido → login.
      ShieldAuth.clearTokens();
      show('login');
    }
  }

  // Selector de aplicación: alterna campo email (Tiendi) / username (Kipu)
  el('link-app').addEventListener('change', function () {
    var isKipu = el('link-app').value === 'kipu';
    el('field-tiendi-email').hidden = isKipu;
    el('field-kipu-username').hidden = !isKipu;
    el('link-email').required = !isKipu;
    el('link-username').required = isKipu;
    el('link-password-label').textContent = isKipu
      ? 'Contraseña de tu cuenta Kipu'
      : 'Contraseña de tu cuenta Tiendi';
  });

  // ===== VINCULAR =====
  el('link-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    linkAlert.hidden = true;
    linkOk.hidden = true;
    var btn = el('link-btn');
    btn.disabled = true;
    btn.textContent = 'Verificando…';
    var authority = el('link-app').value;
    var body = { authority: authority };
    if (authority === 'kipu') {
      body.localUsername = el('link-username').value.trim();
      body.localPassword = el('link-password').value;
    } else {
      body.localEmail = el('link-email').value.trim();
      body.localPassword = el('link-password').value;
    }
    try {
      var data = await ShieldAuth.apiFetch('/shield/identity/link', {
        method: 'POST',
        body: body,
      });
      showAlert(linkOk, 'Cuenta vinculada correctamente.');
      el('link-form').reset();
      renderPanel();
    } catch (err) {
      showAlert(linkAlert, err.status === 401
        ? 'Las credenciales de tu cuenta Tiendi no son correctas. Recordá: son las de la aplicación, no las del registro.'
        : 'No se pudo vincular: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Vincular cuenta';
    }
  });

  // ===== ACTIVAR (crear cuenta nueva bajo demanda) =====
  el('activate-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    linkAlert.hidden = true;
    linkOk.hidden = true;
    var btn = el('act-btn');
    btn.disabled = true;
    btn.textContent = 'Creando…';
    try {
      var data = await ShieldAuth.apiFetch('/shield/identity/activate', {
        method: 'POST',
        body: {
          authority: 'tiendi-api',
          email: el('act-email').value.trim(),
          password: el('act-password').value,
          firstName: el('act-first-name').value.trim(),
          lastName: el('act-last-name').value.trim(),
        },
      });
      showAlert(linkOk, 'Cuenta creada y vinculada. Ya podés entrar a Tiendi Web con ese email y contraseña.');
      el('activate-form').reset();
      renderPanel();
    } catch (err) {
      if (err.status === 409) {
        showAlert(linkAlert, err.message);
      } else {
        showAlert(linkAlert, 'No se pudo crear la cuenta: ' + err.message);
      }
    } finally {
      btn.disabled = false;
      btn.textContent = 'Crear y vincular cuenta nueva';
    }
  });

  // ===== LOGOUT =====
  el('logout-btn').addEventListener('click', async function () {
    // Revoca la familia de refresh en el servidor (mejor esfuerzo) y limpia local.
    try {
      await ShieldAuth.apiFetch('/shield/identity/logout', {
        method: 'POST',
        auth: false,
        body: { refreshToken: ShieldAuth.getRefresh() || undefined },
      });
    } catch (e) { /* el logout local nunca falla por esto */ }
    ShieldAuth.clearTokens();
    show('login');
  });

  // ===== ARRANQUE =====
  if (ShieldAuth.hasSession()) {
    renderPanel();
  } else {
    show('login');
  }
})();