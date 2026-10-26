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
    carga = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
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

// El dueño pasa cualquier control de rol.
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
