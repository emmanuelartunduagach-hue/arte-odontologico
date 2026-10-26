const sesion = exigirSesion('administrador', 'superadmin');
const cuerpo = document.getElementById('panel-cuerpo');
const DUENO = esDueno(sesion?.usuario);
const NOMBRE_PANEL = DUENO ? 'Panel del dueño' : 'Panel de la secretaria';

const SECCIONES = {
  inicio: { titulo: 'Inicio', montar: montarInicio },
  agenda: { titulo: 'Agenda', montar: montarAgenda },
  pacientes: { titulo: 'Pacientes', montar: montarPacientes },
  disponibilidad: { titulo: 'Horarios', montar: montarDisponibilidad },
  ...(DUENO && {
    solicitudes: { titulo: 'Solicitudes', montar: montarSolicitudes },
    especialistas: { titulo: 'Especialistas', montar: montarEspecialistas },
    equipo: { titulo: 'Equipo', montar: montarEquipo },
  }),
};

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
    if (enlace.dataset.seccion === nombre) enlace.setAttribute('aria-current', 'page');
    else enlace.removeAttribute('aria-current');
  });
  document.title = `${SECCIONES[nombre].titulo} · ${NOMBRE_PANEL} — Arte Odontológico`;
  SECCIONES[nombre].montar(cuerpo, parametro);
  if (enfocar) {
    cuerpo.querySelector('[data-foco-seccion]')?.focus();
    window.scrollTo({ top: 0 });
  }
}

panel.refrescar = () => mostrarSeccion();

const HORAS_NOVEDADES = 48;

function saludo() {
  const hora = Number(ahoraColombia().slice(11, 13));
  return hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}

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

  let novedades, solicitudes, deHoy, porEnviar, conError, porAprobar;
  try {
    [novedades, solicitudes, deHoy, porEnviar, conError, porAprobar] = await Promise.all([
      api(`/admin/citas/novedades?horas=${HORAS_NOVEDADES}`),
      api(`/admin/citas?estado=pendiente&desde=${hoy}&hasta=${sumarDiasA(hoy, 180)}`),
      api(`/admin/citas?fecha=${hoy}`),
      api('/admin/notificaciones?estado=pendiente'),
      api('/admin/notificaciones?estado=fallida'),
      DUENO ? api('/superadmin/solicitudes') : null,
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
  const porConfirmar = ordenarPorHora(solicitudes);
  const nuevas = novedades.filter((c) => c.novedad === 'nueva').length;
  const totalPorAprobar = porAprobar ? porAprobar.correcciones.length + porAprobar.anulaciones.length : 0;
  if (porAprobar) actualizarContadorSolicitudes(totalPorAprobar);

  pintarEn(destino,
    avisoDemo(),
    encabezado,
    aviso,
    el('div', { class: 'datos-panel' },
      tarjetaDato(porAtender.length, porAtender.length === 1 ? 'cita por atender hoy' : 'citas por atender hoy', '#agenda'),
      tarjetaDato(nuevas, nuevas === 1 ? 'cita nueva por la web (48 h)' : 'citas nuevas por la web (48 h)', 'titulo-novedades'),
      DUENO && tarjetaDato(totalPorAprobar, totalPorAprobar === 1 ? 'solicitud por aprobar' : 'solicitudes por aprobar', '#solicitudes', totalPorAprobar > 0)),

    sinEnviar.length > 0 && el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-sin-enviar' },
      el('h2', { id: 'titulo-sin-enviar', class: 'bloque-panel__titulo',
        texto: sinEnviar.length === 1 ? '1 WhatsApp sin enviar' : `${sinEnviar.length} WhatsApp sin enviar` }),
      el('p', { class: 'alerta bloque-panel__ayuda', texto: 'El envío automático no pudo entregar estos avisos. Ábrelos en WhatsApp, envíalos y confírmalo aquí.' }),
      listaPaginada(sinEnviar, {
        porPagina: POR_PAGINA_INICIO, estado: paginasInicio.mensajes, nombre: 'mensajes',
        contenedor: (filas) => el('div', { class: 'mensajes__lista' }, filas), fila: tarjetaMensaje,
      })),

    porConfirmar.length > 0 && el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-solicitudes' },
      el('h2', { id: 'titulo-solicitudes', class: 'bloque-panel__titulo', texto: 'Citas anteriores sin confirmar' }),
      el('p', { class: 'bloque-panel__ayuda', texto: 'Se pidieron cuando las citas de la web todavía se aprobaban a mano. Acéptalas o recházalas; las nuevas ya llegan confirmadas.' }),
      listaCitasPaginada(porConfirmar, 'sinConfirmar', { conFecha: true })),

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
        ? listaCitasPaginada(ordenadas, 'hoy')
        : el('div', { class: 'vacio' }, el('p', { texto: 'No hay citas para hoy.' }))),

    el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-novedades' },
      el('h2', { id: 'titulo-novedades', class: 'bloque-panel__titulo', texto: 'Novedades de la web' }),
      el('p', { class: 'bloque-panel__ayuda', texto: 'Últimas 48 horas. Las citas pedidas por la web quedan confirmadas solas y al paciente le llega el WhatsApp.' }),
      novedades.length
        ? listaCitasPaginada(novedades, 'novedades', { conFecha: true, conNovedad: true })
        : el('div', { class: 'vacio' }, el('p', { texto: 'No hubo movimientos en la web en las últimas 48 horas.' }))));
}

