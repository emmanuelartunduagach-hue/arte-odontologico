/* Panel de la secretaria (panel-secretaria.html), solo rol administrador.

   Una sola página con secciones; el menú cambia la sección por el
   fragmento de la URL (#inicio, #agenda, #pacientes, #pacientes/12,
   #disponibilidad) para que Atrás funcione y cada sección se pueda
   enlazar. Cada sección vive en su archivo (panel-agenda.js,
   panel-pacientes.js, panel-disponibilidad.js) y expone
   `montar(cuerpo, parametro)`. Los WhatsApp se envían solos; si alguno
   falla, aparece en Inicio (tarjeta de panel-mensajes.js).

   Inicio (contrato API v2, sección 4):
     GET /admin/citas/novedades?horas=48                      lo que pasó en la web
     GET /admin/citas?fecha=hoy                               agenda de hoy
     GET /admin/citas?estado=pendiente&desde=hoy&hasta=+180   citas antiguas sin confirmar
     GET /admin/notificaciones?estado=pendiente y ?estado=fallida   WhatsApp sin enviar */

const sesion = exigirSesion('administrador');
const cuerpo = document.getElementById('panel-cuerpo');

const SECCIONES = {
  inicio: { titulo: 'Inicio', montar: montarInicio },
  agenda: { titulo: 'Agenda', montar: montarAgenda },
  pacientes: { titulo: 'Pacientes', montar: montarPacientes },
  disponibilidad: { titulo: 'Horarios', montar: montarDisponibilidad },
};

/** '#pacientes/12' → { nombre: 'pacientes', parametro: '12' }. */
function rutaActual() {
  const [nombre, parametro = null] = location.hash.slice(1).split('/');
  return SECCIONES[nombre] ? { nombre, parametro } : { nombre: 'inicio', parametro: null };
}

function seccionActual() {
  return rutaActual().nombre;
}

