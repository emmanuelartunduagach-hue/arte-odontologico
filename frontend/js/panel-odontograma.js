/* Ficha del paciente · Odontograma.

   Dibuja la boca como una dentadura (numeración FDI): arriba la arcada
   superior y abajo la inferior, con el lado derecho del paciente a la
   izquierda de la pantalla, como se ve al paciente de frente. Cada
   diente tiene su silueta y el cuadro de 5 caras (oclusal, mesial,
   distal, vestibular y lingual o palatina). Al tocar un diente se abre
   su detalle para registrar hallazgos, marcarlos como realizados o
   pedir su anulación.

   Colores (convención clínica): rojo = por hacer, azul = realizado.

   Contrato:
     GET  /pacientes/:id/odontograma        { catalogo: { hallazgos, caras }, hallazgos }
     POST /pacientes/:id/odontograma        { diente, caras, hallazgo, estado, notas? }
     POST /admin/odontograma/:id/realizado
     POST /admin/odontograma/:id/anular     { motivo }
   Anular: si lo pide un administrador espera la aprobación del dueño. */

/* Catálogo por defecto (el servidor manda el oficial en cada GET). */
let CATALOGO_HALLAZGOS = {
  caries: { nombre: 'Caries', alcance: 'cara' },
  resina: { nombre: 'Resina', alcance: 'cara' },
  amalgama: { nombre: 'Amalgama', alcance: 'cara' },
  sellante: { nombre: 'Sellante', alcance: 'cara' },
  fractura: { nombre: 'Fractura', alcance: 'ambos' },
  corona: { nombre: 'Corona', alcance: 'diente' },
  endodoncia: { nombre: 'Endodoncia', alcance: 'diente' },
  extraccion: { nombre: 'Extracción', alcance: 'diente' },
  ausente: { nombre: 'Ausente', alcance: 'diente', soloRealizado: true },
  implante: { nombre: 'Implante', alcance: 'diente' },
  protesis: { nombre: 'Prótesis', alcance: 'diente' },
  otro: { nombre: 'Otro', alcance: 'ambos' },
};

/* Abreviatura que se ve bajo el diente para hallazgos del diente completo. */
const SIGLA_HALLAZGO = {
  corona: 'CO', endodoncia: 'EN', extraccion: 'EX', ausente: 'AU', implante: 'IM',
  protesis: 'PR', fractura: 'FR', otro: 'OT',
};

const NOMBRE_CARA = {
  completo: 'Diente completo', oclusal: 'Oclusal', mesial: 'Mesial', distal: 'Distal',
  vestibular: 'Vestibular', lingual: 'Lingual o palatina',
};

const nombreHallazgo = (codigo) => CATALOGO_HALLAZGOS[codigo]?.nombre || codigo;
const nombreCara = (cara) => NOMBRE_CARA[cara] || cara;

/* Arcadas en el orden en que se ven de frente. */
const DENTICION = {
  permanente: {
    superior: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
    inferior: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
  },
  temporal: {
    superior: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
    inferior: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
  },
};

const odonto = {
  paciente: null,
  hallazgos: [],
  denticion: 'permanente',
  nodo: null,
};

/* ---------- Geometría ---------- */

function tipoDiente(n) {
  const pieza = n % 10;
  const temporal = Math.floor(n / 10) >= 5;
  if (pieza <= 2) return 'incisivo';
  if (pieza === 3) return 'canino';
  if (temporal || pieza >= 6) return 'molar';
  return 'premolar';
}

/* Siluetas en un cuadro de 24 × 34, con la corona abajo (arcada superior).
   La arcada inferior usa la misma figura volteada. */
const SILUETA = {
  incisivo: 'M9 2.5Q12 1 15 2.5L16.5 17Q19.5 22 18.5 29Q12 33 5.5 29Q4.5 22 7.5 17Z',
  canino: 'M9.5 1Q12 0 14.5 1L16.5 16.5Q20 21 18.5 27.5L12 33L5.5 27.5Q4 21 7.5 16.5Z',
  premolar: 'M6.5 3Q8 1.5 9.5 3L11 12.5L12.5 3Q14 1.5 15.5 3L17.5 16.5Q21 21.5 19.5 29Q12 33 4.5 29Q3 21.5 6.5 16.5Z',
  molar: 'M3.5 4Q5 2 6.5 4L9 13L12 5.5L15 13L17.5 4Q19 2 20.5 4L21.5 16.5Q23.5 22 22 29Q12 33.5 2 29Q0.5 22 2.5 16.5Z',
};

