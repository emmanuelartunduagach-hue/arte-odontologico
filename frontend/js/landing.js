/* Lógica de la página pública. */

document.addEventListener('DOMContentLoaded', () => {
  pintarServicios();
  configurarWhatsApp();
  prepararFormularios();
  vigilarDesplazamiento();
});

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

function pintarServicios() {
  const contenedor = document.getElementById('lista-servicios');
  if (!contenedor) return;

  contenedor.innerHTML = SERVICIOS.map(s => `
    <button type="button" class="servicio" data-abrir="modal-registro" data-servicio="${s.id}">
      <span class="servicio__icono">${svgIcono(s.icono)}</span>
      <span>
        <span class="servicio__nombre">${s.nombre}</span>
        <span class="servicio__desc">${s.desc}</span>
      </span>
    </button>
  `).join('');
}

function configurarWhatsApp() {
  const enlace = document.getElementById('enlace-whatsapp');
  if (enlace) {
    enlace.href = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(CONFIG.MENSAJE_WHATSAPP)}`;
  }
}

/* Validación en cliente. La validación real y obligatoria vive
   en el backend; esta solo evita viajes innecesarios al servidor. */
function prepararFormularios() {
  const registro = document.getElementById('form-registro');
  const ingreso  = document.getElementById('form-ingreso');

  registro?.addEventListener('submit', (e) => {
    e.preventDefault();
    const datos = Object.fromEntries(new FormData(registro));
    const error = registro.querySelector('[data-error]');

    if (datos.contrasena !== datos.contrasena2) {
      return mostrarError(error, 'Las dos contraseñas no coinciden.');
    }
    if (datos.contrasena.length < 8) {
      return mostrarError(error, 'La contraseña debe tener al menos 8 caracteres.');
    }
    if (!datos.autorizacion) {
      return mostrarError(error, 'Debes autorizar el tratamiento de tus datos para continuar.');
    }

    ocultarError(error);
    // PENDIENTE: POST ${CONFIG.API}/auth/registro
    console.log('Registro validado. Falta conectar con el backend.', datos);
  });

  ingreso?.addEventListener('submit', (e) => {
    e.preventDefault();
    const error = ingreso.querySelector('[data-error]');
    ocultarError(error);
    // PENDIENTE: POST ${CONFIG.API}/auth/ingreso
    console.log('Ingreso validado. Falta conectar con el backend.');
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