function mostrarSeccion({ enfocar = false } = {}) {
  const { nombre, parametro } = rutaActual();
  dialogo.cerrar();
  document.querySelectorAll('[data-seccion]').forEach((enlace) => {
    if (enlace.dataset.seccion === nombre) {
      enlace.setAttribute('aria-current', 'page');
      // En celular el menú es una barra que se desplaza: deja visible la sección activa.
      enlace.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    else enlace.removeAttribute('aria-current');
  });
  document.title = `${SECCIONES[nombre].titulo} · Panel de la secretaria — Arte Odontológico`;
  SECCIONES[nombre].montar(cuerpo, parametro);
  if (enfocar) {
    cuerpo.querySelector('[data-foco-seccion]')?.focus();
    window.scrollTo({ top: 0 });
  }
}

panel.refrescar = () => mostrarSeccion();

/* ---------- Inicio ---------- */

const HORAS_NOVEDADES = 48;

function saludo() {
  const hora = Number(ahoraColombia().slice(11, 13));
  return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

/** `enlace` es otra sección (#agenda) o un bloque de esta página (id sin #). */
function tarjetaDato(cantidad, etiqueta, enlace, destacada) {
  const enPagina = !enlace.startsWith('#');
  return el('a', {
    class: 'dato-panel' + (destacada ? ' dato-panel--alerta' : ''),
    href: enPagina ? `#inicio` : enlace,
    onclick: enPagina ? (e) => { e.preventDefault(); document.getElementById(enlace)?.scrollIntoView({ behavior: 'smooth' }); } : null,
  },
    el('span', { class: 'dato-panel__numero', texto: String(cantidad) }),
    el('span', { class: 'dato-panel__etiqueta', texto: etiqueta }));
}

async function montarInicio(destino) {
  const hoy = hoyColombia();
  const encabezado = encabezadoSeccion(`${saludo()}, ${sesion.usuario.nombre.split(' ')[0]}`, `Hoy es ${fechaLarga(hoy)}.`);
  const aviso = tomarAviso();

  pintarEn(destino, avisoDemo(), encabezado, aviso, estadoCarga('Cargando el resumen del día…'));

  let novedades, solicitudes, deHoy, porEnviar, conError;
  try {
    [novedades, solicitudes, deHoy, porEnviar, conError] = await Promise.all([
      api(`/admin/citas/novedades?horas=${HORAS_NOVEDADES}`),
      api(`/admin/citas?estado=pendiente&desde=${hoy}&hasta=${sumarDiasA(hoy, 180)}`),
      api(`/admin/citas?fecha=${hoy}`),
      api('/admin/notificaciones?estado=pendiente'),
      api('/admin/notificaciones?estado=fallida'),
    ]);
  } catch (err) {
    pintarEn(destino, avisoDemo(), encabezado, aviso, errorConReintento(err, panel.refrescar));
    return;
  }
  if (seccionActual() !== 'inicio') return;
  const sinEnviar = [...conError, ...porEnviar];

  const ahora = ahoraColombia();
  const ordenadas = ordenarPorHora(deHoy);
  const porAtender = ordenadas.filter((c) => c.estado === 'confirmada');
  const siguiente = porAtender.find((c) => `${c.fecha}T${c.hora}` > ahora);
  const sinMarcar = porAtender.filter((c) => `${c.fecha}T${c.hora}` <= ahora);
  // Citas que quedaron pendientes de antes de que las de la web se
  // confirmaran solas (decisión 27). Solo se muestran si existen.
  const porConfirmar = ordenarPorHora(solicitudes);
  const nuevas = novedades.filter((c) => c.novedad === 'nueva').length;

  pintarEn(destino,
    avisoDemo(),
    encabezado,
    aviso,
    el('div', { class: 'datos-panel' },
      tarjetaDato(porAtender.length, porAtender.length === 1 ? 'cita por atender hoy' : 'citas por atender hoy', '#agenda'),
      tarjetaDato(nuevas, nuevas === 1 ? 'cita nueva por la web (48 h)' : 'citas nuevas por la web (48 h)', 'titulo-novedades')),

    // Solo aparece si el WhatsApp automático falló (o el servidor está en
    // modo manual): son avisos que el paciente aún no recibió.
    sinEnviar.length > 0 && el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-sin-enviar' },
      el('h2', { id: 'titulo-sin-enviar', class: 'bloque-panel__titulo',
        texto: sinEnviar.length === 1 ? '1 WhatsApp sin enviar' : `${sinEnviar.length} WhatsApp sin enviar` }),
      el('p', { class: 'alerta bloque-panel__ayuda', texto: 'El envío automático no pudo entregar estos avisos. Ábrelos en WhatsApp, envíalos y confírmalo aquí.' }),
      el('div', { class: 'mensajes__lista' }, sinEnviar.map(tarjetaMensaje))),

    porConfirmar.length > 0 && el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-solicitudes' },
      el('h2', { id: 'titulo-solicitudes', class: 'bloque-panel__titulo', texto: 'Citas anteriores sin confirmar' }),
      el('p', { class: 'bloque-panel__ayuda', texto: 'Se pidieron cuando las citas de la web todavía se aprobaban a mano. Acéptalas o recházalas; las nuevas ya llegan confirmadas.' }),
      listaCitas(porConfirmar, { conFecha: true })),

    sinMarcar.length > 0 && el('p', { class: 'alerta alerta--info bloque-panel', texto: sinMarcar.length === 1
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
        : el('div', { class: 'vacio' }, el('p', { texto: 'No hay citas para hoy.' }))),

    // Lo que pasó en la web sin que la secretaria tuviera que hacer nada:
    // citas nuevas (ya confirmadas) y cambios o cancelaciones del paciente.
    el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-novedades' },
      el('h2', { id: 'titulo-novedades', class: 'bloque-panel__titulo', texto: 'Novedades de la web' }),
      el('p', { class: 'bloque-panel__ayuda', texto: 'Últimas 48 horas. Las citas pedidas por la web quedan confirmadas solas y al paciente le llega el WhatsApp.' }),
      novedades.length
        ? listaCitas(novedades, { conFecha: true, conNovedad: true })
        : el('div', { class: 'vacio' }, el('p', { texto: 'No hubo movimientos en la web en las últimas 48 horas.' }))));
}

if (sesion) {
  document.querySelectorAll('[data-nombre-usuario]').forEach((nodo) => { nodo.textContent = sesion.usuario.nombre; });
  document.querySelectorAll('[data-inicial-usuario]').forEach((nodo) => { nodo.textContent = sesion.usuario.nombre.charAt(0).toUpperCase(); });
  window.addEventListener('hashchange', () => mostrarSeccion({ enfocar: true }));
  mostrarSeccion();
}
