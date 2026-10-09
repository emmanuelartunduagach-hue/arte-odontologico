/* Gestionar mi cita (gestionar-cita.html?codigo=…).

   Contrato API v2, sección 2:
     GET  /citas/gestion/:codigo                 ver la cita y qué se puede hacer
     POST /citas/gestion/:codigo/reprogramar     { franjaId }  (una sola vez)
     POST /citas/gestion/:codigo/cancelar

   Los botones se muestran según puedeReprogramar / puedeCancelar y, si
   alguno es false, se explica el `motivo`. Al reprogramar, la nueva hora
   queda pendiente hasta que el consultorio la acepte. Las utilidades están en
   js/comun.js. */

const codigo = new URLSearchParams(location.search).get('codigo') || '';
const cuerpo = document.getElementById('gestion-cuerpo');
const estado = { paso: 'cargando', mensaje: 'Buscando tu cita…', aviso: null };
let turno = 0;  // descarta respuestas de una pantalla que ya cambió

const rutaGestion = (accion = '') => `/citas/gestion/${encodeURIComponent(codigo)}${accion}`;
const URL_AGENDAR = 'index.html#especialidades';

/* ---------- Pantallas ---------- */

function titulo(texto) {
  return el('h1', { class: 'agendar__titulo gestion__titulo', tabindex: '-1', 'data-foco': true, texto });
}

function pintar() {
  const pintores = {
    cargando: pintarCargando, error: pintarError, ver: pintarVer,
    reprogramar: pintarReprogramar, confirmar: pintarConfirmar, cancelada: pintarCancelada,
  };
  const nodos = [].concat(pintores[estado.paso]()).filter(Boolean);
  if (typeof window.API_DEMO === 'function') {
    nodos.unshift(el('p', { class: 'alerta alerta--info', texto: 'Modo demostración: los datos son de prueba y no se guarda nada.' }));
  }
  const idPrevio = document.activeElement?.dataset?.idFoco;
  cuerpo.replaceChildren(...nodos);

  if (estado.pasoPintado !== estado.paso) cuerpo.querySelector('[data-foco]')?.focus();
  else if (idPrevio) cuerpo.querySelector(`[data-id-foco="${idPrevio}"]`)?.focus();
  estado.pasoPintado = estado.paso;
}

function pintarCargando() {
  return el('p', { class: 'estado-carga', role: 'status', texto: estado.mensaje });
}

function pintarError() {
  return [
    titulo(estado.error.estado === 404 ? 'No encontramos tu cita' : 'No pudimos cargar tu cita'),
    el('p', { class: 'alerta', role: 'alert', texto: estado.error.message }),
    el('div', { class: 'acciones' },
      estado.error.estado === 404
        ? el('a', { class: 'btn btn--primario', href: URL_AGENDAR, texto: 'Agendar una cita nueva' })
        : el('button', { type: 'button', class: 'btn btn--primario', onclick: estado.reintentarCon || cargar, texto: 'Reintentar' })),
  ];
}

function resumen(cita, conHora = true) {
  return el('dl', { class: 'resumen' },
    cita.paciente && dato('Paciente', cita.paciente),
    cita.especialidad && dato('Especialidad', cita.especialidad),
    cita.especialista && dato('Especialista', cita.especialista),
    conHora && dato('Fecha y hora', `${fechaLarga(cita.fecha)}, ${horaLarga(cita.hora)}`),
    cita.direccion && dato('Dónde', cita.direccion));
}

function pintarVer() {
  const { cita, puedeReprogramar, puedeCancelar, motivo } = estado.gestion;
  const yaReprogramada = cita.reprogramaciones >= 1;
  const TITULOS = {
    cancelada: 'Tu cita está cancelada',
    rechazada: 'Tu solicitud no fue confirmada',
    pendiente: 'Tu cita está pendiente de confirmación',
  };

  const acciones = [];
  if (puedeReprogramar) {
    acciones.push(el('button', { type: 'button', class: 'btn btn--primario', onclick: comenzarReprogramar, texto: 'Reprogramar mi cita' }));
  }
  if (puedeCancelar) {
    acciones.push(el('button', {
      type: 'button', class: puedeReprogramar ? 'btn btn--secundario' : 'btn btn--primario',
      'data-abrir': 'modal-cancelar', onclick: prepararCancelar,
      texto: yaReprogramada && !puedeReprogramar ? 'Cancelar y pedir una cita nueva' : 'Cancelar mi cita',
    }));
  }
  if (!puedeReprogramar && !puedeCancelar) {
    acciones.push(el('a', { class: 'btn btn--secundario', href: URL_AGENDAR, texto: 'Agendar una cita nueva' }));
  }

  return [
    titulo(TITULOS[cita.estado] || 'Tu cita'),
    estado.aviso && el('p', { class: 'alerta alerta--info', role: 'status', texto: estado.aviso }),
    resumen(cita),
    motivo && el('p', { class: 'alerta alerta--info', texto: motivo }),
    el('div', { class: 'acciones' }, acciones),
  ];
}

