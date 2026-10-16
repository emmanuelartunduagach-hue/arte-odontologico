require('dotenv').config();
const { pool } = require('../config/db');
const { enviarRecordatorios } = require('../services/recordatorios');

(async () => {
  try {
    const r = await enviarRecordatorios({ ignorarHorario: true });
    console.log(`Citas del ${r.fecha} revisadas: ${r.revisadas}`);
    for (const x of r.resultados) console.log(` - cita ${x.citaId}: ${x.estado}`);
  } catch (error) {
    console.error('No fue posible enviar los recordatorios:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
