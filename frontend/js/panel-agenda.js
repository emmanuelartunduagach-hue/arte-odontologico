/* Panel de la secretaria · Agenda (B-24 y B-25).

   Contrato API v2, sección 4 ("Agenda"):
     GET   /admin/citas?desde=&hasta=&especialistaId=&estado=&q=
     PATCH /admin/citas/:id/estado       { estado: atendida | no_asistio | cancelada }
     POST  /admin/citas/:id/reprogramar  { franjaId }  (sin límite; puede cambiar de especialista)
   Para reprogramar se usan el calendario y las horas públicas del especialista:
     GET /especialistas/:id/calendario?mes=   GET /especialistas/:id/horas?fecha=

   Atendida y no asistió solo se ofrecen cuando ya llegó la hora (el
   servidor lo exige igual). Los filtros se conservan al cambiar de sección. */

const agenda = {
  filtros: null,           // { desde, hasta, especialistaId, estado, q }
  especialistas: null,     // GET /admin/especialistas (para el filtro y para reprogramar)
  aviso: null,             // resultado de la última acción
  turno: 0,                // descarta respuestas de una búsqueda anterior
};

const ESTADOS_FILTRO = [
  ['', 'Todos'], ['confirmada', 'Confirmada'], ['atendida', 'Atendida'],
  ['no_asistio', 'No asistió'], ['cancelada', 'Cancelada'],
];

function filtrosIniciales() {
  const hoy = hoyColombia();
  return { desde: hoy, hasta: hoy, especialistaId: '', estado: '', q: '' };
}

function consultaAgenda(f) {
  const p = new URLSearchParams({ desde: f.desde, hasta: f.hasta });
  if (f.especialistaId) p.set('especialistaId', f.especialistaId);
  if (f.estado) p.set('estado', f.estado);
  if (f.q) p.set('q', f.q);
  return `/admin/citas?${p}`;
}

/* ---------- Sección ---------- */

async function montarAgenda(cuerpo) {
  agenda.filtros ??= filtrosIniciales();
  agenda.aviso = null;  // el aviso de una acción no sobrevive al cambio de sección
  const resultados = el('div', { class: 'agenda__resultados' });
  const avisos = el('div', { class: 'agenda__avisos' });

  pintarEn(cuerpo,
    avisoDemo(),
    el('h1', { class: 'gestion__titulo', tabindex: '-1', 'data-foco-seccion': true, texto: 'Agenda' }),
    formularioFiltros(),
    avisos,
    resultados);

  agenda.recargar = () => cargarAgenda(resultados, avisos);

  if (!agenda.especialistas) {
    try {
      agenda.especialistas = await api('/admin/especialistas');
      const select = cuerpo.querySelector('select[name="especialistaId"]');
      if (select) llenarEspecialistas(select);
    } catch { /* el filtro queda solo con "Todos"; la agenda carga igual */ }
  }
  agenda.recargar();
}