const NS = 'http://www.w3.org/2000/svg';
function svg(nombre, atributos = {}, ...hijos) {
  const nodo = document.createElementNS(NS, nombre);
  for (const [k, v] of Object.entries(atributos)) if (v !== null && v !== undefined && v !== false) nodo.setAttribute(k, v);
  hijos.flat().filter(Boolean).forEach((h) => nodo.append(h));
  return nodo;
}

/* Cuadro de 5 caras en 40 × 40. Arriba va la cara que mira hacia afuera
   de la boca en la arcada superior (vestibular) y hacia adentro en la
   inferior (lingual). Mesial es el lado que mira al centro de la boca. */
function posicionesCaras(diente) {
  const cuadrante = Math.floor(diente / 10) % 4 || 4; // 1..4 (5→1, 6→2, 7→3, 8→4)
  const superior = cuadrante === 1 || cuadrante === 2;
  const derechaPaciente = cuadrante === 1 || cuadrante === 4; // se ve a la izquierda
  return {
    arriba: superior ? 'vestibular' : 'lingual',
    abajo: superior ? 'lingual' : 'vestibular',
    izquierda: derechaPaciente ? 'distal' : 'mesial',
    derecha: derechaPaciente ? 'mesial' : 'distal',
  };
}

const POLIGONO = {
  arriba: '1,1 39,1 28,12 12,12',
  abajo: '12,28 28,28 39,39 1,39',
  izquierda: '1,1 12,12 12,28 1,39',
  derecha: '39,1 39,39 28,28 28,12',
};

/* ---------- Estado de cada diente ---------- */

const vigentes = () => odonto.hallazgos.filter((h) => h.anulacion !== 'aprobada');
const delDiente = (n) => odonto.hallazgos.filter((h) => h.diente === n);

/* 'por_hacer' si hay algo pendiente en esa cara; si no, 'realizado'; o null. */
function estadoDe(lista) {
  if (!lista.length) return null;
  return lista.some((h) => h.estado === 'por_hacer') ? 'por_hacer' : 'realizado';
}

function resumenDiente(n) {
  const lista = vigentes().filter((h) => h.diente === n);
  const caras = {};
  for (const cara of ['oclusal', 'mesial', 'distal', 'vestibular', 'lingual']) {
    caras[cara] = estadoDe(lista.filter((h) => h.cara === cara));
  }
  const completos = lista.filter((h) => h.cara === 'completo');
  return {
    total: lista.length,
    caras,
    completo: estadoDe(completos),
    siglas: [...new Set(completos.map((h) => SIGLA_HALLAZGO[h.hallazgo]).filter(Boolean))],
    ausente: completos.some((h) => h.hallazgo === 'ausente' || (h.hallazgo === 'extraccion' && h.estado === 'realizado')),
    extraccionPendiente: completos.some((h) => h.hallazgo === 'extraccion' && h.estado === 'por_hacer'),
  };
}

/* ---------- Dibujo ---------- */

function dibujoCaras(n, r, { grande = false, alTocarCara = null, marcadas = null } = {}) {
  const pos = posicionesCaras(n);
  const clase = (cara) => {
    const marcada = marcadas?.has(cara);
    return ['cara', r.caras[cara] && `cara--${r.caras[cara]}`, marcada && 'cara--marcada'].filter(Boolean).join(' ');
  };
  const pieza = (forma, cara, puntos) => {
    const atributos = { class: clase(cara), 'data-cara': cara };
    const nodo = forma === 'rect'
      ? svg('rect', { ...atributos, x: 12, y: 12, width: 16, height: 16 })
      : svg('polygon', { ...atributos, points: puntos });
    if (alTocarCara) nodo.addEventListener('click', () => alTocarCara(cara));
    nodo.append(svg('title', {}, document.createTextNode(nombreCara(cara))));
    return nodo;
  };
  return svg('svg', { class: 'diente__caras' + (grande ? ' diente__caras--grande' : ''), viewBox: '0 0 40 40', 'aria-hidden': 'true' },
    pieza('poly', pos.arriba, POLIGONO.arriba),
    pieza('poly', pos.abajo, POLIGONO.abajo),
    pieza('poly', pos.izquierda, POLIGONO.izquierda),
    pieza('poly', pos.derecha, POLIGONO.derecha),
    pieza('rect', 'oclusal'),
    r.extraccionPendiente && svg('path', { class: 'diente__aspa diente__aspa--por_hacer', d: 'M4 4 36 36M36 4 4 36' }),
    r.ausente && svg('path', { class: 'diente__aspa', d: 'M4 4 36 36M36 4 4 36' }));
}

