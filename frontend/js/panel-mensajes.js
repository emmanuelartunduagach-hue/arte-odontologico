/* Panel de la secretaria · Mensajes de WhatsApp.

   Contrato API v2, sección 4 ("Mensajes de WhatsApp"):
     GET   /admin/notificaciones?estado=pendiente|enviada|fallida
     PATCH /admin/notificaciones/:id   { estado: 'enviada' }
     POST  /admin/recordatorios        genera ya los recordatorios de las próximas 24 horas

   En modo manual cada mensaje queda "por enviar": la secretaria lo abre
   en su WhatsApp (enlaceWhatsApp trae el texto listo), lo envía y lo
   marca como enviado. */

const mensajes = { estado: 'pendiente' };

const PESTANAS_MENSAJES = [
  ['pendiente', 'Por enviar'],
  ['enviada', 'Enviados'],
  ['fallida', 'Con error'],
];

const TIPO_MENSAJE = {
  confirmacion: 'Confirmación de cita',
  reprogramacion: 'Cita reprogramada',
  cancelacion: 'Cita cancelada',
  recordatorio: 'Recordatorio',
  rechazo: 'Solicitud rechazada',
};

async function montarMensajes(cuerpo) {
  const lista = el('div', { class: 'mensajes__lista' });
  const generar = el('button', { type: 'button', class: 'btn btn--secundario', texto: 'Generar recordatorios (próximas 24 h)' });
  generar.addEventListener('click', () => generarRecordatorios(generar));

  pintarEn(cuerpo,
    avisoDemo(),
    encabezadoSeccion('Mensajes de WhatsApp', 'Avisos que el sistema no pudo enviar solo. Mientras el envío automático no esté activo, todos llegan aquí para enviarlos desde WhatsApp.', generar),
    tomarAviso(),
    el('div', { class: 'pestanas', role: 'tablist', 'aria-label': 'Estado de los mensajes' },
      PESTANAS_MENSAJES.map(([valor, texto]) => el('button', {
        type: 'button', role: 'tab', class: 'pestanas__item', 'aria-selected': String(valor === mensajes.estado),
        onclick: () => { mensajes.estado = valor; panel.refrescar(); }, texto,
      }))),
    lista);

  pintarEn(lista, estadoCarga('Cargando mensajes…'));
  let filas;
  try {
    filas = await api(`/admin/notificaciones?estado=${mensajes.estado}`);
  } catch (err) {
    pintarEn(lista, errorConReintento(err, panel.refrescar));
    return;
  }
  if (mensajes.estado === 'pendiente') mostrarContadorMensajes(filas.length);

  if (!filas.length) {
    pintarEn(lista, el('div', { class: 'vacio' }, el('p', {
      texto: { pendiente: 'No hay mensajes por enviar. Todo al día.', enviada: 'Aún no hay mensajes enviados.', fallida: 'No hay mensajes con error.' }[mensajes.estado],
    })));
    return;
  }
  pintarEn(lista, filas.map(tarjetaMensaje));
}

function tarjetaMensaje(n) {
  const pendiente = n.estado === 'pendiente' || n.estado === 'fallida';
  const tarjeta = el('article', { class: 'mensaje' });

  const marcar = el('button', { type: 'button', class: 'btn btn--secundario btn--compacto', texto: 'Ya lo envié' });
  marcar.addEventListener('click', async () => {
    marcar.disabled = true;
    try {
      await api(`/admin/notificaciones/${n.id}`, { metodo: 'PATCH', cuerpo: { estado: 'enviada' } });
      tarjeta.remove();
      actualizarContadorMensajes();
      if (!document.querySelector('.mensajes__lista .mensaje')) panel.refrescar();
    } catch (err) {
      marcar.disabled = false;
      marcar.after(el('p', { class: 'campo__error', texto: err.message }));
    }
  });

  pintarEn(tarjeta,
    el('div', { class: 'mensaje__cabecera' },
      el('div', {},
        el('p', { class: 'mensaje__paciente', texto: n.paciente }),
        el('p', { class: 'fila-cita__detalle', texto: `${TIPO_MENSAJE[n.tipo] || n.tipo} · Tel. ${telefonoLegible(n.destino)}` })),
      el('time', { class: 'fila-cita__detalle', datetime: n.creadoEn, texto: fechaHoraCorta(n.creadoEn) })),
    el('p', { class: 'mensaje__texto', texto: n.mensaje }),
    n.estado === 'fallida' && n.detalle && el('p', { class: 'campo__error', texto: `Error: ${n.detalle}` }),
    pendiente && el('div', { class: 'acciones mensaje__acciones' },
      el('a', { class: 'btn btn--whatsapp btn--compacto', href: n.enlaceWhatsApp, target: '_blank', rel: 'noopener', texto: 'Abrir en WhatsApp' }),
      marcar));
  return tarjeta;
}

/** '2026-10-08 14:05:00' → '8 oct., 2:05 p. m.' */
function fechaHoraCorta(fechaHora) {
  if (!fechaHora) return '';
  const [fecha, hora] = fechaHora.split(' ');
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)}., ${horaLarga(hora.slice(0, 5))}`;
}

async function generarRecordatorios(boton) {
  boton.disabled = true;
  boton.textContent = 'Generando…';
  try {
    const r = await api('/admin/recordatorios', { metodo: 'POST' });
    const n = r.resultados.length;
    panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status',
      texto: n === 0
        ? 'No hay recordatorios nuevos para las próximas 24 horas. Las citas que ya tienen su recordatorio, o que se confirmaron hace menos de 12 horas, no reciben otro.'
        : `${n === 1 ? 'Se generó 1 recordatorio' : `Se generaron ${n} recordatorios`} para las citas de las próximas 24 horas.` });
    mensajes.estado = 'pendiente';
    panel.refrescar();
  } catch (err) {
    boton.disabled = false;
    boton.textContent = 'Generar recordatorios (próximas 24 h)';
    boton.after(el('p', { class: 'campo__error', texto: err.message }));
  }
}