function formularioFiltros() {
  const f = agenda.filtros;
  const campo = (etiqueta, control) => el('label', { class: 'campo' }, el('span', { class: 'campo__etiqueta', texto: etiqueta }), control);

  const especialista = el('select', { class: 'campo__control', name: 'especialistaId' }, el('option', { value: '', texto: 'Todos' }));
  if (agenda.especialistas) llenarEspecialistas(especialista);

  const form = el('form', { class: 'filtros', role: 'search', 'aria-label': 'Filtrar la agenda' },
    campo('Desde', el('input', { class: 'campo__control', type: 'date', name: 'desde', value: f.desde, required: true })),
    campo('Hasta', el('input', { class: 'campo__control', type: 'date', name: 'hasta', value: f.hasta, required: true })),
    campo('Especialista', especialista),
    campo('Estado', el('select', { class: 'campo__control', name: 'estado' },
      ESTADOS_FILTRO.map(([valor, texto]) => el('option', { value: valor, selected: valor === f.estado, texto })))),
    campo('Paciente', el('input', { class: 'campo__control', type: 'search', name: 'q', value: f.q, placeholder: 'Nombre, documento o teléfono', autocomplete: 'off' })),
    el('div', { class: 'filtros__botones' },
      el('button', { type: 'submit', class: 'btn btn--primario', texto: 'Buscar' }),
      el('button', { type: 'button', class: 'btn btn--fantasma', onclick: () => rango(0), texto: 'Hoy' }),
      el('button', { type: 'button', class: 'btn btn--fantasma', onclick: () => rango(7), texto: 'Próximos 7 días' })));

  function rango(dias) {
    const hoy = hoyColombia();
    form.desde.value = hoy;
    form.hasta.value = sumarDiasA(hoy, dias);
    form.requestSubmit();
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let { desde, hasta } = { desde: form.desde.value, hasta: form.hasta.value };
    if (!desde) desde = hoyColombia();
    if (!hasta || hasta < desde) hasta = desde;
    form.desde.value = desde;
    form.hasta.value = hasta;
    agenda.filtros = { desde, hasta, especialistaId: form.especialistaId.value, estado: form.estado.value, q: form.q.value.trim() };
    agenda.aviso = null;
    agenda.recargar();
  });
  // Los menús filtran al cambiar; las fechas y el texto, con "Buscar".
  especialista.addEventListener('change', () => form.requestSubmit());
  form.estado.addEventListener('change', () => form.requestSubmit());
  return form;
}

function llenarEspecialistas(select) {
  pintarEn(select, el('option', { value: '', texto: 'Todos' }),
    agenda.especialistas.map((e) => el('option', {
      value: String(e.id), selected: String(e.id) === agenda.filtros.especialistaId,
      texto: e.activo ? e.nombre : `${e.nombre} (inactivo)`,
    })));
}

