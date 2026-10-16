const TIPO_MENSAJE = {
  confirmacion: 'Confirmación de cita',
  reprogramacion: 'Cita reprogramada',
  cancelacion: 'Cita cancelada',
  recordatorio: 'Recordatorio',
  rechazo: 'Solicitud rechazada',
};

function tarjetaMensaje(n) {
  const pendiente = n.estado === 'pendiente' || n.estado === 'fallida';
  const tarjeta = el('article', { class: 'mensaje' });

  const marcar = el('button', { type: 'button', class: 'btn btn--secundario btn--compacto', texto: 'Ya lo envié' });
  marcar.addEventListener('click', async () => {
    marcar.disabled = true;
    try {
      await api(`/admin/notificaciones/${n.id}`, { metodo: 'PATCH', cuerpo: { estado: 'enviada' } });
      tarjeta.remove();
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

function fechaHoraCorta(fechaHora) {
  if (!fechaHora) return '';
  const [fecha, hora] = fechaHora.split(' ');
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)}., ${horaLarga(hora.slice(0, 5))}`;
}
