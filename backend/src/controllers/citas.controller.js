/* Citas.

   Público (sin iniciar sesión):
     POST /api/citas                              agendar con 3 datos
     GET  /api/citas/gestion/:codigo              ver la cita desde el enlace
     POST /api/citas/gestion/:codigo/reprogramar  una sola vez
     POST /api/citas/gestion/:codigo/cancelar
   Paciente con usuario:
     GET  /api/mis-citas                          con lo que puede hacer en cada una
     POST /api/mis-citas/:id/reprogramar          mismas reglas que el enlace
     POST /api/mis-citas/:id/cancelar
     (y POST /api/citas con su sesión: sin límite de citas activas)
   Secretaria:
     GET  /api/admin/citas                        agenda con filtros
     PATCH /api/admin/citas/:id/estado            atendida | no_asistio | cancelada
     POST /api/admin/citas/:id/reprogramar        sin límite

   Reglas acordadas (documento "Alcance v2"):
   - La cita queda confirmada al agendar.
   - El paciente reprograma 1 vez; después solo puede cancelar.
   - Reprogramar o cancelar desde el enlace o desde "Mis citas": hasta 24 h antes.
   - Las canceladas no se borran: quedan como 'cancelada'. */

const citaModelo = require('../models/cita.model');
const franjaModelo = require('../models/franja.model');
const especialistaModelo = require('../models/especialista.model');
const usuarioModelo = require('../models/usuario.model');
const { notificarCita } = require('../services/notificaciones/NotificacionService');
const { ErrorHttp } = require('../utils/errores');
const { validarDatosPersona, aId, esFecha } = require('../utils/validaciones');
const { generarCodigoGestion, hashCodigo, pareceCodigo } = require('../utils/codigos');
const { ahoraBogota, hoyBogota, sumarDias } = require('../utils/tiempo');

