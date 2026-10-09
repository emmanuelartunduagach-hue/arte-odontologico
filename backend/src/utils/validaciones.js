/* Validación de datos de personas, fechas y horas.
   Cada validador de campo devuelve '' si el valor es válido o el
   mensaje de error si no. Las funciones `validarX` agrupan campos y
   devuelven { valores (normalizados), errores (un mensaje por campo) }. */

const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function limpiar(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

/* ---------- Normalización ---------- */

function normalizarNombre(valor) {
  return limpiar(valor).replace(/\s+/g, ' ');
}

function normalizarDocumento(valor) {
  return limpiar(valor).replace(/[.\s-]/g, '');
}

/* Deja solo dígitos y agrega el indicativo de Colombia (57) a los
   celulares de 10 dígitos que empiezan por 3. WhatsApp exige el
   número completo con indicativo y sin el signo +. */
function normalizarTelefono(valor) {
  const digitos = limpiar(valor).replace(/[\s\-()+]/g, '');
  if (/^3\d{9}$/.test(digitos)) return `57${digitos}`;
  return digitos;
}

/* ---------- Validadores de campo ---------- */

function errorNombre(nombre) {
  return nombre.length < 3 || nombre.length > 120
    ? 'Escribe el nombre completo (entre 3 y 120 caracteres).'
    : '';
}

function errorDocumento(documento) {
  return /^\d{5,20}$/.test(documento)
    ? ''
    : 'El documento debe tener solo números (entre 5 y 20 dígitos).';
}

function errorTelefono(telefono) {
  return /^\d{7,15}$/.test(telefono)
    ? ''
    : 'Escribe un celular válido, por ejemplo 300 123 4567.';
}

function errorCorreo(correo) {
  return correo.length > 160 || !REGEX_CORREO.test(correo)
    ? 'Escribe un correo electrónico válido.'
    : '';
}

/* Devuelve el mensaje de error de una contraseña, o '' si es válida. */
function validarContrasena(contrasena) {
  if (typeof contrasena !== 'string' || contrasena.length < 8 || contrasena.length > 72) {
    return 'La contraseña debe tener entre 8 y 72 caracteres.';
  }
  if (!/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
    return 'La contraseña debe incluir al menos una letra y un número.';
  }
  return '';
}

/* ---------- Grupos de campos ---------- */

function agregar(errores, campo, mensaje) {
  if (mensaje) errores[campo] = mensaje;
}

/* Usuario completo. `exigirContrasena: false` se usa cuando la
   secretaria crea un paciente: la contraseña la genera el sistema. */
function validarUsuario(datos = {}, { exigirContrasena = true } = {}) {
  const errores = {};
  const nombreCompleto = normalizarNombre(datos.nombreCompleto);
  const documento = normalizarDocumento(datos.documento);
  const correo = limpiar(datos.correo).toLowerCase();
  const telefono = normalizarTelefono(datos.telefono);

  agregar(errores, 'nombreCompleto', errorNombre(nombreCompleto));
  agregar(errores, 'documento', errorDocumento(documento));
  agregar(errores, 'correo', errorCorreo(correo));
  agregar(errores, 'telefono', errorTelefono(telefono));

  let contrasena = '';
  if (exigirContrasena) {
    contrasena = typeof datos.contrasena === 'string' ? datos.contrasena : '';
    agregar(errores, 'contrasena', validarContrasena(contrasena));
  }

  return {
    valores: { nombreCompleto, documento, correo, telefono, contrasena },
    errores,
  };
}

/* Datos de una persona al pedir su cita o al registrarla en el
   consultorio: nombre, documento, celular y correo, todos obligatorios. */
function validarDatosPersona(datos = {}) {
  const errores = {};
  const nombreCompleto = normalizarNombre(datos.nombreCompleto);
  const documento = normalizarDocumento(datos.documento);
  const telefono = normalizarTelefono(datos.telefono);
  const correo = limpiar(datos.correo).toLowerCase();

  agregar(errores, 'nombreCompleto', errorNombre(nombreCompleto));
  agregar(errores, 'documento', errorDocumento(documento));
  agregar(errores, 'telefono', errorTelefono(telefono));
  agregar(errores, 'correo', correo ? errorCorreo(correo) : 'Escribe tu correo electrónico.');

  return { valores: { nombreCompleto, documento, telefono, correo }, errores };
}

/* ---------- Fechas, horas e identificadores ---------- */

/* 'YYYY-MM-DD' que además sea una fecha real (no 2026-02-31). */
function esFecha(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

/* 'HH:MM' entre 00:00 y 23:59. */
function esHora(valor) {
  return typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

/* 'YYYY-MM'. */
function esMes(valor) {
  return typeof valor === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

/* Entero positivo que venga como número o como texto ("12"). */
function aId(valor) {
  const numero = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor;
  return Number.isInteger(numero) && numero > 0 && numero < 2 ** 32 ? numero : null;
}

module.exports = {
  validarUsuario,
  validarDatosPersona,
  validarContrasena,
  normalizarTelefono,
  normalizarNombre,
  esFecha,
  esHora,
  esMes,
  aId,
};
