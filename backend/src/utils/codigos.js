// En la base solo se guarda el hash SHA-256 del código del enlace.
const { randomBytes, createHash } = require('crypto');

function hashCodigo(codigo) {
  return createHash('sha256').update(String(codigo)).digest('hex');
}

function generarCodigoGestion() {
  const codigo = randomBytes(32).toString('base64url');
  return { codigo, hash: hashCodigo(codigo) };
}

function pareceCodigo(valor) {
  return typeof valor === 'string' && /^[A-Za-z0-9_-]{43}$/.test(valor);
}

module.exports = { generarCodigoGestion, hashCodigo, pareceCodigo };