function dibujoSilueta(n, r, superior) {
  return svg('svg', { class: 'diente__forma' + (r.completo ? ` diente__forma--${r.completo}` : '') + (r.ausente ? ' diente__forma--ausente' : ''),
    viewBox: '0 0 24 34', 'aria-hidden': 'true' },
  svg('path', { d: SILUETA[tipoDiente(n)], transform: superior ? null : 'translate(0 34) scale(1 -1)' }));
}

function etiquetaDiente(n, r) {
  const partes = [`Diente ${n}`];
  if (!r.total) partes.push('sin hallazgos');
  else partes.push(r.total === 1 ? '1 hallazgo' : `${r.total} hallazgos`);
  if (r.ausente) partes.push('ausente');
  return partes.join(', ');
}

function botonDiente(n, superior) {
  const r = resumenDiente(n);
  const conPendiente = delDiente(n).some((h) => h.anulacion === 'pendiente');
  return el('button', {
    type: 'button',
    class: `diente diente--${superior ? 'superior' : 'inferior'}` + (r.total ? ' diente--con-hallazgos' : ''),
    'data-diente': String(n),
    'aria-label': etiquetaDiente(n, r),
    onclick: () => abrirDiente(n),
  },
  el('span', { class: 'diente__numero', texto: String(n) }),
  dibujoSilueta(n, r, superior),
  dibujoCaras(n, r),
  el('span', { class: 'diente__siglas' + (r.completo ? ` diente__siglas--${r.completo}` : ''), texto: r.siglas.join(' ') || ' ' }),
  conPendiente && el('span', { class: 'diente__punto', title: 'Anulación esperando aprobación' }));
}

function pintarOdontograma() {
  const { nodo } = odonto;
  if (!nodo) return;
  const d = DENTICION[odonto.denticion];
  const mitad = (lista) => [lista.slice(0, lista.length / 2), lista.slice(lista.length / 2)];
  const arcada = (lista, superior) => el('div', { class: `arcada arcada--${superior ? 'superior' : 'inferior'}`, role: 'group',
    'aria-label': superior ? 'Arcada superior' : 'Arcada inferior' },
  mitad(lista).map((lado, i) => el('div', { class: `arcada__lado arcada__lado--${i ? 'izquierdo' : 'derecho'}` },
    lado.map((n) => botonDiente(n, superior)))));

  const plan = vigentes().filter((h) => h.estado === 'por_hacer')
    .filter((h) => DENTICION[odonto.denticion].superior.includes(h.diente) || DENTICION[odonto.denticion].inferior.includes(h.diente));
  const totalOtra = vigentes().filter((h) => {
    const otra = DENTICION[odonto.denticion === 'permanente' ? 'temporal' : 'permanente'];
    return otra.superior.includes(h.diente) || otra.inferior.includes(h.diente);
  }).length;

  const pestanas = el('div', { class: 'segmentado', role: 'group', 'aria-label': 'Dentición' },
    [['permanente', 'Adulto (32)'], ['temporal', 'Niño (20)']].map(([valor, texto]) =>
      el('button', { type: 'button', class: 'segmentado__opcion', 'aria-pressed': String(odonto.denticion === valor),
        onclick: () => { odonto.denticion = valor; pintarOdontograma(); }, texto })));

  pintarEn(nodo,
    el('div', { class: 'odontograma__barra' },
      pestanas,
      totalOtra > 0 && el('p', { class: 'fila-cita__detalle', texto: `También hay ${totalOtra === 1 ? '1 hallazgo' : `${totalOtra} hallazgos`} en la dentición ${odonto.denticion === 'permanente' ? 'de niño' : 'de adulto'}.` })),
    el('div', { class: 'odontograma__marco' },
      el('div', { class: `odontograma odontograma--${odonto.denticion}` },
        el('p', { class: 'odontograma__lado', 'aria-hidden': 'true', texto: 'Derecha del paciente' }),
        el('p', { class: 'odontograma__lado odontograma__lado--izq', 'aria-hidden': 'true', texto: 'Izquierda del paciente' }),
        arcada(d.superior, true),
        el('div', { class: 'odontograma__linea', 'aria-hidden': 'true' }),
        arcada(d.inferior, false))),
    el('p', { class: 'odontograma__deslizar', texto: 'Desliza para ver todos los dientes. Toca un diente para ver o registrar sus hallazgos.' }),
    el('ul', { class: 'odontograma__leyenda', 'aria-label': 'Leyenda' },
      el('li', {}, el('span', { class: 'muestra muestra--por_hacer', 'aria-hidden': 'true' }), 'Por hacer'),
      el('li', {}, el('span', { class: 'muestra muestra--realizado', 'aria-hidden': 'true' }), 'Realizado'),
      el('li', { class: 'odontograma__siglas' }, 'CO corona · EN endodoncia · EX extracción · AU ausente · IM implante · PR prótesis · FR fractura · OT otro')),
    el('div', { class: 'odontograma__plan' },
      el('h3', { class: 'odontograma__subtitulo', texto: plan.length ? `Por hacer (${plan.length})` : 'Por hacer' }),
      plan.length
        ? el('ul', { class: 'odontograma__lista' }, plan.map((h) => el('li', {},
          el('button', { type: 'button', class: 'enlace-boton', onclick: () => abrirDiente(h.diente),
            texto: `Diente ${h.diente} · ${nombreCara(h.cara)} · ${nombreHallazgo(h.hallazgo)}` }))))
        : el('p', { class: 'fila-cita__detalle', texto: 'No hay tratamientos pendientes en esta dentición.' })));
}

