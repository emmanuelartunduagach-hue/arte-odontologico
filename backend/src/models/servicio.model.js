/* Acceso a la tabla `servicios`, que el sistema muestra como
   "especialidades". La columna duracion_minutos se conserva pero ya
   no se usa: el consultorio no maneja duración de citas. */
const { pool } = require('../config/db');

/* Públicas: solo las activas. */
async function listarActivos() {
  const [filas] = await pool.execute(
    `SELECT id, codigo, nombre, descripcion
       FROM servicios
      WHERE activo = TRUE
      ORDER BY nombre`
  );
  return filas;
}

/* Para la secretaria: todas, con cuántos especialistas activos tiene cada una. */
async function listarTodos() {
  const [filas] = await pool.execute(
    `SELECT s.id, s.codigo, s.nombre, s.descripcion, s.activo,
            COUNT(e.id) AS especialistasActivos
       FROM servicios s
       LEFT JOIN especialista_especialidad ee ON ee.servicio_id = s.id
       LEFT JOIN especialistas e ON e.id = ee.especialista_id AND e.activo = TRUE
      GROUP BY s.id
      ORDER BY s.nombre`
  );
  return filas.map((f) => ({ ...f, activo: Boolean(f.activo) }));
}

async function buscarPorId(id) {
  const [filas] = await pool.execute(
    `SELECT id, codigo, nombre, descripcion, activo FROM servicios WHERE id = ?`,
    [id]
  );
  return filas[0] || null;
}

async function existeCodigo(codigo) {
  const [filas] = await pool.execute(`SELECT 1 FROM servicios WHERE codigo = ? LIMIT 1`, [codigo]);
  return filas.length > 0;
}

async function crear({ codigo, nombre, descripcion }) {
  const [r] = await pool.execute(
    `INSERT INTO servicios (codigo, nombre, descripcion) VALUES (?, ?, ?)`,
    [codigo, nombre, descripcion]
  );
  return r.insertId;
}

/* Actualiza solo los campos presentes en `cambios`. */
async function actualizar(id, cambios) {
  const columnas = { nombre: 'nombre', descripcion: 'descripcion', activo: 'activo' };
  const sets = [];
  const valores = [];
  for (const [campo, columna] of Object.entries(columnas)) {
    if (cambios[campo] !== undefined) {
      sets.push(`${columna} = ?`);
      valores.push(cambios[campo]);
    }
  }
  if (sets.length === 0) return;
  await pool.execute(`UPDATE servicios SET ${sets.join(', ')} WHERE id = ?`, [...valores, id]);
}

/* Ids de servicios que existen (para validar listas). */
async function idsExistentes(ids) {
  if (ids.length === 0) return [];
  const [filas] = await pool.query(`SELECT id FROM servicios WHERE id IN (?)`, [ids]);
  return filas.map((f) => f.id);
}

module.exports = { listarActivos, listarTodos, buscarPorId, existeCodigo, crear, actualizar, idsExistentes };
