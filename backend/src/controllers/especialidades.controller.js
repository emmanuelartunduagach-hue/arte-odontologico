/* Especialidades (tabla `servicios`).
   Públicas: el paciente las ve al agendar.
   Administración: la secretaria las crea, edita y activa/desactiva. */
const servicioModelo = require('../models/servicio.model');
const especialistaModelo = require('../models/especialista.model');
const { ErrorHttp } = require('../utils/errores');
const { aId, normalizarNombre } = require('../utils/validaciones');

/* GET /api/especialidades  (también /api/servicios, por compatibilidad) */
async function listarPublicas(req, res, next) {
  try {
    res.json(await servicioModelo.listarActivos());
  } catch (error) {
    next(error);
  }
}

/* GET /api/especialidades/:id/especialistas */
async function especialistasDe(req, res, next) {
  try {
    const id = aId(req.params.id);
    if (!id) throw new ErrorHttp(404, 'Especialidad no encontrada.');
    const especialidad = await servicioModelo.buscarPorId(id);
    if (!especialidad || !especialidad.activo) throw new ErrorHttp(404, 'Especialidad no encontrada.');
    res.json(await especialistaModelo.listarPorEspecialidad(id));
  } catch (error) {
    next(error);
  }
}

/* ---------- Secretaria ---------- */

/* "Diseño de sonrisa" -> "diseno-de-sonrisa" */
function aCodigo(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 34) || 'especialidad';
}

function validar(cuerpo, { parcial }) {
  const errores = {};
  const cambios = {};

  if (!parcial || cuerpo.nombre !== undefined) {
    const nombre = normalizarNombre(cuerpo.nombre);
    if (nombre.length < 3 || nombre.length > 120) {
      errores.nombre = 'Escribe el nombre de la especialidad (entre 3 y 120 caracteres).';
    }
    cambios.nombre = nombre;
  }
  if (cuerpo.descripcion !== undefined) {
    const descripcion = typeof cuerpo.descripcion === 'string' ? cuerpo.descripcion.trim() : '';
    if (descripcion.length > 255) errores.descripcion = 'La descripción admite hasta 255 caracteres.';
    cambios.descripcion = descripcion || null;
  }
  if (cuerpo.activo !== undefined) {
    if (typeof cuerpo.activo !== 'boolean') errores.activo = 'Debe ser verdadero o falso.';
    cambios.activo = cuerpo.activo;
  }
  if (Object.keys(errores).length > 0) {
    throw new ErrorHttp(400, 'Revisa los datos del formulario.', errores);
  }
  return cambios;
}

/* GET /api/admin/especialidades */
async function listarTodas(req, res, next) {
  try {
    res.json(await servicioModelo.listarTodos());
  } catch (error) {
    next(error);
  }
}

/* POST /api/admin/especialidades   { nombre, descripcion? } */
async function crear(req, res, next) {
  try {
    const datos = validar(req.body || {}, { parcial: false });
    const base = aCodigo(datos.nombre);
    let codigo = base;
    for (let n = 2; await servicioModelo.existeCodigo(codigo); n++) codigo = `${base}-${n}`;

    const id = await servicioModelo.crear({ codigo, nombre: datos.nombre, descripcion: datos.descripcion ?? null });
    res.status(201).json(await servicioModelo.buscarPorId(id));
  } catch (error) {
    next(error);
  }
}

/* PATCH /api/admin/especialidades/:id   { nombre?, descripcion?, activo? } */
async function actualizar(req, res, next) {
  try {
    const id = aId(req.params.id);
    if (!id || !(await servicioModelo.buscarPorId(id))) {
      throw new ErrorHttp(404, 'Especialidad no encontrada.');
    }
    const cambios = validar(req.body || {}, { parcial: true });
    await servicioModelo.actualizar(id, cambios);
    const actualizada = await servicioModelo.buscarPorId(id);
    res.json({ ...actualizada, activo: Boolean(actualizada.activo) });
  } catch (error) {
    next(error);
  }
}

module.exports = { listarPublicas, especialistasDe, listarTodas, crear, actualizar };