/* ---------- Montaje en la ficha ---------- */

async function montarOdontograma(nodo, paciente) {
  odonto.nodo = nodo;
  odonto.paciente = paciente;
  pintarEn(nodo, estadoCarga('Cargando el odontograma…'));
  try {
    const datos = await api(`/pacientes/${paciente.id}/odontograma`);
    if (odonto.paciente !== paciente) return;
    if (datos.catalogo?.hallazgos) CATALOGO_HALLAZGOS = datos.catalogo.hallazgos;
    odonto.hallazgos = datos.hallazgos;
    // Si solo tiene hallazgos en dientes de niño, se abre en esa dentición.
    const temporales = datos.hallazgos.some((h) => h.diente >= 51);
    const permanentes = datos.hallazgos.some((h) => h.diente < 51);
    odonto.denticion = temporales && !permanentes ? 'temporal' : 'permanente';
    pintarOdontograma();
  } catch (err) {
    pintarEn(nodo, errorConReintento(err, () => montarOdontograma(nodo, paciente)));
  }
}

/* ---------- Detalle de un diente ---------- */

function abrirDiente(n, aviso = null) {
  const nodo = dialogo.abrir(`Diente ${n}`);
  const lista = delDiente(n);
  const r = resumenDiente(n);
  const marcadas = new Set();

  const alerta = el('p', { class: 'alerta', role: 'alert', hidden: true });
  const opciones = Object.entries(CATALOGO_HALLAZGOS);
  const form = el('form', { class: 'form-hallazgo', novalidate: true });
  const caraCasillas = el('div', { class: 'caras-opciones', role: 'group', 'aria-labelledby': 'odo-caras-titulo' });

  const vista = el('div', { class: 'diente-detalle__vista' });
  const pintarVista = () => pintarEn(vista,
    dibujoCaras(n, r, { grande: true, marcadas, alTocarCara: (cara) => alternarCara(cara) }));

  function casillas() {
    const tipo = CATALOGO_HALLAZGOS[form.hallazgo.value];
    const soloDiente = tipo?.alcance === 'diente';
    const soloCaras = tipo?.alcance === 'cara';
    if (soloDiente) { marcadas.clear(); marcadas.add('completo'); }
    if (soloCaras) marcadas.delete('completo');
    pintarEn(caraCasillas,
      ['vestibular', 'mesial', 'oclusal', 'distal', 'lingual', 'completo'].map((cara) => {
        const deshabilitada = (cara === 'completo' && soloCaras) || (cara !== 'completo' && soloDiente);
        return el('label', { class: 'casilla-opcion' + (deshabilitada ? ' casilla-opcion--apagada' : '') },
          el('input', { type: 'checkbox', name: 'caras', value: cara, checked: marcadas.has(cara), disabled: deshabilitada,
            onchange: () => alternarCara(cara) }),
          el('span', { texto: nombreCara(cara) }));
      }));
    form.querySelector('.estado-opciones [value="por_hacer"]').disabled = Boolean(tipo?.soloRealizado);
    if (tipo?.soloRealizado) form.querySelector('.estado-opciones [value="realizado"]').checked = true;
    pintarVista();
  }

  function alternarCara(cara) {
    const tipo = CATALOGO_HALLAZGOS[form.hallazgo.value];
    if (tipo?.alcance === 'diente') return;
    if (cara === 'completo') {
      if (tipo?.alcance === 'cara') return;
      const estaba = marcadas.has('completo');
      marcadas.clear();
      if (!estaba) marcadas.add('completo');
    } else {
      marcadas.delete('completo');
      if (marcadas.has(cara)) marcadas.delete(cara); else marcadas.add(cara);
    }
    casillas();
  }

  pintarEn(form,
    el('div', { class: 'campo' },
      el('label', { class: 'campo__etiqueta', for: 'pac-hallazgo', texto: '¿Qué se encontró o qué se hizo?' }),
      el('select', { class: 'campo__control', id: 'pac-hallazgo', name: 'hallazgo', 'aria-describedby': 'pac-hallazgo-error', onchange: () => casillas() },
        el('option', { value: '', texto: 'Elige una opción' }),
        opciones.map(([codigo, h]) => el('option', { value: codigo, texto: h.nombre }))),
      el('p', { class: 'campo__error', id: 'pac-hallazgo-error', hidden: true })),
    el('fieldset', { class: 'campo' },
      el('legend', { class: 'campo__etiqueta', id: 'odo-caras-titulo', texto: 'Caras (toca el dibujo o marca aquí)' }),
      caraCasillas,
      el('p', { class: 'campo__error', id: 'pac-caras-error', hidden: true })),
    el('fieldset', { class: 'campo' },
      el('legend', { class: 'campo__etiqueta', texto: 'Estado' }),
      el('div', { class: 'estado-opciones' },
        el('label', { class: 'casilla-opcion' }, el('input', { type: 'radio', name: 'estado', value: 'por_hacer', checked: true }), el('span', { texto: 'Por hacer' })),
        el('label', { class: 'casilla-opcion' }, el('input', { type: 'radio', name: 'estado', value: 'realizado' }), el('span', { texto: 'Realizado' }))),
      el('p', { class: 'campo__error', id: 'pac-estado-error', hidden: true })),
    campoForm('notas', 'Notas (opcional)', 'textarea', { rows: '2', maxlength: '500' }),
    alerta,
    el('div', { class: 'acciones' },
      el('button', { type: 'submit', class: 'btn btn--primario', texto: 'Guardar hallazgo' }),
      el('button', { type: 'button', class: 'btn btn--secundario', 'data-cerrar': true, texto: 'Cerrar' })));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = form.querySelector('[type="submit"]');
    limpiarErroresForm(form);
    alerta.hidden = true;
    boton.disabled = true;
    try {
      const r2 = await api(`/pacientes/${odonto.paciente.id}/odontograma`, {
        metodo: 'POST',
        cuerpo: { diente: n, caras: [...marcadas], hallazgo: form.hallazgo.value, estado: form.estado.value, notas: form.notas.value },
      });
      odonto.hallazgos = r2.hallazgos;
      pintarOdontograma();
      abrirDiente(n, 'Hallazgo guardado.');
    } catch (err) {
      boton.disabled = false;
      // El error de caras no tiene control propio: se muestra bajo las casillas.
      if (err.campos?.caras) {
        const p = form.querySelector('#pac-caras-error');
        p.textContent = err.campos.caras;
        p.hidden = false;
      }
      const { caras, ...resto } = err.campos || {};
      const sueltos = mostrarErroresForm(form, resto);
      if (!err.campos || sueltos.length) { alerta.textContent = sueltos.join(' ') || err.message; alerta.hidden = false; }
    }
  });

  const registrados = lista.length
    ? el('ul', { class: 'hallazgos' }, [...lista].reverse().map((h) => filaHallazgo(h, n)))
    : el('p', { class: 'fila-cita__detalle', texto: 'Este diente no tiene hallazgos registrados.' });

  pintarEn(nodo,
    aviso && el('p', { class: 'alerta alerta--exito', role: 'status', texto: aviso }),
    el('div', { class: 'diente-detalle' },
      vista,
      el('div', {},
        el('p', { class: 'fila-cita__detalle', texto: `${capitalizar(tipoDiente(n))} ${Number(n) >= 51 ? 'temporal (de leche)' : 'permanente'} · ${odonto.paciente.nombreCompleto}` }),
        el('h3', { class: 'odontograma__subtitulo', texto: 'Registrados' }),
        registrados)),
    el('h3', { class: 'odontograma__subtitulo', texto: 'Registrar hallazgo' }),
    form);
  casillas();
}

