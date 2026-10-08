/* Mis citas (mis-citas.html), panel del paciente con usuario.

   Contrato API v2, sección 3:
     GET  /mis-citas                    citas con puedeReprogramar, puedeCancelar
                                        y motivo, la más reciente primero
     POST /mis-citas/:id/reprogramar    { franjaId }  (1 vez, hasta 24 h antes)
     POST /mis-citas/:id/cancelar                     (hasta 24 h antes)
     GET  /auth/perfil                  datos para "Mis datos"
   Para reprogramar se usan el calendario y las horas públicas del mismo
   especialista (sección 1).

   Secciones: tu próxima cita, atajos, otras citas próximas, historial
   (plegable) y mis datos. Las utilidades (el, calendario, fechas…)
   están en js/comun.js. */

const sesion = exigirSesion('paciente');
const cuerpo = document.getElementById('panel-cuerpo');

const NOMBRE_ESTADO = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  atendida: 'Atendida',
  no_asistio: 'No asistió',
};
const ESTADOS_VIVOS = ['pendiente', 'confirmada'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const URL_AGENDAR = 'index.html#especialidades';
const REGLA = 'Puedes reprogramarla una vez y cancelarla hasta 24 horas antes.';

const estado = {
  citas: null,        // GET /mis-citas
  errorCitas: null,
  perfil: null,       // GET /auth/perfil
  errorPerfil: null,
  aviso: null,        // resultado de la última acción, se muestra una vez
};

/* ---------- Utilidades ---------- */

function pintar() {
  cuerpo.replaceChildren(...[
    typeof window.API_DEMO === 'function'
      && el('p', { class: 'alerta alerta--info', texto: 'Modo demostración: los datos son de prueba y no se guarda nada.' }),
    saludo(),
    estado.aviso && el('div', { class: 'alerta alerta--exito', role: 'status', tabindex: '-1', 'data-aviso': true }, estado.aviso),
    ...contenido(),
  ].flat(3).filter(Boolean));
}

const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

function esProxima(cita) {
  return ESTADOS_VIVOS.includes(cita.estado) && cita.fecha >= hoyColombia();
}

/** "Es hoy", "Es mañana" o "Faltan N días". */
function faltan(fecha) {
  const dias = Math.round((Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoyColombia()}T00:00:00Z`)) / 86400000);
  if (dias <= 0) return 'Es hoy';
  if (dias === 1) return 'Es mañana';
  return `Faltan ${dias} días`;
}

function enlaceMapa(direccion) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Arte Odontológico, ${direccion}`)}`;
}

/** Bloque de fecha (mes, día y día de la semana). Es decorativo: la
    fecha completa siempre va en texto al lado. */
function bloqueFecha(fecha, pequeno) {
  const [, m, d] = fecha.split('-').map(Number);
  return el('div', { class: 'bloque-fecha' + (pequeno ? ' bloque-fecha--pequeno' : ''), 'aria-hidden': 'true' },
    el('span', { class: 'bloque-fecha__mes', texto: MESES_CORTOS[m - 1] }),
    el('span', { class: 'bloque-fecha__dia', texto: String(d) }),
    !pequeno && el('span', { class: 'bloque-fecha__semana', texto: fechaLarga(fecha).split(' ')[0] }));
}

function chipEstado(cita) {
  return el('span', { class: `estado estado--${cita.estado}`, texto: NOMBRE_ESTADO[cita.estado] || cita.estado });
}

/** Botones Reprogramar / Cancelar según lo que permite la API. */
function botonesGestion(cita, compactos) {
  const clase = (principal) => `btn ${principal ? 'btn--primario' : 'btn--secundario'}${compactos ? ' btn--compacto' : ''}`;
  return [
    cita.puedeReprogramar && el('button', { type: 'button', class: clase(true), onclick: () => reprogramar(cita), texto: 'Reprogramar' }),
    cita.puedeCancelar && el('button', { type: 'button', class: clase(!cita.puedeReprogramar), onclick: () => cancelar(cita), texto: 'Cancelar cita' }),
  ].filter(Boolean);
}

/* ---------- Secciones ---------- */

function saludo() {
  const nombre = sesion.usuario.nombre.split(' ')[0];
  return el('header', { class: 'paciente__saludo' },
    el('h1', { class: 'gestion__titulo', texto: `Hola, ${nombre}` }),
    el('p', { class: 'gestion__intro', texto: 'Aquí ves tus citas en Arte Odontológico y puedes reprogramarlas o cancelarlas.' }));
}

function contenido() {
  if (estado.errorCitas) {
    return [el('div', { class: 'alerta', role: 'alert' },
      el('p', { texto: estado.errorCitas.message }),
      el('button', { type: 'button', class: 'btn btn--secundario alerta__accion', onclick: cargar, texto: 'Reintentar' }))];
  }
  if (!estado.citas) return [el('p', { class: 'estado-carga', role: 'status', texto: 'Cargando tus citas…' })];

  // La API las entrega de la más reciente a la más antigua; las próximas
  // se muestran de la más cercana a la más lejana.
  const proximas = estado.citas.filter(esProxima).reverse();
  const historial = estado.citas.filter((c) => !esProxima(c));
  const [siguiente, ...otras] = proximas;

  return [
    siguiente ? tarjetaProxima(siguiente) : sinProximas(),
    atajos(),
    otras.length > 0 && seccionOtras(otras),
    historial.length > 0 && seccionHistorial(historial),
    seccionDatos(),
  ];
}

function tarjetaProxima(cita) {
  const gestion = botonesGestion(cita);
  return el('section', { class: 'tarjeta-panel proxima', 'aria-labelledby': 'titulo-proxima' },
    el('div', { class: 'proxima__cabecera' },
      el('h2', { class: 'tarjeta-panel__titulo', id: 'titulo-proxima', texto: 'Tu próxima cita' }),
      el('span', { class: 'proxima__faltan', texto: faltan(cita.fecha) })),
    el('div', { class: 'proxima__cuerpo' },
      bloqueFecha(cita.fecha),
      el('div', { class: 'proxima__info' },
        el('p', { class: 'proxima__cuando', texto: `${capitalizar(fechaLarga(cita.fecha))}, ${horaLarga(cita.hora)}` }),
        el('p', { class: 'proxima__que', texto: `${cita.especialidad} con ${cita.especialista}` }),
        el('p', { class: 'proxima__donde' },
          icono('<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'),
          el('span', { texto: cita.direccion }),
          el('a', { href: enlaceMapa(cita.direccion), target: '_blank', rel: 'noopener noreferrer', texto: 'Cómo llegar' })))),
    el('p', { class: 'proxima__regla', texto: cita.motivo || REGLA }),
    gestion.length > 0 && el('div', { class: 'acciones proxima__acciones' }, gestion));
}

function sinProximas() {
  return el('section', { class: 'tarjeta-panel proxima proxima--vacia', 'aria-labelledby': 'titulo-proxima' },
    el('h2', { class: 'tarjeta-panel__titulo', id: 'titulo-proxima', texto: 'Tu próxima cita' }),
    el('p', { texto: 'No tienes citas próximas.' }),
    el('div', { class: 'acciones' },
      el('a', { class: 'btn btn--primario', href: URL_AGENDAR, texto: 'Agendar una cita' })));
}

function atajos() {
  const atajo = (href, trazo, titulo, detalle) => el('a', { class: 'atajo', href },
    el('span', { class: 'atajo__icono' }, icono(trazo)),
    el('span', {},
      el('span', { class: 'atajo__titulo', texto: titulo }),
      el('span', { class: 'atajo__detalle', texto: detalle })));
  return el('nav', { class: 'atajos', 'aria-label': 'Atajos' },
    atajo(URL_AGENDAR, '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>',
      'Agendar otra cita', 'Con tus datos ya llenos'),
    atajo('#mis-datos', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      'Mis datos', 'Nombre, documento y celular'),
    atajo('cambiar-contrasena.html', '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
      'Cambiar contraseña', 'Elige una clave nueva'));
}

function filaCita(cita, conAcciones) {
  const gestion = conAcciones ? botonesGestion(cita, true) : [];
  return el('li', { class: 'fila-paciente' },
    bloqueFecha(cita.fecha, true),
    el('div', { class: 'fila-paciente__info' },
      el('p', { class: 'fila-paciente__cuando', texto: `${capitalizar(fechaLarga(cita.fecha))}, ${horaLarga(cita.hora)}` }),
      el('p', { class: 'fila-paciente__detalle', texto: `${cita.especialidad} · ${cita.especialista}` }),
      conAcciones && cita.motivo && el('p', { class: 'fila-paciente__detalle', texto: cita.motivo })),
    conAcciones
      ? gestion.length > 0 && el('div', { class: 'fila-paciente__acciones' }, gestion)
      : el('div', { class: 'fila-paciente__acciones' }, chipEstado(cita)));
}

function seccionOtras(citas) {
  return el('section', { class: 'tarjeta-panel', 'aria-labelledby': 'titulo-otras' },
    el('h2', { class: 'tarjeta-panel__titulo', id: 'titulo-otras', texto: 'Otras citas próximas' }),
    el('ul', { class: 'lista-paciente' }, citas.map((c) => filaCita(c, true))));
}

function seccionHistorial(citas) {
  return el('details', { class: 'tarjeta-panel historial' },
    el('summary', { class: 'historial__resumen' },
      el('span', { class: 'tarjeta-panel__titulo', texto: 'Historial de citas' }),
      el('span', { class: 'historial__cantidad', texto: citas.length === 1 ? '1 cita' : `${citas.length} citas` })),
    el('ul', { class: 'lista-paciente' }, citas.map((c) => filaCita(c, false))));
}

function seccionDatos() {
  const p = estado.perfil;
  let contenidoDatos;
  if (estado.errorPerfil) {
    contenidoDatos = el('div', { class: 'alerta', role: 'alert' },
      el('p', { texto: estado.errorPerfil.message }),
      el('button', { type: 'button', class: 'btn btn--secundario alerta__accion', onclick: cargarPerfil, texto: 'Reintentar' }));
  } else if (!p) {
    contenidoDatos = el('p', { class: 'estado-carga', role: 'status', texto: 'Cargando tus datos…' });
  } else {
    const texto = `Hola, soy ${p.nombreCompleto} (documento ${p.documento}). Quiero corregir mis datos en Arte Odontológico: `;
    contenidoDatos = [
      el('dl', { class: 'resumen' },
        dato('Nombre', p.nombreCompleto),
        dato('Documento', p.documento),
        dato('Celular', celularLegible(p.telefono)),
        dato('Correo', p.correo || 'Sin correo')),
      el('div', { class: 'datos__correccion' },
        el('p', { texto: '¿Algún dato está mal?' }),
        el('a', {
          class: 'btn btn--whatsapp', target: '_blank', rel: 'noopener noreferrer',
          href: `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(texto)}`,
          texto: 'Escríbenos por WhatsApp',
        })),
    ];
  }
  return el('section', { class: 'tarjeta-panel', id: 'mis-datos', tabindex: '-1', 'aria-labelledby': 'titulo-datos' },
    el('h2', { class: 'tarjeta-panel__titulo', id: 'titulo-datos', texto: 'Mis datos' }),
    contenidoDatos);
}

/** '573001234567' → '300 123 4567'. */
function celularLegible(telefono) {
  const local = String(telefono || '').replace(/^57(?=\d{10}$)/, '');
  return /^\d{10}$/.test(local) ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : telefono;
}

/* ---------- Diálogo ---------- */

const dialogo = {
  modal: () => document.getElementById('modal-paciente'),
  abrir(titulo) {
    elementoQueAbrio = document.activeElement;  // de modales.js: recibe el foco al cerrar
    document.getElementById('titulo-modal-paciente').textContent = titulo;
    const nodo = document.getElementById('modal-paciente-cuerpo');
    nodo.replaceChildren();
    abrirModal('modal-paciente');
    return nodo;
  },
  cerrar() {
    if (!dialogo.modal().hidden) cerrarModal(dialogo.modal());
  },
  abierto: () => !dialogo.modal().hidden,
};

/** Tras una acción: cierra el diálogo, muestra el aviso y lo enfoca
    (el botón que abrió el diálogo ya no existe tras repintar). */
function terminarAccion(aviso) {
  elementoQueAbrio = null;
  dialogo.cerrar();
  estado.aviso = aviso;
  pintar();
  cuerpo.querySelector('[data-aviso]')?.focus();
  estado.aviso = null;
}

function reemplazarCita(nueva) {
  estado.citas = estado.citas.map((c) => (c.id === nueva.id ? nueva : c));
}

/* ---------- Reprogramar: día → hora → confirmar ---------- */

function reprogramar(cita) {
  const nodo = dialogo.abrir('Reprogramar tu cita');
  const paso = {
    mes: hoyColombia().slice(0, 7), dias: null, fecha: null, horas: null, hora: null,
    error: null, enviando: false, turno: 0,
  };

  async function cargarMes() {
    const turno = ++paso.turno;
    paso.dias = null;
    dibujar();
    try {
      const r = await api(`/especialistas/${cita.especialistaId}/calendario?mes=${paso.mes}`);
      if (turno !== paso.turno) return;
      paso.dias = new Set(r.dias.map((d) => d.fecha));
    } catch (err) {
      if (turno !== paso.turno) return;
      paso.dias = new Set();
      paso.error = err.message;
    }
    dibujar();
  }

  function cambiarMes(delta) {
    const [a, m] = paso.mes.split('-').map(Number);
    const nuevo = new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 7);
    if (nuevo < hoyColombia().slice(0, 7)) return;
    Object.assign(paso, { mes: nuevo, fecha: null, horas: null, error: null });
    cargarMes();
  }

  async function elegirDia(fecha) {
    const turno = ++paso.turno;
    Object.assign(paso, { fecha, horas: null, hora: null, error: null });
    dibujar();
    try {
      const horas = await api(`/especialistas/${cita.especialistaId}/horas?fecha=${fecha}`);
      if (turno !== paso.turno) return;
      paso.horas = horas;
    } catch (err) {
      if (turno !== paso.turno) return;
      paso.horas = [];
      paso.error = err.message;
    }
    dibujar();
    nodo.querySelector('.hora')?.focus();
  }

  async function confirmar() {
    paso.enviando = true;
    paso.error = null;
    dibujar();
    try {
      const r = await api(`/mis-citas/${cita.id}/reprogramar`, { metodo: 'POST', cuerpo: { franjaId: paso.hora.franjaId } });
      reemplazarCita(r.cita);
      terminarAccion(`Tu cita quedó para el ${fechaLarga(r.cita.fecha)} a las ${horaLarga(r.cita.hora)} ${r.whatsapp === 'enviado'
        ? 'Te enviamos la nueva confirmación por WhatsApp.'
        : 'Te enviaremos la nueva confirmación por WhatsApp.'}`);
    } catch (err) {
      paso.enviando = false;
      paso.hora = null;
      // La hora pudo tomarse mientras tanto: se vuelven a pedir las del día.
      if (err.estado === 409 && paso.fecha) await elegirDia(paso.fecha);
      paso.error = err.message;
      dibujar();
    }
  }

  function dibujar() {
    if (!dialogo.abierto()) return;
    const idPrevio = document.activeElement?.dataset?.idFoco;
    nodo.replaceChildren(...[
      el('dl', { class: 'resumen' },
        dato('Cita actual', `${fechaLarga(cita.fecha)}, ${horaLarga(cita.hora)}`),
        dato('Especialista', cita.especialista)),
      paso.error && el('p', { class: 'alerta', role: 'alert', texto: paso.error }),
      paso.hora
        ? [
          el('p', { class: 'reprogramar__nueva', texto: `Nueva hora: ${fechaLarga(paso.fecha)}, ${horaLarga(paso.hora.hora)}.` }),
          el('p', { class: 'agendar__nota', texto: 'Después de este cambio no podrás reprogramar de nuevo; solo cancelar y pedir una cita nueva.' }),
          el('div', { class: 'acciones' },
            el('button', { type: 'button', class: 'btn btn--primario', disabled: paso.enviando, 'data-id-foco': 'confirmar', onclick: confirmar,
              texto: paso.enviando ? 'Guardando…' : 'Confirmar nueva hora' }),
            el('button', { type: 'button', class: 'btn btn--secundario', disabled: paso.enviando,
              onclick: () => { paso.hora = null; dibujar(); }, texto: 'Elegir otra hora' })),
        ]
        : [
          el('p', { class: 'agendar__nota', texto: 'Elige el nuevo día y la hora con el mismo especialista. Solo puedes reprogramar una vez.' }),
          calendarioMes({ mes: paso.mes, dias: paso.dias, fecha: paso.fecha, alElegirDia: elegirDia, alCambiarMes: cambiarMes }),
          paso.fecha && listaHoras({
            fecha: paso.fecha, horas: paso.horas,
            alElegirHora: (h) => { paso.hora = h; paso.error = null; dibujar(); nodo.querySelector('[data-id-foco="confirmar"]')?.focus(); },
          }),
        ],
    ].flat(2).filter(Boolean));
    if (idPrevio) nodo.querySelector(`[data-id-foco="${idPrevio}"]`)?.focus();
  }

  cargarMes();
}

/* ---------- Cancelar ---------- */

function cancelar(cita) {
  const nodo = dialogo.abrir('¿Cancelar tu cita?');
  const error = el('p', { class: 'alerta', role: 'alert', hidden: true });
  const si = el('button', { type: 'button', class: 'btn btn--primario', texto: 'Sí, cancelar la cita' });
  si.addEventListener('click', async () => {
    si.disabled = true;
    si.textContent = 'Cancelando…';
    error.hidden = true;
    try {
      await api(`/mis-citas/${cita.id}/cancelar`, { metodo: 'POST' });
      reemplazarCita({ ...cita, estado: 'cancelada', puedeReprogramar: false, puedeCancelar: false, motivo: null });
      terminarAccion('Tu cita fue cancelada. La hora quedó libre para otra persona.');
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
      si.disabled = false;
      si.textContent = 'Sí, cancelar la cita';
    }
  });
  nodo.replaceChildren(
    el('p', { texto: `Vas a cancelar tu cita de ${cita.especialidad} del ${fechaLarga(cita.fecha)} a las ${horaLarga(cita.hora)} Esta acción no se puede deshacer.` }),
    error,
    el('div', { class: 'acciones' },
      si,
      el('button', { type: 'button', class: 'btn btn--secundario', 'data-cerrar': true, texto: 'No, conservarla' })));
  si.focus();
}

/* ---------- Carga ---------- */

async function cargar() {
  Object.assign(estado, { citas: null, errorCitas: null });
  pintar();
  try {
    estado.citas = await api('/mis-citas');
  } catch (err) {
    estado.errorCitas = err;
  }
  pintar();
}

async function cargarPerfil() {
  Object.assign(estado, { perfil: null, errorPerfil: null });
  if (estado.citas) pintar();
  try {
    estado.perfil = await api('/auth/perfil');
  } catch (err) {
    estado.errorPerfil = err;
  }
  if (estado.citas || estado.errorCitas) pintar();
}

if (sesion) {
  document.querySelector('[data-nombre-usuario]').textContent = sesion.usuario.nombre;
  cargar();
  cargarPerfil();
}
