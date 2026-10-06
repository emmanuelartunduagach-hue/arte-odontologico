/* Validación de los datos de una persona usuaria.
   Se usa tanto en el registro de pacientes como en el script que
   crea el primer administrador, para que ambos apliquen las mismas
   reglas. Devuelve los valores ya normalizados y un objeto con un
   mensaje por cada campo inválido (vacío si todo está bien). */

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function limpiar(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function validarUsuario(datos = {}) {
  const errores = {};

  const nombreCompleto = limpiar(datos.nombreCompleto).replace(/\s+/g, ' ');
  if (nombreCompleto.length < 3 || nombreCompleto.length > 120) {
    errores.nombreCompleto = 'Escribe tu nombre completo (entre 3 y 120 caracteres).';
  }

  const documento = limpiar(datos.documento).replace(/[.\s]/g, '');
  if (!/^\d{5,20}$/.test(documento)) {
    errores.documento = 'El documento debe tener solo números (entre 5 y 20 dígitos).';
  }

  const correo = limpiar(datos.correo).toLowerCase();
  if (correo.length > 160 || !REGEX_CORREO.test(correo)) {
    errores.correo = 'Escribe un correo electrónico válido.';
  }

  // Acepta espacios, guiones y un + inicial; se guardan solo los dígitos.
  const telefono = limpiar(datos.telefono).replace(/[\s-]/g, '');
  if (!/^\+?\d{7,15}$/.test(telefono)) {
    errores.telefono = 'Escribe un teléfono válido (entre 7 y 15 dígitos).';
  }

  const contrasena = typeof datos.contrasena === 'string' ? datos.contrasena : '';
  if (contrasena.length < 8 || contrasena.length > 72) {
    errores.contrasena = 'La contraseña debe tener entre 8 y 72 caracteres.';
  } else if (!/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
    errores.contrasena = 'La contraseña debe incluir al menos una letra y un número.';
  }

  return {
    valores: { nombreCompleto, documento, correo, telefono, contrasena },
    errores,
  };
}

module.exports = { validarUsuario };