function filaHallazgo(h, n) {
  const anulado = h.anulacion === 'aprobada';
  const chip = anulado ? ['Anulado', 'cancelada']
    : h.anulacion === 'pendiente' ? ['Anulación por aprobar', 'pendiente']
      : h.estado === 'realizado' ? ['Realizado', 'realizado'] : ['Por hacer', 'por_hacer'];
  const detalle = [`Registró ${h.autor} el ${fechaLarga(h.creadoEn.slice(0, 10))}`];
  if (h.realizadoEn && h.estado === 'realizado') detalle.push(`realizado el ${fechaLarga(h.realizadoEn.slice(0, 10))}`);
  return el('li', { class: 'hallazgo' + (anulado ? ' hallazgo--anulado' : '') },
    el('div', { class: 'hallazgo__cabecera' },
      el('p', { class: 'hallazgo__titulo', texto: `${nombreHallazgo(h.hallazgo)} · ${nombreCara(h.cara)}` }),
      el('span', { class: `estado estado--odo-${chip[1]}`, texto: chip[0] })),
    h.notas && el('p', { class: 'nota-hc__notas', texto: h.notas }),
    el('p', { class: 'fila-cita__detalle', texto: detalle.join(' · ') }),
    h.anulacion && h.anulacionMotivo && el('p', { class: 'fila-cita__detalle', texto: `Motivo de anulación: ${h.anulacionMotivo}` }),
    h.anulacion === 'rechazada' && el('p', { class: 'fila-cita__detalle', texto: `El dueño no aprobó la anulación: ${h.anulacionRechazo}` }),
    !anulado && h.anulacion !== 'pendiente' && el('div', { class: 'acciones hallazgo__acciones' },
      h.estado === 'por_hacer' && el('button', { type: 'button', class: 'btn btn--secundario btn--compacto', onclick: () => marcarHallazgoRealizado(h, n), texto: 'Marcar realizado' }),
      el('button', { type: 'button', class: 'btn btn--fantasma btn--compacto', onclick: () => anularHallazgo(h, n), texto: 'Anular' })));
}

