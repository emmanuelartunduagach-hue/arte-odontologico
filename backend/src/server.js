/* Punto de entrada. Verifica la base de datos antes de
   levantar el servidor: es preferible fallar de inmediato
   que aceptar peticiones sin persistencia. */
require('dotenv').config();
const app = require('./app');
const { probarConexion } = require('./config/db');
const { iniciarProgramacion } = require('./services/recordatorios');

const PUERTO = process.env.PORT || 3000;

(async () => {
  try {
    await probarConexion();
    console.log('Conexión a MySQL establecida.');
    app.listen(PUERTO, () => {
      console.log(`API escuchando en http://localhost:${PUERTO}/api`);
    });
    iniciarProgramacion(); // recordatorios del día anterior
  } catch (error) {
    console.error('No fue posible conectar con MySQL:', error.message);
    process.exit(1);
  }
})();
