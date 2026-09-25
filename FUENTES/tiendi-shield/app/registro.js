/**
 * Tiendi Shield — alta del registro (E2.3).
 * Respuesta idéntica siempre (anti-enumeración): el servidor nunca revela
 * si el email ya existía. La validación de contraseña es local; el resto
 * la hace el backend con Zod.
 */
(function () {
  'use strict';

  var form = document.getElementById('register-form');
  var alertBox = document.getElementById('alert');
  var submitBtn = document.getElementById('submit-btn');

  function showAlert(kind, text) {
    alertBox.className = 'alert ' + kind;
    alertBox.textContent = text;
    alertBox.hidden = false;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    alertBox.hidden = true;

    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;
    var password2 = document.getElementById('password2').value;

    if (password.length < 8) {
      showAlert('err', 'La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== password2) {
      showAlert('err', 'Las contraseñas no coinciden.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando…';
    try {
      var data = await ShieldAuth.apiFetch('/shield/identity/register', {
        method: 'POST',
        auth: false,
        body: { email: email, password: password },
      });
      showAlert('ok', data.message + ' Podés cerrar esta página; el enlace vence en 15 minutos.');
      form.reset();
    } catch (err) {
      showAlert('err', err.status === 429
        ? 'Demasiados intentos. Esperá un minuto y probá de nuevo.'
        : 'No se pudo crear el registro: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear registro';
    }
  });
})();