async function cargarAgenda(resultados, avisos) {
  const turno = ++agenda.turno;
  pintarEn(avisos, agenda.aviso);
  pintarEn(resultados, el('p', { class: 'estado-carga', role: 'status', texto: 'Cargando citas…' }));

  let citas;
  try {
    citas = await api(consultaAgenda(agenda.filtros));
  } catch (err) {
    if (turno !== agenda.turno) return;
    pintarEn(resultados,
      el('p', { class: 'alerta', role: 'alert', texto: err.message }),
      el('button', { type: 'button', class: 'btn btn--secundario', onclick: agenda.recargar, texto: 'Reintentar' }));
    return;
  }
  if (turno !== agenda.turno) return;

  if (!citas.length) {
    pintarEn(resultados, el('p', { class: 'gestion__intro', role: 'status', texto: 'No hay citas con estos filtros.' }));
    return;
  }

  // Agrupadas por día, en orden de hora.
  const porDia = new Map();
  [...citas].sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`))
    .forEach((c) => porDia.set(c.fecha, [...(porDia.get(c.fecha) || []), c]));

  pintarEn(resultados,
    el('p', { class: 'agenda__conteo', role: 'status', texto: citas.length === 1 ? '1 cita.' : `${citas.length} citas.` }),
    [...porDia].map(([fecha, delDia]) => [
      el('h2', { class: 'lista-citas__grupo', texto: fechaLarga(fecha) }),
      el('div', { class: 'lista-citas' }, delDia.map(tarjetaAgenda)),
    ]));
}

function tarjetaAgenda(cita) {
  const llegoLaHora = `${cita.fecha}T${cita.hora}` <= ahoraColombia();
  const viva = cita.estado === 'confirmada';
  const boton = (texto, clase, accion) => el('button', { type: 'button', class: `btn ${clase}`, onclick: accion, texto });

  return el('article', { class: 'cita' + (viva ? '' : ' cita--pasada'), 'aria-label': `${horaLarga(cita.hora)}, ${cita.paciente}` },
    el('div', { class: 'cita__cabecera' },
      el('h3', { class: 'cita__titulo', texto: `${horaLarga(cita.hora)} · ${cita.paciente}` }),
      chipEstado(cita.estado)),
    el('dl', { class: 'resumen' },
      dato('Especialista', `${cita.especialista} (${cita.especialidad})`),
      dato('Documento', cita.documento),
      dato('Teléfono', telefonoLegible(cita.telefono)),
      cita.correo && dato('Correo', cita.correo),
      cita.estado === 'cancelada' && cita.canceladaPor
        && dato('Cancelada por', cita.canceladaPor === 'paciente' ? 'El paciente' : 'El consultorio'),
      cita.reprogramaciones > 0 && dato('Reprogramada por el paciente', 'Sí')),
    viva && el('div', { class: 'acciones cita__acciones' },
      llegoLaHora && boton('Atendida', 'btn--primario', () => marcarCita(cita, 'atendida')),
      llegoLaHora && boton('No asistió', 'btn--secundario', () => marcarCita(cita, 'no_asistio')),
      boton('Reprogramar', 'btn--secundario', () => reprogramarCita(cita)),
      boton('Cancelar cita', 'btn--fantasma', () => cancelarCita(cita))));
}

/* ---------- Acciones ---------- */

function nombreCita(cita) {
  return `${cita.paciente}, ${fechaLarga(cita.fecha)} a las ${horaLarga(cita.hora)}`;
}

function marcarCita(cita, estado) {
  const atendida = estado === 'atendida';
  confirmarAccion({
    titulo: atendida ? '¿Marcar como atendida?' : '¿Marcar que no asistió?',
    texto: nombreCita(cita),
    si: atendida ? 'Sí, fue atendida' : 'Sí, no asistió',
    accion: async () => {
      const r = await api(`/admin/citas/${cita.id}/estado`, { metodo: 'PATCH', cuerpo: { estado } });
      agenda.aviso = avisoAccion(r.mensaje);
      agenda.recargar();
    },
  });
}

function cancelarCita(cita) {
  confirmarAccion({
    titulo: '¿Cancelar la cita?',
    texto: `${nombreCita(cita)}. La hora vuelve a quedar libre y se avisa al paciente por WhatsApp.`,
    si: 'Sí, cancelar la cita',
    no: 'No, conservarla',
    accion: async () => {
      const r = await api(`/admin/citas/${cita.id}/estado`, { metodo: 'PATCH', cuerpo: { estado: 'cancelada' } });
      agenda.aviso = avisoAccion(r.mensaje, r.notificacion);
      agenda.recargar();
    },
  });
}

/* Reprogramar: especialista (de la misma especialidad) → día → hora → confirmar. */
function reprogramarCita(cita) {
  const cuerpo = dialogo.abrir('Reprogramar cita');
  const candidatos = (agenda.especialistas || [])
    .filter((e) => e.activo && e.especialidades.some((s) => s.id === cita.especialidadId));
  if (!candidatos.some((e) => e.id === cita.especialistaId)) {
    candidatos.unshift({ id: cita.especialistaId, nombre: cita.especialista });
  }

  const estado = {
    especialistaId: cita.especialistaId,
    mes: hoyColombia().slice(0, 7),
    dias: null, fecha: null, horas: null, hora: null,
    error: null, enviando: false, turno: 0,
  };
  const especialistaElegido = () => candidatos.find((e) => e.id === estado.especialistaId);

  async function cargarMes() {
    const turno = ++estado.turno;
    estado.dias = null;
    pintar();
    try {
      const r = await api(`/especialistas/${estado.especialistaId}/calendario?mes=${estado.mes}`);
      if (turno !== estado.turno) return;
      estado.dias = new Set(r.dias.map((d) => d.fecha));
    } catch (err) {
      if (turno !== estado.turno) return;
      estado.dias = new Set();
      estado.error = err.message;
    }
    pintar();
  }

  async function elegirDia(fecha) {
    const turno = ++estado.turno;
    Object.assign(estado, { fecha, horas: null, hora: null, error: null });
    pintar();
    try {
      const horas = await api(`/especialistas/${estado.especialistaId}/horas?fecha=${fecha}`);
      if (turno !== estado.turno) return;
      estado.horas = horas;
    } catch (err) {
      if (turno !== estado.turno) return;
      estado.horas = [];
      estado.error = err.message;
    }
    pintar();
    cuerpo.querySelector('.hora')?.focus();
  }

  async function confirmar() {
    estado.enviando = true;
    estado.error = null;
    pintar();
    try {
      const r = await api(`/admin/citas/${cita.id}/reprogramar`, { metodo: 'POST', cuerpo: { franjaId: estado.hora.franjaId } });
      agenda.aviso = avisoAccion(`Cita de ${cita.paciente} reprogramada para el ${fechaLarga(r.cita.fecha)} a las ${horaLarga(r.cita.hora)} con ${r.cita.especialista}.`, r.notificacion);
      dialogo.cerrar();
      agenda.recargar();
    } catch (err) {
      estado.enviando = false;
      estado.error = err.message;
      // La hora pudo tomarse mientras tanto: se vuelven a pedir las del día.
      if (err.estado === 409 && estado.fecha) {
        estado.hora = null;
        const fallo = estado.error;
        await elegirDia(estado.fecha);
        estado.error = fallo;
      }
      pintar();
    }
  }

  function pintar() {
    if (!dialogo.abierto()) return;
    const idPrevio = document.activeElement?.dataset?.idFoco;
    const selector = el('select', { class: 'campo__control', name: 'especialista', 'data-id-foco': 'especialista' },
      candidatos.map((e) => el('option', { value: String(e.id), selected: e.id === estado.especialistaId, texto: e.nombre })));
    selector.addEventListener('change', () => {
      Object.assign(estado, { especialistaId: Number(selector.value), fecha: null, horas: null, hora: null, error: null });
      cargarMes();
    });

    pintarEn(cuerpo,
      el('dl', { class: 'resumen' },
        dato('Paciente', cita.paciente),
        dato('Cita actual', `${fechaLarga(cita.fecha)}, ${horaLarga(cita.hora)} · ${cita.especialista}`)),
      el('label', { class: 'campo' },
        el('span', { class: 'campo__etiqueta', texto: `Especialista (${cita.especialidad})` }),
        selector),
      estado.error && el('p', { class: 'alerta', role: 'alert', texto: estado.error }),
      estado.hora
        ? [
          el('p', { class: 'gestion__intro', texto: `Nueva hora: ${fechaLarga(estado.fecha)}, ${horaLarga(estado.hora.hora)} con ${especialistaElegido()?.nombre}.` }),
          el('div', { class: 'acciones' },
            el('button', { type: 'button', class: 'btn btn--primario', disabled: estado.enviando, 'data-id-foco': 'confirmar', onclick: confirmar,
              texto: estado.enviando ? 'Reprogramando…' : 'Confirmar nueva hora' }),
            el('button', { type: 'button', class: 'btn btn--secundario', disabled: estado.enviando,
              onclick: () => { estado.hora = null; pintar(); }, texto: 'Elegir otra hora' })),
        ]
        : [
          calendarioMes({
            mes: estado.mes, dias: estado.dias, fecha: estado.fecha,
            alElegirDia: elegirDia,
            alCambiarMes: (delta) => {
              const [a, m] = estado.mes.split('-').map(Number);
              const nuevo = new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 7);
              Object.assign(estado, { mes: nuevo, fecha: null, horas: null, error: null });
              cargarMes();
            },
          }),
          estado.fecha && listaHoras({
            fecha: estado.fecha, horas: estado.horas,
            alElegirHora: (h) => { estado.hora = h; pintar(); cuerpo.querySelector('[data-id-foco="confirmar"]')?.focus(); },
          }),
        ]);

    if (idPrevio) cuerpo.querySelector(`[data-id-foco="${idPrevio}"]`)?.focus();
  }

  cargarMes();
  cuerpo.querySelector('select')?.focus();
}
