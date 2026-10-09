/* Recordatorio por WhatsApp 24 horas antes de la cita.

   `enviarRecordatorios()` busca las citas confirmadas que empiezan en
   las próximas 24 horas y aún no tienen recordatorio, y llama a
   notificarCita(tipo 'recordatorio') para cada una. Es seguro
   ejecutarla muchas veces: una cita recibe un solo recordatorio (y uno
   nuevo si se reprograma).

   Como revisa cada 30 minutos y solo entre RECORDATORIO_DESDE y
   RECORDATORIO_HASTA, el mensaje sale unas 24 horas antes; una cita de
   las 7:00 lo recibe a las 8:00 del día anterior.

   Se ejecuta:
   - sola, cada 30 minutos mientras el servidor esté encendido
     (iniciarProgramacion, desde server.js), solo dentro del horario
     RECORDATORIO_DESDE–RECORDATORIO_HASTA para no escribir de noche;
   - a mano: POST /api/admin/recordatorios o `npm run recordatorios`.

   Cada mensaje sigue el modo de WHATSAPP_MODO: en "manual" queda
   pendiente en el panel para que la secretaria lo envíe. */
const citaModelo = require('../models/cita.model');
const { notificarCita } = require('./notificaciones/NotificacionService');
const { ahoraBogota } = require('../utils/tiempo');

const entero = (valor, porDefecto) => {
  const n = Number(valor);
  return Number.isInteger(n) ? n : porDefecto;
};
const HORA_DESDE = () => entero(process.env.RECORDATORIO_DESDE, 8);
const HORA_HASTA = () => entero(process.env.RECORDATORIO_HASTA, 19);
const HORAS_MINIMAS = () => entero(process.env.RECORDATORIO_HORAS_MINIMAS, 12);

let enCurso = false;

function dentroDelHorario() {
  const hora = Number(ahoraBogota().slice(11, 13));
  return hora >= HORA_DESDE() && hora < HORA_HASTA();
}

/**
 * @param {{ ignorarHorario?: boolean }} [opciones]
 * @returns {Promise<{ fecha: string, revisadas: number, resultados: Array<{citaId:number, estado:string}>, omitido?: string }>}
 */
async function enviarRecordatorios({ ignorarHorario = false } = {}) {
  const ahora = ahoraBogota();
  const limite = ahoraBogota(24);
  const fecha = limite.slice(0, 10);  // hasta qué día se revisó (para mostrarlo)
  if (!ignorarHorario && !dentroDelHorario()) {
    return { fecha, revisadas: 0, resultados: [], omitido: 'Fuera del horario de envío' };
  }
  if (enCurso) return { fecha, revisadas: 0, resultados: [], omitido: 'Ya hay una ejecución en curso' };

  enCurso = true;
  try {
    const ids = await citaModelo.pendientesDeRecordatorio(ahora, limite, HORAS_MINIMAS());
    const resultados = [];
    for (const citaId of ids) {
      const r = await notificarCita({ citaId, tipo: 'recordatorio' });
      resultados.push({ citaId, estado: r.estado });
    }
    return { fecha, revisadas: ids.length, resultados };
  } finally {
    enCurso = false;
  }
}

/* Programa la ejecución automática. Se desactiva con RECORDATORIOS_AUTOMATICOS=false. */
function iniciarProgramacion() {
  if (String(process.env.RECORDATORIOS_AUTOMATICOS).toLowerCase() === 'false') return null;
  const ejecutar = () =>
    enviarRecordatorios()
      .then((r) => {
        if (r.revisadas > 0) console.log(`Recordatorios de las próximas 24 horas: ${r.revisadas}`);
      })
      .catch((e) => console.error('Fallo al enviar recordatorios:', e.message));
  setTimeout(ejecutar, 10 * 1000);
  return setInterval(ejecutar, 30 * 60 * 1000);
}

module.exports = { enviarRecordatorios, iniciarProgramacion };
