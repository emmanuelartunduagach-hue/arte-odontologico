require('dotenv').config();
const readline = require('readline');
const { timingSafeEqual, createHash } = require('crypto');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const usuarioModelo = require('../models/usuario.model');
const { validarUsuario, validarContrasena } = require('../utils/validaciones');

const lector = readline.createInterface({ input: process.stdin, output: process.stdout });

function preguntar(texto) {
  return new Promise((resolver) => lector.question(texto, resolver));
}

function preguntarOculto(texto) {
  return new Promise((resolver) => {
    const escribir = lector._writeToOutput;
    process.stdout.write(texto);
    lector._writeToOutput = () => {};
    lector.question('', (respuesta) => {
      lector._writeToOutput = escribir;
      process.stdout.write('\n');
      resolver(respuesta);
    });
  });
}

// Tiempo constante; se compara el hash para que las longitudes coincidan.
function claveCorrecta(escrita, esperada) {
  const a = createHash('sha256').update(String(escrita)).digest();
  const b = createHash('sha256').update(String(esperada)).digest();
  return timingSafeEqual(a, b);
}

function fallar(mensaje) {
  console.error(`\n${mensaje}`);
  process.exitCode = 1;
}

async function crear(correo) {
  console.log('\nNo hay ninguna cuenta con ese correo: se creará la cuenta del dueño.\n');
  const datos = {
    nombreCompleto: await preguntar('Nombre completo: '),
    documento: await preguntar('Documento: '),
    correo,
    telefono: await preguntar('Celular: '),
    contrasena: await preguntarOculto('Contraseña del dueño (mínimo 8, con letra y número): '),
  };
  const { valores, errores } = validarUsuario(datos);
  if (Object.keys(errores).length) {
    return fallar(`Datos inválidos:\n${Object.values(errores).map((m) => ` - ${m}`).join('\n')}`);
  }
  const contrasenaHash = await bcrypt.hash(valores.contrasena, 10);
  const id = await usuarioModelo.crearSuperadmin({ ...valores, contrasenaHash });
  console.log(`\nCuenta del dueño creada (id ${id}). Ya puede ingresar con ${valores.correo} por el candado de la página.`);
}

async function editar(dueno) {
  console.log(`\nCuenta del dueño: ${dueno.nombreCompleto}. Deja en blanco lo que no quieras cambiar.\n`);
  const nombreCompleto = (await preguntar(`Nombre completo [${dueno.nombreCompleto}]: `)).trim();
  const telefono = (await preguntar(`Celular [${dueno.telefono}]: `)).trim();
  const contrasena = await preguntarOculto('Contraseña nueva (en blanco = no cambia): ');

  const cambios = {};
  if (nombreCompleto || telefono) {
    const { valores, errores } = validarUsuario({
      nombreCompleto: nombreCompleto || dueno.nombreCompleto,
      documento: '00000',
      correo: 'sin-uso@ejemplo.co',
      telefono: telefono || dueno.telefono,
    }, { exigirContrasena: false });
    const utiles = ['nombreCompleto', 'telefono'].filter((c) => errores[c]);
    if (utiles.length) return fallar(`Datos inválidos:\n${utiles.map((c) => ` - ${errores[c]}`).join('\n')}`);
    if (nombreCompleto) cambios.nombreCompleto = valores.nombreCompleto;
    if (telefono) cambios.telefono = valores.telefono;
  }
  if (contrasena) {
    const error = validarContrasena(contrasena);
    if (error) return fallar(error);
    cambios.contrasenaHash = await bcrypt.hash(contrasena, 10);
  }
  if (!Object.keys(cambios).length && dueno.activo) {
    console.log('\nNo se cambió nada.');
    return;
  }
  await usuarioModelo.actualizarSuperadmin(dueno.id, cambios);
  console.log('\nCuenta del dueño actualizada.');
}

(async () => {
  try {
    const esperada = process.env.SUPERADMIN_CLAVE || '';
    if (esperada.length < 16) {
      return fallar('Falta SUPERADMIN_CLAVE (mínimo 16 caracteres) en las variables del servidor. No se hizo nada.');
    }

    console.log('Cuenta del dueño de Arte Odontológico (solo equipo técnico)\n');
    const clave = await preguntarOculto('Clave especial: ');
    if (!claveCorrecta(clave, esperada)) {
      return fallar('Clave especial incorrecta. No se hizo nada.');
    }

    const correo = (await preguntar('Correo del dueño: ')).trim().toLowerCase();
    if (!correo) return fallar('Escribe el correo del dueño.');

    const existente = await usuarioModelo.buscarCompletoPorCorreo(correo);
    if (!existente) return await crear(correo);
    if (existente.rol !== 'superadmin') {
      return fallar('Ese correo ya es de un administrador. Usa otro correo para el dueño.');
    }
    await editar(existente);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') fallar('Ya existe un usuario con ese documento. No se creó nada.');
    else fallar(`No fue posible completar la operación: ${error.message}`);
  } finally {
    lector.close();
    await pool.end();
  }
})();
