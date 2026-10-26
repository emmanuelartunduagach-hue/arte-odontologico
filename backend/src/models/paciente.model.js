const { pool } = require('../config/db');

const VERSION_POLITICA_DATOS = '1.1';  // Debe coincidir con frontend/politica-datos.html.

const SELECT_PACIENTE = `
  SELECT id, nombres, apellidos, nombre_completo AS nombreCompleto,
         tipo_documento AS tipoDocumento, documento, telefono, telefono_fijo AS telefonoFijo,
         correo, origen, motivo_consulta AS motivoConsulta,
         DATE_FORMAT(fecha_autorizacion, '%Y-%m-%d %H:%i:%s') AS fechaAutorizacion,
         DATE_FORMAT(creado_en, '%Y-%m-%d %H:%i:%s') AS creadoEn
    FROM pacientes`;

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

const FILTRO_BUSQUEDA = `(? = '' OR nombre_completo LIKE ? OR documento LIKE ? OR telefono LIKE ? OR correo LIKE ?)`;

function patronDe(busqueda) {
  return `%${busqueda.replace(/[\\%_]/g, '\\$&')}%`;
}

async function listar(busqueda = '') {
  const patron = patronDe(busqueda);
  const [filas] = await pool.execute(
    `${SELECT_PACIENTE}
      WHERE ${FILTRO_BUSQUEDA}
      ORDER BY nombre_completo
      LIMIT 100`,
    [busqueda, patron, patron, patron, patron]
  );
  return filas;
}

async function contar(busqueda = '') {
  const patron = patronDe(busqueda);
  const [[fila]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM pacientes WHERE ${FILTRO_BUSQUEDA}`,
    [busqueda, patron, patron, patron, patron]
  );
  return fila.total;
}

// desde y limite son enteros ya validados (utils/paginacion.js): LIMIT no admite parámetros con execute.
async function listarPagina(busqueda, desde, limite) {
  const patron = patronDe(busqueda);
  const [filas] = await pool.execute(
    `${SELECT_PACIENTE}
      WHERE ${FILTRO_BUSQUEDA}
      ORDER BY nombre_completo, id
      LIMIT ${Number(limite)} OFFSET ${Number(desde)}`,
    [busqueda, patron, patron, patron, patron]
  );
  return filas;
}

module.exports = { crear, buscarPorId, buscarPorDocumento, listar, contar, listarPagina };
