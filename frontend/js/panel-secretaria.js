/* Panel de la secretaria (panel-secretaria.html), solo rol administrador.

   Por ahora es la pantalla de inicio: citas de hoy y mensajes de
   WhatsApp pendientes. Las secciones de especialidades, especialistas,
   disponibilidad, pacientes e historia clínica se agregan aquí
   (contrato API v2, sección 4).
     GET /admin/citas?fecha=AAAA-MM-DD
     GET /admin/notificaciones?estado=pendiente */

const sesion = exigirSesion('administrador');
const cuerpo = document.getElementById('panel-cuerpo');

/** Reemplaza el contenido; acepta nodos, listas y valores falsos (se omiten). */
function pintar(...nodos) {
  cuerpo.replaceChildren(...nodos.flat(2).filter(Boolean));
}

const NOMBRE_ESTADO = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  atendida: 'Atendida',
  no_asistio: 'No asistió',
};

function tarjetaCita(cita) {
  return el('article', { class: 'cita' + (cita.estado === 'cancelada' ? ' cita--pasada' : '') },
    el('div', { class: 'cita__cabecera' },
      el('h3', { class: 'cita__titulo', texto: `${horaLarga(cita.hora)} · ${cita.paciente}` }),
      el('span', { class: `estado estado--${cita.estado}`, texto: NOMBRE_ESTADO[cita.estado] || cita.estado })),
    el('dl', { class: 'resumen' },
      dato('Especialista', `${cita.especialista} (${cita.especialidad})`),
      dato('Documento', cita.documento),
      dato('Teléfono', cita.telefono)));
}

async function cargar() {
  const hoy = hoyColombia();
  const titulo = [
    typeof window.API_DEMO === 'function'
      && el('p', { class: 'alerta alerta--info', texto: 'Modo demostración: los datos son de prueba y no se guarda nada.' }),
    el('h1', { class: 'gestion__titulo', texto: `Hola, ${sesion.usuario.nombre.split(' ')[0]}` }),
  ];
  const pie = el('div', { class: 'acciones' },
    el('a', { class: 'btn btn--secundario', href: 'cambiar-contrasena.html', texto: 'Cambiar contraseña' }));

  pintar(titulo, el('p', { class: 'estado-carga', role: 'status', texto: 'Cargando la agenda de hoy…' }));

  let citas, pendientes;
  try {
    [citas, pendientes] = await Promise.all([
      api(`/admin/citas?fecha=${hoy}`),
      api('/admin/notificaciones?estado=pendiente'),
    ]);
  } catch (err) {
    pintar(titulo,
      el('p', { class: 'alerta', role: 'alert', texto: err.message }),
      el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'btn btn--secundario', onclick: cargar, texto: 'Reintentar' })));
    return;
  }

  const activas = citas.filter((c) => c.estado !== 'cancelada');
  pintar(titulo,
    pendientes.length > 0 && el('p', { class: 'alerta', role: 'status',
      texto: pendientes.length === 1
        ? 'Hay 1 mensaje de WhatsApp pendiente por enviar.'
        : `Hay ${pendientes.length} mensajes de WhatsApp pendientes por enviar.` }),
    el('h2', { class: 'lista-citas__grupo', texto: `Agenda de hoy · ${fechaLarga(hoy)}` }),
    citas.length
      ? [
        el('p', { class: 'gestion__intro', texto: activas.length === 1 ? '1 cita activa.' : `${activas.length} citas activas.` }),
        el('div', { class: 'lista-citas' }, citas.map(tarjetaCita)),
      ]
      : el('p', { class: 'gestion__intro', texto: 'No hay citas para hoy.' }),
    pie);
}

if (sesion) {
  document.querySelector('[data-nombre-usuario]').textContent = sesion.usuario.nombre;
  cargar();
}