/* ---------- Reprogramar ---------- */

function comenzarReprogramar() {
  Object.assign(estado, {
    paso: 'reprogramar', aviso: null, error: null, alerta: null,
    mes: hoyColombia().slice(0, 7), dias: null, fecha: null, horas: null, franja: null,
  });
  pintar();
  cargarMes();
}

async function cargarMes() {
  const mio = ++turno;
  const mes = estado.mes;
  try {
    const r = await api(`/especialistas/${estado.gestion.cita.especialistaId}/calendario?mes=${mes}`);
    if (mio !== turno) return;
    estado.dias = new Set(r.dias.map((d) => d.fecha));
    pintar();
  } catch (error) {
    if (mio !== turno) return;
    fallar(error, comenzarReprogramar);
  }
}

function cambiarMes(delta) {
  const [a, m] = estado.mes.split('-').map(Number);
  const nuevo = new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 7);
  if (nuevo < hoyColombia().slice(0, 7)) return;
  Object.assign(estado, { mes: nuevo, dias: null, fecha: null, horas: null });
  pintar();
  cargarMes();
}

async function elegirDia(fecha) {
  const mio = ++turno;
  Object.assign(estado, { fecha, horas: null });
  pintar();
  try {
    const horas = await api(`/especialistas/${estado.gestion.cita.especialistaId}/horas?fecha=${fecha}`);
    if (mio !== turno) return;
    estado.horas = horas;
    pintar();
  } catch (error) {
    if (mio !== turno) return;
    fallar(error, () => elegirDia(fecha));
  }
}

function elegirHora(franja) {
  estado.franja = franja;
  estado.alerta = null;
  estado.paso = 'confirmar';
  estado.error = null;
  pintar();
}

function pintarReprogramar() {
  const { cita } = estado.gestion;
  return [
    titulo('Elige la nueva fecha y hora'),
    estado.alerta && el('p', { class: 'alerta', role: 'alert', texto: estado.alerta }),
    el('p', { class: 'agendar__nota', texto: `Tu cita actual es el ${fechaLarga(cita.fecha)}, ${horaLarga(cita.hora)}; solo puedes reprogramar una vez.` }),
    calendarioMes({ mes: estado.mes, dias: estado.dias, fecha: estado.fecha, alElegirDia: elegirDia, alCambiarMes: cambiarMes }),
    estado.fecha && listaHoras({ fecha: estado.fecha, horas: estado.horas, alElegirHora: elegirHora }),
    el('div', { class: 'acciones' },
      el('button', { type: 'button', class: 'btn btn--fantasma', onclick: volverAVer, texto: 'Volver sin cambios' })),
  ];
}

function pintarConfirmar() {
  const { cita } = estado.gestion;
  return [
    titulo('Confirma el cambio'),
    estado.error && el('p', { class: 'alerta', role: 'alert', texto: estado.error.message }),
    el('dl', { class: 'resumen' },
      dato('Cita actual', `${fechaLarga(cita.fecha)}, ${horaLarga(cita.hora)}`),
      dato('Nueva fecha y hora', `${fechaLarga(estado.fecha)}, ${horaLarga(estado.franja.hora)}`, () => { estado.paso = 'reprogramar'; estado.error = null; pintar(); })),
    el('p', { class: 'agendar__nota', texto: 'La nueva hora queda pendiente hasta que el consultorio la confirme. Después de este cambio no podrás reprogramar de nuevo; solo cancelar y pedir una cita nueva.' }),
    el('div', { class: 'acciones' },
      el('button', { type: 'button', class: 'btn btn--primario', id: 'btn-confirmar-cambio', onclick: reprogramar, texto: 'Solicitar el cambio' }),
      el('button', { type: 'button', class: 'btn btn--fantasma', onclick: volverAVer, texto: 'Volver sin cambios' })),
  ];
}