async function marcarHallazgoRealizado(h, n) {
  try {
    const r = await api(`/admin/odontograma/${h.id}/realizado`, { metodo: 'POST' });
    odonto.hallazgos = r.hallazgos;
    pintarOdontograma();
    abrirDiente(n, 'Marcado como realizado.');
  } catch (err) {
    abrirDiente(n);
    dialogo.modal().querySelector('#modal-panel-cuerpo').prepend(el('p', { class: 'alerta', role: 'alert', texto: err.message }));
  }
}

function anularHallazgo(h, n) {
  const dueno = esDueno(obtenerSesion()?.usuario);
  const nodo = dialogo.abrir(`Anular hallazgo del diente ${n}`);
  const alerta = el('p', { class: 'alerta', role: 'alert', hidden: true });
  const form = el('form', { novalidate: true },
    el('dl', { class: 'resumen' }, dato('Hallazgo', `${nombreHallazgo(h.hallazgo)} · ${nombreCara(h.cara)}`)),
    el('p', { class: 'agendar__nota', texto: dueno
      ? 'El hallazgo deja de aparecer en el odontograma. No se borra: queda en el historial como anulado.'
      : 'Úsalo si se registró por error. El hallazgo sigue vigente hasta que el dueño apruebe la anulación.' }),
    campoForm('motivo', 'Motivo', 'textarea', { rows: '2', maxlength: '300' }),
    alerta,
    el('div', { class: 'acciones' },
      el('button', { type: 'submit', class: 'btn btn--primario', texto: dueno ? 'Anular' : 'Pedir anulación' }),
      el('button', { type: 'button', class: 'btn btn--secundario', onclick: () => abrirDiente(n), texto: 'Volver' })));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = form.querySelector('[type="submit"]');
    limpiarErroresForm(form);
    alerta.hidden = true;
    boton.disabled = true;
    try {
      const r = await api(`/admin/odontograma/${h.id}/anular`, { metodo: 'POST', cuerpo: { motivo: form.motivo.value } });
      odonto.hallazgos = r.hallazgos;
      pintarOdontograma();
      abrirDiente(n, r.mensaje);
    } catch (err) {
      boton.disabled = false;
      const sueltos = mostrarErroresForm(form, err.campos);
      if (!err.campos || sueltos.length) { alerta.textContent = sueltos.join(' ') || err.message; alerta.hidden = false; }
    }
  });
  pintarEn(nodo, form);
  form.motivo.focus();
}
