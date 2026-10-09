/* Panel de la secretaria · Agenda (B-24 y B-25).

   Contrato API v2, sección 4 ("Agenda"):
     GET   /admin/citas?desde=&hasta=&especialistaId=&estado=&q=
     POST  /admin/citas/:id/aceptar      pendiente → confirmada (+ WhatsApp)
     POST  /admin/citas/:id/rechazar     pendiente → rechazada (+ WhatsApp)
     PATCH /admin/citas/:id/estado       { estado: atendida | no_asistio | cancelada }
     POST  /admin/citas/:id/reprogramar  { franjaId }  (sin límite; puede cambiar de especialista)
   Para reprogramar se usan el calendario y las horas públicas del especialista:
     GET /especialistas/:id/calendario?mes=   GET /especialistas/:id/horas?fecha=

   La agenda se ve por día (‹ Hoy ›). Al buscar un paciente se buscan sus
   citas de 3 meses atrás a 3 meses adelante. Atendida y no asistió solo
   se ofrecen cuando ya llegó la hora (el servidor lo exige igual). */

const agenda = {
  fecha: null,             // día que se está viendo
  especialistaId: '',
  estado: '',
  q: '',                   // búsqueda de paciente (cambia la vista a "resultados")
  especialistas: null,     // GET /admin/especialistas (filtro y reprogramar)
  turno: 0,                // descarta respuestas de una consulta anterior
};

const DIAS_BUSQUEDA = 90;

/* ---------- Fila de cita (también la usa Inicio) ---------- */

/** Acciones de una cita: la primera va a la vista y el resto, en "Más". */
function accionesDe(cita) {
  const llegoLaHora = `${cita.fecha}T${cita.hora}` <= ahoraColombia();
  if (cita.estado === 'pendiente') {
    return llegoLaHora
      ? [['Rechazar', () => rechazarCita(cita)]]
      : [['Aceptar', () => aceptarCita(cita)], ['Rechazar', () => rechazarCita(cita)], ['Cambiar hora', () => reprogramarCita(cita)]];
  }
  if (cita.estado !== 'confirmada') return [];
  return llegoLaHora
    ? [['Atendida', () => marcarCita(cita, 'atendida')], ['No asistió', () => marcarCita(cita, 'no_asistio')],
      ['Reprogramar', () => reprogramarCita(cita)], ['Cancelar cita', () => cancelarCita(cita)]]
    : [['Reprogramar', () => reprogramarCita(cita)], ['Cancelar cita', () => cancelarCita(cita)]];
}

function filaCita(cita, { conFecha = false } = {}) {
  const viva = ['pendiente', 'confirmada'].includes(cita.estado);
  const [h, m] = cita.hora.split(':').map(Number);
  const [principal, ...resto] = accionesDe(cita);
  const clases = 'fila-cita' + (viva ? '' : ' fila-cita--cerrada') + (cita.estado === 'pendiente' ? ' fila-cita--pendiente' : '');

  return el('article', { class: clases, 'aria-label': `${horaLarga(cita.hora)}, ${cita.paciente}` },
    el('div', { class: 'fila-cita__hora' },
      conFecha && el('span', { class: 'fila-cita__fecha', texto: fechaLarga(cita.fecha) }),
      el('span', { class: 'fila-cita__reloj', texto: `${h % 12 || 12}:${String(m).padStart(2, '0')}` }),
      el('span', { class: 'fila-cita__meridiano', texto: h >= 12 ? 'p. m.' : 'a. m.' })),
    el('div', { class: 'fila-cita__paciente' },
      cita.pacienteId
        ? el('a', { class: 'fila-cita__nombre', href: `#pacientes/${cita.pacienteId}`, title: 'Ver ficha del paciente', texto: cita.paciente })
        : el('p', { class: 'fila-cita__nombre', texto: cita.paciente }),
      el('p', { class: 'fila-cita__detalle' },
        el('span', { texto: `Doc. ${cita.documento}` }),
        el('span', { texto: `Tel. ${telefonoLegible(cita.telefono)}` }))),
    el('div', { class: 'fila-cita__especialista' },
      el('p', { texto: cita.especialista }),
      el('p', { class: 'fila-cita__detalle', texto: cita.especialidad })),
    el('div', { class: 'fila-cita__estado' },
      chipEstado(cita.estado),
      cita.estado === 'cancelada' && cita.canceladaPor
        && el('span', { class: 'fila-cita__detalle', texto: cita.canceladaPor === 'paciente' ? 'por el paciente' : 'por el consultorio' })),
    el('div', { class: 'fila-cita__acciones' },
      principal && el('button', {
        type: 'button', class: `btn ${['Atendida', 'Aceptar'].includes(principal[0]) ? 'btn--primario' : 'btn--secundario'} btn--compacto`,
        onclick: principal[1], texto: principal[0],
      }),
      resto.length > 0 && el('details', { class: 'menu-acciones' },
        el('summary', { class: 'btn btn--fantasma btn--compacto', 'aria-label': `Más acciones para ${cita.paciente}`, texto: 'Más' }),
        el('div', { class: 'menu-acciones__lista' },
          resto.map(([texto, accion]) => el('button', { type: 'button', onclick: accion, texto }))))));
}

