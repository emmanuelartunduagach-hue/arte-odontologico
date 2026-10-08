/* Utilidades del panel de la secretaria, compartidas por sus secciones
   (panel-agenda.js, panel-mensajes.js). Se carga después de comun.js y
   modales.js, y antes de las secciones y de panel-secretaria.js.

   Todo el texto de la API se inserta con textContent (vía `el()`). */

const NOMBRE_ESTADO = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  atendida: 'Atendida',
  no_asistio: 'No asistió',
};

/* Estado compartido del panel.
   - aviso: resultado de la última acción; la sección lo muestra arriba una vez.
   - refrescar: vuelve a cargar la sección actual (lo define panel-secretaria.js). */
const panel = {
  aviso: null,
  refrescar: () => {},
};

function tomarAviso() {
  const aviso = panel.aviso;
  panel.aviso = null;
  return aviso;
}

/** Reemplaza el contenido de `nodo`; acepta nodos, listas y valores falsos (se omiten). */
function pintarEn(nodo, ...hijos) {
  nodo.replaceChildren(...hijos.flat(3).filter(Boolean));
}

/** Fecha y hora actuales en Colombia, 'AAAA-MM-DDTHH:MM'. */
function ahoraColombia() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 16);
}

function sumarDiasA(fecha, dias) {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** '573001234567' → '300 123 4567'. */
function telefonoLegible(telefono) {
  const local = String(telefono || '').replace(/^57(?=\d{10}$)/, '');
  return /^\d{10}$/.test(local) ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : telefono;
}

function chipEstado(estado) {
  return el('span', { class: `estado estado--${estado}`, texto: NOMBRE_ESTADO[estado] || estado });
}

function avisoDemo() {
  return typeof window.API_DEMO === 'function'
    && el('p', { class: 'alerta alerta--info', texto: 'Modo demostración: los datos son de prueba y no se guarda nada.' });
}

/** Encabezado de sección: título (recibe el foco al cambiar de sección) y una línea opcional. */
function encabezadoSeccion(titulo, subtitulo, ...acciones) {
  return el('header', { class: 'seccion-panel__cabecera' },
    el('div', {},
      el('h1', { class: 'seccion-panel__titulo', tabindex: '-1', 'data-foco-seccion': true, texto: titulo }),
      subtitulo && el('p', { class: 'seccion-panel__subtitulo', texto: subtitulo })),
    acciones.length > 0 && el('div', { class: 'seccion-panel__acciones' }, acciones));
}

function estadoCarga(texto) {
  return el('p', { class: 'estado-carga', role: 'status', texto });
}

function errorConReintento(err, reintentar) {
  return el('div', { class: 'alerta', role: 'alert' },
    el('p', { texto: err.message }),
    el('button', { type: 'button', class: 'btn btn--secundario alerta__accion', onclick: reintentar, texto: 'Reintentar' }));
}

/* ---------- Contador de mensajes del menú ---------- */

function mostrarContadorMensajes(cantidad) {
  const contador = document.querySelector('[data-contador-mensajes]');
  if (!contador) return;
  contador.textContent = cantidad > 99 ? '99+' : String(cantidad);
  contador.hidden = !cantidad;
  contador.setAttribute('aria-label', cantidad === 1 ? '1 por enviar' : `${cantidad} por enviar`);
}

async function actualizarContadorMensajes() {
  try {
    mostrarContadorMensajes((await api('/admin/notificaciones?estado=pendiente')).length);
  } catch { /* el contador no es crítico */ }
}

/** Aviso tras una acción que generó un WhatsApp. En modo manual el
    mensaje queda pendiente: se ofrece enviarlo y marcarlo como enviado
    sin salir de la pantalla. */
function avisoAccion(mensaje, notificacion) {
  const caja = el('div', { class: 'alerta alerta--exito aviso-accion', role: 'status' });
  const partes = [el('p', { class: 'aviso-accion__titulo', texto: mensaje })];

  if (notificacion?.estado === 'enviada') {
    partes.push(el('p', { texto: 'Se avisó al paciente por WhatsApp.' }));
  } else if ((notificacion?.estado === 'pendiente' || notificacion?.estado === 'fallida') && notificacion.enlaceWhatsApp) {
    // Pendiente: modo manual. Fallida: el envío automático no funcionó.
    const fallida = notificacion.estado === 'fallida';
    const marcar = el('button', { type: 'button', class: 'btn btn--secundario', texto: 'Ya lo envié' });
    marcar.addEventListener('click', async () => {
      marcar.disabled = true;
      try {
        await api(`/admin/notificaciones/${notificacion.id}`, { metodo: 'PATCH', cuerpo: { estado: 'enviada' } });
        pintarEn(caja, el('p', { class: 'aviso-accion__titulo', texto: mensaje }), el('p', { texto: 'Mensaje marcado como enviado.' }));
        actualizarContadorMensajes();
      } catch (err) {
        marcar.disabled = false;
        marcar.after(el('p', { class: 'campo__error', texto: err.message }));
      }
    });
    partes.push(
      el('p', { texto: fallida
        ? 'El WhatsApp automático no se pudo enviar. Ábrelo en WhatsApp, envíalo tú y confírmalo aquí.'
        : 'Falta avisarle al paciente: abre el mensaje en WhatsApp, envíalo y confírmalo aquí.' }),
      el('div', { class: 'acciones aviso-accion__botones' },
        el('a', { class: 'btn btn--whatsapp', href: notificacion.enlaceWhatsApp, target: '_blank', rel: 'noopener', texto: 'Abrir en WhatsApp' }),
        marcar));
  } else if (notificacion) {
    partes.push(el('p', { texto: 'No se pudo preparar el WhatsApp. Avísale al paciente por teléfono.' }));
  }
  pintarEn(caja, partes);
  return caja;
}

/* ---------- Diálogo del panel (#modal-panel) ---------- */

const dialogo = {
  modal: () => document.getElementById('modal-panel'),

  /** Abre el diálogo con un título y devuelve el nodo donde va el contenido. */
  abrir(titulo) {
    elementoQueAbrio = document.activeElement;  // de modales.js: recibe el foco al cerrar
    document.getElementById('titulo-modal-panel').textContent = titulo;
    const cuerpo = document.getElementById('modal-panel-cuerpo');
    cuerpo.replaceChildren();
    abrirModal('modal-panel');
    return cuerpo;
  },

  cerrar() {
    const modal = dialogo.modal();
    if (!modal.hidden) cerrarModal(modal);
  },

  abierto: () => !dialogo.modal().hidden,
};

/** Pide confirmación y ejecuta `accion`. Si falla, muestra el error en el
    mismo diálogo para que la secretaria pueda reintentar o desistir. */
function confirmarAccion({ titulo, texto, si, no = 'Volver', accion }) {
  const cuerpo = dialogo.abrir(titulo);
  const error = el('p', { class: 'alerta', role: 'alert', hidden: true });
  const botonSi = el('button', { type: 'button', class: 'btn btn--primario', texto: si });
  botonSi.addEventListener('click', async () => {
    botonSi.disabled = true;
    error.hidden = true;
    try {
      await accion();
      dialogo.cerrar();
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      botonSi.disabled = false;
    }
  });
  pintarEn(cuerpo,
    el('p', { texto }),
    error,
    el('div', { class: 'acciones' }, botonSi, el('button', { type: 'button', class: 'btn btn--secundario', 'data-cerrar': true, texto: no })));
  botonSi.focus();
}

/* Menús "Más" de las filas (<details class="menu-acciones">): se cierran
   al hacer clic fuera, al elegir una opción o con Escape. */
document.addEventListener('click', (e) => {
  document.querySelectorAll('details.menu-acciones[open]').forEach((menu) => {
    if (!menu.contains(e.target) || e.target.closest('.menu-acciones__lista button')) menu.open = false;
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const abierto = document.querySelector('details.menu-acciones[open]');
  if (abierto) {
    abierto.open = false;
    abierto.querySelector('summary').focus();
  }
});
