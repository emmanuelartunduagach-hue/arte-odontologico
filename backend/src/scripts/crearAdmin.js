/* Crea el primer administrador desde la consola:

     cd backend
     npm run crear-admin

   La contraseña se cifra con bcrypt. No existe ninguna ruta HTTP para
   crear administradores: solo se pueden crear con este script. */
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const usuarioModelo = require('../models/usuario.model');
const { validarUsuario } = require('../utils/validaciones');

const lector = readline.createInterface({ input: process.stdin, output: process.stdout });

function preguntar(texto) {
  return new Promise((resolver) => lector.question(texto, resolver));
}

/* Pregunta sin mostrar lo que se escribe (para la contraseña). */
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

(async () => {
  try {
    console.log('Creación del administrador de Arte Odontológico\n');

    const datos = {
      nombreCompleto: await preguntar('Nombre completo: '),
      documento: await preguntar('Documento: '),
      correo: await preguntar('Correo: '),
      telefono: await preguntar('Teléfono: '),
      contrasena: await preguntarOculto('Contraseña (mínimo 8, con letra y número): '),
    };

    const { valores, errores } = validarUsuario(datos);
    if (Object.keys(errores).length > 0) {
      console.error('\nDatos inválidos:');
      Object.values(errores).forEach((mensaje) => console.error(` - ${mensaje}`));
      process.exitCode = 1;
      return;
    }

    if (await usuarioModelo.buscarPorCorreo(valores.correo)) {
      console.error('\nYa existe un usuario con ese correo. No se creó nada.');
      process.exitCode = 1;
      return;
    }

    const contrasenaHash = await bcrypt.hash(valores.contrasena, 10);
    const id = await usuarioModelo.crearAdministrador({ ...valores, contrasenaHash });
    console.log(`\nAdministrador creado (id ${id}). Ya puede ingresar con ${valores.correo}.`);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('\nYa existe un usuario con ese documento o correo. No se creó nada.');
    } else {
      console.error('\nNo fue posible crear el administrador:', error.message);
    }
    process.exitCode = 1;
  } finally {
    lector.close();
    await pool.end();
  }
})();
