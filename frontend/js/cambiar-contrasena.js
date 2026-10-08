/* Cambiar contraseña (cambiar-contrasena.html).

   Contrato API v2, sección 3:
     POST /auth/cambiar-contrasena  { contrasenaActual, contrasenaNueva }
   Una clave actual incorrecta responde 400 con campos.contrasenaActual
   (no 401, para no cerrar la sesión).

   Llega aquí obligado quien ingresa con una clave temporal
   (debeCambiarContrasena) y, por gusto, quien entra desde su panel. */

const sesion = exigirSesion();
const cuerpo = document.getElementById('panel-cuerpo');

// Mismas reglas que el servidor (utils/validaciones.js): aquí solo se
// adelantan para no esperar la respuesta; la validación real es la del backend.
function errorClaveNueva(clave) {
  if (clave.length < 8 || clave.length > 72) return 'La contraseña debe tener entre 8 y 72 caracteres.';
  if (!/[A-Za-z]/.test(clave) || !/\d/.test(clave)) return 'La contraseña debe incluir al menos una letra y un número.';
  return '';
}

function campo(nombre, etiqueta, autocompletar, ayuda) {
  const idError = `error-${nombre}`;
  const idAyuda = ayuda ? `ayuda-${nombre}` : null;
  return el('label', { class: 'campo' },
    el('span', { class: 'campo__etiqueta', texto: etiqueta }),
    el('input', {
      class: 'campo__control', type: 'password', name: nombre, autocomplete: autocompletar, required: true,
      'aria-describedby': [idAyuda, idError].filter(Boolean).join(' '),
    }),
    ayuda && el('span', { class: 'campo__ayuda', id: idAyuda, texto: ayuda }),
    el('span', { class: 'campo__error', id: idError, 'data-error-de': nombre, hidden: true }));
}

function pintarFormulario() {
  const obligado = sesion.usuario.debeCambiarContrasena;
  const error = el('p', { class: 'alerta', role: 'alert', hidden: true });
  const boton = el('button', { type: 'submit', class: 'btn btn--primario btn--grande', texto: 'Guardar contraseña' });

  const form = el('form', { class: 'form-clave', novalidate: true },
    campo('contrasenaActual', obligado ? 'Contraseña temporal' : 'Contraseña actual', 'current-password'),
    campo('contrasenaNueva', 'Contraseña nueva', 'new-password', 'Mínimo 8 caracteres, con al menos una letra y un número.'),
    campo('confirmacion', 'Repite la contraseña nueva', 'new-password'),
    error,
    el('div', { class: 'acciones' }, boton,
      !obligado && el('a', { class: 'btn btn--secundario', href: destinoDe(sesion.usuario), texto: 'Volver' })));

  function marcar(nombre, mensaje) {
    const nodo = form.querySelector(`[data-error-de="${nombre}"]`);
    nodo.textContent = mensaje || '';
    nodo.hidden = !mensaje;
    form[nombre].setAttribute('aria-invalid', mensaje ? 'true' : 'false');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    const actual = form.contrasenaActual.value;
    const nueva = form.contrasenaNueva.value;

    const errores = {
      contrasenaActual: actual ? '' : `Escribe tu ${obligado ? 'contraseña temporal' : 'contraseña actual'}.`,
      contrasenaNueva: errorClaveNueva(nueva) || (nueva === actual ? 'La contraseña nueva debe ser distinta de la actual.' : ''),
      confirmacion: form.confirmacion.value === nueva ? '' : 'Las contraseñas no coinciden.',
    };
    Object.entries(errores).forEach(([nombre, mensaje]) => marcar(nombre, mensaje));
    const primero = Object.keys(errores).find((nombre) => errores[nombre]);
    if (primero) {
      form[primero].focus();
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Guardando…';
    try {
      await api('/auth/cambiar-contrasena', { metodo: 'POST', cuerpo: { contrasenaActual: actual, contrasenaNueva: nueva } });
      actualizarUsuario({ debeCambiarContrasena: false });
      pintarListo();
    } catch (err) {
      if (err.campos) {
        Object.entries(err.campos).forEach(([nombre, mensaje]) => form[nombre] && marcar(nombre, mensaje));
        const conError = Object.keys(err.campos).find((nombre) => form[nombre]);
        if (conError) form[conError].focus();
      } else {
        error.textContent = err.message;
        error.hidden = false;
      }
      boton.disabled = false;
      boton.textContent = 'Guardar contraseña';
    }
  });

  cuerpo.replaceChildren(
    el('h1', { class: 'gestion__titulo', texto: obligado ? 'Crea tu contraseña' : 'Cambiar contraseña' }),
    obligado && el('p', { class: 'gestion__intro', texto: 'Ingresaste con una contraseña temporal. Antes de continuar, elige una contraseña propia.' }),
    form);
  form.contrasenaActual.focus();
}

function pintarListo() {
  const titulo = el('h1', { class: 'gestion__titulo', tabindex: '-1', texto: 'Contraseña actualizada' });
  cuerpo.replaceChildren(
    titulo,
    el('p', { class: 'alerta alerta--info', role: 'status', texto: 'Desde ahora ingresa con tu contraseña nueva.' }),
    el('div', { class: 'acciones' },
      el('a', { class: 'btn btn--primario', href: destinoDe(obtenerSesion().usuario), texto: 'Continuar' })));
  titulo.focus();
}

if (sesion) {
  document.querySelector('[data-nombre-usuario]').textContent = sesion.usuario.nombre;
  pintarFormulario();
}
