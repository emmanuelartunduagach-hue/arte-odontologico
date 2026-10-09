/* Citas.

   Público (sin iniciar sesión):
     POST /api/citas                              pedir una cita (queda pendiente)
     GET  /api/citas/gestion/:codigo              ver la cita desde el enlace
     POST /api/citas/gestion/:codigo/reprogramar  una sola vez (vuelve a pendiente)
     POST /api/citas/gestion/:codigo/cancelar
   Secretaria:
     GET  /api/admin/citas                        agenda con filtros
     POST /api/admin/citas                        agendar a un paciente (queda confirmada)
     POST /api/admin/citas/:id/aceptar            pendiente → confirmada
     POST /api/admin/citas/:id/rechazar           pendiente → rechazada
     PATCH /api/admin/citas/:id/estado            atendida | no_asistio | cancelada
     POST /api/admin/citas/:id/reprogramar        sin límite

   Reglas acordadas (documento "Alcance v2", ajustado el 9 de octubre):
   - La cita pedida por la web queda pendiente y aparta la hora. La
     secretaria la acepta (llega el WhatsApp con los datos y el enlace)
     o la rechaza (la hora se libera y llega un WhatsApp avisando).
   - Al aceptarla, la cita se enlaza con el paciente del mismo documento;
     si no existe, se crea con los datos de la cita.
   - El paciente reprograma 1 vez desde el enlace; la nueva hora vuelve a
     quedar pendiente. Después solo puede cancelar.
   - Reprogramar o cancelar desde el enlace: hasta 24 h antes.
   - Las canceladas y rechazadas no se borran. */

const citaModelo = require('../models/cita.model');
const franjaModelo = require('../models/franja.model');
const especialistaModelo = require('../models/especialista.model');
const pacienteModelo = require('../models/paciente.model');
const { notificarCita } = require('../services/notificaciones/NotificacionService');
const { ErrorHttp } = require('../utils/errores');
const { validarDatosPersona, aId, esFecha } = require('../utils/validaciones');
const { hashCodigo, pareceCodigo } = require('../utils/codigos');
const { ahoraBogota, hoyBogota, sumarDias } = require('../utils/tiempo');

const HORAS_MINIMAS = () => Number(process.env.HORAS_MINIMAS_GESTION ?? 24);
// Citas pendientes o confirmadas que una persona puede tener a la vez
// desde la web (0 = sin límite). Se acepta el nombre anterior de la variable.
const LIMITE_POR_DOCUMENTO = () =>
  Number(process.env.LIMITE_CITAS_ACTIVAS_POR_DOCUMENTO ?? process.env.LIMITE_CITAS_ACTIVAS_SIN_USUARIO ?? 1);

const MENSAJE_HORA_TOMADA = 'Esa hora acaba de ser tomada por otra persona. Elige otra.';

/* Lo que se muestra de una cita fuera del panel (sin documento ni teléfono completos). */
function vistaPublica(cita) {
  return {
    id: cita.id,
    estado: cita.estado,
    paciente: cita.nombrePaciente,
    especialidad: cita.especialidad,
    especialistaId: cita.especialistaId,
    especialista: cita.especialista,
    fecha: cita.fecha,
    hora: cita.hora,
    sede: cita.sede,
    direccion: `${cita.direccion}, ${cita.ciudad}`,
    reprogramaciones: cita.reprogramaciones,
  };
}

/* Qué puede hacer el paciente desde su enlace, y por qué no. */
function reglasGestion(cita) {
  if (cita.estado === 'cancelada') {
    return { puedeReprogramar: false, puedeCancelar: false, motivo: 'Esta cita fue cancelada.' };
  }
  if (cita.estado === 'rechazada') {
    return { puedeReprogramar: false, puedeCancelar: false, motivo: 'El consultorio no pudo confirmar esta cita. Puedes pedir una nueva.' };
  }
  if (cita.estado !== 'confirmada' && cita.estado !== 'pendiente') {
    return { puedeReprogramar: false, puedeCancelar: false, motivo: 'Esta cita ya pasó.' };
  }
  if (cita.fechaHora <= ahoraBogota(HORAS_MINIMAS())) {
    return {
      puedeReprogramar: false,
      puedeCancelar: false,
      motivo: `Faltan menos de ${HORAS_MINIMAS()} horas para tu cita. Para cambiarla, comunícate con el consultorio.`,
    };
  }
  if (cita.estado === 'pendiente') {
    return {
      puedeReprogramar: false,
      puedeCancelar: true,
      motivo: 'Tu nueva hora está pendiente de confirmación. Te avisaremos por WhatsApp cuando el consultorio la confirme.',
    };
  }
  if (cita.reprogramaciones >= 1) {
    return {
      puedeReprogramar: false,
      puedeCancelar: true,
      motivo: 'Ya reprogramaste esta cita una vez. Si necesitas otro cambio, cancélala y agenda una nueva.',
    };
  }
  return { puedeReprogramar: true, puedeCancelar: true, motivo: null };
}

