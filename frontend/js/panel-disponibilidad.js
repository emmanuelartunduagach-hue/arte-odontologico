/* Panel de la secretaria · Disponibilidad (B-21, B-22 y B-23).

   La secretaria marca a mano las horas en que atiende cada especialista.
   Contrato API v2, sección 4 ("Disponibilidad"):
     GET    /admin/especialistas/:id/franjas?desde=&hasta=  → [{ id, fecha, hora, cita }]
     POST   /admin/especialistas/:id/franjas  { fechas: [...], horas: [...] }  → { total }
     DELETE /admin/franjas/:id   (409 si la hora tiene cita)

   Se ve una semana a la vez. "Publicar horas" abre un diálogo para elegir
   los días de la semana, cuántas semanas repetir y las horas; publica
   cada hora en cada día (así se "copia a varios días"). Una hora libre se
   quita con un clic; una hora con cita no se puede quitar. */

const disponibilidad = {
  especialistaId: null,
  lunes: null,            // lunes de la semana que se ve (AAAA-MM-DD)
  especialistas: null,    // solo activos
  turno: 0,
};

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Horas que se pueden publicar: de 7:00 a. m. a 7:00 p. m., cada 30 minutos.
const HORAS_PUBLICABLES = Array.from({ length: 25 }, (_, i) => {
  const minutos = 7 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
});

