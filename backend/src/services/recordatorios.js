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

async function enviarRecordatorios({ ignorarHorario = false } = {}) {
  const ahora = ahoraBogota();
  const limite = ahoraBogota(24);
  const fecha = limite.slice(0, 10);
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