function esHoraTomada(error) {
  return error.code === 'ER_DUP_ENTRY' && String(error.sqlMessage).includes('uq_cita_franja_ocupada');
}

/* ---------- Público ---------- */

/* POST /api/citas
   { especialidadId, franjaId, nombreCompleto, documento, telefono,
     correo, autorizacionDatos: true, sitioWeb: '' }
   La cita queda pendiente: aparta la hora hasta que la secretaria la
   acepte o la rechace. El WhatsApp con el enlace llega al aceptarla.
   `sitioWeb` es un campo trampa: el formulario lo oculta, así que
   una persona lo deja vacío y un bot suele llenarlo. */
async function crear(req, res, next) {
  try {
    const cuerpo = req.body || {};
    if (cuerpo.sitioWeb) throw new ErrorHttp(400, 'No fue posible agendar la cita.');

    const { valores, errores } = validarDatosPersona(cuerpo);
    const especialidadId = aId(cuerpo.especialidadId);
    const franjaId = aId(cuerpo.franjaId);
    if (!especialidadId) errores.especialidadId = 'Elige una especialidad.';
    if (!franjaId) errores.franjaId = 'Elige un día y una hora.';
    if (cuerpo.autorizacionDatos !== true) {
      errores.autorizacionDatos = 'Debes autorizar el tratamiento de tus datos personales para agendar.';
    }
    if (Object.keys(errores).length > 0) {
      throw new ErrorHttp(400, 'Revisa los datos del formulario.', errores);
    }

    const ahora = ahoraBogota();
    const franja = await franjaModelo.buscarLibre(franjaId, ahora);
    if (!franja) throw new ErrorHttp(409, 'Esa hora ya no está disponible. Elige otra.', { franjaId: 'Esa hora ya no está disponible.' });
    if (!(await especialistaModelo.atiende(franja.especialistaId, especialidadId))) {
      throw new ErrorHttp(400, 'Ese especialista no atiende la especialidad elegida.');
    }

    if (LIMITE_POR_DOCUMENTO() > 0) {
      const activas = await citaModelo.contarActivasPorDocumento(valores.documento, ahora);
      if (activas >= LIMITE_POR_DOCUMENTO()) {
        throw new ErrorHttp(
          409,
          'Ya tienes una cita pedida. Para pedir otra, primero asiste a esa cita o cancélala desde el enlace que te llegó por WhatsApp.'
        );
      }
    }

    let id;
    try {
      id = await citaModelo.crear({
        pacienteId: null,
        servicioId: especialidadId,
        franjaId,
        estado: 'pendiente',
        nombre: valores.nombreCompleto,
        documento: valores.documento,
        telefono: valores.telefono,
        correo: valores.correo,
      });
    } catch (error) {
      if (esHoraTomada(error)) throw new ErrorHttp(409, MENSAJE_HORA_TOMADA, { franjaId: MENSAJE_HORA_TOMADA });
      throw error;
    }

    res.set('Cache-Control', 'no-store');
    res.status(201).json({
      mensaje: 'Recibimos tu solicitud. Te confirmaremos por WhatsApp.',
      cita: vistaPublica(await citaModelo.buscarDetalle(id)),
    });
  } catch (error) {
    next(error);
  }
}

async function citaDesdeCodigo(codigo) {
  if (!pareceCodigo(codigo)) throw new ErrorHttp(404, 'El enlace no es válido o ya no está vigente.');
  const cita = await citaModelo.buscarPorCodigoHash(hashCodigo(codigo));
  if (!cita) throw new ErrorHttp(404, 'El enlace no es válido o ya no está vigente.');
  return cita;
}

/* GET /api/citas/gestion/:codigo */
async function verGestion(req, res, next) {
  try {
    const cita = await citaDesdeCodigo(req.params.codigo);
    res.set('Cache-Control', 'no-store');
    res.json({ cita: vistaPublica(cita), ...reglasGestion(cita) });
  } catch (error) {
    next(error);
  }
}

/* POST /api/citas/gestion/:codigo/reprogramar   { franjaId }
   La nueva hora debe ser del mismo especialista. La cita vuelve a
   quedar pendiente: el WhatsApp llega cuando la secretaria la acepte. */
