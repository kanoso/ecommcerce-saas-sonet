/**
 * Tiendi Shield — verificación de email (E2.3).
 * Lee el token del enlace del email, lo consume UNA vez y limpia la URL
 * para que el token no quede en la barra de direcciones ni el historial.
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var token = params.get('token');

  var title = document.getElementById('ver-title');
  var msg = document.getElementById('state-msg');
  var alertBox = document.getElementById('alert');
  var panelLink = document.getElementById('panel-link');

  // El token no vive en la URL visible más de lo necesario.
  window.history.replaceState({}, document.title, window.location.pathname);

  function show(kind, text) {
    alertBox.className = 'alert ' + kind;
    alertBox.textContent = text;
    alertBox.hidden = false;
  }

  async function run() {
    if (!token) {
      title.textContent = 'Falta el enlace de verificación';
      msg.textContent = 'Abrí el enlace completo que te llegó por email.';
      show('err', 'No encontramos el token en la dirección.');
      return;
    }
    try {
      var data = await ShieldAuth.apiFetch('/shield/identity/verify', {
        method: 'POST',
        auth: false,
        body: { token: token },
      });
      title.textContent = '¡Registro verificado!';
      msg.textContent = '';
      show('ok', data.message + '. Ya podés ingresar a tu panel.');
      panelLink.hidden = false;
    } catch (err) {
      title.textContent = 'No se pudo verificar';
      msg.textContent = '';
      show('err', err.status === 400
        ? 'El enlace es inválido o ya venció. Desde tu panel podés solicitar uno nuevo, o volvé a registrarte con el mismo email para recibirlo de nuevo.'
        : 'Error de conexión: ' + err.message);
    }
  }

  run();
})();