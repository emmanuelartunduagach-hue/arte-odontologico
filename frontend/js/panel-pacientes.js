/* Panel de la secretaria · Pacientes e historia clínica.

   Un paciente es un registro sin usuario ni contraseña. Llega de dos formas:
   - por la web: su ficha se crea sola cuando la secretaria acepta su
     primera cita;
   - en persona: la secretaria lo registra aquí y le agenda la cita.

   Contrato API v2, sección 4:
     GET  /pacientes?q=                   lista y búsqueda
     POST /pacientes                      { nombres, apellidos, tipoDocumento, documento, telefono, telefonoFijo?,
                                            correo, motivoConsulta?, autorizacionDatos }
     GET  /pacientes/:id                  { paciente, citas, historia }
     POST /pacientes/:id/historia         { fechaAtencion, procedimiento, notas?, citaId? }
     POST /admin/historia/:id/correccion  { notas, procedimiento? }
     POST /admin/citas                    { pacienteId, especialidadId, franjaId }  (queda confirmada)
   Para agendar se usan el catálogo y el calendario públicos:
     GET /especialidades · /especialidades/:id/especialistas
     GET /especialistas/:id/calendario?mes= · /especialistas/:id/horas?fecha=

   La historia clínica no se edita ni se borra (Resolución 1995 de 1999):
   corregir es agregar una entrada nueva que apunta a la original. */

const pacientesPanel = {
  q: '',
  turno: 0,
  especialidades: null,   // GET /especialidades (para agendar)
};

const ORIGEN = { web: 'Pidió cita por la web', consultorio: 'Registrado en el consultorio' };

function montarPacientes(cuerpo, parametro) {
  if (parametro) return montarFicha(cuerpo, parametro);
  return montarLista(cuerpo);
}

/* ---------- Formularios (campos con su error) ---------- */

function campoForm(nombre, etiqueta, tipo = 'text', extra = {}) {
  const id = `pac-${nombre}`;
  const control = tipo === 'textarea'
    ? el('textarea', { class: 'campo__control', id, name: nombre, rows: '4', 'aria-describedby': `${id}-error`, ...extra })
    : el('input', { class: 'campo__control', id, name: nombre, type: tipo, 'aria-describedby': `${id}-error`, ...extra });
  return el('div', { class: 'campo' },
    el('label', { class: 'campo__etiqueta', for: id, texto: etiqueta }),
    control,
    el('p', { class: 'campo__error', id: `${id}-error`, hidden: true }));
}

function campoSelect(nombre, etiqueta, opciones, elegido) {
  const id = `pac-${nombre}`;
  return el('div', { class: 'campo' },
    el('label', { class: 'campo__etiqueta', for: id, texto: etiqueta }),
    el('select', { class: 'campo__control', id, name: nombre, 'aria-describedby': `${id}-error` },
      Object.entries(opciones).map(([valor, texto]) => el('option', { value: valor, selected: valor === elegido, texto }))),
    el('p', { class: 'campo__error', id: `${id}-error`, hidden: true }));
}

