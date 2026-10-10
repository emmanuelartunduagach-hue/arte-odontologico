/* Panel de la secretaria · Horarios de atención (B-21, B-22, B-23 y decisión 29).

   La secretaria marca a mano las horas en que atiende cada especialista.
   Contrato API v2, sección 4 ("Disponibilidad"):
     GET    /admin/especialistas/:id/franjas?desde=&hasta=  → [{ id, fecha, hora, cita }]
     POST   /admin/especialistas/:id/franjas  { fechas: [...], horas: [...] }  → { total }
     DELETE /admin/franjas/:id   (409 si la hora tiene cita)

   Se ve una semana a la vez. Cada día tiene un botón «Editar» que abre el
   horario de ese día: las horas marcadas son las que los pacientes pueden
   elegir; se marcan o desmarcan con un toque y al guardar se agregan o se
   quitan solo las diferencias. El mismo horario se puede usar en otros días
   de la semana y repetir varias semanas. Las horas con cita y las que ya
   pasaron no se tocan. */

const disponibilidad = {
  especialistaId: null,
  lunes: null,            // lunes de la semana que se ve (AAAA-MM-DD)
  especialistas: null,    // solo activos
  franjas: [],            // horas de la semana que se ve
  turno: 0,
};

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Horas que se pueden marcar: de 7:00 a. m. a 7:00 p. m., cada 30 minutos.
const HORAS_PUBLICABLES = Array.from({ length: 25 }, (_, i) => {
  const minutos = 7 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
});

// Bloques del editor y atajos (inicio incluido, fin excluido).
const BLOQUES_DIA = [
  { nombre: 'Mañana', desde: '00:00', hasta: '12:00' },
  { nombre: 'Tarde', desde: '12:00', hasta: '18:00' },
  { nombre: 'Noche', desde: '18:00', hasta: '24:00' },
];
const ATAJOS_HORARIO = [
  { texto: 'Mañana (8 a 12)', incluye: (h) => h >= '08:00' && h < '12:00' },
  { texto: 'Tarde (2 a 6)', incluye: (h) => h >= '14:00' && h < '18:00' },
  { texto: 'Mañana y tarde', incluye: (h) => (h >= '08:00' && h < '12:00') || (h >= '14:00' && h < '18:00') },
  { texto: 'Desmarcar todo', incluye: () => false },
];

