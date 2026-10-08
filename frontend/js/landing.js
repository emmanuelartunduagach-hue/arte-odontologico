/* Lógica de la página pública. */

document.addEventListener('DOMContentLoaded', () => {
  configurarWhatsApp();
  prepararFormularios();
  vigilarDesplazamiento();
  configurarCarruseles();
});

/* Carrusel de fotos: se desliza solo, lento y continuo.
   Se duplica el contenido para que el bucle no tenga saltos; las
   copias se ocultan a lectores de pantalla. Con "reducir
   movimiento" activado no se anima: queda como tira que se
   desplaza a mano. */
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

    // La duración depende del ancho real, para que la velocidad
    // sea la misma en celular y en escritorio.
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

/* El encabezado se separa del contenido solo cuando la página
   ya se desplazó. Se usa IntersectionObserver en lugar de
   escuchar 'scroll': el navegador lo resuelve sin ejecutar
   código en cada píxel de desplazamiento. */
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

/* Formulario de ingreso. Un solo acceso para la secretaria (administrador)
   y para los pacientes que ya tienen usuario; el rol lo decide el servidor
   (contrato API v2, sección 3). La validación real vive en el backend. */
function prepararFormularios() {
  const ingreso = document.getElementById('form-ingreso');
  if (!ingreso) return;
  const error = ingreso.querySelector('[data-error]');
  const boton = ingreso.querySelector('button[type="submit"]');

  // Con sesión abierta, "Ingresar" lleva directo al panel.
  const sesion = obtenerSesion();
  if (sesion) {
    document.querySelectorAll('[data-abrir="modal-ingreso"]').forEach((enlace) => {
      enlace.removeAttribute('data-abrir');
      enlace.textContent = 'Mi panel';
      if (enlace.tagName === 'A') enlace.href = destinoDe(sesion.usuario);
      else enlace.addEventListener('click', () => location.assign(destinoDe(sesion.usuario)));
    });
  }

  // index.html?ingresar=1 abre el formulario (lo usan los paneles al
  // pedir sesión); &vencida=1 explica por qué.
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