function limpiarErroresForm(form) {
  form.querySelectorAll('.campo__error').forEach((p) => { p.hidden = true; p.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
}

/** Muestra los errores por campo; devuelve los que no tienen campo. */
function mostrarErroresForm(form, campos) {
  const sueltos = [];
  let primero = null;
  for (const [nombre, mensaje] of Object.entries(campos || {})) {
    const control = form.elements[nombre];
    const aviso = form.querySelector(`#pac-${nombre}-error`);
    if (!control || !aviso) { sueltos.push(mensaje); continue; }
    aviso.textContent = mensaje;
    aviso.hidden = false;
    control.setAttribute('aria-invalid', 'true');
    primero = primero || control;
  }
  primero?.focus();
  return sueltos;
}

/* ---------- Lista ---------- */

function montarLista(cuerpo) {
  const resultados = el('div');
  const busqueda = el('form', { class: 'agenda__busqueda pacientes__busqueda', role: 'search' },
    el('input', { class: 'campo__control', type: 'search', name: 'q', value: pacientesPanel.q, 'aria-label': 'Buscar paciente',
      placeholder: 'Nombre, documento, celular o correo', autocomplete: 'off' }),
    el('button', { type: 'submit', class: 'btn btn--primario btn--compacto', texto: 'Buscar' }));
  busqueda.addEventListener('submit', (e) => {
    e.preventDefault();
    pacientesPanel.q = busqueda.q.value.trim();
    cargarLista(resultados);
  });

  pintarEn(cuerpo,
    avisoDemo(),
    encabezadoSeccion('Pacientes', 'Cada paciente tiene su ficha con citas e historia clínica.',
      el('button', { type: 'button', class: 'btn btn--primario btn--compacto', onclick: nuevoPaciente, texto: 'Registrar paciente' })),
    tomarAviso(),
    busqueda,
    resultados);
  cargarLista(resultados);
}

async function cargarLista(resultados) {
  const turno = ++pacientesPanel.turno;
  pintarEn(resultados, estadoCarga('Cargando pacientes…'));
  let lista;
  try {
    lista = await api(`/pacientes?${new URLSearchParams({ q: pacientesPanel.q })}`);
  } catch (err) {
    if (turno === pacientesPanel.turno) pintarEn(resultados, errorConReintento(err, () => cargarLista(resultados)));
    return;
  }
  if (turno !== pacientesPanel.turno) return;

  if (!lista.length) {
    pintarEn(resultados, el('div', { class: 'vacio' },
      el('p', { texto: pacientesPanel.q ? `No encontramos pacientes con «${pacientesPanel.q}».` : 'Aún no hay pacientes registrados.' }),
      el('button', { type: 'button', class: 'btn btn--secundario btn--compacto', onclick: nuevoPaciente, texto: 'Registrar paciente' })));
    return;
  }
  pintarEn(resultados,
    el('p', { class: 'agenda__conteo', role: 'status', texto: lista.length === 1 ? '1 paciente' : `${lista.length} pacientes` }),
    el('ul', { class: 'lista-filas lista-pacientes' }, lista.map((p) =>
      el('li', {},
        el('a', { class: 'fila-paciente-panel', href: `#pacientes/${p.id}` },
          el('span', { class: 'fila-paciente-panel__inicial', 'aria-hidden': 'true', texto: p.nombreCompleto.charAt(0).toUpperCase() }),
          el('span', { class: 'fila-paciente-panel__datos' },
            el('span', { class: 'fila-cita__nombre', texto: p.nombreCompleto }),
            el('span', { class: 'fila-cita__detalle', texto: `Doc. ${p.documento} · Cel. ${telefonoLegible(p.telefono)}` })),
          el('span', { class: 'fila-paciente-panel__origen', texto: p.origen === 'web' ? 'Web' : 'Consultorio' }))))));
}

/* ---------- Registrar paciente (llegó al consultorio) ---------- */

function nuevoPaciente() {
  const nodo = dialogo.abrir('Registrar paciente');
  const alerta = el('div', { class: 'alerta', role: 'alert', hidden: true });
  const form = el('form', { novalidate: true },
    el('p', { class: 'agendar__nota', texto: 'Para quien llega al consultorio sin haber pedido cita por la web. Después podrás agendarle su cita desde su ficha.' }),
    el('div', { class: 'rejilla-2' },
      campoForm('nombres', 'Nombres', 'text', { autocomplete: 'off' }),
      campoForm('apellidos', 'Apellidos', 'text', { autocomplete: 'off' })),
    el('div', { class: 'rejilla-2' },
      campoSelect('tipoDocumento', 'Tipo de documento', TIPOS_DOCUMENTO, 'CC'),
      campoForm('documento', 'Número de documento', 'text', { autocomplete: 'off' })),
    campoForm('correo', 'Correo electrónico', 'email', { autocomplete: 'off' }),
    el('div', { class: 'rejilla-2' },
      campoForm('telefono', 'Celular (WhatsApp)', 'tel', { placeholder: '300 123 4567', autocomplete: 'off' }),
      campoForm('telefonoFijo', 'Teléfono fijo (opcional)', 'tel', { placeholder: '608 837 0000', autocomplete: 'off' })),
    campoForm('motivoConsulta', 'Motivo de consulta (opcional)', 'textarea',
      { rows: '3', maxlength: '500', placeholder: 'Ej.: dolor en una muela, valoración para ortodoncia, limpieza…' }),
    el('div', { class: 'campo' },
      el('label', { class: 'casilla' },
        el('input', { type: 'checkbox', name: 'autorizacionDatos', 'aria-describedby': 'pac-autorizacionDatos-error' }),
        el('span', { texto: 'El paciente autorizó el tratamiento de sus datos personales (Ley 1581 de 2012).' })),
      el('p', { class: 'campo__error', id: 'pac-autorizacionDatos-error', hidden: true })),
    alerta,
    el('div', { class: 'acciones' },
      el('button', { type: 'submit', class: 'btn btn--primario', texto: 'Registrar' }),
      el('button', { type: 'button', class: 'btn btn--secundario', 'data-cerrar': true, texto: 'Cancelar' })));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = form.querySelector('[type="submit"]');
    limpiarErroresForm(form);
    alerta.hidden = true;
    boton.disabled = true;
    try {
      const r = await api('/pacientes', {
        metodo: 'POST',
        cuerpo: {
          nombres: form.nombres.value, apellidos: form.apellidos.value,
          tipoDocumento: form.tipoDocumento.value, documento: form.documento.value,
          telefono: form.telefono.value, telefonoFijo: form.telefonoFijo.value,
          correo: form.correo.value, motivoConsulta: form.motivoConsulta.value,
          autorizacionDatos: form.autorizacionDatos.checked,
        },
      });
      panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status', texto: `${r.paciente.nombreCompleto} quedó registrado. Ya puedes agendarle su cita.` });
      dialogo.cerrar();
      location.hash = `#pacientes/${r.paciente.id}`;
    } catch (err) {
      boton.disabled = false;
      const sueltos = mostrarErroresForm(form, err.campos);
      if (!err.campos || sueltos.length) {
        alerta.replaceChildren(sueltos.join(' ') || err.message);
        alerta.hidden = false;
      }
      if (err.datos?.pacienteId) {
        alerta.replaceChildren(err.message,
          el('div', { class: 'alerta__accion' },
            el('a', { class: 'btn btn--secundario btn--compacto', href: `#pacientes/${err.datos.pacienteId}`, texto: 'Abrir su ficha' })));
        alerta.hidden = false;
      }
    }
  });
  pintarEn(nodo, form);
  form.nombres.focus();
}

