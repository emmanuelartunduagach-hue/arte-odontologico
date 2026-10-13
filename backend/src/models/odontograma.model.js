/* Acceso a `odontograma`: hallazgos por diente (FDI) y por cara.

   No se borran filas. Los únicos UPDATE son:
   - pasar un hallazgo de "por hacer" a "realizado" (una vez, con autor y fecha);
   - pedir, aprobar o rechazar su anulación (si se registró por error). */
const { pool } = require('../config/db');

const SELECT_HALLAZGO = `
  SELECT o.id, o.paciente_id AS pacienteId, o.diente, o.cara, o.hallazgo, o.estado, o.notas,
         u.nombre_completo AS autor,
         DATE_FORMAT(o.creado_en, '%Y-%m-%d %H:%i:%s') AS creadoEn,
         ur.nombre_completo AS realizadoPor,
         DATE_FORMAT(o.realizado_en, '%Y-%m-%d %H:%i:%s') AS realizadoEn,
         o.anulacion, o.anulacion_motivo AS anulacionMotivo,
         up.nombre_completo AS anulacionPedidaPor,
         DATE_FORMAT(o.anulacion_pedida_en, '%Y-%m-%d %H:%i:%s') AS anulacionPedidaEn,
         uv.nombre_completo AS anulacionRevisadaPor,
         DATE_FORMAT(o.anulacion_revisada_en, '%Y-%m-%d %H:%i:%s') AS anulacionRevisadaEn,
         o.anulacion_rechazo AS anulacionRechazo
    FROM odontograma o
    JOIN usuarios u       ON u.id = o.creado_por
    LEFT JOIN usuarios ur ON ur.id = o.realizado_por
    LEFT JOIN usuarios up ON up.id = o.anulacion_pedida_por
    LEFT JOIN usuarios uv ON uv.id = o.anulacion_revisada_por`;

async function listarDePaciente(pacienteId) {
  const [filas] = await pool.execute(
    `${SELECT_HALLAZGO} WHERE o.paciente_id = ? ORDER BY o.diente, o.creado_en, o.id`,
    [pacienteId]
  );
  return filas;
}

async function buscarPorId(id) {
  const [filas] = await pool.execute(`${SELECT_HALLAZGO} WHERE o.id = ?`, [id]);
  return filas[0] || null;
}

/* Un hallazgo por cara, en una sola transacción. Devuelve los ids. */
async function crearVarios({ pacienteId, diente, caras, hallazgo, estado, notas, creadoPor }) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const ids = [];
    for (const cara of caras) {
      const [r] = await conexion.execute(
        `INSERT INTO odontograma (paciente_id, diente, cara, hallazgo, estado, notas, creado_por,
                                  realizado_por, realizado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'realizado', NOW(), NULL))`,
        [pacienteId, diente, cara, hallazgo, estado, notas ?? null, creadoPor,
          estado === 'realizado' ? creadoPor : null, estado]
      );
      ids.push(r.insertId);
    }
    await conexion.commit();
    return ids;
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

async function marcarRealizado(id, usuarioId) {
  const [r] = await pool.execute(
    `UPDATE odontograma SET estado = 'realizado', realizado_por = ?, realizado_en = NOW()
      WHERE id = ? AND estado = 'por_hacer' AND (anulacion IS NULL OR anulacion = 'rechazada')`,
    [usuarioId, id]
  );
  return r.affectedRows > 0;
}

/* Pide la anulación. Si la pide el dueño, queda aprobada de una vez. */
async function pedirAnulacion(id, { motivo, pedidaPor, aprobadaDeUnaVez }) {
  const [r] = await pool.execute(
    `UPDATE odontograma
        SET anulacion = ?, anulacion_motivo = ?, anulacion_pedida_por = ?, anulacion_pedida_en = NOW(),
            anulacion_revisada_por = ?, anulacion_revisada_en = IF(? , NOW(), NULL), anulacion_rechazo = NULL
      WHERE id = ? AND (anulacion IS NULL OR anulacion = 'rechazada')`,
    [aprobadaDeUnaVez ? 'aprobada' : 'pendiente', motivo, pedidaPor,
      aprobadaDeUnaVez ? pedidaPor : null, aprobadaDeUnaVez ? 1 : 0, id]
  );
  return r.affectedRows > 0;
}

async function revisarAnulacion(id, { aprobar, revisadoPor, motivo }) {
  const [r] = await pool.execute(
    `UPDATE odontograma
        SET anulacion = ?, anulacion_revisada_por = ?, anulacion_revisada_en = NOW(), anulacion_rechazo = ?
      WHERE id = ? AND anulacion = 'pendiente'`,
    [aprobar ? 'aprobada' : 'rechazada', revisadoPor, motivo ?? null, id]
  );
  return r.affectedRows > 0;
}

/* Anulaciones que esperan al dueño, con el nombre del paciente. */
async function listarAnulacionesPendientes() {
  const [filas] = await pool.execute(
    `${SELECT_HALLAZGO.replace('SELECT o.id,', 'SELECT o.id, p.nombre_completo AS paciente,')}
      JOIN pacientes p ON p.id = o.paciente_id
     WHERE o.anulacion = 'pendiente'
     ORDER BY o.anulacion_pedida_en, o.id`
  );
  return filas;
}

module.exports = {
  listarDePaciente,
  buscarPorId,
  crearVarios,
  marcarRealizado,
  pedirAnulacion,
  revisarAnulacion,
  listarAnulacionesPendientes,
};
