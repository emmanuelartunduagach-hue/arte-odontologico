/* El consultorio atiende hoy en una sola sede activa (Rivera). */
const { pool } = require('../config/db');

async function principal() {
  const [filas] = await pool.execute(
    `SELECT id, nombre, direccion, ciudad FROM sedes WHERE activa = TRUE ORDER BY id LIMIT 1`
  );
  return filas[0] || null;
}

module.exports = { principal };