function listaCitas(citas, opciones) {
  return el('div', { class: 'lista-filas' }, citas.map((c) => filaCita(c, opciones)));
}

function ordenarPorHora(citas) {
  return [...citas].sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
}

/* ---------- Sección ---------- */

async function montarAgenda(cuerpo) {
  agenda.fecha ??= hoyColombia();
  const resultados = el('div', { class: 'agenda__resultados' });

  pintarEn(cuerpo,
    avisoDemo(),
    encabezadoSeccion('Agenda'),
    tomarAviso(),
    barraAgenda(),
    resultados);

  if (!agenda.especialistas) {
    try {
      agenda.especialistas = await api('/admin/especialistas');
      const select = cuerpo.querySelector('select[name="especialistaId"]');
      if (select) llenarEspecialistas(select);
    } catch { /* el filtro queda solo con "Todos"; la agenda carga igual */ }
  }
  cargarAgenda(resultados);
}

function barraAgenda() {
  const hoy = hoyColombia();
  const ir = (fecha) => { agenda.fecha = fecha; agenda.q = ''; panel.refrescar(); };

  const navegacion = el('div', { class: 'agenda__dia' },
    el('button', { type: 'button', class: 'btn btn--secundario btn--icono', 'aria-label': 'Día anterior', onclick: () => ir(sumarDiasA(agenda.fecha, -1)) },
      icono('<path d="m15 18-6-6 6-6"/>')),
    el('button', { type: 'button', class: 'btn btn--secundario btn--compacto', disabled: agenda.fecha === hoy && !agenda.q, onclick: () => ir(hoy), texto: 'Hoy' }),
    el('button', { type: 'button', class: 'btn btn--secundario btn--icono', 'aria-label': 'Día siguiente', onclick: () => ir(sumarDiasA(agenda.fecha, 1)) },
      icono('<path d="m9 18 6-6-6-6"/>')),
    el('label', { class: 'agenda__ir-fecha' },
      el('span', { class: 'sr-only', texto: 'Ir a una fecha' }),
      el('input', { class: 'campo__control', type: 'date', value: agenda.fecha, onchange: (e) => e.target.value && ir(e.target.value) })));

  const especialista = el('select', { class: 'campo__control', name: 'especialistaId', 'aria-label': 'Especialista' },
    el('option', { value: '', texto: 'Todos los especialistas' }));
  if (agenda.especialistas) llenarEspecialistas(especialista);
  especialista.addEventListener('change', () => { agenda.especialistaId = especialista.value; panel.refrescar(); });

  const estado = el('select', { class: 'campo__control', name: 'estado', 'aria-label': 'Estado' },
    [['', 'Todos los estados'], ['pendiente', 'Por confirmar'], ['confirmada', 'Confirmadas'], ['atendida', 'Atendidas'],
      ['no_asistio', 'No asistió'], ['cancelada', 'Canceladas'], ['rechazada', 'Rechazadas']]
      .map(([valor, texto]) => el('option', { value: valor, selected: valor === agenda.estado, texto })));
  estado.addEventListener('change', () => { agenda.estado = estado.value; panel.refrescar(); });

  const busqueda = el('form', { class: 'agenda__busqueda', role: 'search' },
    el('input', { class: 'campo__control', type: 'search', name: 'q', value: agenda.q, 'aria-label': 'Buscar paciente',
      placeholder: 'Buscar paciente: nombre, documento o teléfono', autocomplete: 'off' }),
    el('button', { type: 'submit', class: 'btn btn--primario btn--compacto', texto: 'Buscar' }));
  busqueda.addEventListener('submit', (e) => {
    e.preventDefault();
    agenda.q = busqueda.q.value.trim();
    panel.refrescar();
  });

  return el('div', { class: 'agenda__barra' },
    navegacion,
    el('div', { class: 'agenda__filtros' }, especialista, estado),
    busqueda);
}

