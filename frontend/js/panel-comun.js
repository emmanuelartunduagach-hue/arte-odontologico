const NOMBRE_ESTADO = {
  pendiente: 'Por confirmar',
  confirmada: 'Confirmada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
  atendida: 'Atendida',
  no_asistio: 'No asistió',
};

const panel = {
  aviso: null,
  refrescar: () => {},
};

function tomarAviso() {
  const aviso = panel.aviso;
  panel.aviso = null;
  return aviso;
}

function pintarEn(nodo, ...hijos) {
  nodo.replaceChildren(...hijos.flat(3).filter(Boolean));
}

function ahoraColombia() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 16);
}

function sumarDiasA(fecha, dias) {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

function telefonoLegible(telefono) {
  const local = String(telefono || '').replace(/^57(?=\d{10}$)/, '');
  return /^\d{10}$/.test(local) ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : telefono;
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function chipEstado(estado) {
  return el('span', { class: `estado estado--${estado}`, texto: NOMBRE_ESTADO[estado] || estado });
}

function avisoDemo() {
  return typeof window.API_DEMO === 'function'
    && el('p', { class: 'alerta alerta--info', texto: 'Modo demostración: los datos son de prueba y no se guarda nada.' });
}

function encabezadoSeccion(titulo, subtitulo, ...acciones) {
  return el('header', { class: 'seccion-panel__cabecera' },
    el('div', {},
      el('h1', { class: 'seccion-panel__titulo', tabindex: '-1', 'data-foco-seccion': true, texto: titulo }),
      subtitulo && el('p', { class: 'seccion-panel__subtitulo', texto: subtitulo })),
    acciones.length > 0 && el('div', { class: 'seccion-panel__acciones' }, acciones));
}

// Controles «Anterior / Siguiente» con el rango que se está viendo. alCambiar(nuevaPagina, cual).
function controlPaginacion({ total, pagina, porPagina, alCambiar, nombre = 'elementos' }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  const boton = (texto, cual, destino, desactivado) => el('button', {
    type: 'button', class: 'btn btn--secundario btn--compacto', 'data-pag': cual, disabled: desactivado,
    onclick: () => alCambiar(destino, cual), texto,
  });
  return el('nav', { class: 'paginacion', 'aria-label': `Paginación de ${nombre}` },
    el('p', { class: 'paginacion__estado', role: 'status', texto: `Mostrando ${desde}–${hasta} de ${total} · Página ${pagina} de ${paginas}` }),
    el('div', { class: 'paginacion__botones' },
      boton('Anterior', 'anterior', pagina - 1, pagina <= 1),
      boton('Siguiente', 'siguiente', pagina + 1, pagina >= paginas)));
}

// Tras cambiar de página los botones se vuelven a crear: se devuelve el foco al que se usó.
function enfocarPaginacion(raiz, cual) {
  if (!cual) return;
  const buscado = raiz.querySelector(`[data-pag="${cual}"]:not(:disabled)`)
    || raiz.querySelector('[data-pag]:not(:disabled)');
  buscado?.focus();
}

// Lista que se corta en páginas en el navegador (para listados que ya llegan completos).
// «estado.pagina» conserva la página mientras la pantalla se vuelve a pintar.
function listaPaginada(items, { porPagina, estado, nombre, contenedor, fila }) {
  const raiz = el('div', { class: 'lista-paginada' });
  const pintar = (cual) => {
    const paginas = Math.max(1, Math.ceil(items.length / porPagina));
    estado.pagina = Math.min(Math.max(estado.pagina || 1, 1), paginas);
    const inicio = (estado.pagina - 1) * porPagina;
    pintarEn(raiz,
      contenedor(items.slice(inicio, inicio + porPagina).map(fila)),
      items.length > porPagina && controlPaginacion({
        total: items.length, pagina: estado.pagina, porPagina, nombre,
        alCambiar: (destino, usado) => { estado.pagina = destino; pintar(usado); },
      }));
    enfocarPaginacion(raiz, cual);
  };
  pintar();
  return raiz;
}

function estadoCarga(texto) {
  return el('p', { class: 'estado-carga', role: 'status', texto });
}

function errorConReintento(err, reintentar) {
  return el('div', { class: 'alerta', role: 'alert' },
    el('p', { texto: err.message }),
    el('button', { type: 'button', class: 'btn btn--secundario alerta__accion', onclick: reintentar, texto: 'Reintentar' }));
}

function avisoAccion(mensaje, notificacion) {
  const caja = el('div', { class: 'alerta alerta--exito aviso-accion', role: 'status' });
  const partes = [el('p', { class: 'aviso-accion__titulo', texto: mensaje })];

  if (notificacion?.estado === 'enviada') {
    partes.push(el('p', { texto: 'Se avisó al paciente por WhatsApp.' }));
  } else if ((notificacion?.estado === 'pendiente' || notificacion?.estado === 'fallida') && notificacion.enlaceWhatsApp) {
    const fallida = notificacion.estado === 'fallida';
    const marcar = el('button', { type: 'button', class: 'btn btn--secundario', texto: 'Ya lo envié' });
    marcar.addEventListener('click', async () => {
      marcar.disabled = true;
      try {
        await api(`/admin/notificaciones/${notificacion.id}`, { metodo: 'PATCH', cuerpo: { estado: 'enviada' } });
        pintarEn(caja, el('p', { class: 'aviso-accion__titulo', texto: mensaje }), el('p', { texto: 'Mensaje marcado como enviado.' }));
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

const dialogo = {
  modal: () => document.getElementById('modal-panel'),

  abrir(titulo) {
    elementoQueAbrio = document.activeElement;
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

document.addEventListener('click', (e) => {
  document.querySelectorAll('details.menu-acciones[open], details.menu-cuenta[open]').forEach((menu) => {
    if (!menu.contains(e.target) || e.target.closest('.menu-acciones__lista button')) menu.open = false;
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const abierto = document.querySelector('details.menu-acciones[open], details.menu-cuenta[open]');
  if (abierto) {
    abierto.open = false;
    abierto.querySelector('summary').focus();
  }
});
