document.addEventListener('DOMContentLoaded', () => {
  configurarWhatsApp();
  prepararFormularios();
  vigilarDesplazamiento();
  configurarCarruseles();
});

const VELOCIDAD_CARRUSEL_PX_S = 35;

function configurarCarruseles() {
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('[data-carrusel]').forEach((carrusel) => {
    const carril = carrusel.querySelector('.carrusel__carril');
    if (!carril || sinMovimiento.matches) return;

    [...carril.children].forEach((item) => {
      const copia = item.cloneNode(true);
      copia.setAttribute('aria-hidden', 'true');
      copia.querySelector('img')?.setAttribute('alt', '');
      carril.appendChild(copia);
    });

    // La duración depende del ancho para que la velocidad sea igual en celular y escritorio.
    function ajustarVelocidad() {
      const mitad = carril.scrollWidth / 2;
      carrusel.style.setProperty('--duracion-carrusel', `${Math.round(mitad / VELOCIDAD_CARRUSEL_PX_S)}s`);
    }
    carrusel.classList.add('carrusel--auto');
    ajustarVelocidad();
    window.addEventListener('resize', ajustarVelocidad);
    carrusel.querySelectorAll('img').forEach((img) => img.addEventListener('load', ajustarVelocidad));
  });
}

function vigilarDesplazamiento() {
  const encabezado = document.querySelector('.encabezado');
  if (!encabezado) return;

  const centinela = document.createElement('div');
  centinela.style.cssText = 'position:absolute;top:0;height:1px;width:1px';
  document.body.prepend(centinela);

  new IntersectionObserver(
    ([entrada]) => encabezado.classList.toggle('esta-desplazado', !entrada.isIntersecting),
    { threshold: 0 }
  ).observe(centinela);
}

function configurarWhatsApp() {
  const enlace = document.getElementById('enlace-whatsapp');
  if (enlace) {
    enlace.href = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(CONFIG.MENSAJE_WHATSAPP)}`;
  }
}

function prepararFormularios() {
  const ingreso = document.getElementById('form-ingreso');
  if (!ingreso) return;
  const error = ingreso.querySelector('[data-error]');
  const boton = ingreso.querySelector('button[type="submit"]');

  const sesion = obtenerSesion();
  if (sesion) {
    document.querySelectorAll('[data-abrir="modal-ingreso"]').forEach((enlace) => {
      enlace.removeAttribute('data-abrir');
      if (enlace.hasAttribute('data-acceso-icono')) {
        enlace.setAttribute('aria-label', 'Ir a mi panel');
        enlace.title = 'Ir a mi panel';
      } else {
        enlace.textContent = 'Mi panel';
      }
      if (enlace.tagName === 'A') enlace.href = destinoDe(sesion.usuario);
      else enlace.addEventListener('click', () => location.assign(destinoDe(sesion.usuario)));
    });
  }

  const parametros = new URLSearchParams(location.search);
  if (parametros.has('ingresar') && !sesion) {
    abrirModal('modal-ingreso');
    if (parametros.has('vencida')) mostrarError(error, 'Tu sesión venció. Ingresa de nuevo.');
  }

  ingreso.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarError(error);

    const correo = ingreso.correo.value.trim();
    const contrasena = ingreso.contrasena.value;
    if (!correo || !contrasena) {
      mostrarError(error, 'Escribe tu correo y tu contraseña.');
      (correo ? ingreso.contrasena : ingreso.correo).focus();
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Ingresando…';
    try {
      const respuesta = await api('/auth/ingreso', { metodo: 'POST', cuerpo: { correo, contrasena } });
      guardarSesion(respuesta);
      location.assign(destinoDe(respuesta.usuario));
    } catch (err) {
      mostrarError(error, err.message);
      ingreso.contrasena.value = '';
      ingreso.contrasena.focus();
      boton.disabled = false;
      boton.textContent = 'Ingresar';
    }
  });
}

function mostrarError(nodo, mensaje) {
  if (!nodo) return;
  nodo.textContent = mensaje;
  nodo.hidden = false;
}

function ocultarError(nodo) {
  if (!nodo) return;
  nodo.hidden = true;
}