function llenarEspecialistas(select) {
  pintarEn(select, el('option', { value: '', texto: 'Todos los especialistas' }),
    agenda.especialistas.map((e) => el('option', {
      value: String(e.id), selected: String(e.id) === agenda.especialistaId,
      texto: e.activo ? e.nombre : `${e.nombre} (inactivo)`,
    })));
}

async function cargarAgenda(resultados) {
  const turno = ++agenda.turno;
  const buscando = Boolean(agenda.q);
  const p = buscando
    ? new URLSearchParams({ desde: sumarDiasA(hoyColombia(), -DIAS_BUSQUEDA), hasta: sumarDiasA(hoyColombia(), DIAS_BUSQUEDA), q: agenda.q })
    : new URLSearchParams({ fecha: agenda.fecha });
  if (agenda.especialistaId) p.set('especialistaId', agenda.especialistaId);
  if (agenda.estado) p.set('estado', agenda.estado);

  pintarEn(resultados, estadoCarga('Cargando citas…'));
  let citas;
  try {
    citas = await api(`/admin/citas?${p}`);
  } catch (err) {
    if (turno === agenda.turno) pintarEn(resultados, errorConReintento(err, () => cargarAgenda(resultados)));
    return;
  }
  if (turno !== agenda.turno) return;

  const confirmadas = citas.filter((c) => c.estado === 'confirmada').length;
  const porConfirmar = citas.filter((c) => c.estado === 'pendiente').length;
  const resumen = citas.length === 0 ? null
    : [citas.length === 1 ? '1 cita' : `${citas.length} citas`,
      confirmadas === 1 ? '1 confirmada' : `${confirmadas} confirmadas`,
      porConfirmar > 0 && `${porConfirmar} por confirmar`].filter(Boolean).join(' · ');

  pintarEn(resultados,
    el('div', { class: 'agenda__titulo-lista' },
      el('h2', { texto: buscando ? `Resultados para «${agenda.q}»` : capitalizar(fechaLarga(agenda.fecha)) }),
      resumen && el('p', { class: 'agenda__conteo', role: 'status', texto: resumen }),
      buscando && el('button', { type: 'button', class: 'btn btn--fantasma btn--compacto', onclick: () => { agenda.q = ''; panel.refrescar(); }, texto: 'Limpiar búsqueda' })),
    citas.length
      ? listaCitas(ordenarPorHora(citas), { conFecha: buscando })
      : el('div', { class: 'vacio' },
        el('p', { texto: buscando ? 'No encontramos citas de ese paciente en los últimos y próximos 3 meses.' : 'No hay citas este día.' }),
        !buscando && agenda.fecha !== hoyColombia()
          && el('button', { type: 'button', class: 'btn btn--secundario btn--compacto', onclick: () => { agenda.fecha = hoyColombia(); panel.refrescar(); }, texto: 'Volver a hoy' })));
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
      panel.aviso = avisoAccion(r.mensaje);
      panel.refrescar();
    },
  });
}

