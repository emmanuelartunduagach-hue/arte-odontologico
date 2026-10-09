/* Arranca la API y la pagina local con un solo comando: npm run local. */
require('dotenv').config();
const path = require('node:path');
const express = require('express');
const app = require('../app');
const { pool, probarConexion } = require('../config/db');
const { iniciarProgramacion } = require('../services/recordatorios');

const frontend = express();
frontend.use(express.static(path.resolve(__dirname, '../../../frontend')));
const puertoFrontend = Number(process.env.FRONTEND_PORT) || 5500;
const servidores = [];
let recordatorios;

function escuchar(aplicacion, puerto) {
  return new Promise((resolve, reject) => {
    const servidor = aplicacion.listen(puerto, 'localhost', () => resolve(servidor));
    servidor.once('error', reject);
  });
}

async function cerrar() {
  clearInterval(recordatorios);
  for (const servidor of servidores) servidor.close();
  await pool.end();
}

(async () => {
  try {
    await probarConexion();
    servidores.push(await escuchar(app, Number(process.env.PORT) || 3000));
    servidores.push(await escuchar(frontend, puertoFrontend));
    recordatorios = iniciarProgramacion();
    console.log(`Proyecto listo. Abre http://localhost:${puertoFrontend}`);
    console.log('Deja esta ventana abierta mientras usas el proyecto.');
  } catch (error) {
    console.error(error.code === 'EADDRINUSE'
      ? 'El puerto ya esta ocupado. Cierra el backend o Live Server anterior y vuelve a intentar.'
      : `No fue posible iniciar el proyecto: ${error.message || error.code}`);
    await cerrar();
    process.exitCode = 1;
  }
})();

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.once(senal, () => cerrar().finally(() => process.exit()));
}
