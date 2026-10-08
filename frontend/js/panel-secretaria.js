/* Panel de la secretaria (panel-secretaria.html), solo rol administrador.

   Una sola página con secciones; el menú lateral cambia la sección por
   el fragmento de la URL (#inicio, #agenda, #mensajes) para que Atrás
   funcione y cada sección se pueda enlazar. Cada sección vive en su
   archivo (panel-agenda.js, panel-mensajes.js) y expone `montar(cuerpo)`.

   Inicio (contrato API v2, sección 4):
     GET /admin/citas?fecha=hoy               agenda de hoy
     GET /admin/citas?desde=mañana&hasta=+7   próximas citas
     GET /admin/notificaciones?estado=pendiente */

const sesion = exigirSesion('administrador');
const cuerpo = document.getElementById('panel-cuerpo');

const SECCIONES = {
  inicio: { titulo: 'Inicio', montar: montarInicio },
  agenda: { titulo: 'Agenda', montar: montarAgenda },
  mensajes: { titulo: 'Mensajes', montar: montarMensajes },
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
  if (enfocar) {
    cuerpo.querySelector('[data-foco-seccion]')?.focus();
    window.scrollTo({ top: 0 });
  }
}

panel.refrescar = () => mostrarSeccion();

/* ---------- Inicio ---------- */

function saludo() {
  const hora = Number(ahoraColombia().slice(11, 13));
  return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

function tarjetaDato(cantidad, etiqueta, enlace, destacada) {
  return el('a', { class: 'dato-panel' + (destacada ? ' dato-panel--alerta' : ''), href: enlace },
    el('span', { class: 'dato-panel__numero', texto: String(cantidad) }),
    el('span', { class: 'dato-panel__etiqueta', texto: etiqueta }));
}

async function montarInicio(destino) {
  const hoy = hoyColombia();
  const encabezado = encabezadoSeccion(`${saludo()}, ${sesion.usuario.nombre.split(' ')[0]}`,
    `Hoy es ${fechaLarga(hoy)}.`,
    el('a', { class: 'btn btn--secundario btn--compacto', href: 'cambiar-contrasena.html', texto: 'Cambiar contraseña' }));
  const aviso = tomarAviso();

  pintarEn(destino, avisoDemo(), encabezado, aviso, estadoCarga('Cargando el resumen del día…'));

  let deHoy, proximas, pendientes;
  try {
    [deHoy, proximas, pendientes] = await Promise.all([
      api(`/admin/citas?fecha=${hoy}`),
      api(`/admin/citas?desde=${sumarDiasA(hoy, 1)}&hasta=${sumarDiasA(hoy, 7)}&estado=confirmada`),
      api('/admin/notificaciones?estado=pendiente'),
    ]);
  } catch (err) {
    pintarEn(destino, avisoDemo(), encabezado, aviso, errorConReintento(err, panel.refrescar));
    return;
  }
  if (seccionActual() !== 'inicio') return;
  mostrarContadorMensajes(pendientes.length);

  const ahora = ahoraColombia();
  const ordenadas = ordenarPorHora(deHoy);
  const porAtender = ordenadas.filter((c) => c.estado === 'confirmada');
  const siguiente = porAtender.find((c) => `${c.fecha}T${c.hora}` > ahora);
  const sinMarcar = porAtender.filter((c) => `${c.fecha}T${c.hora}` <= ahora);

  pintarEn(destino,
    avisoDemo(),
    encabezado,
    aviso,
    el('div', { class: 'datos-panel' },
      tarjetaDato(porAtender.length, porAtender.length === 1 ? 'cita por atender hoy' : 'citas por atender hoy', '#agenda'),
      tarjetaDato(proximas.length, 'citas en los próximos 7 días', '#agenda'),
      tarjetaDato(pendientes.length, pendientes.length === 1 ? 'mensaje por enviar' : 'mensajes por enviar', '#mensajes', pendientes.length > 0)),

    sinMarcar.length > 0 && el('p', { class: 'alerta alerta--info', texto: sinMarcar.length === 1
      ? 'Hay 1 cita de hoy que ya pasó y falta marcar si el paciente asistió.'
      : `Hay ${sinMarcar.length} citas de hoy que ya pasaron y falta marcar si los pacientes asistieron.` }),

    siguiente && el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-siguiente' },
      el('h2', { id: 'titulo-siguiente', class: 'bloque-panel__titulo', texto: 'Siguiente paciente' }),
      el('div', { class: 'lista-filas lista-filas--destacada' }, filaCita(siguiente))),

    el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-hoy' },
      el('div', { class: 'bloque-panel__cabecera' },
        el('h2', { id: 'titulo-hoy', class: 'bloque-panel__titulo', texto: 'Agenda de hoy' }),
        el('a', { href: '#agenda', class: 'bloque-panel__enlace', onclick: () => { agenda.fecha = hoy; agenda.q = ''; }, texto: 'Ver agenda completa' })),
      ordenadas.length
        ? listaCitas(ordenadas)
        : el('div', { class: 'vacio' }, el('p', { texto: 'No hay citas para hoy.' }))));
}

if (sesion) {
  document.querySelector('[data-nombre-usuario]').textContent = sesion.usuario.nombre;
  window.addEventListener('hashchange', () => mostrarSeccion({ enfocar: true }));
  mostrarSeccion();
  // Inicio y Mensajes ya traen los pendientes; las demás secciones no.
  if (!['inicio', 'mensajes'].includes(seccionActual())) actualizarContadorMensajes();
}
