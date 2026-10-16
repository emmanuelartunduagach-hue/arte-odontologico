// Solo INSERT: la historia clínica no se edita ni se borra (Resolución 1995 de 1999).
const { pool } = require('../config/db');

const SELECT_ENTRADA = `
  SELECT h.id,
         DATE_FORMAT(h.fecha_atencion, '%Y-%m-%d') AS fechaAtencion,
         h.servicio_id AS especialidadId, s.nombre AS especialidad,
         h.especialista_id AS especialistaId, e.nombre AS especialista,
         h.cita_id AS citaId, h.procedimiento, h.notas,
         h.corrige_a AS corrigeA, h.estado,
         u.nombre_completo AS autor,
         DATE_FORMAT(h.creado_en, '%Y-%m-%d %H:%i:%s') AS creadoEn,
         r.nombre_completo AS revisor,
         DATE_FORMAT(h.revisado_en, '%Y-%m-%d %H:%i:%s') AS revisadoEn,
         h.motivo_rechazo AS motivoRechazo
    FROM historia_clinica h
    LEFT JOIN servicios s     ON s.id = h.servicio_id
    LEFT JOIN especialistas e ON e.id = h.especialista_id
    JOIN usuarios u           ON u.id = h.creado_por
    LEFT JOIN usuarios r      ON r.id = h.revisado_por`;

async function listarDePaciente(pacienteId) {
  const [filas] = await pool.execute(
    `${SELECT_ENTRADA}
      WHERE h.paciente_id = ?
      ORDER BY h.fecha_atencion DESC, h.id DESC`,
    [pacienteId]
  );
  const correccionesDe = new Map();
  const conPendiente = new Set();
  for (const f of filas) {
    if (!f.corrigeA) continue;
    if (f.estado === 'pendiente') conPendiente.add(f.corrigeA);
    if (f.estado !== 'vigente') continue;
    if (!correccionesDe.has(f.corrigeA)) correccionesDe.set(f.corrigeA, []);
    correccionesDe.get(f.corrigeA).push(f.id);
  }
  return filas.map((f) => ({
    ...f,
    correcciones: correccionesDe.get(f.id) || [],
    correccionPendiente: conPendiente.has(f.id),
  }));
}

async function buscarPorId(id) {
  const [filas] = await pool.execute(
    `SELECT h.id, h.paciente_id AS pacienteId,
            DATE_FORMAT(h.fecha_atencion, '%Y-%m-%d') AS fechaAtencion,
            h.servicio_id AS especialidadId, h.especialista_id AS especialistaId,
            h.cita_id AS citaId, h.procedimiento, h.notas,
            h.corrige_a AS corrigeA, h.estado
       FROM historia_clinica h WHERE h.id = ?`,
    [id]
  );
  return filas[0] || null;
}

async function buscarEntrada(id) {
  const [filas] = await pool.execute(`${SELECT_ENTRADA} WHERE h.id = ?`, [id]);
  return filas[0] ? { ...filas[0], correcciones: [], correccionPendiente: false } : null;
}

async function tieneCorreccionPendiente(id) {
  const [filas] = await pool.execute(
    `SELECT 1 FROM historia_clinica WHERE corrige_a = ? AND estado = 'pendiente' LIMIT 1`,
    [id]
  );
  return filas.length > 0;
}

async function listarPendientes() {
  const [filas] = await pool.execute(
    `${SELECT_ENTRADA.replace('SELECT h.id,', `SELECT h.id, h.paciente_id AS pacienteId, p.nombre_completo AS paciente,
            o.procedimiento AS procedimientoOriginal, o.notas AS notasOriginal,
            DATE_FORMAT(o.fecha_atencion, '%Y-%m-%d') AS fechaOriginal,`)}
      JOIN pacientes p        ON p.id = h.paciente_id
      JOIN historia_clinica o ON o.id = h.corrige_a
     WHERE h.estado = 'pendiente'
     ORDER BY h.creado_en, h.id`
  );
  return filas;
}

async function revisar(id, { estado, revisadoPor, motivo }) {
  const [r] = await pool.execute(
    `UPDATE historia_clinica
        SET estado = ?, revisado_por = ?, revisado_en = NOW(), motivo_rechazo = ?
      WHERE id = ? AND estado = 'pendiente'`,
    [estado, revisadoPor, motivo ?? null, id]
  );
  return r.affectedRows > 0;
}

async function crear(datos) {
  const [r] = await pool.execute(
    `INSERT INTO historia_clinica
       (paciente_id, fecha_atencion, servicio_id, especialista_id, cita_id,
        procedimiento, notas, corrige_a, estado, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.pacienteId,
      datos.fechaAtencion,
      datos.especialidadId ?? null,
      datos.especialistaId ?? null,
      datos.citaId ?? null,
      datos.procedimiento,
      datos.notas ?? null,
      datos.corrigeA ?? null,
      datos.estado || 'vigente',
      datos.creadoPor,
    ]
  );
  return r.insertId;
}

module.exports = {
  listarDePaciente,
  buscarPorId,
  buscarEntrada,
  crear,
  tieneCorreccionPendiente,
  listarPendientes,
  revisar,
};