async function reprogramar() {
  const boton = document.getElementById('btn-confirmar-cambio');
  if (boton) { boton.disabled = true; boton.textContent = 'Guardando…'; }
  try {
    const r = await api(rutaGestion('/reprogramar'), { metodo: 'POST', cuerpo: { franjaId: estado.franja.franjaId } });
    estado.gestion = { cita: r.cita, puedeReprogramar: r.puedeReprogramar, puedeCancelar: r.puedeCancelar, motivo: null };
    estado.aviso = 'Recibimos tu cambio. Te apartamos la nueva hora y te avisaremos por WhatsApp cuando el consultorio la confirme.';
    estado.paso = 'ver';
    pintar();
  } catch (error) {
    if (error.estado === 409) {
      // La hora se tomó o la regla ya no lo permite: se vuelve a elegir.
      const fecha = estado.fecha;
      Object.assign(estado, { paso: 'reprogramar', franja: null, horas: null, aviso: null, alerta: error.message });
      pintar();
      cargarMes();
      if (fecha) elegirDia(fecha);
      return;
    }
    estado.error = error;
    pintar();
  }
}

function volverAVer() {
  turno++;
  Object.assign(estado, { paso: 'ver', aviso: null, error: null });
  pintar();
}

/* ---------- Cancelar ---------- */

function prepararCancelar() {
  const { cita, puedeReprogramar } = estado.gestion;
  const ya = cita.reprogramaciones >= 1 && !puedeReprogramar;
  document.getElementById('texto-cancelar').textContent =
    `Vas a cancelar tu cita de ${cita.especialidad || 'odontología'} del ${fechaLarga(cita.fecha)} a las ${horaLarga(cita.hora)} Esta acción no se puede deshacer.` +
    (ya ? ' Después podrás agendar una cita nueva.' : '');
  const error = document.getElementById('error-cancelar');
  error.hidden = true;
  error.textContent = '';
  const boton = document.getElementById('confirmar-cancelar');
  boton.disabled = false;
  boton.textContent = 'Sí, cancelar la cita';
}

document.getElementById('confirmar-cancelar').addEventListener('click', async (e) => {
  const boton = e.currentTarget;
  const error = document.getElementById('error-cancelar');
  boton.disabled = true;
  boton.textContent = 'Cancelando…';
  try {
    await api(rutaGestion('/cancelar'), { metodo: 'POST' });
    cerrarModal(document.getElementById('modal-cancelar'));
    estado.paso = 'cancelada';
    pintar();
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
    boton.disabled = false;
    boton.textContent = 'Sí, cancelar la cita';
  }
});

function pintarCancelada() {
  return [
    el('div', { class: 'exito' },
      icono('<circle cx="12" cy="12" r="10"/><path d="m8 12.5 2.8 2.8L16 9.5"/>'),
      titulo('Tu cita fue cancelada')),
    el('p', { class: 'agendar__nota', texto: 'Liberamos ese horario. Si quieres, puedes agendar una cita nueva ahora.' }),
    el('div', { class: 'acciones' },
      el('a', { class: 'btn btn--primario', href: URL_AGENDAR, texto: 'Pedir una cita nueva' }),
      el('a', { class: 'btn btn--secundario', href: 'index.html', texto: 'Ir al inicio' })),
  ];
}

/* ---------- Carga inicial y errores ---------- */

function fallar(error, reintentar) {
  estado.paso = 'error';
  estado.error = error;
  estado.reintentarCon = reintentar;
  pintar();
}

async function cargar() {
  Object.assign(estado, { paso: 'cargando', mensaje: 'Buscando tu cita…' });
  pintar();
  if (!codigo) {
    return fallar(Object.assign(new ErrorApi('El enlace no es válido o ya no está vigente.', 404)), cargar);
  }
  try {
    estado.gestion = await api(rutaGestion());
    estado.paso = 'ver';
    pintar();
  } catch (error) {
    fallar(error, cargar);
  }
}

document.addEventListener('DOMContentLoaded', cargar);