async function reprogramarGestion(req, res, next) {
  try {
    const cita = await citaDesdeCodigo(req.params.codigo);
    const reglas = reglasGestion(cita);
    if (!reglas.puedeReprogramar) throw new ErrorHttp(409, reglas.motivo);

    const franjaId = aId(req.body?.franjaId);
    if (!franjaId) throw new ErrorHttp(400, 'Elige un día y una hora.', { franjaId: 'Elige un día y una hora.' });
    if (franjaId === cita.franjaId) throw new ErrorHttp(400, 'Elige una hora distinta a la actual.');

    const franja = await franjaModelo.buscarLibre(franjaId, ahoraBogota());
    if (!franja) throw new ErrorHttp(409, 'Esa hora ya no está disponible. Elige otra.');
    if (franja.especialistaId !== cita.especialistaId) {
      throw new ErrorHttp(400, 'Elige una hora del mismo especialista.');
    }

    let cambiada;
    try {
      cambiada = await citaModelo.cambiarFranja(cita.id, franjaId, { porPaciente: true });
    } catch (error) {
      if (esHoraTomada(error)) throw new ErrorHttp(409, MENSAJE_HORA_TOMADA);
      throw error;
    }
    if (!cambiada) throw new ErrorHttp(409, 'Esta cita ya no se puede reprogramar.');

    const actualizada = await citaModelo.buscarDetalle(cita.id);
    res.json({
      mensaje: 'Recibimos tu cambio. Te confirmaremos la nueva hora por WhatsApp.',
      cita: vistaPublica(actualizada),
      ...reglasGestion(actualizada),
    });
  } catch (error) {
    next(error);
  }
}

/* POST /api/citas/gestion/:codigo/cancelar */
async function cancelarGestion(req, res, next) {
  try {
    const cita = await citaDesdeCodigo(req.params.codigo);
    const reglas = reglasGestion(cita);
    if (!reglas.puedeCancelar) throw new ErrorHttp(409, reglas.motivo);

    if (!(await citaModelo.cancelar(cita.id, 'paciente'))) {
      throw new ErrorHttp(409, 'Esta cita ya no se puede cancelar.');
    }
    await notificarCita({ citaId: cita.id, tipo: 'cancelacion' });
    res.json({ mensaje: 'Tu cita fue cancelada. La hora quedó libre para otra persona.' });
  } catch (error) {
    next(error);
  }
}

/* ---------- Secretaria ---------- */

const ESTADOS = ['pendiente', 'confirmada', 'rechazada', 'cancelada', 'atendida', 'no_asistio'];

/* GET /api/admin/citas?fecha=&desde=&hasta=&especialistaId=&estado=&q=
   Sin fechas: desde hoy hasta dentro de 30 días. */
async function agenda(req, res, next) {
  try {
    const q = req.query;
    const desde = q.fecha || q.desde || hoyBogota();
    if (!esFecha(desde)) throw new ErrorHttp(400, 'Revisa el rango de fechas (formato AAAA-MM-DD).');
    const hasta = q.fecha || q.hasta || sumarDias(desde, 30);
    if (!esFecha(hasta) || hasta < desde) {
      throw new ErrorHttp(400, 'Revisa el rango de fechas (formato AAAA-MM-DD).');
    }
    if (q.estado && !ESTADOS.includes(q.estado)) throw new ErrorHttp(400, 'Estado no válido.');
    const especialistaId = q.especialistaId ? aId(q.especialistaId) : null;
    if (q.especialistaId && !especialistaId) throw new ErrorHttp(400, 'Especialista no válido.');

    const citas = await citaModelo.listarAgenda({
      desde,
      hasta,
      especialistaId,
      estado: q.estado || null,
      busqueda: typeof q.q === 'string' ? q.q.trim().slice(0, 100) : '',
    });
    res.json(
      citas.map((c) => ({
        ...vistaPublica(c),
        especialidadId: c.especialidadId,
        documento: c.documento,
        telefono: c.telefono,
        correo: c.correo,
        pacienteId: c.pacienteId,
        canceladaPor: c.canceladaPor,
        creadoEn: c.creadoEn,
      }))
    );
  } catch (error) {
    next(error);
  }
}

async function citaPorId(idTexto) {
  const id = aId(idTexto);
  const cita = id ? await citaModelo.buscarDetalle(id) : null;
  if (!cita) throw new ErrorHttp(404, 'Cita no encontrada.');
  return cita;
}

