/* Acceso a `especialistas` y a su relación con las especialidades. */
const { pool } = require('../config/db');

/* Públicos: especialistas activos que atienden una especialidad activa. */
async function listarPorEspecialidad(servicioId) {
  const [filas] = await pool.execute(
    `SELECT e.id, e.nombre
       FROM especialistas e
       JOIN especialista_especialidad ee ON ee.especialista_id = e.id
       JOIN servicios s ON s.id = ee.servicio_id AND s.activo = TRUE
      WHERE ee.servicio_id = ? AND e.activo = TRUE
      ORDER BY e.nombre`,
    [servicioId]
  );
  return filas;
}

/* Para la secretaria: todos, con sus especialidades. */
async function listarTodos() {
  const [filas] = await pool.execute(
    `SELECT e.id, e.nombre, e.activo, s.id AS servicioId, s.nombre AS servicioNombre
       FROM especialistas e
       LEFT JOIN especialista_especialidad ee ON ee.especialista_id = e.id
       LEFT JOIN servicios s ON s.id = ee.servicio_id
      ORDER BY e.nombre, s.nombre`
  );
  const porId = new Map();
  for (const f of filas) {
    if (!porId.has(f.id)) {
      porId.set(f.id, { id: f.id, nombre: f.nombre, activo: Boolean(f.activo), especialidades: [] });
    }
    if (f.servicioId) {
      porId.get(f.id).especialidades.push({ id: f.servicioId, nombre: f.servicioNombre });
    }
  }
  return [...porId.values()];
}

async function buscarPorId(id) {
  const [filas] = await pool.execute(
    `SELECT id, nombre, activo FROM especialistas WHERE id = ?`,
    [id]
  );
  return filas[0] || null;
}

/* ¿El especialista (activo) atiende esa especialidad (activa)? */
async function atiende(especialistaId, servicioId) {
  const [filas] = await pool.execute(
    `SELECT 1
       FROM especialista_especialidad ee
       JOIN especialistas e ON e.id = ee.especialista_id AND e.activo = TRUE
       JOIN servicios s ON s.id = ee.servicio_id AND s.activo = TRUE
      WHERE ee.especialista_id = ? AND ee.servicio_id = ?
      LIMIT 1`,
    [especialistaId, servicioId]
  );
  return filas.length > 0;
}

/* Crea el especialista y sus especialidades en una transacción. */
async function crear({ nombre, titulo = null, especialidadIds }) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [r] = await conexion.execute(
      `INSERT INTO especialistas (nombre, titulo) VALUES (?, ?)`, [nombre, titulo]);
    await insertarEspecialidades(conexion, r.insertId, especialidadIds);
    await conexion.commit();
    return r.insertId;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

async function actualizar(id, { nombre, titulo, activo, especialidadIds }) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    if (nombre !== undefined) {
      await conexion.execute(`UPDATE especialistas SET nombre = ? WHERE id = ?`, [nombre, id]);
    }
    if (titulo !== undefined) {
      await conexion.execute(`UPDATE especialistas SET titulo = ? WHERE id = ?`, [titulo, id]);
    }
    if (activo !== undefined) {
      await conexion.execute(`UPDATE especialistas SET activo = ? WHERE id = ?`, [activo, id]);
    }
    if (especialidadIds !== undefined) {
      await conexion.execute(`DELETE FROM especialista_especialidad WHERE especialista_id = ?`, [id]);
      await insertarEspecialidades(conexion, id, especialidadIds);
    }
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

async function insertarEspecialidades(conexion, especialistaId, especialidadIds) {
  if (especialidadIds.length === 0) return;
  const filas = especialidadIds.map((servicioId) => [especialistaId, servicioId]);
  await conexion.query(
    `INSERT INTO especialista_especialidad (especialista_id, servicio_id) VALUES ?`,
    [filas]
  );
}

/* Para la dueña: perfil completo, con la foto lista para un <img>
   (data URL). Son pocos especialistas y cada foto pesa unos 30–60 KB. */
async function listarPerfiles() {
  const lista = await listarTodos();
  const [filas] = await pool.execute(
    `SELECT id, titulo, foto, foto_tipo AS fotoTipo FROM especialistas`
  );
  const extra = new Map(filas.map((f) => [f.id, f]));
  return lista.map((e) => {
    const f = extra.get(e.id) || {};
    return {
      ...e,
      titulo: f.titulo || null,
      foto: f.foto ? `data:${f.fotoTipo};base64,${Buffer.from(f.foto).toString('base64')}` : null,
    };
  });
}

async function guardarFoto(id, contenido, tipo) {
  await pool.execute(
    `UPDATE especialistas SET foto = ?, foto_tipo = ? WHERE id = ?`, [contenido, tipo, id]);
}

async function quitarFoto(id) {
  await pool.execute(`UPDATE especialistas SET foto = NULL, foto_tipo = NULL WHERE id = ?`, [id]);
}

module.exports = {
  listarPorEspecialidad, listarTodos, listarPerfiles, buscarPorId, atiende,
  crear, actualizar, guardarFoto, quitarFoto,
};
