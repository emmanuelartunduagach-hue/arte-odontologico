/* Acceso a `pacientes`: el registro de cada paciente, con su historia
   clínica. No tienen usuario ni contraseña. Todas las consultas usan
   parámetros (?) para evitar inyección SQL. */
const { pool } = require('../config/db');

const VERSION_POLITICA_DATOS = '1.0';

const SELECT_PACIENTE = `
  SELECT id, nombres, apellidos, nombre_completo AS nombreCompleto,
         tipo_documento AS tipoDocumento, documento, telefono, telefono_fijo AS telefonoFijo,
         correo, origen, motivo_consulta AS motivoConsulta,
         DATE_FORMAT(fecha_autorizacion, '%Y-%m-%d %H:%i:%s') AS fechaAutorizacion,
         DATE_FORMAT(creado_en, '%Y-%m-%d %H:%i:%s') AS creadoEn
    FROM pacientes`;

/* Crea un paciente.
   - origen 'consultorio': la secretaria lo registra en persona y
     confirma que autorizó el tratamiento de sus datos (ahora). Puede
     anotar a qué vino (`motivoConsulta`).
   - origen 'web': se crea al aceptar su primera cita; la autorización
     es la que dio al pedirla (`fechaAutorizacion` de la cita).
   El nombre completo lo calcula la base (nombres + apellidos). */
async function crear({
  nombres, apellidos, tipoDocumento, documento, telefono, telefonoFijo = null, correo,
  origen, motivoConsulta = null, fechaAutorizacion, creadoPor,
}) {
  const [r] = await pool.execute(
    `INSERT INTO pacientes
       (nombres, apellidos, tipo_documento, documento, telefono, telefono_fijo, correo, origen, motivo_consulta,
        autorizacion_datos, fecha_autorizacion, version_politica_datos, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, COALESCE(?, UTC_TIMESTAMP()), ?, ?)`,
    [nombres, apellidos, tipoDocumento, documento, telefono, telefonoFijo || null, correo, origen, motivoConsulta || null,
      fechaAutorizacion || null, VERSION_POLITICA_DATOS, creadoPor]
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
