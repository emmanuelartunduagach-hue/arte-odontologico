const REGEX_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function limpiar(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function normalizarNombre(valor) {
  return limpiar(valor).replace(/\s+/g, ' ');
}

function normalizarDocumento(valor) {
  return limpiar(valor).replace(/[.\s-]/g, '');
}

// WhatsApp exige el número con indicativo: se agrega 57 a los celulares de Colombia.
function normalizarTelefono(valor) {
  const digitos = limpiar(valor).replace(/[\s\-()+]/g, '');
  if (/^3\d{9}$/.test(digitos)) return `57${digitos}`;
  return digitos;
}

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

function validarContrasena(contrasena) {
  if (typeof contrasena !== 'string' || contrasena.length < 8 || contrasena.length > 72) {
    return 'La contraseña debe tener entre 8 y 72 caracteres.';
  }
  if (!/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
    return 'La contraseña debe incluir al menos una letra y un número.';
  }
  return '';
}

function agregar(errores, campo, mensaje) {
  if (mensaje) errores[campo] = mensaje;
}

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

const TIPOS_DOCUMENTO = {
  CC: 'Cédula de ciudadanía',
  TI: 'Tarjeta de identidad',
  RC: 'Registro civil',
  CE: 'Cédula de extranjería',
  PA: 'Pasaporte',
  PPT: 'Permiso por protección temporal',
};

function errorParteNombre(valor, que) {
  if (valor.length < 2 || valor.length > 60) return `Escribe ${que} (entre 2 y 60 caracteres).`;
  if (/\d/.test(valor)) return `${que.charAt(0).toUpperCase()}${que.slice(1)} no pueden llevar números.`;
  return '';
}

function errorDocumentoSegunTipo(documento, tipo) {
  if (tipo === 'PA') {
    return /^[A-Z0-9]{5,20}$/.test(documento)
      ? ''
      : 'El pasaporte debe tener entre 5 y 20 letras o números.';
  }
  return errorDocumento(documento);
}

function errorTelefonoFijo(telefono) {
  return /^\d{7,15}$/.test(telefono)
    ? ''
    : 'Escribe un teléfono válido, por ejemplo 608 837 0000, o déjalo vacío.';
}

function validarDatosPersona(datos = {}) {
  const errores = {};
  const nombres = normalizarNombre(datos.nombres);
  const apellidos = normalizarNombre(datos.apellidos);
  const tipoDocumento = limpiar(datos.tipoDocumento).toUpperCase();
  const documento = normalizarDocumento(datos.documento).toUpperCase();
  const telefono = normalizarTelefono(datos.telefono);
  const telefonoFijo = limpiar(datos.telefonoFijo).replace(/[\s\-()+]/g, '');
  const correo = limpiar(datos.correo).toLowerCase();

  agregar(errores, 'nombres', errorParteNombre(nombres, 'los nombres'));
  agregar(errores, 'apellidos', errorParteNombre(apellidos, 'los apellidos'));
  if (!TIPOS_DOCUMENTO[tipoDocumento]) agregar(errores, 'tipoDocumento', 'Elige el tipo de documento.');
  agregar(errores, 'documento', errorDocumentoSegunTipo(documento, tipoDocumento));
  agregar(errores, 'telefono', errorTelefono(telefono));
  if (telefonoFijo) agregar(errores, 'telefonoFijo', errorTelefonoFijo(telefonoFijo));
  agregar(errores, 'correo', correo ? errorCorreo(correo) : 'Escribe tu correo electrónico.');

  return {
    valores: {
      nombres, apellidos, nombreCompleto: `${nombres} ${apellidos}`.trim(),
      tipoDocumento, documento, telefono, telefonoFijo: telefonoFijo || null, correo,
    },
    errores,
  };
}

function esFecha(valor) {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function esHora(valor) {
  return typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

function esMes(valor) {
  return typeof valor === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

function aId(valor) {
  const numero = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor;
  return Number.isInteger(numero) && numero > 0 && numero < 2 ** 32 ? numero : null;
}

module.exports = {
  TIPOS_DOCUMENTO,
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