/* PATCH /api/admin/citas/:id/estado   { estado: 'atendida' | 'no_asistio' | 'cancelada' } */
async function cambiarEstado(req, res, next) {
  try {
    const cita = await citaPorId(req.params.id);
    const { estado } = req.body || {};
    if (!['atendida', 'no_asistio', 'cancelada'].includes(estado)) {
      throw new ErrorHttp(400, 'El estado debe ser atendida, no_asistio o cancelada.');
    }
    if (cita.estado === 'pendiente') {
      throw new ErrorHttp(409, 'La cita está pendiente: primero acéptala o recházala.');
    }
    if (cita.estado !== 'confirmada') {
      throw new ErrorHttp(409, `La cita ya está ${cita.estado.replace('_', ' ')}.`);
    }

    if (estado === 'cancelada') {
      if (!(await citaModelo.cancelar(cita.id, 'administrador'))) {
        throw new ErrorHttp(409, 'La cita ya no se puede cancelar.');
      }
      const notificacion = await notificarCita({ citaId: cita.id, tipo: 'cancelacion' });
      return res.json({ mensaje: 'Cita cancelada.', notificacion });
    }

    if (cita.fechaHora > ahoraBogota()) {
      throw new ErrorHttp(409, 'Solo puedes marcar asistencia cuando ya llegó la hora de la cita.');
    }
    if (!(await citaModelo.marcarEstado(cita.id, estado))) {
      throw new ErrorHttp(409, 'La cita ya cambió de estado.');
    }
    res.json({ mensaje: estado === 'atendida' ? 'Cita marcada como atendida.' : 'Cita marcada como no asistió.' });
  } catch (error) {
    next(error);
  }
}

/* POST /api/admin/citas/:id/reprogramar   { franjaId }
   La secretaria no tiene límite ni plazo, y puede pasar la cita a
   otro especialista que atienda la misma especialidad. */
async function reprogramarAdmin(req, res, next) {
  try {
    const cita = await citaPorId(req.params.id);
    if (!['pendiente', 'confirmada'].includes(cita.estado)) {
      throw new ErrorHttp(409, 'Solo se pueden reprogramar citas pendientes o confirmadas.');
    }

    const franjaId = aId(req.body?.franjaId);
    if (!franjaId) throw new ErrorHttp(400, 'Elige un día y una hora.', { franjaId: 'Elige un día y una hora.' });
    if (franjaId === cita.franjaId) throw new ErrorHttp(400, 'Elige una hora distinta a la actual.');

    const franja = await franjaModelo.buscarLibre(franjaId, ahoraBogota());
    if (!franja) throw new ErrorHttp(409, 'Esa hora ya no está disponible. Elige otra.');
    if (!(await especialistaModelo.atiende(franja.especialistaId, cita.especialidadId))) {
      throw new ErrorHttp(400, 'Ese especialista no atiende la especialidad de esta cita.');
    }

    let cambiada;
    try {
      cambiada = await citaModelo.cambiarFranja(cita.id, franjaId, { porPaciente: false });
    } catch (error) {
      if (esHoraTomada(error)) throw new ErrorHttp(409, MENSAJE_HORA_TOMADA);
      throw error;
    }
    if (!cambiada) throw new ErrorHttp(409, 'La cita ya cambió de estado.');

    // Una pendiente aún no tiene mensaje: el paciente se entera al aceptarla.
    // Una confirmada recibe el aviso con un enlace nuevo (sin código en
    // claro no se puede reutilizar el anterior, que deja de servir).
    const notificacion = cita.estado === 'confirmada'
      ? await notificarCita({ citaId: cita.id, tipo: 'reprogramacion' })
      : null;
    res.json({ mensaje: 'Cita reprogramada.', cita: vistaPublica(await citaModelo.buscarDetalle(cita.id)), notificacion });
  } catch (error) {
    next(error);
  }
}

/* Paciente con el documento de la cita; si no existe, se crea con los
   datos que escribió al pedirla. Devuelve { paciente, nuevo }. */
async function pacienteDeCita(cita, creadoPor) {
  const existente = await pacienteModelo.buscarPorDocumento(cita.documento);
  if (existente) return { paciente: existente, nuevo: false };
  try {
    const id = await pacienteModelo.crear({
      nombreCompleto: cita.nombrePaciente,
      documento: cita.documento,
      telefono: cita.telefono,
      correo: cita.correo || '',
      origen: 'web',
      fechaAutorizacion: cita.fechaAutorizacion,
      creadoPor,
    });
    return { paciente: await pacienteModelo.buscarPorId(id), nuevo: true };
  } catch (error) {
    // Otra aceptación lo creó al mismo tiempo: se usa ese.
    if (error.code === 'ER_DUP_ENTRY') {
      return { paciente: await pacienteModelo.buscarPorDocumento(cita.documento), nuevo: false };
    }
    throw error;
  }
}

