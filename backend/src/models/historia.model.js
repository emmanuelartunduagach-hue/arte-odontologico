/* Acceso a `historia_clinica`.
   Solo se insertan filas: no hay UPDATE ni DELETE (Resolución 1995 de
   1999). Una corrección es una fila nueva con `corrige_a` apuntando a
   la entrada corregida; la original se conserva tal cual. */
const { pool } = require('../config/db');

const SELECT_ENTRADA = `
  SELECT h.id,
         DATE_FORMAT(h.fecha_atencion, '%Y-%m-%d') AS fechaAtencion,
         h.servicio_id AS especialidadId, s.nombre AS especialidad,
         h.especialista_id AS especialistaId, e.nombre AS especialista,
         h.cita_id AS citaId, h.procedimiento, h.notas,
         h.corrige_a AS corrigeA,
         u.nombre_completo AS autor,
         DATE_FORMAT(h.creado_en, '%Y-%m-%d %H:%i:%s') AS creadoEn
    FROM historia_clinica h
    LEFT JOIN servicios s     ON s.id = h.servicio_id
    LEFT JOIN especialistas e ON e.id = h.especialista_id
    JOIN usuarios u           ON u.id = h.creado_por`;

/* Entradas de un paciente, la atención más reciente primero. Cada
   entrada trae `correcciones`: ids de las entradas que la corrigen. */
async function listarDePaciente(pacienteId) {
  const [filas] = await pool.execute(
    `${SELECT_ENTRADA}
      WHERE h.paciente_id = ?
      ORDER BY h.fecha_atencion DESC, h.id DESC`,
    [pacienteId]
  );
  const correccionesDe = new Map();
  for (const f of filas) {
    if (f.corrigeA) {
      if (!correccionesDe.has(f.corrigeA)) correccionesDe.set(f.corrigeA, []);
      correccionesDe.get(f.corrigeA).push(f.id);
    }
  }
  return filas.map((f) => ({ ...f, correcciones: correccionesDe.get(f.id) || [] }));
}

async function buscarPorId(id) {
  const [filas] = await pool.execute(
    `SELECT h.id, h.paciente_id AS pacienteId,
            DATE_FORMAT(h.fecha_atencion, '%Y-%m-%d') AS fechaAtencion,
            h.servicio_id AS especialidadId, h.especialista_id AS especialistaId,
            h.cita_id AS citaId, h.procedimiento, h.notas
       FROM historia_clinica h WHERE h.id = ?`,
    [id]
  );
  return filas[0] || null;
}

async function buscarEntrada(id) {
  const [filas] = await pool.execute(`${SELECT_ENTRADA} WHERE h.id = ?`, [id]);
  return filas[0] ? { ...filas[0], correcciones: [] } : null;
}

async function crear(datos) {
  const [r] = await pool.execute(
    `INSERT INTO historia_clinica
       (paciente_id, fecha_atencion, servicio_id, especialista_id, cita_id,
        procedimiento, notas, corrige_a, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.pacienteId,
      datos.fechaAtencion,
      datos.especialidadId ?? null,
      datos.especialistaId ?? null,
      datos.citaId ?? null,
      datos.procedimiento,
      datos.notas ?? null,
      datos.corrigeA ?? null,
      datos.creadoPor,
    ]
  );
  return r.insertId;
}

module.exports = { listarDePaciente, buscarPorId, buscarEntrada, crear };