function lunesDe(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const diaSemana = (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;  // 0 = lunes
  return sumarDiasA(fecha, -diaSemana);
}

function fechaCorta(fecha) {
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)}.`;
}

/* ---------- Sección ---------- */

async function montarDisponibilidad(cuerpo) {
  disponibilidad.lunes ??= lunesDe(hoyColombia());
  const contenido = el('div', { class: 'disponibilidad__contenido' });

  pintarEn(cuerpo,
    avisoDemo(),
    encabezadoSeccion('Horarios de atención', 'Marca las horas en que atiende cada especialista. Solo esas horas aparecen para agendar.',
      el('button', { type: 'button', class: 'btn btn--primario', 'data-publicar': true, hidden: true, onclick: abrirPublicar, texto: 'Publicar horas' })),
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

  cuerpo.querySelector('[data-publicar]').hidden = false;
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

  const hoy = hoyColombia();
  const ahora = ahoraColombia();
  const libres = franjas.filter((f) => !f.cita).length;

  pintarEn(semana,
    el('p', { class: 'agenda__conteo', role: 'status', texto: franjas.length
      ? `${franjas.length} ${franjas.length === 1 ? 'hora publicada' : 'horas publicadas'} esta semana · ${libres} ${libres === 1 ? 'libre' : 'libres'}`
      : 'No hay horas publicadas esta semana. Usa «Publicar horas» para agregarlas.' }),
    el('div', { class: 'semana__rejilla' },
      DIAS_SEMANA.map((nombre, i) => {
        const fecha = sumarDiasA(lunes, i);
        const delDia = franjas.filter((f) => f.fecha === fecha);
        return el('section', { class: 'semana__dia' + (fecha < hoy ? ' semana__dia--pasado' : '') + (fecha === hoy ? ' semana__dia--hoy' : ''),
          'aria-label': `${nombre} ${fechaCorta(fecha)}` },
        el('h3', { class: 'semana__titulo' },
          el('span', { texto: nombre }), el('span', { class: 'semana__fecha', texto: fechaCorta(fecha) })),
        delDia.length
          ? el('ul', { class: 'semana__horas' }, delDia.map((f) => el('li', {}, chipHora(f, `${f.fecha}T${f.hora}` <= ahora))))
          : el('p', { class: 'semana__vacio', texto: 'Sin horas' }));
      })),
    el('p', { class: 'disponibilidad__leyenda' },
      el('span', { class: 'chip-hora chip-hora--libre', 'aria-hidden': 'true', texto: '8:00' }), ' libre (clic para quitarla)  ',
      el('span', { class: 'chip-hora chip-hora--ocupada', 'aria-hidden': 'true', texto: '9:00' }), ' con cita  ',
      el('span', { class: 'chip-hora chip-hora--pasada', 'aria-hidden': 'true', texto: '7:00' }), ' ya pasó'));
}

function chipHora(franja, pasada) {
  const texto = horaLarga(franja.hora);
  if (franja.cita) {
    return el('span', { class: 'chip-hora chip-hora--ocupada', title: `Cita de ${franja.cita.paciente}` },
      el('span', { texto }), el('span', { class: 'chip-hora__paciente', texto: franja.cita.paciente }));
  }
  if (pasada) return el('span', { class: 'chip-hora chip-hora--pasada', texto });
  return el('button', {
    type: 'button', class: 'chip-hora chip-hora--libre', 'aria-label': `Quitar la hora ${texto} del ${fechaLarga(franja.fecha)}`,
    onclick: () => quitarHora(franja), texto,
  });
}

function quitarHora(franja) {
  confirmarAccion({
    titulo: '¿Quitar esta hora?',
    texto: `${capitalizar(fechaLarga(franja.fecha))}, ${horaLarga(franja.hora)}. Los pacientes ya no podrán elegirla.`,
    si: 'Sí, quitarla',
    accion: async () => {
      await api(`/admin/franjas/${franja.id}`, { metodo: 'DELETE' });
      panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status', texto: `Se quitó la hora de las ${horaLarga(franja.hora)} del ${fechaLarga(franja.fecha)}.` });
      panel.refrescar();
    },
  });
}

/* ---------- Publicar horas ---------- */

function abrirPublicar() {
  const cuerpo = dialogo.abrir('Publicar horas');
  const especialista = disponibilidad.especialistas.find((e) => e.id === disponibilidad.especialistaId);
  const hoy = hoyColombia();
  const error = el('p', { class: 'alerta', role: 'alert', hidden: true });

  const dias = el('fieldset', { class: 'publicar__grupo' },
    el('legend', { class: 'campo__etiqueta', texto: 'Días' }),
    el('div', { class: 'publicar__opciones' },
      DIAS_SEMANA.map((nombre, i) => {
        const fecha = sumarDiasA(disponibilidad.lunes, i);
        return el('label', { class: 'casilla-opcion' },
          el('input', { type: 'checkbox', name: 'dia', value: String(i), checked: i < 5 && fecha >= hoy }),
          el('span', { texto: `${nombre.slice(0, 3)} ${fechaCorta(fecha)}` }));
      })));

  const repetir = el('select', { class: 'campo__control', name: 'semanas' },
    [[1, 'Solo esta semana'], [2, 'Esta semana y la siguiente'], [4, 'Las próximas 4 semanas'], [8, 'Las próximas 8 semanas']]
      .map(([n, texto]) => el('option', { value: String(n), texto })));

  const horas = el('div', { class: 'publicar__opciones publicar__opciones--horas' },
    HORAS_PUBLICABLES.map((h) => el('label', { class: 'casilla-opcion' },
      el('input', { type: 'checkbox', name: 'hora', value: h }),
      el('span', { texto: horaLarga(h) }))));
  const marcarHoras = (filtro) => horas.querySelectorAll('input').forEach((c) => { c.checked = filtro(c.value); });

  const resumen = el('p', { class: 'publicar__resumen', 'aria-live': 'polite' });
  const boton = el('button', { type: 'submit', class: 'btn btn--primario', texto: 'Publicar' });

  const form = el('form', { class: 'publicar', novalidate: true },
    el('p', { class: 'seccion-panel__subtitulo', texto: `${especialista.nombre}. Las horas que ya existían no se duplican.` }),
    dias,
    el('label', { class: 'campo' }, el('span', { class: 'campo__etiqueta', texto: 'Repetir' }), repetir),
    el('fieldset', { class: 'publicar__grupo' },
      el('legend', { class: 'campo__etiqueta', texto: 'Horas' }),
      el('div', { class: 'publicar__atajos' },
        el('button', { type: 'button', class: 'btn btn--fantasma btn--compacto', onclick: () => { marcarHoras((h) => h >= '08:00' && h < '12:00'); actualizar(); }, texto: 'Mañana (8 a 12)' }),
        el('button', { type: 'button', class: 'btn btn--fantasma btn--compacto', onclick: () => { marcarHoras((h) => h >= '14:00' && h < '18:00'); actualizar(); }, texto: 'Tarde (2 a 6)' }),
        el('button', { type: 'button', class: 'btn btn--fantasma btn--compacto', onclick: () => { marcarHoras((h) => (h >= '08:00' && h < '12:00') || (h >= '14:00' && h < '18:00')); actualizar(); }, texto: 'Día completo' }),
        el('button', { type: 'button', class: 'btn btn--fantasma btn--compacto', onclick: () => { marcarHoras(() => false); actualizar(); }, texto: 'Ninguna' })),
      horas),
    resumen,
    error,
    el('div', { class: 'acciones' }, boton, el('button', { type: 'button', class: 'btn btn--secundario', 'data-cerrar': true, texto: 'Cancelar' })));

  function elegidas() {
    const indices = [...form.querySelectorAll('input[name="dia"]:checked')].map((c) => Number(c.value));
    const semanas = Number(repetir.value);
    const fechas = [];
    for (let s = 0; s < semanas; s++) {
      indices.forEach((i) => {
        const fecha = sumarDiasA(disponibilidad.lunes, s * 7 + i);
        if (fecha >= hoy) fechas.push(fecha);
      });
    }
    const listaHoras = [...form.querySelectorAll('input[name="hora"]:checked')].map((c) => c.value);
    return { fechas, horas: listaHoras };
  }

  function actualizar() {
    const { fechas, horas: h } = elegidas();
    resumen.textContent = fechas.length && h.length
      ? `Se publicarán ${h.length} ${h.length === 1 ? 'hora' : 'horas'} en ${fechas.length} ${fechas.length === 1 ? 'día' : 'días'}.`
      : 'Elige al menos un día y una hora.';
  }
  form.addEventListener('change', actualizar);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { fechas, horas: h } = elegidas();
    if (!fechas.length || !h.length) {
      error.textContent = !fechas.length ? 'Elige al menos un día que no haya pasado.' : 'Elige al menos una hora.';
      error.hidden = false;
      return;
    }
    error.hidden = true;
    boton.disabled = true;
    boton.textContent = 'Publicando…';
    try {
      await api(`/admin/especialistas/${especialista.id}/franjas`, { metodo: 'POST', cuerpo: { fechas, horas: h } });
      panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status',
        texto: `Se publicaron ${h.length === 1 ? '1 hora' : `${h.length} horas`} en ${fechas.length === 1 ? '1 día' : `${fechas.length} días`} para ${especialista.nombre}.` });
      dialogo.cerrar();
      panel.refrescar();
    } catch (err) {
      error.textContent = err.campos ? Object.values(err.campos).join(' ') : err.message;
      error.hidden = false;
      boton.disabled = false;
      boton.textContent = 'Publicar';
    }
  });

  // Los días que ya pasaron no se pueden elegir.
  form.querySelectorAll('input[name="dia"]').forEach((c) => {
    if (sumarDiasA(disponibilidad.lunes, Number(c.value)) < hoy) {
      c.disabled = true;
      c.closest('.casilla-opcion').classList.add('casilla-opcion--inactiva');
    }
  });

  pintarEn(cuerpo, form);
  actualizar();
  form.querySelector('input:not(:disabled)')?.focus();
}
