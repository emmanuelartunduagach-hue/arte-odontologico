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
    iniciarProgramacion();
  } catch (error) {
    // Algunos errores de red llegan sin mensaje: se muestran el código y el destino.
    const detalle = [error.code, error.message, error.errors?.map((e) => e.message).join(' | ')]
      .filter(Boolean).join(' — ');
    console.error('No fue posible conectar con MySQL:', detalle || String(error));
    console.error(`Destino: ${process.env.DB_HOST || '(DB_HOST vacío)'}:${process.env.DB_PORT || '(DB_PORT vacío)'}, base ${process.env.DB_NAME || '(DB_NAME vacío)'}`);
    process.exit(1);
  }
})();
