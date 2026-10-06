/* Fechas y horas en la zona del consultorio (Colombia, UTC-5, sin
   horario de verano).

   Las franjas se guardan como fecha + hora "de pared" (lo que dice
   el reloj en Rivera). Para comparar con "ahora" se calcula la hora
   actual en Bogotá aquí, en Node, y se pasa a las consultas como
   texto 'YYYY-MM-DD HH:MM:SS'. Así el resultado no depende de la
   zona horaria del servidor donde se publique. */

const ZONA = 'America/Bogota';

function partes(fecha) {
  const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(formato.formatToParts(fecha).map((x) => [x.type, x.value]));
  return p;
}

/* 'YYYY-MM-DD HH:MM:SS' en Bogotá, `horasDespues` horas desde ahora. */
function ahoraBogota(horasDespues = 0) {
  const p = partes(new Date(Date.now() + horasDespues * 3600 * 1000));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

function hoyBogota() {
  return ahoraBogota().slice(0, 10);
}

/* Suma días a una fecha 'YYYY-MM-DD'. */
function sumarDias(fecha, dias) {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/* Primer y último día de un mes 'YYYY-MM'. */
function limitesDeMes(mes) {
  const [anio, numero] = mes.split('-').map(Number);
  const ultimo = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

/* "miércoles 15 de octubre" */
function fechaEnTexto(fecha) {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
    .format(new Date(`${fecha}T00:00:00Z`))
    .replace(',', '');
}

/* '15:00' -> '3:00 p. m.' */
function horaEnTexto(hora) {
  const [h, m] = hora.split(':').map(Number);
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${sufijo}`;
}

module.exports = { ahoraBogota, hoyBogota, sumarDias, limitesDeMes, fechaEnTexto, horaEnTexto };
