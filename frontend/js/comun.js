/* Utilidades compartidas por las pantallas públicas (agendar y
   gestionar cita). Se carga antes que agendar.js y gestionar.js.

   Todo el texto que llega de la API se inserta con textContent
   (a través de `el()`), nunca con innerHTML. */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const DIAS_CORTOS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Crea un nodo. Los hijos de tipo texto se agregan como texto, no como HTML. */
function el(etiqueta, props = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(props)) {
    if (valor == null || valor === false) continue;
    if (clave === 'class') nodo.className = valor;
    else if (clave === 'texto') nodo.textContent = valor;
    else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
    else nodo.setAttribute(clave, valor === true ? '' : valor);
  }
  hijos.flat().forEach((h) => { if (h != null && h !== false) nodo.append(h); });
  return nodo;
}

/** Icono SVG a partir de un trazo estático (nunca de datos de la API). */
function icono(trazo) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = trazo;
  return svg;
}

/** Fecha de hoy en Colombia (UTC-5, sin horario de verano), AAAA-MM-DD. */
function hoyColombia() {
  return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

function fechaLarga(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS[(dia + 6) % 7]} ${d} de ${MESES[m - 1]}`;
}

function horaLarga(hora) {
  const [h, min] = hora.split(':').map(Number);
  return `${h % 12 || 12}:${String(min).padStart(2, '0')} ${h >= 12 ? 'p. m.' : 'a. m.'}`;
}

/** Fila del resumen de una cita: <div><dt/><dd/></div>. */
function dato(etiqueta, valor, cambiar) {
  return el('div', { class: 'resumen__item' },
    el('dt', { texto: etiqueta }),
    el('dd', {}, valor,
      cambiar && el('button', { type: 'button', class: 'resumen__cambiar', 'aria-label': `Cambiar ${etiqueta.toLowerCase()}`, onclick: cambiar, texto: 'Cambiar' })));
}

/** Calendario mensual (lunes primero). Solo los días de `dias` (Set de
    AAAA-MM-DD) se pueden elegir; los demás quedan bloqueados.
    `dias === null` muestra "Cargando disponibilidad…". */
function calendarioMes({ mes, dias, fecha, alElegirDia, alCambiarMes }) {
  const [anio, m] = mes.split('-').map(Number);
  const hueco = (new Date(Date.UTC(anio, m - 1, 1)).getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  const esMesActual = mes <= hoyColombia().slice(0, 7);

  const celdas = [];
  for (let i = 0; i < hueco; i++) celdas.push(el('span', { 'aria-hidden': 'true' }));
  for (let d = 1; d <= total; d++) {
    const f = `${mes}-${String(d).padStart(2, '0')}`;
    const libre = dias?.has(f);
    celdas.push(el('button', {
      type: 'button',
      class: 'dia' + (libre ? ' dia--libre' : ''),
      disabled: !libre,
      'aria-pressed': libre ? String(fecha === f) : null,
      'aria-label': `${fechaLarga(f)}, ${libre ? 'con horas disponibles' : 'sin horas disponibles'}`,
      'data-id-foco': `dia-${f}`,
      onclick: () => alElegirDia(f),
    }, String(d)));
  }

  const nav = (delta, etiqueta, trazo, bloqueado) => el('button', {
    type: 'button', class: 'calendario__nav', 'aria-label': etiqueta, disabled: bloqueado,
    'data-id-foco': `mes-${delta}`, onclick: () => alCambiarMes(delta),
  }, icono(trazo));

  return el('div', { class: 'calendario' },
    el('div', { class: 'calendario__cabecera' },
      nav(-1, 'Mes anterior', '<path d="m15 18-6-6 6-6"/>', esMesActual),
      el('p', { class: 'calendario__mes', 'aria-live': 'polite', texto: `${MESES[m - 1]} ${anio}` }),
      nav(1, 'Mes siguiente', '<path d="m9 18 6-6-6-6"/>', false)),
    dias === null
      ? el('p', { class: 'estado-carga', role: 'status', texto: 'Cargando disponibilidad…' })
      : [
        el('div', { class: 'calendario__rejilla' }, DIAS_CORTOS.map((c) => el('span', { class: 'calendario__sem', 'aria-hidden': 'true', texto: c })), celdas),
        el('p', { class: 'calendario__ayuda', texto: dias.size
          ? 'Los días resaltados tienen horas disponibles.'
          : 'No hay días con horas disponibles este mes. Prueba con el mes siguiente.' }),
      ]);
}

/** Lista de horas de un día. `horas === null` muestra "Cargando horas…". */
function listaHoras({ fecha, horas, alElegirHora }) {
  return el('div', { class: 'agendar__horas' },
    el('h3', { class: 'agendar__subtitulo', texto: `Horas disponibles · ${fechaLarga(fecha)}` }),
    horas === null
      ? el('p', { class: 'estado-carga', role: 'status', texto: 'Cargando horas…' })
      : horas.length
        ? el('div', { class: 'horas', role: 'group', 'aria-label': 'Horas disponibles' }, horas.map((h) =>
          el('button', { type: 'button', class: 'hora', 'data-id-foco': `hora-${h.hora}`, onclick: () => alElegirHora(h), texto: horaLarga(h.hora) })))
        : el('p', { class: 'alerta', 'data-sin-horas': true, texto: 'Ya no quedan horas ese día. Elige otro día.' }));
}
