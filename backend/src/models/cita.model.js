/* Acceso a `citas`.
   La regla "una hora, una sola cita viva" la garantiza el índice
   único sobre `franja_ocupada`: si dos personas piden la misma hora
   a la vez, una de las dos recibe ER_DUP_ENTRY. Una cita pendiente
   ya aparta la hora; una cancelada o rechazada la libera. */
const { pool } = require('../config/db');

const VERSION_POLITICA_DATOS = '1.0';

/* Detalle completo de una cita, para respuestas y mensajes. */
const SELECT_DETALLE = `
  SELECT c.id, c.estado, c.reprogramaciones, c.paciente_id AS pacienteId,
         c.nombre_paciente AS nombrePaciente, c.nombres_paciente AS nombres, c.apellidos_paciente AS apellidos,
         c.tipo_documento_paciente AS tipoDocumento, c.documento_paciente AS documento,
         c.telefono_paciente AS telefono, c.telefono_fijo_paciente AS telefonoFijo, c.correo_paciente AS correo,
         c.cancelada_por AS canceladaPor,
         DATE_FORMAT(c.fecha_autorizacion, '%Y-%m-%d %H:%i:%s') AS fechaAutorizacion,
         DATE_FORMAT(c.confirmada_en, '%Y-%m-%d %H:%i:%s') AS confirmadaEn,
         c.servicio_id AS especialidadId, s.nombre AS especialidad,
         f.id AS franjaId, f.especialista_id AS especialistaId, e.nombre AS especialista,
         DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha,
         TIME_FORMAT(f.hora_inicio, '%H:%i') AS hora,
         DATE_FORMAT(TIMESTAMP(f.fecha, f.hora_inicio), '%Y-%m-%d %H:%i:%s') AS fechaHora,
         se.nombre AS sede, se.direccion, se.ciudad,
         DATE_FORMAT(fa.fecha, '%Y-%m-%d') AS fechaAnterior,
         TIME_FORMAT(fa.hora_inicio, '%H:%i') AS horaAnterior,
         DATE_FORMAT(c.creado_en, '%Y-%m-%d %H:%i:%s') AS creadoEn
    FROM citas c
    JOIN servicios s         ON s.id = c.servicio_id
    JOIN franjas_horarias f  ON f.id = c.franja_id
    JOIN especialistas e     ON e.id = f.especialista_id
    JOIN sedes se            ON se.id = f.sede_id
    LEFT JOIN franjas_horarias fa ON fa.id = c.franja_anterior_id`;

async function buscarDetalle(id) {
  const [filas] = await pool.execute(`${SELECT_DETALLE} WHERE c.id = ?`, [id]);
  return filas[0] || null;
}

async function buscarPorCodigoHash(hash) {
  const [filas] = await pool.execute(`${SELECT_DETALLE} WHERE c.codigo_gestion_hash = ?`, [hash]);
  return filas[0] || null;
}

/* `estado`: 'pendiente' si la pide el paciente por la web (la
   secretaria debe aceptarla) o 'confirmada' si la agenda la secretaria.
   El nombre completo lo calcula la base (nombres + apellidos). */
async function crear({
  pacienteId, servicioId, franjaId, estado,
  nombres, apellidos, tipoDocumento, documento, telefono, telefonoFijo = null, correo, codigoHash = null,
}) {
  const [r] = await pool.execute(
    `INSERT INTO citas
       (paciente_id, servicio_id, franja_id, estado, confirmada_en,
        nombres_paciente, apellidos_paciente, tipo_documento_paciente, documento_paciente,
        telefono_paciente, telefono_fijo_paciente, correo_paciente,
        autorizacion_datos, fecha_autorizacion, version_politica_datos,
        codigo_gestion_hash)
     VALUES (?, ?, ?, ?, IF(? = 'confirmada', NOW(), NULL), ?, ?, ?, ?, ?, ?, ?, TRUE, UTC_TIMESTAMP(), ?, ?)`,
    [pacienteId, servicioId, franjaId, estado, estado, nombres, apellidos, tipoDocumento, documento,
      telefono, telefonoFijo || null, correo, VERSION_POLITICA_DATOS, codigoHash]
  );
  return r.insertId;
}

/* Citas pendientes o confirmadas que aún no pasan, de un documento,
   contadas por estado: { pendientes, confirmadas }. Se usa para
   limitar cuántas puede pedir a la vez una persona. */
async function contarActivasPorDocumento(documento, ahora) {
  const [filas] = await pool.execute(
    `SELECT COALESCE(SUM(c.estado = 'pendiente'), 0) AS pendientes,
            COALESCE(SUM(c.estado = 'confirmada'), 0) AS confirmadas
       FROM citas c
       JOIN franjas_horarias f ON f.id = c.franja_id
      WHERE c.documento_paciente = ? AND c.estado IN ('pendiente','confirmada')
        AND TIMESTAMP(f.fecha, f.hora_inicio) > ?`,
    [documento, ahora]
  );
  return { pendientes: Number(filas[0].pendientes), confirmadas: Number(filas[0].confirmadas) };
}