/* POST /api/admin/citas/:id/aceptar
   La cita pasa a confirmada, queda en la ficha del paciente y le llega
   el WhatsApp con los datos y el enlace para reprogramar o cancelar. */
async function aceptar(req, res, next) {
  try {
    const cita = await citaPorId(req.params.id);
    if (cita.estado !== 'pendiente') throw new ErrorHttp(409, `La cita ya está ${cita.estado.replace('_', ' ')}.`);
    if (cita.fechaHora <= ahoraBogota()) {
      throw new ErrorHttp(409, 'La hora de esta cita ya pasó. Recházala o reprográmala.');
    }

    const { paciente, nuevo } = await pacienteDeCita(cita, req.usuario.id);
    if (!(await citaModelo.aceptar(cita.id, paciente.id))) {
      throw new ErrorHttp(409, 'La cita ya cambió de estado.');
    }
    const notificacion = await notificarCita({ citaId: cita.id, tipo: 'confirmacion' });
    res.json({
      mensaje: nuevo ? 'Cita aceptada. Se creó la ficha del paciente.' : 'Cita aceptada.',
      cita: vistaPublica(await citaModelo.buscarDetalle(cita.id)),
      pacienteId: paciente.id,
      pacienteNuevo: nuevo,
      notificacion,
    });
  } catch (error) {
    next(error);
  }
}

/* POST /api/admin/citas/:id/rechazar
   La hora se libera y al paciente le llega un WhatsApp invitándolo a
   pedir otra hora. */
async function rechazar(req, res, next) {
  try {
    const cita = await citaPorId(req.params.id);
    if (cita.estado !== 'pendiente') throw new ErrorHttp(409, `La cita ya está ${cita.estado.replace('_', ' ')}.`);
    if (!(await citaModelo.rechazar(cita.id))) throw new ErrorHttp(409, 'La cita ya cambió de estado.');
    const notificacion = await notificarCita({ citaId: cita.id, tipo: 'rechazo' });
    res.json({ mensaje: 'Solicitud rechazada. La hora quedó libre.', notificacion });
  } catch (error) {
    next(error);
  }
}

/* POST /api/admin/citas   { pacienteId, especialidadId, franjaId }
   Para quien llega al consultorio o llama: la secretaria le agenda la
   cita con los datos de su ficha. Queda confirmada de una vez (no hay
   nada que aprobar) y le llega el WhatsApp con el enlace. */
async function crearAdmin(req, res, next) {
  try {
    const cuerpo = req.body || {};
    const errores = {};
    const pacienteId = aId(cuerpo.pacienteId);
    const especialidadId = aId(cuerpo.especialidadId);
    const franjaId = aId(cuerpo.franjaId);
    if (!pacienteId) errores.pacienteId = 'Elige un paciente.';
    if (!especialidadId) errores.especialidadId = 'Elige una especialidad.';
    if (!franjaId) errores.franjaId = 'Elige un día y una hora.';
    if (Object.keys(errores).length > 0) throw new ErrorHttp(400, 'Revisa los datos de la cita.', errores);

    const paciente = await pacienteModelo.buscarPorId(pacienteId);
    if (!paciente) throw new ErrorHttp(404, 'Paciente no encontrado.');
    const franja = await franjaModelo.buscarLibre(franjaId, ahoraBogota());
    if (!franja) throw new ErrorHttp(409, 'Esa hora ya no está disponible. Elige otra.');
    if (!(await especialistaModelo.atiende(franja.especialistaId, especialidadId))) {
      throw new ErrorHttp(400, 'Ese especialista no atiende la especialidad elegida.');
    }

    let id;
    try {
      id = await citaModelo.crear({
        pacienteId: paciente.id,
        servicioId: especialidadId,
        franjaId,
        estado: 'confirmada',
        nombre: paciente.nombreCompleto,
        documento: paciente.documento,
        telefono: paciente.telefono,
        correo: paciente.correo,
      });
    } catch (error) {
      if (esHoraTomada(error)) throw new ErrorHttp(409, MENSAJE_HORA_TOMADA);
      throw error;
    }
    const notificacion = await notificarCita({ citaId: id, tipo: 'confirmacion' });
    res.status(201).json({ mensaje: 'Cita agendada.', cita: vistaPublica(await citaModelo.buscarDetalle(id)), notificacion });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  crear,
  verGestion,
  reprogramarGestion,
  cancelarGestion,
  agenda,
  crearAdmin,
  aceptar,
  rechazar,
  cambiarEstado,
  reprogramarAdmin,
};
