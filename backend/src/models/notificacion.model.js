/* Bitácora de mensajes de WhatsApp (tabla `notificaciones`). */
const { pool } = require('../config/db');

async function crear({ citaId, tipo, destino, mensaje }) {
  const [r] = await pool.execute(
    `INSERT INTO notificaciones (cita_id, canal, tipo, estado, destino, mensaje)
     VALUES (?, 'whatsapp', ?, 'pendiente', ?, ?)`,
    [citaId, tipo, destino, mensaje]
  );
  return r.insertId;
}

/* Al quedar enviado, el código del enlace se borra del texto guardado:
   así la tabla no conserva enlaces válidos (en la tabla `citas` solo
   está el hash). Mientras está pendiente sí lo guarda, porque la
   secretaria necesita el texto completo para enviarlo a mano. */
async function marcar(id, estado, detalle = null) {
  await pool.execute(
    `UPDATE notificaciones
        SET estado = ?, detalle = ?,
            enviada_en = IF(? = 'enviada', UTC_TIMESTAMP(), enviada_en),
            mensaje = IF(? = 'enviada',
                         REGEXP_REPLACE(mensaje, 'codigo=[A-Za-z0-9_-]+', 'codigo=(oculto)'),
                         mensaje)
      WHERE id = ?`,
    [estado, detalle ? String(detalle).slice(0, 500) : null, estado, estado, id]
  );
}

/* Para la secretaria: mensajes por estado, los más recientes primero. */
async function listar({ estado }) {
  const [filas] = await pool.execute(
    `SELECT n.id, n.cita_id AS citaId, n.tipo, n.estado, n.destino, n.mensaje, n.detalle,
            DATE_FORMAT(n.creado_en, '%Y-%m-%d %H:%i:%s') AS creadoEn,
            c.nombre_paciente AS paciente
       FROM notificaciones n
       JOIN citas c ON c.id = n.cita_id
      WHERE n.estado = ?
      ORDER BY n.creado_en DESC, n.id DESC
      LIMIT 200`,
    [estado]
  );
  return filas;
}

async function buscarPorId(id) {
  const [filas] = await pool.execute(`SELECT id, estado FROM notificaciones WHERE id = ?`, [id]);
  return filas[0] || null;
}

module.exports = { crear, marcar, listar, buscarPorId };
