/* Acceso a `franjas_horarias` (horas publicadas por la secretaria).

   Una franja está LIBRE cuando:
     - está activa (la secretaria no la quitó),
     - su fecha y hora todavía no pasaron (en hora de Bogotá), y
     - ninguna cita viva la ocupa (citas.franja_ocupada = franja.id).
   `ahora` siempre llega desde utils/tiempo.js como 'YYYY-MM-DD HH:MM:SS'. */
const { pool } = require('../config/db');

const LIBRE = `
      f.activa = TRUE
  AND TIMESTAMP(f.fecha, f.hora_inicio) > ?
  AND NOT EXISTS (SELECT 1 FROM citas c WHERE c.franja_ocupada = f.id)`;

/* Días de un rango con al menos una hora libre: para pintar el calendario. */
async function diasConCupo(especialistaId, desde, hasta, ahora) {
  const [filas] = await pool.execute(
    `SELECT DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha, COUNT(*) AS horasLibres
       FROM franjas_horarias f
      WHERE f.especialista_id = ? AND f.fecha BETWEEN ? AND ? AND ${LIBRE}
      GROUP BY f.fecha
      ORDER BY f.fecha`,
    [especialistaId, desde, hasta, ahora]
  );
  return filas.map((f) => ({ fecha: f.fecha, horasLibres: Number(f.horasLibres) }));
}

/* Horas libres de un día. */
async function horasLibres(especialistaId, fecha, ahora) {
  const [filas] = await pool.execute(
    `SELECT f.id AS franjaId, TIME_FORMAT(f.hora_inicio, '%H:%i') AS hora
       FROM franjas_horarias f
      WHERE f.especialista_id = ? AND f.fecha = ? AND ${LIBRE}
      ORDER BY f.hora_inicio`,
    [especialistaId, fecha, ahora]
  );
  return filas;
}

/* Una franja con su especialista y sede, si está libre. */
async function buscarLibre(franjaId, ahora) {
  const [filas] = await pool.execute(
    `SELECT f.id, f.especialista_id AS especialistaId, f.sede_id AS sedeId,
            DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha,
            TIME_FORMAT(f.hora_inicio, '%H:%i') AS hora
       FROM franjas_horarias f
       JOIN especialistas e ON e.id = f.especialista_id AND e.activo = TRUE
      WHERE f.id = ? AND ${LIBRE}`,
    [franjaId, ahora]
  );
  return filas[0] || null;
}

/* Para la secretaria: horas activas de un especialista en un rango,
   con la cita que la ocupa (si hay). */
async function listarConCitas(especialistaId, desde, hasta) {
  const [filas] = await pool.execute(
    `SELECT f.id, DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha,
            TIME_FORMAT(f.hora_inicio, '%H:%i') AS hora,
            c.id AS citaId, c.nombre_paciente AS paciente, c.estado AS estadoCita
       FROM franjas_horarias f
       LEFT JOIN citas c ON c.franja_ocupada = f.id
      WHERE f.especialista_id = ? AND f.fecha BETWEEN ? AND ? AND f.activa = TRUE
      ORDER BY f.fecha, f.hora_inicio`,
    [especialistaId, desde, hasta]
  );
  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    hora: f.hora,
    cita: f.citaId ? { id: f.citaId, paciente: f.paciente, estado: f.estadoCita } : null,
  }));
}

/* Publica cada combinación fecha x hora. Si la hora ya existía (por
   ejemplo, la secretaria la quitó antes), se reactiva; si ya estaba
   activa, no cambia nada. Devuelve cuántas combinaciones se pidieron. */
async function publicar({ especialistaId, sedeId, fechas, horas, creadoPor }) {
  const filas = [];
  for (const fecha of fechas) {
    for (const hora of horas) {
      filas.push([sedeId, especialistaId, fecha, `${hora}:00`, creadoPor]);
    }
  }
  await pool.query(
    `INSERT INTO franjas_horarias (sede_id, especialista_id, fecha, hora_inicio, creado_por)
     VALUES ?
     ON DUPLICATE KEY UPDATE activa = TRUE`,
    [filas]
  );
  return filas.length;
}

async function buscarPorId(id) {
  const [filas] = await pool.execute(
    `SELECT f.id, f.activa, f.especialista_id AS especialistaId,
            c.id AS citaId, c.nombre_paciente AS paciente
       FROM franjas_horarias f
       LEFT JOIN citas c ON c.franja_ocupada = f.id
      WHERE f.id = ?`,
    [id]
  );
  return filas[0] || null;
}

/* Se desactiva en vez de borrarse: puede haber citas antiguas
   (canceladas o atendidas) que la referencian. */
async function desactivar(id) {
  await pool.execute(`UPDATE franjas_horarias SET activa = FALSE WHERE id = ?`, [id]);
}

module.exports = { diasConCupo, horasLibres, buscarLibre, listarConCitas, publicar, buscarPorId, desactivar };