/* ---------- Ficha del paciente ---------- */

async function montarFicha(cuerpo, idTexto) {
  const aviso = tomarAviso();
  const volver = el('a', { class: 'btn btn--fantasma btn--compacto', href: '#pacientes', texto: '‹ Pacientes' });
  pintarEn(cuerpo, avisoDemo(), volver, aviso, estadoCarga('Cargando la ficha…'));

  let ficha;
  try {
    ficha = await api(`/pacientes/${encodeURIComponent(idTexto)}`);
  } catch (err) {
    pintarEn(cuerpo, avisoDemo(), volver, errorConReintento(err, panel.refrescar));
    return;
  }
  if (location.hash !== `#pacientes/${idTexto}`) return;
  const { paciente, citas, historia } = ficha;

  const hoy = hoyColombia();
  const proximas = citas.filter((c) => ['pendiente', 'confirmada'].includes(c.estado) && c.fecha >= hoy).reverse();
  const anteriores = citas.filter((c) => !proximas.includes(c));
  const citasConHistoria = new Set(historia.map((h) => h.citaId).filter(Boolean));

  pintarEn(cuerpo,
    avisoDemo(),
    volver,
    encabezadoSeccion(paciente.nombreCompleto,
      `${ORIGEN[paciente.origen] || 'Paciente'} · desde el ${fechaLarga(paciente.creadoEn.slice(0, 10))}`,
      el('button', { type: 'button', class: 'btn btn--primario btn--compacto', onclick: () => agendarParaPaciente(paciente), texto: 'Agendar cita' })),
    aviso,

    el('div', { class: 'ficha__rejilla' },
      el('section', { class: 'ficha__bloque', 'aria-labelledby': 'titulo-datos' },
        el('h2', { id: 'titulo-datos', class: 'bloque-panel__titulo', texto: 'Datos' }),
        el('dl', { class: 'resumen' },
          dato('Documento', `${paciente.tipoDocumento} ${paciente.documento}`),
          dato('Celular', telefonoLegible(paciente.telefono)),
          paciente.telefonoFijo && dato('Teléfono fijo', telefonoLegible(paciente.telefonoFijo)),
          dato('Correo', paciente.correo)),
        paciente.motivoConsulta && el('div', { class: 'ficha__motivo' },
          el('p', { class: 'ficha__motivo-titulo', texto: 'Motivo de consulta' }),
          el('p', { texto: paciente.motivoConsulta })),
        el('a', { class: 'btn btn--whatsapp btn--compacto', href: `https://wa.me/${paciente.telefono}`, target: '_blank', rel: 'noopener', texto: 'Escribir por WhatsApp' })),

      el('section', { class: 'ficha__bloque', 'aria-labelledby': 'titulo-citas' },
        el('h2', { id: 'titulo-citas', class: 'bloque-panel__titulo', texto: 'Citas' }),
        citas.length
          ? el('ul', { class: 'lista-filas lista-citas-ficha' },
            [...proximas, ...anteriores].map((c) => filaCitaFicha(c, paciente, !citasConHistoria.has(c.id))))
          : el('div', { class: 'vacio' }, el('p', { texto: 'Aún no tiene citas.' })))),

    el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-historia' },
      el('div', { class: 'bloque-panel__cabecera' },
        el('h2', { id: 'titulo-historia', class: 'bloque-panel__titulo', texto: 'Historia clínica' }),
        el('button', { type: 'button', class: 'btn btn--secundario btn--compacto', onclick: () => agregarEntrada(paciente, citas), texto: 'Agregar entrada' })),
      historia.length
        ? el('ol', { class: 'historia' }, historia.map((h) => entradaHistoria(h, historia, paciente, citas)))
        : el('div', { class: 'vacio' },
          el('p', { texto: 'Sin entradas todavía. Se van agregando después de cada cita atendida.' }))));
}