const HORAS_MINIMAS = () => Number(process.env.HORAS_MINIMAS_GESTION ?? 24);
const LIMITE_SIN_USUARIO = () => Number(process.env.LIMITE_CITAS_ACTIVAS_SIN_USUARIO ?? 1);

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
  if (cita.estado !== 'confirmada') {
    return { puedeReprogramar: false, puedeCancelar: false, motivo: 'Esta cita ya pasó.' };
  }
  if (cita.fechaHora <= ahoraBogota(HORAS_MINIMAS())) {
    return {
      puedeReprogramar: false,
      puedeCancelar: false,
      motivo: `Faltan menos de ${HORAS_MINIMAS()} horas para tu cita. Para cambiarla, comunícate con el consultorio.`,
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
     correo?, autorizacionDatos: true, sitioWeb: '' }
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

    // La cita queda a nombre de un usuario solo si quien agenda es ese
    // paciente con su sesión iniciada. Escribir el documento de otra
    // persona no basta: si no, cualquiera podría llenar la agenda a su
    // nombre saltándose el límite.
    let usuario = null;
    if (req.usuario?.rol === 'paciente') {
      const propio = await usuarioModelo.buscarPacientePorDocumento(valores.documento);
      if (propio && propio.id === req.usuario.id) usuario = propio;
    }
    // Sin sesión (o con el documento de otra persona) se limita cuántas
    // citas activas puede tener ese documento a la vez.
    if (!usuario && LIMITE_SIN_USUARIO() > 0) {
      const activas = await citaModelo.contarActivasPorDocumento(valores.documento, ahora);
      if (activas >= LIMITE_SIN_USUARIO()) {
        throw new ErrorHttp(
          409,
          'Ya tienes una cita agendada. Para pedir otra, primero asiste a esa cita o cancélala desde el enlace que te llegó por WhatsApp.'
        );
      }
    }

    const { codigo, hash } = generarCodigoGestion();
    let id;
    try {
      id = await citaModelo.crear({
        pacienteId: usuario ? usuario.id : null,
        servicioId: especialidadId,
        franjaId,
        nombre: valores.nombreCompleto,
        documento: valores.documento,
        telefono: valores.telefono,
        correo: valores.correo,
        codigoHash: hash,
      });
    } catch (error) {
      if (esHoraTomada(error)) throw new ErrorHttp(409, MENSAJE_HORA_TOMADA, { franjaId: MENSAJE_HORA_TOMADA });
      throw error;
    }

    const notificacion = await notificarCita({ citaId: id, tipo: 'confirmacion', codigo });
    const cita = await citaModelo.buscarDetalle(id);

    res.set('Cache-Control', 'no-store');
    res.status(201).json({
      mensaje: 'Tu cita quedó agendada.',
      cita: vistaPublica(cita),
      whatsapp: notificacion.estado === 'enviada' ? 'enviado' : 'pendiente',
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

/* Reprograma o cancela una cita a pedido del paciente, ya sea desde el
   enlace de gestión o desde "Mis citas" con su sesión. Las reglas son las
   mismas en los dos casos (reglasGestion). `codigo` es el del enlace, si
   se tiene: sin él, el mensaje de WhatsApp lleva un enlace nuevo y el
   anterior deja de servir. */
async function reprogramarPorPaciente(cita, cuerpo, codigo) {
  const reglas = reglasGestion(cita);
  if (!reglas.puedeReprogramar) throw new ErrorHttp(409, reglas.motivo);

  const franjaId = aId(cuerpo?.franjaId);
  if (!franjaId) throw new ErrorHttp(400, 'Elige un día y una hora.', { franjaId: 'Elige un día y una hora.' });
  if (franjaId === cita.franjaId) throw new ErrorHttp(400, 'Elige una hora distinta a la actual.');

  const franja = await franjaModelo.buscarLibre(franjaId, ahoraBogota());
  if (!franja) throw new ErrorHttp(409, 'Esa hora ya no está disponible. Elige otra.');
  if (franja.especialistaId !== cita.especialistaId) {
    throw new ErrorHttp(400, 'Elige una hora del mismo especialista.');
  }

  let cambiada;
  try {
    cambiada = await citaModelo.cambiarFranja(cita.id, franjaId, { contarAlPaciente: true });
  } catch (error) {
    if (esHoraTomada(error)) throw new ErrorHttp(409, MENSAJE_HORA_TOMADA);
    throw error;
  }
  if (!cambiada) throw new ErrorHttp(409, 'Esta cita ya no se puede reprogramar.');

  const notificacion = await notificarCita({ citaId: cita.id, tipo: 'reprogramacion', codigo });
  return {
    actualizada: await citaModelo.buscarDetalle(cita.id),
    whatsapp: notificacion.estado === 'enviada' ? 'enviado' : 'pendiente',
  };
}

async function cancelarPorPaciente(cita) {
  const reglas = reglasGestion(cita);
  if (!reglas.puedeCancelar) throw new ErrorHttp(409, reglas.motivo);

  if (!(await citaModelo.cancelar(cita.id, 'paciente'))) {
    throw new ErrorHttp(409, 'Esta cita ya no se puede cancelar.');
  }
  await notificarCita({ citaId: cita.id, tipo: 'cancelacion' });
}

const MENSAJE_CANCELADA = 'Tu cita fue cancelada. La hora quedó libre para otra persona.';

/* POST /api/citas/gestion/:codigo/reprogramar   { franjaId }
   La nueva hora debe ser del mismo especialista. */
async function reprogramarGestion(req, res, next) {
  try {
    const codigo = req.params.codigo;
    const cita = await citaDesdeCodigo(codigo);
    const { actualizada, whatsapp } = await reprogramarPorPaciente(cita, req.body, codigo);
    res.json({
      mensaje: 'Tu cita fue reprogramada.',
      cita: vistaPublica(actualizada),
      ...reglasGestion(actualizada),
      whatsapp,
    });
  } catch (error) {
    next(error);
  }
}

/* POST /api/citas/gestion/:codigo/cancelar */
async function cancelarGestion(req, res, next) {
  try {
    await cancelarPorPaciente(await citaDesdeCodigo(req.params.codigo));
    res.json({ mensaje: MENSAJE_CANCELADA });
  } catch (error) {
    next(error);
  }
}

/* ---------- Paciente con usuario ---------- */

/* Cita con lo que el paciente puede hacer con ella. */
function vistaPaciente(cita) {
  return { ...vistaPublica(cita), ...reglasGestion(cita) };
}

/* GET /api/mis-citas
   Cada cita trae puedeReprogramar, puedeCancelar y motivo, como en el
   enlace de gestión. */
async function misCitas(req, res, next) {
  try {
    const citas = await citaModelo.listarDePaciente(req.usuario.id);
    res.json(citas.map(vistaPaciente));
  } catch (error) {
    next(error);
  }
}

/* Cita del paciente con sesión. Si es de otra persona responde 404,
   igual que si no existiera, para no revelar qué ids hay. */
async function citaPropia(req) {
  const id = aId(req.params.id);
  const cita = id ? await citaModelo.buscarDetalle(id) : null;
  if (!cita || cita.pacienteId !== req.usuario.id) throw new ErrorHttp(404, 'Cita no encontrada.');
  return cita;
}

/* POST /api/mis-citas/:id/reprogramar   { franjaId } */
async function reprogramarMia(req, res, next) {
  try {
    const cita = await citaPropia(req);
    const { actualizada, whatsapp } = await reprogramarPorPaciente(cita, req.body);
    res.json({ mensaje: 'Tu cita fue reprogramada.', cita: vistaPaciente(actualizada), whatsapp });
  } catch (error) {
    next(error);
  }
}

/* POST /api/mis-citas/:id/cancelar */
async function cancelarMia(req, res, next) {
  try {
    await cancelarPorPaciente(await citaPropia(req));
    res.json({ mensaje: MENSAJE_CANCELADA });
  } catch (error) {
    next(error);
  }
}

/* ---------- Secretaria ---------- */

const ESTADOS = ['pendiente', 'confirmada', 'cancelada', 'atendida', 'no_asistio'];

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
    if (cita.estado !== 'confirmada') throw new ErrorHttp(409, 'Solo se pueden reprogramar citas confirmadas.');

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
      cambiada = await citaModelo.cambiarFranja(cita.id, franjaId, { contarAlPaciente: false });
    } catch (error) {
      if (esHoraTomada(error)) throw new ErrorHttp(409, MENSAJE_HORA_TOMADA);
      throw error;
    }
    if (!cambiada) throw new ErrorHttp(409, 'La cita ya cambió de estado.');

    // Sin código en claro: el mensaje lleva un enlace nuevo y el anterior deja de servir.
    const notificacion = await notificarCita({ citaId: cita.id, tipo: 'reprogramacion' });
    res.json({ mensaje: 'Cita reprogramada.', cita: vistaPublica(await citaModelo.buscarDetalle(cita.id)), notificacion });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  crear,
  verGestion,
  reprogramarGestion,
  cancelarGestion,
  misCitas,
  reprogramarMia,
  cancelarMia,
  agenda,
  cambiarEstado,
  reprogramarAdmin,
};
