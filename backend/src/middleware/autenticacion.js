/* Verificación del token y control de rol.

   Corrige el fallo del boceto: allí el rol se enviaba desde el
   formulario de ingreso, así que cualquiera podía declararse
   administrador. Aquí el rol se lee del token firmado por el
   servidor y no puede alterarse desde el cliente. */
const jwt = require('jsonwebtoken');

function requiereSesion(req, res, next) {
  const cabecera = req.headers.authorization || '';
  const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Debes iniciar sesión' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function requiereRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes permiso para esta acción' });
    }
    next();
  };
}

module.exports = { requiereSesion, requiereRol };
