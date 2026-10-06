/* Ficha del paciente e historia clínica. Solo la secretaria.

   La historia no se edita ni se borra (Resolución 1995 de 1999):
   "editar" es agregar una entrada nueva, y corregir es agregar una
   entrada que apunta a la corregida (`corrigeA`). La original queda
   intacta y el panel muestra ambas, con autor y fecha. */
const usuarioModelo = require('../models/usuario.model');
const citaModelo = require('../models/cita.model');
const historiaModelo = require('../models/historia.model');
const servicioModelo = require('../models/servicio.model');
const especialistaModelo = require('../models/especialista.model');
const { ErrorHttp } = require('../utils/errores');
const { aId, esFecha } = require('../utils/validaciones');
const { hoyBogota } = require('../utils/tiempo');

async function pacientePorId(idTexto) {
  const id = aId(idTexto);
  const paciente = id ? await usuarioModelo.fichaPaciente(id) : null;
  if (!paciente) throw new ErrorHttp(404, 'Paciente no encontrado.');
  return paciente;
}

/* GET /api/pacientes/:id
   Datos del paciente, sus citas y su historia, para la ficha. */
async function ficha(req, res, next) {
  try {
    const paciente = await pacientePorId(req.params.id);
    const [citas, historia] = await Promise.all([
      citaModelo.listarDePaciente(paciente.id),
      historiaModelo.listarDePaciente(paciente.id),
    ]);
    res.json({
      paciente,
      citas: citas.map((c) => ({
        id: c.id,
        estado: c.estado,
        especialidad: c.especialidad,
        especialista: c.especialista,
        fecha: c.fecha,
        hora: c.hora,
      })),
      historia,
    });
  } catch (error) {
    next(error);
  }
}

/* GET /api/pacientes/:id/historia */
async function listar(req, res, next) {
  try {
    const paciente = await pacientePorId(req.params.id);
    res.json(await historiaModelo.listarDePaciente(paciente.id));
  } catch (error) {
    next(error);
  }
}

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

/* Valida y completa los datos de una entrada. `base` son los datos que
   hereda una corrección de la entrada original. */
async function validarEntrada(cuerpo, pacienteId, base = {}) {
  const errores = {};
  const datos = { ...base };

  if (cuerpo.procedimiento !== undefined || !base.procedimiento) {
    const procedimiento = texto(cuerpo.procedimiento);
    if (procedimiento.length < 3 || procedimiento.length > 200) {
      errores.procedimiento = 'Describe el procedimiento (entre 3 y 200 caracteres).';
    }
    datos.procedimiento = procedimiento;
  }

  if (cuerpo.notas !== undefined) {
    const notas = texto(cuerpo.notas);
    if (notas.length > 5000) errores.notas = 'Las notas admiten hasta 5000 caracteres.';
    datos.notas = notas || null;
  }

  // Si viene una cita, debe ser de este paciente; de ella se toman la
  // fecha, la especialidad y el especialista si no se envían.
  if (cuerpo.citaId !== undefined && cuerpo.citaId !== null) {
    const citaId = aId(cuerpo.citaId);
    const cita = citaId ? await citaModelo.buscarDetalle(citaId) : null;
    if (!cita || cita.pacienteId !== pacienteId) {
      errores.citaId = 'Esa cita no es de este paciente.';
    } else {
      datos.citaId = cita.id;
      datos.fechaAtencion = datos.fechaAtencion || cita.fecha;
      datos.especialidadId = datos.especialidadId || cita.especialidadId;
      datos.especialistaId = datos.especialistaId || cita.especialistaId;
    }
  }

  if (cuerpo.fechaAtencion !== undefined) datos.fechaAtencion = cuerpo.fechaAtencion;
  if (!esFecha(datos.fechaAtencion)) {
    errores.fechaAtencion = 'Escribe la fecha de atención (AAAA-MM-DD).';
  } else if (datos.fechaAtencion > hoyBogota()) {
    errores.fechaAtencion = 'La fecha de atención no puede ser futura.';
  }

  if (cuerpo.especialidadId !== undefined && cuerpo.especialidadId !== null) {
    const id = aId(cuerpo.especialidadId);
    if (!id || !(await servicioModelo.buscarPorId(id))) errores.especialidadId = 'Especialidad no válida.';
    else datos.especialidadId = id;
  }
  if (cuerpo.especialistaId !== undefined && cuerpo.especialistaId !== null) {
    const id = aId(cuerpo.especialistaId);
    if (!id || !(await especialistaModelo.buscarPorId(id))) errores.especialistaId = 'Especialista no válido.';
    else datos.especialistaId = id;
  }

  if (Object.keys(errores).length > 0) {
    throw new ErrorHttp(400, 'Revisa los datos de la entrada.', errores);
  }
  return datos;
}

/* POST /api/pacientes/:id/historia
   { fechaAtencion, procedimiento, notas?, especialidadId?, especialistaId?, citaId? }
   Con citaId (de este paciente) se puede omitir fecha, especialidad y especialista. */
async function crear(req, res, next) {
  try {
    const paciente = await pacientePorId(req.params.id);
    const cuerpo = req.body || {};
    const datos = await validarEntrada(cuerpo, paciente.id);
    const id = await historiaModelo.crear({ ...datos, pacienteId: paciente.id, creadoPor: req.usuario.id });
    res.status(201).json(await historiaModelo.buscarEntrada(id));
  } catch (error) {
    next(error);
  }
}

/* POST /api/admin/historia/:id/correccion
   { notas, procedimiento?, fechaAtencion? }
   Crea una entrada nueva que corrige a la indicada. Lo no enviado se
   copia de la original. `notas` es obligatorio: explica la corrección. */
async function corregir(req, res, next) {
  try {
    const id = aId(req.params.id);
    const original = id ? await historiaModelo.buscarPorId(id) : null;
    if (!original) throw new ErrorHttp(404, 'Entrada no encontrada.');

    const cuerpo = req.body || {};
    if (!texto(cuerpo.notas)) {
      throw new ErrorHttp(400, 'Revisa los datos de la corrección.', {
        notas: 'Explica qué se corrige y por qué.',
      });
    }
    const base = {
      fechaAtencion: original.fechaAtencion,
      procedimiento: original.procedimiento,
      especialidadId: original.especialidadId,
      especialistaId: original.especialistaId,
      citaId: original.citaId,
    };
    const datos = await validarEntrada(cuerpo, original.pacienteId, base);
    const nuevoId = await historiaModelo.crear({
      ...datos,
      pacienteId: original.pacienteId,
      corrigeA: original.id,
      creadoPor: req.usuario.id,
    });
    res.status(201).json(await historiaModelo.buscarEntrada(nuevoId));
  } catch (error) {
    next(error);
  }
}

module.exports = { ficha, listar, crear, corregir };