function filaCitaFicha(cita, paciente, sinEntrada) {
  return el('li', { class: 'fila-cita-ficha' },
    el('div', {},
      el('p', { class: 'fila-cita__nombre', texto: `${capitalizar(fechaLarga(cita.fecha))}, ${horaLarga(cita.hora)}` }),
      el('p', { class: 'fila-cita__detalle', texto: `${cita.especialidad} · ${cita.especialista}` })),
    el('div', { class: 'fila-cita-ficha__lado' },
      chipEstado(cita.estado),
      cita.estado === 'atendida' && sinEntrada && el('button', {
        type: 'button', class: 'btn btn--fantasma btn--compacto',
        onclick: () => agregarEntrada(paciente, [cita], cita), texto: 'Agregar a la historia',
      })));
}

function entradaHistoria(h, historia, paciente, citas) {
  const corregida = h.correcciones.length > 0;
  const original = h.corrigeA && historia.find((x) => x.id === h.corrigeA);
  return el('li', { class: 'nota-hc' + (corregida ? ' nota-hc--corregida' : '') },
    el('div', { class: 'nota-hc__cabecera' },
      el('p', { class: 'nota-hc__fecha', texto: capitalizar(fechaLarga(h.fechaAtencion)) }),
      corregida && el('span', { class: 'estado estado--no_asistio', texto: 'Corregida' }),
      h.corrigeA && el('span', { class: 'estado estado--atendida', texto: 'Corrección' })),
    el('p', { class: 'nota-hc__procedimiento', texto: h.procedimiento }),
    (h.especialidad || h.especialista) && el('p', { class: 'fila-cita__detalle', texto: [h.especialidad, h.especialista].filter(Boolean).join(' · ') }),
    original && el('p', { class: 'fila-cita__detalle', texto: `Corrige la entrada del ${fechaLarga(original.fechaAtencion)}.` }),
    h.notas && el('p', { class: 'nota-hc__notas', texto: h.notas }),
    el('div', { class: 'nota-hc__pie' },
      el('span', { class: 'fila-cita__detalle', texto: `Registró ${h.autor} el ${fechaLarga(h.creadoEn.slice(0, 10))}, ${horaLarga(h.creadoEn.slice(11, 16))}` }),
      !corregida && el('button', { type: 'button', class: 'btn btn--fantasma btn--compacto', onclick: () => corregirEntrada(h, paciente), texto: 'Corregir' })));
}

