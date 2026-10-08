/* Panel de la secretaria (panel-secretaria.html), solo rol administrador.

   Una sola página con secciones; el menú cambia la sección por el
   fragmento de la URL (#inicio, #agenda, …) para que Atrás funcione y
   cada sección se pueda enlazar. Cada sección vive en su archivo
   (panel-agenda.js, …) y expone una función `montar(cuerpo)`.

   Inicio (contrato API v2, sección 4):
     GET /admin/citas?fecha=AAAA-MM-DD
     GET /admin/notificaciones?estado=pendiente */

const sesion = exigirSesion('administrador');
const cuerpo = document.getElementById('panel-cuerpo');

const SECCIONES = {
  inicio: { titulo: 'Inicio', montar: montarInicio },
  agenda: { titulo: 'Agenda', montar: montarAgenda },
};

function seccionActual() {
  const nombre = location.hash.slice(1);
  return SECCIONES[nombre] ? nombre : 'inicio';
}

function mostrarSeccion({ enfocar = false } = {}) {
  const nombre = seccionActual();
  dialogo.cerrar();
  document.querySelectorAll('[data-seccion]').forEach((enlace) => {
    if (enlace.dataset.seccion === nombre) enlace.setAttribute('aria-current', 'page');
    else enlace.removeAttribute('aria-current');
  });
  document.title = `${SECCIONES[nombre].titulo} · Panel de la secretaria — Arte Odontológico`;
  SECCIONES[nombre].montar(cuerpo);
  if (enfocar) cuerpo.querySelector('[data-foco-seccion]')?.focus();
}

/* ---------- Inicio ---------- */

function tarjetaHoy(cita) {
  return el('article', { class: 'cita' + (cita.estado === 'cancelada' ? ' cita--pasada' : '') },
    el('div', { class: 'cita__cabecera' },
      el('h3', { class: 'cita__titulo', texto: `${horaLarga(cita.hora)} · ${cita.paciente}` }),
      chipEstado(cita.estado)),
    el('dl', { class: 'resumen' },
      dato('Especialista', `${cita.especialista} (${cita.especialidad})`),
      dato('Documento', cita.documento),
      dato('Teléfono', telefonoLegible(cita.telefono))));
}

async function montarInicio(destino) {
  const hoy = hoyColombia();
  const titulo = [
    avisoDemo(),
    el('h1', { class: 'gestion__titulo', tabindex: '-1', 'data-foco-seccion': true, texto: `Hola, ${sesion.usuario.nombre.split(' ')[0]}` }),
  ];
  const pie = el('div', { class: 'acciones' },
    el('a', { class: 'btn btn--secundario', href: 'cambiar-contrasena.html', texto: 'Cambiar contraseña' }));

  pintarEn(destino, titulo, el('p', { class: 'estado-carga', role: 'status', texto: 'Cargando la agenda de hoy…' }));

  let citas, pendientes;
  try {
    [citas, pendientes] = await Promise.all([
      api(`/admin/citas?fecha=${hoy}`),
      api('/admin/notificaciones?estado=pendiente'),
    ]);
  } catch (err) {
    pintarEn(destino, titulo,
      el('p', { class: 'alerta', role: 'alert', texto: err.message }),
      el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'btn btn--secundario', onclick: () => montarInicio(destino), texto: 'Reintentar' })));
    return;
  }
  if (seccionActual() !== 'inicio') return;

  const activas = citas.filter((c) => c.estado !== 'cancelada');
  pintarEn(destino, titulo,
    pendientes.length > 0 && el('p', { class: 'alerta', role: 'status',
      texto: pendientes.length === 1
        ? 'Hay 1 mensaje de WhatsApp pendiente por enviar.'
        : `Hay ${pendientes.length} mensajes de WhatsApp pendientes por enviar.` }),
    el('h2', { class: 'lista-citas__grupo', texto: `Agenda de hoy · ${fechaLarga(hoy)}` }),
    citas.length
      ? [
        el('p', { class: 'gestion__intro', texto: activas.length === 1 ? '1 cita activa.' : `${activas.length} citas activas.` }),
        el('div', { class: 'lista-citas' }, [...citas].sort((a, b) => a.hora.localeCompare(b.hora)).map(tarjetaHoy)),
        el('div', { class: 'acciones' }, el('a', { class: 'btn btn--primario', href: '#agenda', texto: 'Ir a la agenda' })),
      ]
      : el('p', { class: 'gestion__intro', texto: 'No hay citas para hoy.' }),
    pie);
}

if (sesion) {
  document.querySelector('[data-nombre-usuario]').textContent = sesion.usuario.nombre;
  window.addEventListener('hashchange', () => mostrarSeccion({ enfocar: true }));
  mostrarSeccion();
}
