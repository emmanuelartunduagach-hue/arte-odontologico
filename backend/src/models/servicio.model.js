/* Acceso a la tabla `servicios`. */
const { pool } = require('../config/db');

async function listarActivos() {
  const [filas] = await pool.execute(
    `SELECT id, codigo, nombre, descripcion,
            duracion_minutos AS duracionMinutos
       FROM servicios
      WHERE activo = TRUE
      ORDER BY id`
  );
  return filas;
}

module.exports = { listarActivos };