/* ---------- Historia: agregar y corregir ---------- */

function agregarEntrada(paciente, citas, citaElegida = null) {
  const nodo = dialogo.abrir('Agregar a la historia clínica');
  const atendidas = citas.filter((c) => c.estado === 'atendida');
  const alerta = el('p', { class: 'alerta', role: 'alert', hidden: true });

  const selectorCita = atendidas.length > 0 && el('div', { class: 'campo' },
    el('label', { class: 'campo__etiqueta', for: 'pac-citaId', texto: 'Cita (opcional)' }),
    el('select', { class: 'campo__control', id: 'pac-citaId', name: 'citaId' },
      el('option', { value: '', texto: 'Sin cita' }),
      atendidas.map((c) => el('option', { value: String(c.id), selected: citaElegida?.id === c.id,
        texto: `${fechaLarga(c.fecha)} · ${c.especialidad}` }))));

  const form = el('form', { novalidate: true },
    el('p', { class: 'agendar__nota', texto: `Paciente: ${paciente.nombreCompleto}. Las entradas no se pueden editar ni borrar; si algo queda mal, se agrega una corrección.` }),
    selectorCita,
    campoForm('fechaAtencion', 'Fecha de atención', 'date', { value: citaElegida?.fecha || hoyColombia(), max: hoyColombia() }),
    campoForm('procedimiento', 'Procedimiento', 'text', { placeholder: 'Ej.: Limpieza y control' }),
    campoForm('notas', 'Notas (opcional)', 'textarea'),
    alerta,
    el('div', { class: 'acciones' },
      el('button', { type: 'submit', class: 'btn btn--primario', texto: 'Guardar entrada' }),
      el('button', { type: 'button', class: 'btn btn--secundario', 'data-cerrar': true, texto: 'Cancelar' })));

  // Al elegir una cita, la fecha de atención es la de la cita.
  form.citaId?.addEventListener('change', () => {
    const c = atendidas.find((x) => String(x.id) === form.citaId.value);
    if (c) form.fechaAtencion.value = c.fecha;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = form.querySelector('[type="submit"]');
    limpiarErroresForm(form);
    alerta.hidden = true;
    boton.disabled = true;
    try {
      await api(`/pacientes/${paciente.id}/historia`, {
        metodo: 'POST',
        cuerpo: {
          citaId: form.citaId?.value ? Number(form.citaId.value) : null,
          fechaAtencion: form.fechaAtencion.value,
          procedimiento: form.procedimiento.value,
          notas: form.notas.value,
        },
      });
      panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status', texto: 'Entrada agregada a la historia clínica.' });
      dialogo.cerrar();
      panel.refrescar();
    } catch (err) {
      boton.disabled = false;
      const sueltos = mostrarErroresForm(form, err.campos);
      if (!err.campos || sueltos.length) { alerta.textContent = sueltos.join(' ') || err.message; alerta.hidden = false; }
    }
  });
  pintarEn(nodo, form);
  (form.citaId || form.procedimiento).focus();
}

function corregirEntrada(entrada, paciente) {
  const nodo = dialogo.abrir('Corregir entrada');
  const alerta = el('p', { class: 'alerta', role: 'alert', hidden: true });
  const form = el('form', { novalidate: true },
    el('dl', { class: 'resumen' },
      dato('Paciente', paciente.nombreCompleto),
      dato('Entrada', `${fechaLarga(entrada.fechaAtencion)} · ${entrada.procedimiento}`)),
    el('p', { class: 'agendar__nota', texto: 'La entrada original no se borra: queda marcada como corregida y la corrección se guarda como una entrada nueva.' }),
    campoForm('procedimiento', 'Procedimiento', 'text', { value: entrada.procedimiento }),
    campoForm('notas', 'Corrección: qué cambia y por qué', 'textarea'),
    alerta,
    el('div', { class: 'acciones' },
      el('button', { type: 'submit', class: 'btn btn--primario', texto: 'Guardar corrección' }),
      el('button', { type: 'button', class: 'btn btn--secundario', 'data-cerrar': true, texto: 'Cancelar' })));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = form.querySelector('[type="submit"]');
    limpiarErroresForm(form);
    alerta.hidden = true;
    boton.disabled = true;
    try {
      await api(`/admin/historia/${entrada.id}/correccion`, {
        metodo: 'POST',
        cuerpo: { procedimiento: form.procedimiento.value, notas: form.notas.value },
      });
      panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status', texto: 'Corrección guardada.' });
      dialogo.cerrar();
      panel.refrescar();
    } catch (err) {
      boton.disabled = false;
      const sueltos = mostrarErroresForm(form, err.campos);
      if (!err.campos || sueltos.length) { alerta.textContent = sueltos.join(' ') || err.message; alerta.hidden = false; }
    }
  });
  pintarEn(nodo, form);
  form.notas.focus();
}

