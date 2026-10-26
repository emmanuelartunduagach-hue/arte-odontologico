require('dotenv').config();
const app = require('./app');
const { pool, probarConexion } = require('./config/db');
const { iniciarProgramacion } = require('./services/recordatorios');

const PUERTO = process.env.PORT || 3000;

// Sin una clave de firma el servidor arrancaría, pero nadie podría iniciar sesión.
if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET: defínela en el archivo .env o en las variables del servicio.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('Aviso: JWT_SECRET tiene menos de 32 caracteres; genera una más larga (ver .env.example).');
}

(async () => {
  try {
    await probarConexion();
    console.log('Conexión a MySQL establecida.');
    const servidor = app.listen(PUERTO, () => {
      console.log(`API escuchando en http://localhost:${PUERTO}/api`);
    });
    iniciarProgramacion();

    // Railway envía SIGTERM al publicar una versión nueva: se terminan las peticiones en curso.
    const cerrar = () => {
      servidor.close(() => pool.end().finally(() => process.exit(0)));
      setTimeout(() => process.exit(1), 10000).unref();
    };
    process.on('SIGTERM', cerrar);
    process.on('SIGINT', cerrar);
  } catch (error) {
    // Algunos errores de red llegan sin mensaje: se muestran el código y el destino.
    const detalle = [error.code, error.message, error.errors?.map((e) => e.message).join(' | ')]
      .filter(Boolean).join(' — ');
    console.error('No fue posible conectar con MySQL:', detalle || String(error));
    console.error(`Destino: ${process.env.DB_HOST || '(DB_HOST vacío)'}:${process.env.DB_PORT || '(DB_PORT vacío)'}, base ${process.env.DB_NAME || '(DB_NAME vacío)'}`);
    process.exit(1);
  }
})();
