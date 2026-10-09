/* Acceso a `pacientes`: el registro de cada paciente, con su historia
   clínica. No tienen usuario ni contraseña. Todas las consultas usan
   parámetros (?) para evitar inyección SQL. */
const { pool } = require('../config/db');

const VERSION_POLITICA_DATOS = '1.0';

const SELECT_PACIENTE = `
  SELECT id, nombre_completo AS nombreCompleto, documento, telefono, correo, origen,
         DATE_FORMAT(fecha_autorizacion, '%Y-%m-%d %H:%i:%s') AS fechaAutorizacion,
         DATE_FORMAT(creado_en, '%Y-%m-%d %H:%i:%s') AS creadoEn
    FROM pacientes`;

/* Crea un paciente.
   - origen 'consultorio': la secretaria lo registra en persona y
     confirma que autorizó el tratamiento de sus datos (ahora).
   - origen 'web': se crea al aceptar su primera cita; la autorización
     es la que dio al pedirla (`fechaAutorizacion` de la cita). */
async function crear({ nombreCompleto, documento, telefono, correo, origen, fechaAutorizacion, creadoPor }) {
  const [r] = await pool.execute(
    `INSERT INTO pacientes
       (nombre_completo, documento, telefono, correo, origen,
        autorizacion_datos, fecha_autorizacion, version_politica_datos, creado_por)
     VALUES (?, ?, ?, ?, ?, TRUE, COALESCE(?, UTC_TIMESTAMP()), ?, ?)`,
    [nombreCompleto, documento, telefono, correo, origen, fechaAutorizacion || null, VERSION_POLITICA_DATOS, creadoPor]
  );
  return r.insertId;
}

async function buscarPorId(id) {
  const [filas] = await pool.execute(`${SELECT_PACIENTE} WHERE id = ?`, [id]);
  return filas[0] || null;
}

async function buscarPorDocumento(documento) {
  const [filas] = await pool.execute(`${SELECT_PACIENTE} WHERE documento = ?`, [documento]);
  return filas[0] || null;
}

/* Hasta 100 pacientes. `busqueda` filtra por nombre, documento, celular
   o correo; los comodines de LIKE escritos por el usuario se escapan. */
async function listar(busqueda = '') {
  const patron = `%${busqueda.replace(/[\\%_]/g, '\\$&')}%`;
  const [filas] = await pool.execute(
    `${SELECT_PACIENTE}
      WHERE ? = '' OR nombre_completo LIKE ? OR documento LIKE ? OR telefono LIKE ? OR correo LIKE ?
      ORDER BY nombre_completo
      LIMIT 100`,
    [busqueda, patron, patron, patron, patron]
  );
  return filas;
}

module.exports = { crear, buscarPorId, buscarPorDocumento, listar };
