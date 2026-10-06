/* Acceso a la tabla `usuarios`. Todas las consultas usan parámetros
   (?) para evitar inyección SQL. */
const { pool } = require('../config/db');

const VERSION_POLITICA_DATOS = '1.0';

/* Crea un paciente. Lo llama solo el administrador (POST /api/pacientes).
   - El rol NO se recibe como parámetro: se fija aquí, de modo que ningún
     dato enviado desde el cliente puede cambiarlo.
   - La contraseña es temporal: el paciente debe cambiarla al ingresar.
   - Se guarda quién creó la cuenta y quién registró la autorización de
     datos (Ley 1581 de 2012: se debe poder demostrar cuándo, bajo qué
     versión de la política y ante quién se otorgó). */
async function crearPaciente({ nombreCompleto, documento, correo, telefono, contrasenaHash, creadoPor }) {
  const [resultado] = await pool.execute(
    `INSERT INTO usuarios
       (nombre_completo, documento, correo, telefono, contrasena_hash, rol,
        debe_cambiar_contrasena, autorizacion_datos, fecha_autorizacion,
        version_politica_datos, creado_por, autorizacion_registrada_por)
     VALUES (?, ?, ?, ?, ?, 'paciente', TRUE, TRUE, UTC_TIMESTAMP(), ?, ?, ?)`,
    [nombreCompleto, documento, correo, telefono, contrasenaHash,
     VERSION_POLITICA_DATOS, creadoPor, creadoPor]
  );
  return resultado.insertId;
}

/* Crea un administrador. Solo lo usa el script `npm run crear-admin`;
   no existe ninguna ruta HTTP que llegue a esta función. */
async function crearAdministrador({ nombreCompleto, documento, correo, telefono, contrasenaHash }) {
  const [resultado] = await pool.execute(
    `INSERT INTO usuarios
       (nombre_completo, documento, correo, telefono, contrasena_hash, rol)
     VALUES (?, ?, ?, ?, ?, 'administrador')`,
    [nombreCompleto, documento, correo, telefono, contrasenaHash]
  );
  return resultado.insertId;
}

async function buscarPorCorreo(correo) {
  const [filas] = await pool.execute(
    `SELECT id, nombre_completo, correo, contrasena_hash, rol, activo,
            debe_cambiar_contrasena
       FROM usuarios WHERE correo = ? LIMIT 1`,
    [correo]
  );
  return filas[0] || null;
}

async function buscarPorId(id) {
  const [filas] = await pool.execute(
    `SELECT id, contrasena_hash, activo FROM usuarios WHERE id = ? LIMIT 1`,
    [id]
  );
  return filas[0] || null;
}

/* Guarda la contraseña nueva y apaga la obligación de cambiarla. */
async function actualizarContrasena(id, contrasenaHash) {
  await pool.execute(
    `UPDATE usuarios SET contrasena_hash = ?, debe_cambiar_contrasena = FALSE WHERE id = ?`,
    [contrasenaHash, id]
  );
}

/* Lista pacientes (máximo 100). `busqueda` filtra por nombre, documento
   o correo; los comodines de LIKE escritos por el usuario se escapan. */
async function listarPacientes(busqueda = '') {
  const patron = `%${busqueda.replace(/[\\%_]/g, '\\$&')}%`;
  const [filas] = await pool.execute(
    `SELECT id, nombre_completo AS nombreCompleto, documento, correo, telefono,
            activo, debe_cambiar_contrasena AS debeCambiarContrasena,
            creado_en AS creadoEn
       FROM usuarios
      WHERE rol = 'paciente'
        AND (? = '' OR nombre_completo LIKE ? OR documento LIKE ? OR correo LIKE ?)
      ORDER BY nombre_completo
      LIMIT 100`,
    [busqueda, patron, patron, patron]
  );
  return filas;
}

module.exports = {
  crearPaciente,
  crearAdministrador,
  buscarPorCorreo,
  buscarPorId,
  actualizarContrasena,
  listarPacientes,
};
