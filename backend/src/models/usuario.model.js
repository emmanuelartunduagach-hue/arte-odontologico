/* Acceso a la tabla `usuarios`. Todas las consultas usan parámetros
   (?) para evitar inyección SQL. */
const { pool } = require('../config/db');

const VERSION_POLITICA_DATOS = '1.0';

/* Crea una paciente. El rol NO se recibe como parámetro: se fija aquí,
   de modo que ningún dato enviado desde el cliente puede cambiarlo. */
async function crearPaciente({ nombreCompleto, documento, correo, telefono, contrasenaHash }) {
  const [resultado] = await pool.execute(
    `INSERT INTO usuarios
       (nombre_completo, documento, correo, telefono, contrasena_hash, rol,
        autorizacion_datos, fecha_autorizacion, version_politica_datos)
     VALUES (?, ?, ?, ?, ?, 'paciente', TRUE, UTC_TIMESTAMP(), ?)`,
    [nombreCompleto, documento, correo, telefono, contrasenaHash, VERSION_POLITICA_DATOS]
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
    `SELECT id, nombre_completo, correo, contrasena_hash, rol, activo
       FROM usuarios WHERE correo = ? LIMIT 1`,
    [correo]
  );
  return filas[0] || null;
}

module.exports = { crearPaciente, crearAdministrador, buscarPorCorreo };