// En celular el dueño (7 secciones) navega con un menú lateral que se abre desde el botón de hamburguesa.
function prepararMenuLateral() {
  const menu = document.getElementById('menu-panel');
  const abrirBoton = document.querySelector('[data-abrir-menu-lateral]');
  const cerrarBoton = menu.querySelector('.menu-lateral-cerrar');
  const celular = window.matchMedia('(max-width: 760px)');
  const aislar = ['.saltar-a-contenido', '.encabezado', '#contenido'].map((selector) => document.querySelector(selector)).filter(Boolean);

  const abierto = () => document.body.classList.contains('menu-lateral-abierto');

  function abrir() {
    document.querySelectorAll('details[open]').forEach((detalle) => { detalle.open = false; });
    document.body.classList.add('menu-lateral-abierto');
    abrirBoton.setAttribute('aria-expanded', 'true');
    aislar.forEach((zona) => { zona.inert = true; });
    cerrarBoton.focus();
  }

  function cerrar({ devolverFoco = true } = {}) {
    if (!abierto()) return;
    document.body.classList.remove('menu-lateral-abierto');
    abrirBoton.setAttribute('aria-expanded', 'false');
    aislar.forEach((zona) => { zona.inert = false; });
    if (devolverFoco) abrirBoton.focus();
  }

  abrirBoton.addEventListener('click', abrir);
  document.querySelectorAll('[data-cerrar-menu-lateral]').forEach((nodo) => nodo.addEventListener('click', () => cerrar()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && abierto()) cerrar(); });

  // Al elegir una sección el menú se cierra y el foco pasa al título de la sección.
  menu.querySelectorAll('a[data-seccion]').forEach((enlace) => {
    enlace.addEventListener('click', () => {
      cerrar({ devolverFoco: false });
      if (enlace.getAttribute('aria-current') === 'page') cuerpo.querySelector('[data-foco-seccion]')?.focus();
    });
  });

  // Atrás/adelante del navegador, o girar el celular hasta un ancho de escritorio.
  window.addEventListener('hashchange', () => cerrar({ devolverFoco: false }));
  celular.addEventListener('change', (e) => { if (!e.matches) cerrar({ devolverFoco: false }); });
}

if (sesion) {
  if (DUENO) {
    document.querySelectorAll('[data-solo-dueno]').forEach((nodo) => { nodo.hidden = false; });
    document.body.classList.add('pagina-panel--dueno');
    prepararMenuLateral();
  }
  document.querySelectorAll('[data-nombre-usuario]').forEach((nodo) => { nodo.textContent = sesion.usuario.nombre; });
  document.querySelectorAll('[data-inicial-usuario]').forEach((nodo) => { nodo.textContent = sesion.usuario.nombre.charAt(0).toUpperCase(); });
  window.addEventListener('hashchange', () => mostrarSeccion({ enfocar: true }));
  mostrarSeccion();
}
