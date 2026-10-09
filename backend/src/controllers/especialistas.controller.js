/* Especialistas y su disponibilidad.
   Públicos: calendario del mes y horas libres de un día.
   Secretaria: registrar especialistas, asignar especialidades y
   publicar o quitar horas a mano. */
const especialistaModelo = require('../models/especialista.model');
const servicioModelo = require('../models/servicio.model');
const franjaModelo = require('../models/franja.model');
const sedeModelo = require('../models/sede.model');
const { ErrorHttp } = require('../utils/errores');
const { aId, esFecha, esHora, esMes, normalizarNombre } = require('../utils/validaciones');
const { ahoraBogota, hoyBogota, sumarDias, limitesDeMes } = require('../utils/tiempo');

async function especialistaActivo(idTexto) {
  const id = aId(idTexto);
  const especialista = id ? await especialistaModelo.buscarPorId(id) : null;
  if (!especialista || !especialista.activo) throw new ErrorHttp(404, 'Especialista no encontrado.');
  return especialista;
}

/* GET /api/especialistas/:id/calendario?mes=YYYY-MM
   Días del mes con al menos una hora libre. El frontend resalta
   esos días y bloquea los demás. */
async function calendario(req, res, next) {
  try {
    const especialista = await especialistaActivo(req.params.id);
    const mes = req.query.mes || hoyBogota().slice(0, 7);
    if (!esMes(mes)) throw new ErrorHttp(400, 'El mes debe tener el formato AAAA-MM.');

    const { desde, hasta } = limitesDeMes(mes);
    const dias = await franjaModelo.diasConCupo(especialista.id, desde, hasta, ahoraBogota());
    res.json({ especialistaId: especialista.id, mes, dias });
  } catch (error) {
    next(error);
  }
}

/* GET /api/especialistas/:id/horas?fecha=YYYY-MM-DD */
async function horas(req, res, next) {
  try {
    const especialista = await especialistaActivo(req.params.id);
    const { fecha } = req.query;
    if (!esFecha(fecha)) throw new ErrorHttp(400, 'La fecha debe tener el formato AAAA-MM-DD.');
    res.json(await franjaModelo.horasLibres(especialista.id, fecha, ahoraBogota()));
  } catch (error) {
    next(error);
  }
}

/* ---------- Secretaria ---------- */

async function validarEspecialista(cuerpo, { parcial }) {
  const errores = {};
  const datos = {};

  if (!parcial || cuerpo.nombre !== undefined) {
    const nombre = normalizarNombre(cuerpo.nombre);
    if (nombre.length < 3 || nombre.length > 120) {
      errores.nombre = 'Escribe el nombre del especialista (entre 3 y 120 caracteres).';
    }
    datos.nombre = nombre;
  }
  if (cuerpo.activo !== undefined) {
    if (typeof cuerpo.activo !== 'boolean') errores.activo = 'Debe ser verdadero o falso.';
    datos.activo = cuerpo.activo;
  }
  if (!parcial || cuerpo.especialidadIds !== undefined) {
    const lista = Array.isArray(cuerpo.especialidadIds) ? cuerpo.especialidadIds.map(aId) : null;
    if (!lista || lista.length === 0 || lista.includes(null)) {
      errores.especialidadIds = 'Elige al menos una especialidad.';
    } else {
      const unicos = [...new Set(lista)];
      const existentes = await servicioModelo.idsExistentes(unicos);
      if (existentes.length !== unicos.length) {
        errores.especialidadIds = 'Alguna de las especialidades elegidas no existe.';
      }
      datos.especialidadIds = unicos;
    }
  }
  if (Object.keys(errores).length > 0) {
    throw new ErrorHttp(400, 'Revisa los datos del formulario.', errores);
  }
  return datos;
}

/* GET /api/admin/especialistas */
async function listarTodos(req, res, next) {
  try {
    res.json(await especialistaModelo.listarTodos());
  } catch (error) {
    next(error);
  }
}

/* POST /api/admin/especialistas   { nombre, especialidadIds: [..] } */
async function crear(req, res, next) {
  try {
    const datos = await validarEspecialista(req.body || {}, { parcial: false });
    const id = await especialistaModelo.crear(datos);
    const creado = (await especialistaModelo.listarTodos()).find((e) => e.id === id);
    res.status(201).json(creado);
  } catch (error) {
    next(error);
  }
}

