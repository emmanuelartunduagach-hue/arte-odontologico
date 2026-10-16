const { pool } = require('../config/db');

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

async function actualizarContrasena(id, contrasenaHash) {
  await pool.execute(
    `UPDATE usuarios SET contrasena_hash = ?, debe_cambiar_contrasena = FALSE WHERE id = ?`,
    [contrasenaHash, id]
  );
}

async function buscarAdministradorPorCorreo(correo) {
  const [filas] = await pool.execute(
    `SELECT id, nombre_completo FROM usuarios WHERE correo = ? AND rol = 'administrador' LIMIT 1`,
    [correo]
  );
  return filas[0] || null;
}

async function perfil(id) {
  const [filas] = await pool.execute(
    `SELECT id, nombre_completo AS nombreCompleto, documento, correo, telefono, rol
       FROM usuarios WHERE id = ? AND activo = TRUE`,
    [id]
  );
  return filas[0] || null;
}

const CAMPOS_ADMIN = `id, nombre_completo AS nombreCompleto, documento, correo, telefono,
  activo, debe_cambiar_contrasena AS debeCambiarContrasena,
  DATE_FORMAT(creado_en, '%Y-%m-%d %H:%i:%s') AS creadoEn`;

async function listarAdministradores() {
  const [filas] = await pool.execute(
    `SELECT ${CAMPOS_ADMIN} FROM usuarios WHERE rol = 'administrador' ORDER BY activo DESC, nombre_completo`
  );
  return filas.map((f) => ({ ...f, activo: Boolean(f.activo), debeCambiarContrasena: Boolean(f.debeCambiarContrasena) }));
}

async function buscarAdministrador(id) {
  const [filas] = await pool.execute(
    `SELECT ${CAMPOS_ADMIN} FROM usuarios WHERE id = ? AND rol = 'administrador' LIMIT 1`,
    [id]
  );
  const f = filas[0];
  return f ? { ...f, activo: Boolean(f.activo), debeCambiarContrasena: Boolean(f.debeCambiarContrasena) } : null;
}

async function crearAdministradorTemporal({ nombreCompleto, documento, correo, telefono, contrasenaHash, creadoPor }) {
  const [r] = await pool.execute(
    `INSERT INTO usuarios
       (nombre_completo, documento, correo, telefono, contrasena_hash, rol,
        debe_cambiar_contrasena, creado_por)
     VALUES (?, ?, ?, ?, ?, 'administrador', TRUE, ?)`,
    [nombreCompleto, documento, correo, telefono, contrasenaHash, creadoPor]
  );
  return r.insertId;
}

async function actualizarAdministrador(id, cambios) {
  const columnas = { nombreCompleto: 'nombre_completo', documento: 'documento', correo: 'correo', telefono: 'telefono', activo: 'activo' };
  const pares = Object.entries(cambios).filter(([k]) => columnas[k]);
  if (!pares.length) return;
  await pool.execute(
    `UPDATE usuarios SET ${pares.map(([k]) => `${columnas[k]} = ?`).join(', ')}
      WHERE id = ? AND rol = 'administrador'`,
    [...pares.map(([, v]) => v), id]
  );
}

async function restablecerTemporal(id, contrasenaHash) {
  await pool.execute(
    `UPDATE usuarios SET contrasena_hash = ?, debe_cambiar_contrasena = TRUE
      WHERE id = ? AND rol = 'administrador'`,
    [contrasenaHash, id]
  );
}

async function eliminarAdministrador(id) {
  const [r] = await pool.execute(`DELETE FROM usuarios WHERE id = ? AND rol = 'administrador'`, [id]);
  return r.affectedRows > 0;
}

async function crearSuperadmin({ nombreCompleto, documento, correo, telefono, contrasenaHash }) {
  const [r] = await pool.execute(
    `INSERT INTO usuarios
       (nombre_completo, documento, correo, telefono, contrasena_hash, rol)
     VALUES (?, ?, ?, ?, ?, 'superadmin')`,
    [nombreCompleto, documento, correo, telefono, contrasenaHash]
  );
  return r.insertId;
}

async function actualizarSuperadmin(id, { nombreCompleto, telefono, contrasenaHash }) {
  await pool.execute(
    `UPDATE usuarios
        SET nombre_completo = COALESCE(?, nombre_completo),
            telefono = COALESCE(?, telefono),
            contrasena_hash = COALESCE(?, contrasena_hash),
            activo = TRUE, debe_cambiar_contrasena = FALSE
      WHERE id = ? AND rol = 'superadmin'`,
    [nombreCompleto || null, telefono || null, contrasenaHash || null, id]
  );
}

async function buscarCompletoPorCorreo(correo) {
  const [filas] = await pool.execute(
    `SELECT id, nombre_completo AS nombreCompleto, telefono, rol, activo FROM usuarios WHERE correo = ? LIMIT 1`,
    [correo]
  );
  return filas[0] || null;
}

module.exports = {
  perfil,
  listarAdministradores,
  buscarAdministrador,
  crearAdministradorTemporal,
  actualizarAdministrador,
  restablecerTemporal,
  eliminarAdministrador,
  crearSuperadmin,
  actualizarSuperadmin,
  buscarCompletoPorCorreo,
  crearAdministrador,
  buscarPorCorreo,
  buscarPorId,
  actualizarContrasena,
  buscarAdministradorPorCorreo,
};