function lunesDe(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const diaSemana = (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;  // 0 = lunes
  return sumarDiasA(fecha, -diaSemana);
}

function fechaCorta(fecha) {
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)}.`;
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/* ---------- Sección ---------- */

async function montarDisponibilidad(cuerpo) {
  disponibilidad.lunes ??= lunesDe(hoyColombia());
  const contenido = el('div', { class: 'disponibilidad__contenido' });

  pintarEn(cuerpo,
    avisoDemo(),
    encabezadoSeccion('Horarios de atención',
      'Elige al especialista y toca «Editar» en el día que quieras cambiar. Solo las horas publicadas aparecen para agendar.'),
    tomarAviso(),
    contenido);

  if (!disponibilidad.especialistas) {
    pintarEn(contenido, estadoCarga('Cargando especialistas…'));
    try {
      disponibilidad.especialistas = (await api('/admin/especialistas')).filter((e) => e.activo);
    } catch (err) {
      pintarEn(contenido, errorConReintento(err, panel.refrescar));
      return;
    }
  }
  if (!disponibilidad.especialistas.length) {
    pintarEn(contenido, el('div', { class: 'vacio' }, el('p', { texto: 'Aún no hay especialistas activos. Regístralos primero.' })));
    return;
  }
  if (!disponibilidad.especialistas.some((e) => e.id === disponibilidad.especialistaId)) {
    disponibilidad.especialistaId = disponibilidad.especialistas[0].id;
  }

  const semana = el('div', { class: 'semana' });
  pintarEn(contenido, barraDisponibilidad(), semana);
  cargarSemana(semana);
}

function barraDisponibilidad() {
  const lunesActual = lunesDe(hoyColombia());
  const domingo = sumarDiasA(disponibilidad.lunes, 6);
  const ir = (lunes) => { disponibilidad.lunes = lunes; panel.refrescar(); };

  const selector = el('select', { class: 'campo__control', 'aria-label': 'Especialista' },
    disponibilidad.especialistas.map((e) => el('option', {
      value: String(e.id), selected: e.id === disponibilidad.especialistaId,
      texto: `${e.nombre} · ${e.especialidades.map((s) => s.nombre).join(', ')}`,
    })));
  selector.addEventListener('change', () => { disponibilidad.especialistaId = Number(selector.value); panel.refrescar(); });

  return el('div', { class: 'agenda__barra' },
    el('label', { class: 'disponibilidad__especialista' },
      el('span', { class: 'campo__etiqueta', texto: 'Especialista' }), selector),
    el('div', { class: 'agenda__dia' },
      el('button', { type: 'button', class: 'btn btn--secundario btn--icono', 'aria-label': 'Semana anterior',
        disabled: disponibilidad.lunes <= lunesActual, onclick: () => ir(sumarDiasA(disponibilidad.lunes, -7)) },
      icono('<path d="m15 18-6-6 6-6"/>')),
      el('span', { class: 'disponibilidad__rango', 'aria-live': 'polite', texto: `${fechaCorta(disponibilidad.lunes)} – ${fechaCorta(domingo)}` }),
      el('button', { type: 'button', class: 'btn btn--secundario btn--icono', 'aria-label': 'Semana siguiente',
        onclick: () => ir(sumarDiasA(disponibilidad.lunes, 7)) },
      icono('<path d="m9 18 6-6-6-6"/>')),
      disponibilidad.lunes !== lunesActual
        && el('button', { type: 'button', class: 'btn btn--fantasma btn--compacto', onclick: () => ir(lunesActual), texto: 'Esta semana' })));
}

async function cargarSemana(semana) {
  const turno = ++disponibilidad.turno;
  const { especialistaId, lunes } = disponibilidad;
  pintarEn(semana, estadoCarga('Cargando horas…'));
  let franjas;
  try {
    franjas = await api(`/admin/especialistas/${especialistaId}/franjas?desde=${lunes}&hasta=${sumarDiasA(lunes, 6)}`);
  } catch (err) {
    if (turno === disponibilidad.turno) pintarEn(semana, errorConReintento(err, () => cargarSemana(semana)));
    return;
  }
  if (turno !== disponibilidad.turno) return;
  disponibilidad.franjas = franjas;

  const hoy = hoyColombia();
  const ahora = ahoraColombia();
  const libres = franjas.filter((f) => !f.cita).length;

  pintarEn(semana,
    el('p', { class: 'agenda__conteo', role: 'status', texto: franjas.length
      ? `${plural(franjas.length, 'hora publicada', 'horas publicadas')} esta semana · ${plural(libres, 'libre', 'libres')}`
      : 'No hay horas publicadas esta semana. Toca «Editar» en un día para agregarlas.' }),
    el('div', { class: 'semana__rejilla' },
      DIAS_SEMANA.map((nombre, i) => {
        const fecha = sumarDiasA(lunes, i);
        const delDia = franjas.filter((f) => f.fecha === fecha);
        const editable = fecha >= hoy;
        return el('section', { class: 'semana__dia' + (fecha < hoy ? ' semana__dia--pasado' : '') + (fecha === hoy ? ' semana__dia--hoy' : ''),
          'aria-label': `${nombre} ${fechaCorta(fecha)}` },
        el('h3', { class: 'semana__titulo' },
          el('span', { texto: nombre }), el('span', { class: 'semana__fecha', texto: fechaCorta(fecha) })),
        delDia.length
          ? el('ul', { class: 'semana__horas' }, delDia.map((f) => el('li', {}, chipHora(f, `${f.fecha}T${f.hora}` <= ahora))))
          : el('p', { class: 'semana__vacio', texto: editable ? 'No atiende' : 'Sin horas' }),
        editable && el('button', {
          type: 'button', class: 'btn btn--secundario btn--compacto semana__editar',
          'aria-label': `Editar el horario del ${fechaLarga(fecha)}`, onclick: () => abrirEditorDia(fecha),
        }, icono('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'), el('span', { texto: 'Editar' })));
      })),
    el('p', { class: 'disponibilidad__leyenda' },
      el('span', { class: 'chip-hora chip-hora--libre', 'aria-hidden': 'true', texto: '8:00' }), ' libre  ',
      el('span', { class: 'chip-hora chip-hora--ocupada', 'aria-hidden': 'true', texto: '9:00' }), ' con cita  ',
      el('span', { class: 'chip-hora chip-hora--pasada', 'aria-hidden': 'true', texto: '7:00' }), ' ya pasó'));
}

function chipHora(franja, pasada) {
  const texto = horaLarga(franja.hora);
  if (franja.cita) {
    return el('span', { class: 'chip-hora chip-hora--ocupada', title: `Cita de ${franja.cita.paciente}` },
      el('span', { texto }), el('span', { class: 'chip-hora__paciente', texto: franja.cita.paciente }));
  }
  return el('span', { class: `chip-hora ${pasada ? 'chip-hora--pasada' : 'chip-hora--libre'}`, texto });
}

/* ---------- Editor del horario de un día ---------- */

function abrirEditorDia(fecha) {
  const especialista = disponibilidad.especialistas.find((e) => e.id === disponibilidad.especialistaId);
  const cuerpo = dialogo.abrir(`Horario del ${fechaLarga(fecha)}`);
  const hoy = hoyColombia();
  const ahora = ahoraColombia();
  const indiceDia = DIAS_SEMANA.findIndex((_, i) => sumarDiasA(disponibilidad.lunes, i) === fecha);
  const delDia = new Map(disponibilidad.franjas.filter((f) => f.fecha === fecha).map((f) => [f.hora, f]));

  // Horas del editor: las de siempre más cualquier otra que ya estuviera publicada.
  const horasEditor = [...new Set([...HORAS_PUBLICABLES, ...delDia.keys()])].sort();
  const marcadas = new Set(delDia.keys());
  const bloqueada = (h) => Boolean(delDia.get(h)?.cita) || `${fecha}T${h}` <= ahora;

  const error = el('p', { class: 'alerta', role: 'alert', hidden: true });
  const resumen = el('p', { class: 'editor-dia__resumen', 'aria-live': 'polite' });
  const boton = el('button', { type: 'submit', class: 'btn btn--primario', texto: 'Guardar horario' });

  // Botones de hora (aria-pressed = publicada).
  const botones = new Map();
  function botonHora(h) {
    const franja = delDia.get(h);
    const pasada = `${fecha}T${h}` <= ahora;
    if (franja?.cita) {
      return el('span', { class: 'hora-toggle hora-toggle--cita', title: `Cita de ${franja.cita.paciente}` },
        el('span', { texto: horaLarga(h) }), el('span', { class: 'hora-toggle__nota', texto: `Cita: ${franja.cita.paciente}` }));
    }
    const b = el('button', {
      type: 'button', class: 'hora-toggle', 'aria-pressed': String(marcadas.has(h)), disabled: pasada,
      onclick: () => { marcadas.has(h) ? marcadas.delete(h) : marcadas.add(h); pintarBotones(); actualizar(); },
    }, el('span', { texto: horaLarga(h) }), pasada && el('span', { class: 'hora-toggle__nota', texto: 'Ya pasó' }));
    botones.set(h, b);
    return b;
  }
  const pintarBotones = () => botones.forEach((b, h) => b.setAttribute('aria-pressed', String(marcadas.has(h))));

  const bloques = BLOQUES_DIA.map(({ nombre, desde, hasta }) => {
    const horas = horasEditor.filter((h) => h >= desde && h < hasta);
    return horas.length > 0 && el('fieldset', { class: 'editor-dia__bloque' },
      el('legend', { class: 'editor-dia__bloque-titulo', texto: nombre }),
      el('div', { class: 'editor-dia__horas' }, horas.map(botonHora)));
  });

  const atajos = el('div', { class: 'publicar__atajos', role: 'group', 'aria-label': 'Marcar rápido' },
    el('span', { class: 'publicar__atajos-etiqueta', texto: 'Marcar rápido:' }),
    ATAJOS_HORARIO.map(({ texto, incluye }) => el('button', {
      type: 'button', class: 'btn btn--fantasma btn--compacto', texto,
      onclick: () => {
        horasEditor.filter((h) => !bloqueada(h)).forEach((h) => (incluye(h) ? marcadas.add(h) : marcadas.delete(h)));
        pintarBotones();
        actualizar();
      },
    })));

  // Usar el mismo horario en otros días y repetirlo varias semanas.
  const otrosDias = el('div', { class: 'publicar__opciones' },
    DIAS_SEMANA.map((nombre, i) => el('label', { class: 'casilla-opcion' + (i === indiceDia ? ' casilla-opcion--inactiva' : '') },
      el('input', { type: 'checkbox', name: 'dia', value: String(i), checked: i === indiceDia, disabled: i === indiceDia }),
      el('span', { texto: nombre.slice(0, 3) }))));
  const repetir = el('select', { class: 'campo__control', name: 'semanas' },
    [[1, 'Solo esta semana'], [2, 'Esta semana y la siguiente'], [4, 'Las próximas 4 semanas'], [8, 'Las próximas 8 semanas']]
      .map(([n, texto]) => el('option', { value: String(n), texto })));

  const copiar = el('details', { class: 'editor-dia__copiar' },
    el('summary', { texto: 'Usar este horario en otros días' }),
    el('p', { class: 'campo__ayuda', texto: 'Los días marcados quedan con estas mismas horas. Las horas con cita no se tocan.' }),
    el('fieldset', { class: 'publicar__grupo' },
      el('legend', { class: 'campo__etiqueta', texto: 'Días' }), otrosDias),
    el('label', { class: 'campo' }, el('span', { class: 'campo__etiqueta', texto: 'Repetir' }), repetir));

  const form = el('form', { class: 'editor-dia', novalidate: true },
    el('p', { class: 'seccion-panel__subtitulo', texto: `${especialista.nombre}. Toca una hora para publicarla o quitarla: las marcadas son las que los pacientes pueden elegir.` }),
    atajos,
    bloques,
    copiar,
    resumen,
    error,
    el('div', { class: 'acciones' }, boton, el('button', { type: 'button', class: 'btn btn--secundario', 'data-cerrar': true, texto: 'Cancelar' })));

  /** Fechas a las que se aplica el horario (siempre incluye la del día). */
  function fechasDestino() {
    const indices = [...otrosDias.querySelectorAll('input:checked')].map((c) => Number(c.value));
    const fechas = new Set([fecha]);
    for (let s = 0; s < Number(repetir.value); s++) {
      indices.forEach((i) => {
        const f = sumarDiasA(disponibilidad.lunes, s * 7 + i);
        if (f >= hoy) fechas.add(f);
      });
    }
    return [...fechas].sort();
  }

  // Horas ya publicadas en las fechas destino (se piden una vez por rango).
  let cache = { clave: '', franjas: null };
  async function franjasDe(fechas) {
    if (fechas.length === 1 && fechas[0] === fecha) return disponibilidad.franjas.filter((f) => f.fecha === fecha);
    const clave = `${fechas[0]}|${fechas[fechas.length - 1]}`;
    if (cache.clave !== clave) {
      const lista = await api(`/admin/especialistas/${especialista.id}/franjas?desde=${fechas[0]}&hasta=${fechas[fechas.length - 1]}`);
      cache = { clave, franjas: lista };
    }
    return cache.franjas;
  }

  /** Qué hay que agregar y quitar en cada fecha para que quede igual al día editado. */
  async function calcularCambios() {
    const fechas = fechasDestino();
    const existentes = await franjasDe(fechas);
    const agregar = new Map();   // fecha → [horas]
    const quitar = [];           // franjas libres que sobran
    let conCita = 0;             // horas con cita que se conservan
    fechas.forEach((f) => {
      const delaFecha = existentes.filter((x) => x.fecha === f);
      const publicadas = new Set(delaFecha.map((x) => x.hora));
      const nuevas = [...marcadas].filter((h) => !publicadas.has(h) && `${f}T${h}` > ahora);
      if (nuevas.length) agregar.set(f, nuevas.sort());
      delaFecha.forEach((x) => {
        if (marcadas.has(x.hora) || `${f}T${x.hora}` <= ahora) return;
        if (x.cita) conCita += 1; else quitar.push(x);
      });
    });
    const totalAgregar = [...agregar.values()].reduce((s, l) => s + l.length, 0);
    return { fechas, agregar, quitar, conCita, totalAgregar };
  }

  let turnoResumen = 0;
  async function actualizar() {
    const turno = ++turnoResumen;
    const fechas = fechasDestino();
    if (fechas.length > 1) resumen.textContent = 'Calculando cambios…';
    try {
      const c = await calcularCambios();
      if (turno !== turnoResumen) return;
      const dias = c.fechas.length === 1 ? '' : ` en ${plural(c.fechas.length, 'día', 'días')}`;
      const partes = [];
      if (c.totalAgregar) partes.push(`se publican ${plural(c.totalAgregar, 'hora', 'horas')}`);
      if (c.quitar.length) partes.push(`se quitan ${plural(c.quitar.length, 'hora', 'horas')}`);
      const quedan = horasEditor.filter((h) => marcadas.has(h) || delDia.get(h)?.cita).length;
      resumen.textContent = partes.length
        ? `${capitalizar(partes.join(' y '))}${dias}.` + (c.fechas.length === 1 ? ` El día queda con ${plural(quedan, 'hora', 'horas')}.` : '')
          + (c.conCita ? ` ${plural(c.conCita, 'hora con cita se conserva', 'horas con cita se conservan')}.` : '')
        : 'Sin cambios por guardar.';
    } catch (err) {
      if (turno === turnoResumen) resumen.textContent = err.message;
    }
  }
  otrosDias.addEventListener('change', actualizar);
  repetir.addEventListener('change', actualizar);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    boton.disabled = true;
    boton.textContent = 'Guardando…';
    let dias = 1;
    let agregadas = 0;
    let quitadas = 0;
    const fallos = [];
    try {
      const c = await calcularCambios();
      dias = c.fechas.length;
      if (!c.totalAgregar && !c.quitar.length) {
        dialogo.cerrar();
        return;
      }
      // Agrupa las fechas que reciben las mismas horas: una petición por grupo.
      const grupos = new Map();
      c.agregar.forEach((horas, f) => {
        const clave = horas.join(',');
        if (!grupos.has(clave)) grupos.set(clave, { horas, fechas: [] });
        grupos.get(clave).fechas.push(f);
      });
      for (const { horas, fechas } of grupos.values()) {
        await api(`/admin/especialistas/${especialista.id}/franjas`, { metodo: 'POST', cuerpo: { fechas, horas } });
        agregadas += horas.length * fechas.length;
      }
      // Quita de a cuatro a la vez; si alguna falla (p. ej., le acaban de agendar una cita) se informa.
      for (let i = 0; i < c.quitar.length; i += 4) {
        const lote = c.quitar.slice(i, i + 4);
        const resultados = await Promise.allSettled(lote.map((f) => api(`/admin/franjas/${f.id}`, { metodo: 'DELETE' })));
        resultados.forEach((r, j) => {
          if (r.status === 'fulfilled') quitadas += 1;
          else fallos.push(`${fechaCorta(lote[j].fecha)} ${horaLarga(lote[j].hora)}: ${r.reason.message}`);
        });
      }
    } catch (err) {
      error.textContent = err.campos ? Object.values(err.campos).join(' ') : err.message;
      error.hidden = false;
      boton.disabled = false;
      boton.textContent = 'Guardar horario';
      if (!agregadas && !quitadas) return;
    }

    const hechos = [];
    if (agregadas) hechos.push(`se publicaron ${plural(agregadas, 'hora', 'horas')}`);
    if (quitadas) hechos.push(`se quitaron ${plural(quitadas, 'hora', 'horas')}`);
    panel.aviso = el('div', { class: `alerta ${fallos.length ? '' : 'alerta--exito'}`, role: 'status' },
      el('p', { texto: `Horario de ${especialista.nombre} guardado: ${hechos.join(' y ')}${dias > 1 ? ` en ${plural(dias, 'día', 'días')}` : ''}.` }),
      fallos.length > 0 && el('p', { texto: `No se pudieron quitar ${plural(fallos.length, 'hora', 'horas')}: ${fallos.join(' · ')}` }));
    dialogo.cerrar();
    panel.refrescar();
  });

  pintarEn(cuerpo, form);
  actualizar();
  (form.querySelector('.hora-toggle:not(:disabled)') || boton).focus();
}