/* PATCH /api/admin/especialistas/:id   { nombre?, activo?, especialidadIds? } */
async function actualizar(req, res, next) {
  try {
    const id = aId(req.params.id);
    if (!id || !(await especialistaModelo.buscarPorId(id))) {
      throw new ErrorHttp(404, 'Especialista no encontrado.');
    }
    const datos = await validarEspecialista(req.body || {}, { parcial: true });
    await especialistaModelo.actualizar(id, datos);
    res.json((await especialistaModelo.listarTodos()).find((e) => e.id === id));
  } catch (error) {
    next(error);
  }
}

/* GET /api/admin/especialistas/:id/franjas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
   Por defecto: desde hoy hasta dentro de 30 días. */
async function listarFranjas(req, res, next) {
  try {
    const id = aId(req.params.id);
    if (!id || !(await especialistaModelo.buscarPorId(id))) {
      throw new ErrorHttp(404, 'Especialista no encontrado.');
    }
    const desde = req.query.desde || hoyBogota();
    if (!esFecha(desde)) throw new ErrorHttp(400, 'Revisa el rango de fechas (formato AAAA-MM-DD).');
    const hasta = req.query.hasta || sumarDias(desde, 30);
    if (!esFecha(hasta) || hasta < desde) {
      throw new ErrorHttp(400, 'Revisa el rango de fechas (formato AAAA-MM-DD).');
    }
    res.json(await franjaModelo.listarConCitas(id, desde, hasta));
  } catch (error) {
    next(error);
  }
}

/* POST /api/admin/especialistas/:id/franjas
   { fechas: ['2026-10-15', ...], horas: ['08:00', '08:30', ...] }
   Publica cada hora en cada fecha. Varias fechas = "copiar a varios días". */
async function publicarFranjas(req, res, next) {
  try {
    const especialista = await especialistaActivo(req.params.id);
    const { fechas, horas: listaHoras } = req.body || {};
    const errores = {};
    const hoy = hoyBogota();

    if (!Array.isArray(fechas) || fechas.length === 0 || fechas.length > 62) {
      errores.fechas = 'Elige entre 1 y 62 fechas.';
    } else if (!fechas.every(esFecha)) {
      errores.fechas = 'Alguna fecha no tiene el formato AAAA-MM-DD.';
    } else if (fechas.some((f) => f < hoy)) {
      errores.fechas = 'No se pueden publicar horas en fechas pasadas.';
    }
    if (!Array.isArray(listaHoras) || listaHoras.length === 0 || listaHoras.length > 96) {
      errores.horas = 'Elige entre 1 y 96 horas.';
    } else if (!listaHoras.every(esHora)) {
      errores.horas = 'Alguna hora no tiene el formato HH:MM.';
    }
    if (Object.keys(errores).length > 0) {
      throw new ErrorHttp(400, 'Revisa las fechas y horas.', errores);
    }

    const sede = await sedeModelo.principal();
    if (!sede) throw new Error('No hay una sede activa en la base de datos');

    const total = await franjaModelo.publicar({
      especialistaId: especialista.id,
      sedeId: sede.id,
      fechas: [...new Set(fechas)],
      horas: [...new Set(listaHoras)],
      creadoPor: req.usuario.id,
    });
    res.status(201).json({ mensaje: 'Horas publicadas.', total });
  } catch (error) {
    next(error);
  }
}

/* DELETE /api/admin/franjas/:id
   Quita una hora. Si tiene una cita viva, no se quita: primero hay
   que reprogramar o cancelar esa cita. */
async function quitarFranja(req, res, next) {
  try {
    const id = aId(req.params.id);
    const franja = id ? await franjaModelo.buscarPorId(id) : null;
    if (!franja || !franja.activa) throw new ErrorHttp(404, 'Hora no encontrada.');
    if (franja.citaId) {
      throw new ErrorHttp(
        409,
        `Esta hora tiene una cita de ${franja.paciente} (cita ${franja.citaId}). Reprográmala o cancélala antes de quitar la hora.`
      );
    }
    await franjaModelo.desactivar(id);
    res.json({ mensaje: 'Hora quitada.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  calendario,
  horas,
  listarTodos,
  crear,
  actualizar,
  listarFranjas,
  publicarFranjas,
  quitarFranja,
};