/* Aceptar: un clic. La cita queda confirmada, se crea la ficha del
   paciente si no existía y se prepara el WhatsApp con el enlace. */
async function aceptarCita(cita) {
  const boton = document.activeElement?.tagName === 'BUTTON' ? document.activeElement : null;
  if (boton) { boton.disabled = true; boton.textContent = 'Aceptando…'; }
  try {
    const r = await api(`/admin/citas/${cita.id}/aceptar`, { metodo: 'POST' });
    panel.aviso = avisoAccion(`Cita de ${cita.paciente} aceptada para el ${fechaLarga(cita.fecha)} a las ${horaLarga(cita.hora)}`
      + (r.pacienteNuevo ? ' Se creó su ficha de paciente.' : ''), r.notificacion);
  } catch (err) {
    panel.aviso = el('p', { class: 'alerta', role: 'alert', texto: err.message });
  }
  panel.refrescar();
  actualizarContadorMensajes();
}

function rechazarCita(cita) {
  confirmarAccion({
    titulo: '¿Rechazar la solicitud?',
    texto: `${nombreCita(cita)}. La hora queda libre y se le avisa por WhatsApp que pida otra hora.`,
    si: 'Sí, rechazar',
    no: 'Volver',
    accion: async () => {
      const r = await api(`/admin/citas/${cita.id}/rechazar`, { metodo: 'POST' });
      panel.aviso = avisoAccion(`Solicitud de ${cita.paciente} rechazada.`, r.notificacion);
      panel.refrescar();
      actualizarContadorMensajes();
    },
  });
}

function cancelarCita(cita) {
  confirmarAccion({
    titulo: '¿Cancelar la cita?',
    texto: `${nombreCita(cita)}. La hora vuelve a quedar libre y se le avisa al paciente por WhatsApp.`,
    si: 'Sí, cancelar la cita',
    no: 'No, conservarla',
    accion: async () => {
      const r = await api(`/admin/citas/${cita.id}/estado`, { metodo: 'PATCH', cuerpo: { estado: 'cancelada' } });
      panel.aviso = avisoAccion(`Cita de ${cita.paciente} cancelada.`, r.notificacion);
      panel.refrescar();
      actualizarContadorMensajes();
    },
  });
}

/* Reprogramar: especialista (de la misma especialidad) → día → hora → confirmar. */
async function reprogramarCita(cita) {
  const cuerpo = dialogo.abrir('Reprogramar cita');
  if (!agenda.especialistas) {
    pintarEn(cuerpo, estadoCarga('Cargando especialistas…'));
    try { agenda.especialistas = await api('/admin/especialistas'); } catch { agenda.especialistas = []; }
  }
  const candidatos = agenda.especialistas
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
      panel.aviso = avisoAccion(`Cita de ${cita.paciente} movida al ${fechaLarga(r.cita.fecha)} a las ${horaLarga(r.cita.hora)} con ${r.cita.especialista}.`, r.notificacion);
      dialogo.cerrar();
      panel.refrescar();
      actualizarContadorMensajes();
    } catch (err) {
      estado.enviando = false;
      // La hora pudo tomarse mientras tanto: se vuelven a pedir las del día.
      if (err.estado === 409 && estado.fecha) {
        await elegirDia(estado.fecha);
      }
      estado.error = err.message;
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
          el('p', { class: 'reprogramar__nueva', texto: `Nueva hora: ${fechaLarga(estado.fecha)}, ${horaLarga(estado.hora.hora)} con ${especialistaElegido()?.nombre}.` }),
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