/* ---------- Agendar cita a un paciente ----------
   Especialidad → especialista → día → hora → confirmar. Queda confirmada
   y al paciente le llega el WhatsApp con los datos y el enlace. */

async function agendarParaPaciente(paciente) {
  const nodo = dialogo.abrir('Agendar cita');
  const paso = {
    especialidad: null, especialistas: null, especialista: null,
    mes: hoyColombia().slice(0, 7), dias: null, fecha: null, horas: null, hora: null,
    error: null, enviando: false, turno: 0,
  };

  if (!pacientesPanel.especialidades) {
    pintarEn(nodo, estadoCarga('Cargando especialidades…'));
    try {
      pacientesPanel.especialidades = await api('/especialidades');
    } catch (err) {
      pintarEn(nodo, el('p', { class: 'alerta', role: 'alert', texto: err.message }));
      return;
    }
  }

  async function elegirEspecialidad(id) {
    const turno = ++paso.turno;
    Object.assign(paso, {
      especialidad: pacientesPanel.especialidades.find((e) => e.id === id) || null,
      especialistas: null, especialista: null, dias: null, fecha: null, horas: null, hora: null, error: null,
    });
    dibujar();
    if (!paso.especialidad) return;
    try {
      const lista = await api(`/especialidades/${id}/especialistas`);
      if (turno !== paso.turno) return;
      paso.especialistas = lista;
      if (lista.length === 1) return elegirEspecialista(lista[0].id);
    } catch (err) {
      if (turno !== paso.turno) return;
      paso.especialistas = [];
      paso.error = err.message;
    }
    dibujar();
  }

  function elegirEspecialista(id) {
    Object.assign(paso, {
      especialista: paso.especialistas.find((e) => e.id === id) || null,
      mes: hoyColombia().slice(0, 7), dias: null, fecha: null, horas: null, hora: null, error: null,
    });
    if (paso.especialista) cargarMes();
    else dibujar();
  }

  async function cargarMes() {
    const turno = ++paso.turno;
    paso.dias = null;
    dibujar();
    try {
      const r = await api(`/especialistas/${paso.especialista.id}/calendario?mes=${paso.mes}`);
      if (turno !== paso.turno) return;
      paso.dias = new Set(r.dias.map((d) => d.fecha));
    } catch (err) {
      if (turno !== paso.turno) return;
      paso.dias = new Set();
      paso.error = err.message;
    }
    dibujar();
  }

  async function elegirDia(fecha) {
    const turno = ++paso.turno;
    Object.assign(paso, { fecha, horas: null, hora: null, error: null });
    dibujar();
    try {
      const horas = await api(`/especialistas/${paso.especialista.id}/horas?fecha=${fecha}`);
      if (turno !== paso.turno) return;
      paso.horas = horas;
    } catch (err) {
      if (turno !== paso.turno) return;
      paso.horas = [];
      paso.error = err.message;
    }
    dibujar();
    nodo.querySelector('.hora')?.focus();
  }

  async function confirmar() {
    paso.enviando = true;
    paso.error = null;
    dibujar();
    try {
      const r = await api('/admin/citas', {
        metodo: 'POST',
        cuerpo: { pacienteId: paciente.id, especialidadId: paso.especialidad.id, franjaId: paso.hora.franjaId },
      });
      panel.aviso = avisoAccion(`Cita de ${paciente.nombreCompleto} agendada para el ${fechaLarga(r.cita.fecha)} a las ${horaLarga(r.cita.hora)}`, r.notificacion);
      dialogo.cerrar();
      panel.refrescar();
    } catch (err) {
      paso.enviando = false;
      paso.hora = null;
      if (err.estado === 409 && paso.fecha) await elegirDia(paso.fecha);
      paso.error = err.message;
      dibujar();
    }
  }

  function dibujar() {
    if (!dialogo.abierto()) return;
    const idPrevio = document.activeElement?.dataset?.idFoco;

    const selEspecialidad = el('select', { class: 'campo__control', id: 'agendar-especialidad', 'data-id-foco': 'especialidad' },
      el('option', { value: '', texto: 'Elige una especialidad' }),
      pacientesPanel.especialidades.map((e) => el('option', { value: String(e.id), selected: paso.especialidad?.id === e.id, texto: e.nombre })));
    selEspecialidad.addEventListener('change', () => elegirEspecialidad(Number(selEspecialidad.value)));

    let selEspecialista = null;
    if (paso.especialidad && paso.especialistas === null) {
      selEspecialista = estadoCarga('Cargando especialistas…');
    } else if (paso.especialidad && paso.especialistas.length === 0) {
      selEspecialista = el('p', { class: 'alerta', texto: 'No hay especialistas activos para esta especialidad.' });
    } else if (paso.especialistas?.length > 1) {
      const sel = el('select', { class: 'campo__control', id: 'agendar-especialista', 'data-id-foco': 'especialista' },
        el('option', { value: '', texto: 'Elige el especialista' }),
        paso.especialistas.map((e) => el('option', { value: String(e.id), selected: paso.especialista?.id === e.id, texto: e.nombre })));
      sel.addEventListener('change', () => elegirEspecialista(Number(sel.value)));
      selEspecialista = el('div', { class: 'campo' },
        el('label', { class: 'campo__etiqueta', for: 'agendar-especialista', texto: 'Especialista' }), sel);
    }

    pintarEn(nodo,
      el('p', { class: 'agendar__nota', texto: `Paciente: ${paciente.nombreCompleto} · Cel. ${telefonoLegible(paciente.telefono)}` }),
      el('div', { class: 'campo' },
        el('label', { class: 'campo__etiqueta', for: 'agendar-especialidad', texto: 'Especialidad' }), selEspecialidad),
      selEspecialista,
      paso.especialistas?.length === 1 && el('p', { class: 'agendar__nota', texto: `Especialista: ${paso.especialista?.nombre}` }),
      paso.error && el('p', { class: 'alerta', role: 'alert', texto: paso.error }),
      paso.hora
        ? [
          el('p', { class: 'reprogramar__nueva', texto: `${capitalizar(fechaLarga(paso.fecha))}, ${horaLarga(paso.hora.hora)} con ${paso.especialista.nombre}.` }),
          el('p', { class: 'agendar__nota', texto: 'La cita queda confirmada y al paciente le llega el WhatsApp con los datos y el enlace para reprogramar o cancelar.' }),
          el('div', { class: 'acciones' },
            el('button', { type: 'button', class: 'btn btn--primario', disabled: paso.enviando, 'data-id-foco': 'confirmar', onclick: confirmar,
              texto: paso.enviando ? 'Agendando…' : 'Agendar cita' }),
            el('button', { type: 'button', class: 'btn btn--secundario', disabled: paso.enviando,
              onclick: () => { paso.hora = null; dibujar(); }, texto: 'Elegir otra hora' })),
        ]
        : paso.especialista && [
          calendarioMes({
            mes: paso.mes, dias: paso.dias, fecha: paso.fecha, alElegirDia: elegirDia,
            alCambiarMes: (delta) => {
              const [a, m] = paso.mes.split('-').map(Number);
              const nuevo = new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 7);
              if (nuevo < hoyColombia().slice(0, 7)) return;
              Object.assign(paso, { mes: nuevo, fecha: null, horas: null, error: null });
              cargarMes();
            },
          }),
          paso.fecha && listaHoras({
            fecha: paso.fecha, horas: paso.horas,
            alElegirHora: (h) => { paso.hora = h; paso.error = null; dibujar(); nodo.querySelector('[data-id-foco="confirmar"]')?.focus(); },
          }),
        ]);

    if (idPrevio) nodo.querySelector(`[data-id-foco="${idPrevio}"]`)?.focus();
  }

  dibujar();
  nodo.querySelector('select')?.focus();
}
