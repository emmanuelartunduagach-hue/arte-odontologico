/* Pool de conexiones MySQL. Un pool reutiliza conexiones en
   lugar de abrir una por consulta. */
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
});

/* Cada conexión trabaja con la hora de Colombia (UTC-5, sin horario de
   verano). Así NOW() y los DEFAULT CURRENT_TIMESTAMP (creado_en,
   actualizado_en, confirmada_en) guardan la hora de Rivera aunque el
   servidor donde se publique esté en UTC. Se usa el desfase y no
   'America/Bogota' porque MySQL en Windows no trae cargadas las zonas. */
pool.on('connection', (conexion) => {
  conexion.query("SET time_zone = '-05:00'");
});

async function probarConexion() {
  const conexion = await pool.getConnection();
  await conexion.ping();
  conexion.release();
}

module.exports = { pool, probarConexion };
