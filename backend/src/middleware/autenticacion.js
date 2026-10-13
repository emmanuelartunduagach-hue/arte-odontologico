/* Verificación del token y control de rol.

   Corrige el fallo del boceto: allí el rol se enviaba desde el
   formulario de ingreso, así que cualquiera podía declararse
   administrador. Aquí el rol se lee del token firmado por el
   servidor y no puede alterarse desde el cliente.

   Además, en cada petición se confirma en la base que el usuario
   sigue activo y con el mismo rol: si el dueño elimina o desactiva a
   un administrador, su sesión deja de servir de inmediato, sin
   esperar a que venza el token. */
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

async function requiereSesion(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Debes iniciar sesión' });
  }

  let carga;
  try {
    carga = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }

  try {
    const [filas] = await pool.execute(
      'SELECT rol, activo FROM usuarios WHERE id = ? LIMIT 1',
      [carga.id]
    );
    const actual = filas[0];
    if (!actual || !actual.activo || actual.rol !== carga.rol) {
      return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
    req.usuario = carga;
    next();
  } catch (error) {
    next(error);
  }
}

/* El dueño (superadmin) tiene permiso total: pasa cualquier control de
   rol. Las rutas que son solo suyas usan requiereRol('superadmin'). */
function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    const rol = req.usuario?.rol;
    if (!rol || (rol !== 'superadmin' && !rolesPermitidos.includes(rol))) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };
}

const esSuperadmin = (req) => req.usuario?.rol === 'superadmin';

module.exports = { requiereSesion, requiereRol, esSuperadmin };
