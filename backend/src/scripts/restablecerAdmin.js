/* Restablece la contraseña del administrador (la secretaria) desde la
   consola, por si la olvida:

     cd backend
     npm run restablecer-admin

   Solo funciona con acceso al servidor y a la base de datos; no existe
   ninguna ruta HTTP para esto. */
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcrypt');
const { pool } = require('../config/db');
const usuarioModelo = require('../models/usuario.model');
const { validarContrasena } = require('../utils/validaciones');

const lector = readline.createInterface({ input: process.stdin, output: process.stdout });
const preguntar = (texto) => new Promise((resolver) => lector.question(texto, resolver));

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
    console.log('Restablecer la contraseña del administrador\n');
    const correo = (await preguntar('Correo del administrador: ')).trim().toLowerCase();
    const admin = await usuarioModelo.buscarAdministradorPorCorreo(correo);
    if (!admin) {
      console.error('\nNo hay un administrador con ese correo. No se cambió nada.');
      process.exitCode = 1;
      return;
    }

    const nueva = await preguntarOculto('Contraseña nueva (mínimo 8, con letra y número): ');
    const repetida = await preguntarOculto('Repítela: ');
    const error = validarContrasena(nueva) || (nueva !== repetida ? 'Las contraseñas no coinciden.' : '');
    if (error) {
      console.error(`\n${error} No se cambió nada.`);
      process.exitCode = 1;
      return;
    }

    await usuarioModelo.actualizarContrasena(admin.id, await bcrypt.hash(nueva, 10));
    console.log(`\nContraseña actualizada para ${admin.nombre_completo}.`);
  } catch (error) {
    console.error('\nNo fue posible restablecer la contraseña:', error.message);
    process.exitCode = 1;
  } finally {
    lector.close();
    await pool.end();
  }
})();
