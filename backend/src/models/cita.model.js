/* Acceso a `citas`.
   La regla "una hora, una sola cita viva" la garantiza el índice
   único sobre `franja_ocupada`: si dos personas confirman la misma
   hora a la vez, una de las dos recibe ER_DUP_ENTRY. */
const { pool } = require('../config/db');

const VERSION_POLITICA_DATOS = '1.0';

/* Detalle completo de una cita, para respuestas y mensajes. */
const SELECT_DETALLE = `
  SELECT c.id, c.estado, c.reprogramaciones, c.paciente_id AS pacienteId,
         c.nombre_paciente AS nombrePaciente, c.documento_paciente AS documento,
         c.telefono_paciente AS telefono, c.correo_paciente AS correo,
         c.cancelada_por AS canceladaPor,
         c.servicio_id AS especialidadId, s.nombre AS especialidad,
         f.id AS franjaId, f.especialista_id AS especialistaId, e.nombre AS especialista,
         DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha,
         TIME_FORMAT(f.hora_inicio, '%H:%i') AS hora,
         DATE_FORMAT(TIMESTAMP(f.fecha, f.hora_inicio), '%Y-%m-%d %H:%i:%s') AS fechaHora,
         se.nombre AS sede, se.direccion, se.ciudad,
         DATE_FORMAT(c.creado_en, '%Y-%m-%d %H:%i:%s') AS creadoEn
    FROM citas c
    JOIN servicios s         ON s.id = c.servicio_id
    JOIN franjas_horarias f  ON f.id = c.franja_id
    JOIN especialistas e     ON e.id = f.especialista_id
    JOIN sedes se            ON se.id = f.sede_id`;

async function buscarDetalle(id) {
  const [filas] = await pool.execute(`${SELECT_DETALLE} WHERE c.id = ?`, [id]);
  return filas[0] || null;
}

async function buscarPorCodigoHash(hash) {
  const [filas] = await pool.execute(`${SELECT_DETALLE} WHERE c.codigo_gestion_hash = ?`, [hash]);
  return filas[0] || null;
}

async function crear({ pacienteId, servicioId, franjaId, nombre, documento, telefono, correo, codigoHash }) {
  const [r] = await pool.execute(
    `INSERT INTO citas
       (paciente_id, servicio_id, franja_id, estado,
        nombre_paciente, documento_paciente, telefono_paciente, correo_paciente,
        autorizacion_datos, fecha_autorizacion, version_politica_datos,
        codigo_gestion_hash)
     VALUES (?, ?, ?, 'confirmada', ?, ?, ?, ?, TRUE, UTC_TIMESTAMP(), ?, ?)`,
    [pacienteId, servicioId, franjaId, nombre, documento, telefono, correo, VERSION_POLITICA_DATOS, codigoHash]
  );
  return r.insertId;
}

/* Citas confirmadas que aún no pasan, de un documento. Se usa para
   limitar cuántas puede tener a la vez alguien sin usuario. */
async function contarActivasPorDocumento(documento, ahora) {
  const [filas] = await pool.execute(
    `SELECT COUNT(*) AS total
       FROM citas c
       JOIN franjas_horarias f ON f.id = c.franja_id
      WHERE c.documento_paciente = ? AND c.estado = 'confirmada'
        AND TIMESTAMP(f.fecha, f.hora_inicio) > ?`,
    [documento, ahora]
  );
  return Number(filas[0].total);
}

/* Mueve la cita a otra franja. `contarAlPaciente` suma 1 a sus
   reprogramaciones y exige que aún no haya usado la suya (la
   condición va en el WHERE para que dos clics seguidos no cuenten
   como dos reprogramaciones). Devuelve true si se cambió. */
async function cambiarFranja(id, nuevaFranjaId, { contarAlPaciente }) {
  const sql = contarAlPaciente
    ? `UPDATE citas SET franja_id = ?, reprogramaciones = reprogramaciones + 1
        WHERE id = ? AND estado = 'confirmada' AND reprogramaciones < 1`
    : `UPDATE citas SET franja_id = ?
        WHERE id = ? AND estado = 'confirmada'`;
  const [r] = await pool.execute(sql, [nuevaFranjaId, id]);
  return r.affectedRows === 1;
}

async function cancelar(id, canceladaPor) {
  const [r] = await pool.execute(
    `UPDATE citas SET estado = 'cancelada', cancelada_por = ?
      WHERE id = ? AND estado = 'confirmada'`,
    [canceladaPor, id]
  );
  return r.affectedRows === 1;
}

async function marcarEstado(id, estado) {
  const [r] = await pool.execute(
    `UPDATE citas SET estado = ? WHERE id = ? AND estado = 'confirmada'`,
    [estado, id]
  );
  return r.affectedRows === 1;
}

async function actualizarCodigoHash(id, hash) {
  await pool.execute(`UPDATE citas SET codigo_gestion_hash = ? WHERE id = ?`, [hash, id]);
}

/* Asocia al usuario recién creado las citas que pidió antes sin cuenta.
   Se exige que coincidan documento Y teléfono, para no pegarle citas
   que otra persona pidió escribiendo su documento. */
async function vincularPaciente({ documento, telefono }, pacienteId) {
  const [r] = await pool.execute(
    `UPDATE citas SET paciente_id = ?
      WHERE documento_paciente = ? AND telefono_paciente = ? AND paciente_id IS NULL`,
    [pacienteId, documento, telefono]
  );
  return r.affectedRows;
}

/* Agenda para la secretaria, con filtros opcionales. */
async function listarAgenda({ desde, hasta, especialistaId, estado, busqueda }) {
  const condiciones = ['f.fecha BETWEEN ? AND ?'];
  const valores = [desde, hasta];
  if (especialistaId) {
    condiciones.push('f.especialista_id = ?');
    valores.push(especialistaId);
  }
  if (estado) {
    condiciones.push('c.estado = ?');
    valores.push(estado);
  }
  if (busqueda) {
    const patron = `%${busqueda.replace(/[\\%_]/g, '\\$&')}%`;
    condiciones.push('(c.nombre_paciente LIKE ? OR c.documento_paciente LIKE ? OR c.telefono_paciente LIKE ?)');
    valores.push(patron, patron, patron);
  }
  const [filas] = await pool.execute(
    `${SELECT_DETALLE}
      WHERE ${condiciones.join(' AND ')}
      ORDER BY f.fecha, f.hora_inicio
      LIMIT 500`,
    valores
  );
  return filas;
}

async function listarDePaciente(pacienteId) {
  const [filas] = await pool.execute(
    `${SELECT_DETALLE} WHERE c.paciente_id = ? ORDER BY f.fecha DESC, f.hora_inicio DESC`,
    [pacienteId]
  );
  return filas;
}

module.exports = {
  buscarDetalle,
  buscarPorCodigoHash,
  crear,
  contarActivasPorDocumento,
  cambiarFranja,
  cancelar,
  marcarEstado,
  actualizarCodigoHash,
  vincularPaciente,
  listarAgenda,
  listarDePaciente,
};
