/* Datos de demostración para probar el sistema desde el navegador:
   3 especialistas y horarios para los próximos 14 días (lunes a sábado).

     cd backend
     npm run datos-demo

   Solo para desarrollo: no se ejecuta si NODE_ENV=production.
   Requiere que exista el administrador (npm run crear-admin).
   Se puede ejecutar varias veces: no duplica especialistas ni horas. */
require('dotenv').config();
const { pool } = require('../config/db');
const { hoyBogota, sumarDias } = require('../utils/tiempo');

const ESPECIALISTAS = [
  { nombre: 'Dra. Prueba Uno (demo)', codigos: ['general', 'sonrisa', 'odontopediatria'] },
  { nombre: 'Dr. Prueba Dos (demo)', codigos: ['ortodoncia', 'rehabilitacion', 'general'] },
  { nombre: 'Dra. Prueba Tres (demo)', codigos: ['endodoncia', 'periodoncia', 'cirugia', 'maxilofacial'] },
];
const HORAS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '14:00', '14:30', '15:00', '15:30', '16:00'];

(async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.error('Este script es solo para desarrollo. No se cargó nada.');
      process.exitCode = 1;
      return;
    }

    const [[admin]] = await pool.query(`SELECT id FROM usuarios WHERE rol = 'administrador' ORDER BY id LIMIT 1`);
    if (!admin) {
      console.error('Primero crea el administrador con: npm run crear-admin');
      process.exitCode = 1;
      return;
    }
    const [[sede]] = await pool.query(`SELECT id FROM sedes WHERE activa = TRUE ORDER BY id LIMIT 1`);

    // Fechas: próximos 14 días, sin domingos. El sábado solo en la mañana.
    const fechas = [];
    for (let i = 1; i <= 14; i++) {
      const fecha = sumarDias(hoyBogota(), i);
      const dia = new Date(`${fecha}T00:00:00Z`).getUTCDay();
      if (dia !== 0) fechas.push({ fecha, sabado: dia === 6 });
    }

    let horas = 0;
    for (const e of ESPECIALISTAS) {
      let [[fila]] = await pool.query(`SELECT id FROM especialistas WHERE nombre = ?`, [e.nombre]);
      if (!fila) {
        const [r] = await pool.query(`INSERT INTO especialistas (nombre) VALUES (?)`, [e.nombre]);
        fila = { id: r.insertId };
      }
      await pool.query(
        `INSERT IGNORE INTO especialista_especialidad (especialista_id, servicio_id)
         SELECT ?, id FROM servicios WHERE codigo IN (?)`,
        [fila.id, e.codigos]
      );
      const filas = [];
      for (const { fecha, sabado } of fechas) {
        for (const h of HORAS) {
          if (sabado && h >= '12:00') continue;
          filas.push([sede.id, fila.id, fecha, `${h}:00`, admin.id]);
        }
      }
      const [r] = await pool.query(
        `INSERT IGNORE INTO franjas_horarias (sede_id, especialista_id, fecha, hora_inicio, creado_por) VALUES ?`,
        [filas]
      );
      horas += r.affectedRows;
    }

    console.log(`Listo: ${ESPECIALISTAS.length} especialistas y ${horas} horas nuevas en ${fechas.length} días.`);
  } catch (error) {
    console.error('No fue posible cargar los datos de demostración:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
