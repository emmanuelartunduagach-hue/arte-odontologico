/* Acceso a la tabla `usuarios`: quienes inician sesión (la secretaria).
   Los pacientes no tienen usuario: ver paciente.model.js. Todas las
   consultas usan parámetros (?) para evitar inyección SQL. */
const { pool } = require('../config/db');

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

/* Administrador por correo (para el script de restablecer su clave). */
async function buscarAdministradorPorCorreo(correo) {
  const [filas] = await pool.execute(
    `SELECT id, nombre_completo FROM usuarios WHERE correo = ? AND rol = 'administrador' LIMIT 1`,
    [correo]
  );
  return filas[0] || null;
}

/* Datos propios de quien tiene la sesión. */
async function perfil(id) {
  const [filas] = await pool.execute(
    `SELECT id, nombre_completo AS nombreCompleto, documento, correo, telefono, rol
       FROM usuarios WHERE id = ? AND activo = TRUE`,
    [id]
  );
  return filas[0] || null;
}

module.exports = {
  perfil,
  crearAdministrador,
  buscarPorCorreo,
  buscarPorId,
  actualizarContrasena,
  buscarAdministradorPorCorreo,
};
