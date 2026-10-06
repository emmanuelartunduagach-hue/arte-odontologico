/* Código del enlace "Gestionar mi cita".
   Es aleatorio (32 bytes, imposible de adivinar). En `citas` solo se
   guarda su hash SHA-256. El texto de un mensaje PENDIENTE en
   `notificaciones` sí lleva el enlace completo (la secretaria lo
   necesita para enviarlo); al marcarse enviado, el código se borra
   de ese texto. */
const { randomBytes, createHash } = require('crypto');

function hashCodigo(codigo) {
  return createHash('sha256').update(String(codigo)).digest('hex');
}

function generarCodigoGestion() {
  const codigo = randomBytes(32).toString('base64url');
  return { codigo, hash: hashCodigo(codigo) };
}

/* Un código válido tiene 43 caracteres base64url. */
function pareceCodigo(valor) {
  return typeof valor === 'string' && /^[A-Za-z0-9_-]{43}$/.test(valor);
}

module.exports = { generarCodigoGestion, hashCodigo, pareceCodigo };