/* Mueve la cita a otra franja. Devuelve true si se cambió.
   - Si la reprograma el paciente (`porPaciente`): suma 1 a sus
     reprogramaciones, exige que aún no haya usado la suya y la cita
     vuelve a 'pendiente' hasta que la secretaria acepte la nueva hora.
     Las condiciones van en el WHERE para que dos clics seguidos no
     cuenten como dos reprogramaciones.
   - Si la reprograma la secretaria: sin límite y sin cambiar el estado. */
async function cambiarFranja(id, nuevaFranjaId, { porPaciente }) {
  const sql = porPaciente
    ? `UPDATE citas SET franja_anterior_id = franja_id, franja_id = ?,
              reprogramaciones = reprogramaciones + 1,
              estado = 'pendiente', confirmada_en = NULL
        WHERE id = ? AND estado = 'confirmada' AND reprogramaciones < 1`
    : `UPDATE citas SET franja_id = ?
        WHERE id = ? AND estado IN ('pendiente','confirmada')`;
  const [r] = await pool.execute(sql, [nuevaFranjaId, id]);
  return r.affectedRows === 1;
}

async function cancelar(id, canceladaPor) {
  const [r] = await pool.execute(
    `UPDATE citas SET estado = 'cancelada', cancelada_por = ?
      WHERE id = ? AND estado IN ('pendiente','confirmada')`,
    [canceladaPor, id]
  );
  return r.affectedRows === 1;
}

/* La secretaria acepta una cita pendiente y la enlaza con su paciente. */
async function aceptar(id, pacienteId) {
  const [r] = await pool.execute(
    `UPDATE citas SET estado = 'confirmada', confirmada_en = NOW(), paciente_id = ?
      WHERE id = ? AND estado = 'pendiente'`,
    [pacienteId, id]
  );
  return r.affectedRows === 1;
}

async function rechazar(id) {
  const [r] = await pool.execute(
    `UPDATE citas SET estado = 'rechazada' WHERE id = ? AND estado = 'pendiente'`,
    [id]
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

/* Asocia al paciente recién creado en el consultorio las citas que pidió antes por la web.
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

/* Citas de un paciente, la más reciente primero. Incluye las que pidió
   por la web con su documento y aún no se le enlazan (pendientes). */
async function listarDePaciente(pacienteId, documento) {
  const [filas] = await pool.execute(
    `${SELECT_DETALLE}
      WHERE c.paciente_id = ? OR (c.paciente_id IS NULL AND c.documento_paciente = ?)
      ORDER BY f.fecha DESC, f.hora_inicio DESC`,
    [pacienteId, documento]
  );
  return filas;
}

/* Citas confirmadas que necesitan recordatorio:
   - empiezan dentro de las próximas 24 horas (entre `ahora` y `limite`),
   - se aceptaron hace más de `horasMinimas` horas (quien quedó
     confirmado hace poco ya tiene su mensaje fresco),
   - y no tienen un recordatorio posterior a su última confirmación o
     reprogramación (si la cita se movió, el recordatorio viejo no cuenta). */
async function pendientesDeRecordatorio(ahora, limite, horasMinimas) {
  const [filas] = await pool.execute(
    `SELECT c.id
       FROM citas c
       JOIN franjas_horarias f ON f.id = c.franja_id
      WHERE c.estado = 'confirmada'
        AND TIMESTAMP(f.fecha, f.hora_inicio) > ?
        AND TIMESTAMP(f.fecha, f.hora_inicio) <= ?
        AND c.confirmada_en < (NOW() - INTERVAL ? HOUR)
        AND NOT EXISTS (
          SELECT 1 FROM notificaciones r
           WHERE r.cita_id = c.id AND r.tipo = 'recordatorio'
             AND r.id > COALESCE((SELECT MAX(n.id) FROM notificaciones n
                                   WHERE n.cita_id = c.id
                                     AND n.tipo IN ('confirmacion','reprogramacion')), 0))
      ORDER BY f.fecha, f.hora_inicio
      LIMIT 500`,
    [ahora, limite, horasMinimas]
  );
  return filas.map((f) => f.id);
}

module.exports = {
  pendientesDeRecordatorio,
  buscarDetalle,
  buscarPorCodigoHash,
  crear,
  contarActivasPorDocumento,
  cambiarFranja,
  cancelar,
  aceptar,
  rechazar,
  marcarEstado,
  actualizarCodigoHash,
  vincularPaciente,
  listarAgenda,
  listarDePaciente,
};
