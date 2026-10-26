function actualizarContadorSolicitudes(total) {
  document.querySelectorAll('[data-contador-solicitudes]').forEach((nodo) => {
    nodo.textContent = String(total);
    nodo.hidden = total === 0;
    nodo.setAttribute('aria-label', total === 1 ? '1 por aprobar' : `${total} por aprobar`);
  });
}

function fechaHoraCorta(texto) {
  return texto ? `${fechaLarga(texto.slice(0, 10))}, ${horaLarga(texto.slice(11, 16))}` : '';
}

const POR_PAGINA_SOLICITUDES = 8;
const POR_PAGINA_EQUIPO = 15;
const paginasSuperadmin = { correcciones: { pagina: 1 }, anulaciones: { pagina: 1 }, equipo: { pagina: 1 } };

async function montarSolicitudes(destino) {
  const encabezado = encabezadoSeccion('Solicitudes',
    'Cambios a la historia clínica que pidieron los administradores. Solo quedan en la historia si los apruebas.');
  const aviso = tomarAviso();
  pintarEn(destino, avisoDemo(), encabezado, aviso, estadoCarga('Cargando solicitudes…'));

  let datos;
  try {
    datos = await api('/superadmin/solicitudes');
  } catch (err) {
    pintarEn(destino, avisoDemo(), encabezado, aviso, errorConReintento(err, panel.refrescar));
    return;
  }
  if (seccionActual() !== 'solicitudes') return;
  const { correcciones, anulaciones } = datos;
  actualizarContadorSolicitudes(correcciones.length + anulaciones.length);

  pintarEn(destino, avisoDemo(), encabezado, aviso,
    el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-correcciones' },
      el('h2', { id: 'titulo-correcciones', class: 'bloque-panel__titulo',
        texto: `Correcciones de la historia clínica (${correcciones.length})` }),
      correcciones.length
        ? listaPaginada(correcciones, {
          porPagina: POR_PAGINA_SOLICITUDES, estado: paginasSuperadmin.correcciones, nombre: 'correcciones',
          contenedor: (filas) => el('ul', { class: 'solicitudes' }, filas), fila: tarjetaCorreccion,
        })
        : el('div', { class: 'vacio' }, el('p', { texto: 'No hay correcciones por aprobar.' }))),

    el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-anulaciones' },
      el('h2', { id: 'titulo-anulaciones', class: 'bloque-panel__titulo',
        texto: `Anulaciones del odontograma (${anulaciones.length})` }),
      anulaciones.length
        ? listaPaginada(anulaciones, {
          porPagina: POR_PAGINA_SOLICITUDES, estado: paginasSuperadmin.anulaciones, nombre: 'anulaciones',
          contenedor: (filas) => el('ul', { class: 'solicitudes' }, filas), fila: tarjetaAnulacion,
        })
        : el('div', { class: 'vacio' }, el('p', { texto: 'No hay anulaciones por aprobar.' }))));
}

function botonesDecision(alAprobar, alRechazar) {
  return el('div', { class: 'acciones solicitud__acciones' },
    el('button', { type: 'button', class: 'btn btn--primario btn--compacto', onclick: alAprobar, texto: 'Aprobar' }),
    el('button', { type: 'button', class: 'btn btn--secundario btn--compacto', onclick: alRechazar, texto: 'Rechazar' }));
}

function tarjetaCorreccion(c) {
  const cambioProcedimiento = c.procedimiento !== c.procedimientoOriginal;
  return el('li', { class: 'solicitud' },
    el('div', { class: 'solicitud__cabecera' },
      el('a', { class: 'solicitud__paciente', href: `#pacientes/${c.pacienteId}`, texto: c.paciente }),
      el('span', { class: 'fila-cita__detalle', texto: `Pidió ${c.autor} · ${fechaHoraCorta(c.creadoEn)}` })),
    el('div', { class: 'solicitud__comparacion' },
      el('div', { class: 'solicitud__lado' },
        el('p', { class: 'solicitud__rotulo', texto: 'Entrada original' }),
        el('p', { class: 'nota-hc__fecha', texto: capitalizar(fechaLarga(c.fechaOriginal)) }),
        el('p', { class: 'nota-hc__procedimiento', texto: c.procedimientoOriginal }),
        c.notasOriginal && el('p', { class: 'nota-hc__notas', texto: c.notasOriginal })),
      el('div', { class: 'solicitud__lado solicitud__lado--nuevo' },
        el('p', { class: 'solicitud__rotulo', texto: 'Corrección pedida' }),
        el('p', { class: 'nota-hc__procedimiento', texto: cambioProcedimiento ? c.procedimiento : `${c.procedimiento} (sin cambio)` }),
        c.notas && el('p', { class: 'nota-hc__notas', texto: c.notas }))),
    botonesDecision(
      () => confirmarAccion({
        titulo: '¿Aprobar la corrección?',
        texto: `La corrección pasa a la historia clínica de ${c.paciente} y la entrada original queda marcada como corregida.`,
        si: 'Aprobar', accion: async () => {
          await api(`/superadmin/solicitudes/historia/${c.id}/aprobar`, { metodo: 'POST' });
          panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status', texto: 'Corrección aprobada.' });
          panel.refrescar();
        },
      }),
      () => rechazarSolicitud(`/superadmin/solicitudes/historia/${c.id}/rechazar`, 'Rechazar la corrección',
        `La entrada original de ${c.paciente} queda como está. La corrección rechazada se guarda con tu motivo.`, 'Corrección rechazada.')));
}

function tarjetaAnulacion(a) {
  return el('li', { class: 'solicitud' },
    el('div', { class: 'solicitud__cabecera' },
      el('a', { class: 'solicitud__paciente', href: `#pacientes/${a.pacienteId}`, texto: a.paciente }),
      el('span', { class: 'fila-cita__detalle', texto: `Pidió ${a.anulacionPedidaPor} · ${fechaHoraCorta(a.anulacionPedidaEn)}` })),
    el('dl', { class: 'resumen' },
      dato('Hallazgo', `Diente ${a.diente} · ${nombreCara(a.cara)} · ${nombreHallazgo(a.hallazgo)} (${a.estado === 'realizado' ? 'realizado' : 'por hacer'})`),
      dato('Registró', `${a.autor} · ${fechaHoraCorta(a.creadoEn)}`),
      dato('Motivo para anular', a.anulacionMotivo)),
    botonesDecision(
      () => confirmarAccion({
        titulo: '¿Aprobar la anulación?',
        texto: `El hallazgo deja de aparecer en el odontograma de ${a.paciente}. No se borra: queda en el historial como anulado.`,
        si: 'Aprobar', accion: async () => {
          await api(`/superadmin/solicitudes/odontograma/${a.id}/aprobar`, { metodo: 'POST' });
          panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status', texto: 'Anulación aprobada.' });
          panel.refrescar();
        },
      }),
      () => rechazarSolicitud(`/superadmin/solicitudes/odontograma/${a.id}/rechazar`, 'Rechazar la anulación',
        'El hallazgo sigue vigente en el odontograma. Tu motivo queda registrado.', 'Anulación rechazada.')));
}

function rechazarSolicitud(ruta, titulo, explicacion, mensajeExito) {
  const nodo = dialogo.abrir(titulo);
  const alerta = el('p', { class: 'alerta', role: 'alert', hidden: true });
  const form = el('form', { novalidate: true },
    el('p', { class: 'agendar__nota', texto: explicacion }),
    campoForm('motivo', 'Motivo del rechazo', 'textarea', { maxlength: '300' }),
    alerta,
    el('div', { class: 'acciones' },
      el('button', { type: 'submit', class: 'btn btn--primario', texto: 'Rechazar' }),
      el('button', { type: 'button', class: 'btn btn--secundario', 'data-cerrar': true, texto: 'Volver' })));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = form.querySelector('[type="submit"]');
    limpiarErroresForm(form);
    alerta.hidden = true;
    boton.disabled = true;
    try {
      await api(ruta, { metodo: 'POST', cuerpo: { motivo: form.motivo.value } });
      panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status', texto: mensajeExito });
      dialogo.cerrar();
      panel.refrescar();
    } catch (err) {
      boton.disabled = false;
      const sueltos = mostrarErroresForm(form, err.campos);
      if (!err.campos || sueltos.length) { alerta.textContent = sueltos.join(' ') || err.message; alerta.hidden = false; }
    }
  });
  pintarEn(nodo, form);
  form.motivo.focus();
}

async function montarEquipo(destino) {
  const encabezado = encabezadoSeccion('Equipo',
    'Las personas que administran el consultorio. Tú decides quién entra al panel.',
    el('button', { type: 'button', class: 'btn btn--primario btn--compacto', onclick: () => formularioAdministrador(), texto: 'Agregar administrador' }));
  const aviso = tomarAviso();
  pintarEn(destino, avisoDemo(), encabezado, aviso, estadoCarga('Cargando el equipo…'));

  let lista;
  try {
    lista = await api('/superadmin/administradores');
  } catch (err) {
    pintarEn(destino, avisoDemo(), encabezado, aviso, errorConReintento(err, panel.refrescar));
    return;
  }
  if (seccionActual() !== 'equipo') return;

  pintarEn(destino, avisoDemo(), encabezado, aviso,
    lista.length
      ? listaPaginada(lista, {
        porPagina: POR_PAGINA_EQUIPO, estado: paginasSuperadmin.equipo, nombre: 'el equipo',
        contenedor: (filas) => el('ul', { class: 'lista-filas equipo' }, filas), fila: filaAdministrador,
      })
      : el('div', { class: 'vacio' }, el('p', { texto: 'Aún no hay administradores.' })));
}

function filaAdministrador(a) {
  const estado = !a.activo ? ['Desactivado', 'cancelada']
    : a.debeCambiarContrasena ? ['Clave temporal', 'pendiente'] : ['Activo', 'confirmada'];
  return el('li', { class: 'fila-equipo' + (a.activo ? '' : ' fila-equipo--inactivo') },
    el('span', { class: 'fila-paciente-panel__inicial', 'aria-hidden': 'true', texto: a.nombreCompleto.charAt(0).toUpperCase() }),
    el('div', { class: 'fila-equipo__datos' },
      el('p', { class: 'fila-cita__nombre', texto: a.nombreCompleto }),
      el('p', { class: 'fila-cita__detalle', texto: `${a.correo} · Cel. ${telefonoLegible(a.telefono)} · Doc. ${a.documento}` })),
    el('span', { class: `estado estado--${estado[1]}`, texto: estado[0] }),
    el('details', { class: 'menu-acciones' },
      el('summary', { class: 'btn btn--fantasma btn--compacto', 'aria-label': `Acciones para ${a.nombreCompleto}`, texto: 'Opciones' }),
      el('div', { class: 'menu-acciones__lista' },
        el('button', { type: 'button', onclick: () => formularioAdministrador(a), texto: 'Editar datos' }),
        el('button', { type: 'button', onclick: () => restablecerClave(a), texto: 'Nueva clave temporal' }),
        el('button', { type: 'button', onclick: () => cambiarActivo(a), texto: a.activo ? 'Desactivar' : 'Activar' }),
        el('button', { type: 'button', class: 'menu-acciones__peligro', onclick: () => eliminarAdministrador(a), texto: 'Eliminar' }))));
}

function formularioAdministrador(admin = null) {
  const nodo = dialogo.abrir(admin ? 'Editar administrador' : 'Agregar administrador');
  const alerta = el('p', { class: 'alerta', role: 'alert', hidden: true });
  const form = el('form', { novalidate: true },
    !admin && el('p', { class: 'agendar__nota', texto: 'Al guardar verás una contraseña temporal. Entrégasela a la persona: la cambia la primera vez que ingrese.' }),
    campoForm('nombreCompleto', 'Nombre completo', 'text', { value: admin?.nombreCompleto || '', autocomplete: 'off' }),
    el('div', { class: 'rejilla-2' },
      campoForm('documento', 'Documento', 'text', { value: admin?.documento || '', inputmode: 'numeric', autocomplete: 'off' }),
      campoForm('telefono', 'Celular', 'tel', { value: admin ? telefonoLegible(admin.telefono) : '', autocomplete: 'off' })),
    campoForm('correo', 'Correo (con este ingresa)', 'email', { value: admin?.correo || '', autocomplete: 'off' }),
    alerta,
    el('div', { class: 'acciones' },
      el('button', { type: 'submit', class: 'btn btn--primario', texto: admin ? 'Guardar cambios' : 'Agregar' }),
      el('button', { type: 'button', class: 'btn btn--secundario', 'data-cerrar': true, texto: 'Cancelar' })));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = form.querySelector('[type="submit"]');
    limpiarErroresForm(form);
    alerta.hidden = true;
    boton.disabled = true;
    const cuerpo = {
      nombreCompleto: form.nombreCompleto.value, documento: form.documento.value,
      telefono: form.telefono.value, correo: form.correo.value,
    };
    try {
      if (admin) {
        await api(`/superadmin/administradores/${admin.id}`, { metodo: 'PATCH', cuerpo });
        panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status', texto: 'Datos actualizados.' });
        dialogo.cerrar();
        panel.refrescar();
      } else {
        const r = await api('/superadmin/administradores', { metodo: 'POST', cuerpo });
        mostrarClaveTemporal(`${r.administrador.nombreCompleto} ya puede ingresar`, r.administrador.correo, r.contrasenaTemporal);
      }
    } catch (err) {
      boton.disabled = false;
      const sueltos = mostrarErroresForm(form, err.campos);
      if (!err.campos || sueltos.length) { alerta.textContent = sueltos.join(' ') || err.message; alerta.hidden = false; }
    }
  });
  pintarEn(nodo, form);
  form.nombreCompleto.focus();
}

function mostrarClaveTemporal(titulo, correo, clave) {
  const nodo = dialogo.abrir(titulo);
  const copiar = el('button', { type: 'button', class: 'btn btn--secundario', texto: 'Copiar clave' });
  copiar.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(clave);
      copiar.textContent = 'Copiada';
    } catch {
      copiar.textContent = 'Cópiala a mano';
    }
  });
  pintarEn(nodo,
    el('p', { texto: 'Entrégale estos datos. Al ingresar, el sistema le pedirá crear su propia contraseña.' }),
    el('dl', { class: 'resumen' },
      dato('Correo', correo),
      dato('Contraseña temporal', clave)),
    el('p', { class: 'alerta alerta--info', texto: 'Esta clave no se vuelve a mostrar. Si se pierde, usa «Nueva clave temporal».' }),
    el('div', { class: 'acciones' },
      copiar,
      el('button', { type: 'button', class: 'btn btn--primario', 'data-cerrar': true, onclick: () => panel.refrescar(), texto: 'Listo' })));
}

function restablecerClave(admin) {
  confirmarAccion({
    titulo: '¿Dar una clave temporal nueva?',
    texto: `${admin.nombreCompleto} dejará de ingresar con su contraseña actual y tendrá que crear una nueva con la clave temporal.`,
    si: 'Dar clave nueva',
    accion: async () => {
      const r = await api(`/superadmin/administradores/${admin.id}/restablecer`, { metodo: 'POST' });
      setTimeout(() => mostrarClaveTemporal(`Clave nueva para ${admin.nombreCompleto}`, admin.correo, r.contrasenaTemporal), 0);
    },
  });
}

function cambiarActivo(admin) {
  confirmarAccion({
    titulo: admin.activo ? '¿Desactivar al administrador?' : '¿Activar al administrador?',
    texto: admin.activo
      ? `${admin.nombreCompleto} no podrá ingresar y, si tiene el panel abierto, se le cerrará. Sus registros se conservan.`
      : `${admin.nombreCompleto} podrá volver a ingresar con su contraseña.`,
    si: admin.activo ? 'Desactivar' : 'Activar',
    accion: async () => {
      await api(`/superadmin/administradores/${admin.id}`, { metodo: 'PATCH', cuerpo: { activo: !admin.activo } });
      panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status', texto: admin.activo ? 'Administrador desactivado.' : 'Administrador activado.' });
      panel.refrescar();
    },
  });
}

function eliminarAdministrador(admin) {
  confirmarAccion({
    titulo: '¿Eliminar al administrador?',
    texto: `${admin.nombreCompleto} se borra del sistema. Si ya registró pacientes, citas o historia clínica no se puede borrar y te sugeriremos desactivarlo.`,
    si: 'Eliminar',
    accion: async () => {
      await api(`/superadmin/administradores/${admin.id}`, { metodo: 'DELETE' });
      panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status', texto: 'Administrador eliminado.' });
      panel.refrescar();
    },
  });
}

const FOTO_LADO = 400;
const FOTO_MAX_ARCHIVO = 5 * 1024 * 1024;
const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

async function montarEspecialistas(destino) {
  const encabezado = encabezadoSeccion('Especialistas',
    'Quiénes atienden en el consultorio y qué especialidades cubre cada uno. Solo los ves tú.',
    el('button', { type: 'button', class: 'btn btn--primario btn--compacto', onclick: () => formularioEspecialista(), texto: 'Agregar especialista' }));
  const aviso = tomarAviso();
  pintarEn(destino, avisoDemo(), encabezado, aviso, estadoCarga('Cargando especialistas…'));

  let lista;
  try {
    lista = await api('/superadmin/especialistas');
  } catch (err) {
    pintarEn(destino, avisoDemo(), encabezado, aviso, errorConReintento(err, panel.refrescar));
    return;
  }
  if (seccionActual() !== 'especialistas') return;

  const activos = lista.filter((e) => e.activo);
  const inactivos = lista.filter((e) => !e.activo);
  pintarEn(destino, avisoDemo(), encabezado, aviso,
    lista.length === 0 && el('div', { class: 'vacio' },
      el('p', { texto: 'Aún no hay especialistas. Agrega el primero para poder publicar sus horarios.' })),
    activos.length > 0 && el('ul', { class: 'especialistas' }, activos.map(tarjetaEspecialista)),
    inactivos.length > 0 && el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-inactivos' },
      el('h2', { id: 'titulo-inactivos', class: 'bloque-panel__titulo', texto: `Desactivados (${inactivos.length})` }),
      el('p', { class: 'bloque-panel__ayuda', texto: 'No aparecen para agendar. Sus citas anteriores se conservan.' }),
      el('ul', { class: 'especialistas' }, inactivos.map(tarjetaEspecialista))),
    lista.length > 0 && el('p', { class: 'alerta alerta--info bloque-panel', texto: 'Para que un especialista aparezca al agendar, publica sus horas en Horarios.' }));
}

function retratoEspecialista(e, clase = 'retrato') {
  if (e.foto) return el('img', { class: clase, src: e.foto, alt: `Foto de ${e.nombre}`, width: '96', height: '96' });
  const inicial = (e.nombre || '').replace(/^(dra?\.?\s+)/i, '').charAt(0).toUpperCase();
  return el('span', { class: `retrato retrato--inicial ${clase}`, 'aria-hidden': 'true' },
    inicial || icono('<circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/>'));
}

function tarjetaEspecialista(e) {
  return el('li', { class: 'especialista' + (e.activo ? '' : ' especialista--inactivo') },
    retratoEspecialista(e),
    el('div', { class: 'especialista__datos' },
      el('p', { class: 'especialista__nombre', texto: e.nombre }),
      e.titulo && el('p', { class: 'especialista__titulo', texto: e.titulo }),
      el('ul', { class: 'especialista__especialidades', 'aria-label': 'Especialidades' },
        e.especialidades.length
          ? e.especialidades.map((s) => el('li', { class: 'chip-especialidad', texto: s.nombre }))
          : el('li', { class: 'chip-especialidad chip-especialidad--vacia', texto: 'Sin especialidades' }))),
    el('details', { class: 'menu-acciones especialista__menu' },
      el('summary', { class: 'btn btn--fantasma btn--compacto', 'aria-label': `Acciones para ${e.nombre}`, texto: 'Opciones' }),
      el('div', { class: 'menu-acciones__lista' },
        el('button', { type: 'button', onclick: () => formularioEspecialista(e), texto: 'Editar perfil' }),
        el('button', { type: 'button', onclick: () => cambiarActivoEspecialista(e), texto: e.activo ? 'Desactivar' : 'Activar' }))));
}

async function prepararFoto(archivo) {
  if (!FOTO_TIPOS.includes(archivo.type)) throw new Error('Elige una imagen JPG, PNG o WEBP.');
  if (archivo.size > FOTO_MAX_ARCHIVO) throw new Error('La imagen pesa más de 5 MB. Elige una más liviana.');
  const url = URL.createObjectURL(archivo);
  try {
    const imagen = await new Promise((resolver, rechazar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => rechazar(new Error('No pudimos leer esa imagen. Prueba con otra.'));
      img.src = url;
    });
    const ancho = imagen.naturalWidth;
    const alto = imagen.naturalHeight;
    const lado = Math.min(ancho, alto);
    const x = (ancho - lado) / 2;
    const y = alto > ancho ? (alto - lado) * 0.25 : (alto - lado) / 2;
    const lienzo = document.createElement('canvas');
    lienzo.width = FOTO_LADO;
    lienzo.height = FOTO_LADO;
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, FOTO_LADO, FOTO_LADO);
    ctx.drawImage(imagen, x, y, lado, lado, 0, 0, FOTO_LADO, FOTO_LADO);
    return lienzo.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function formularioEspecialista(esp = null) {
  const nodo = dialogo.abrir(esp ? 'Editar especialista' : 'Agregar especialista');
  pintarEn(nodo, estadoCarga('Cargando especialidades…'));
  let especialidades;
  try {
    especialidades = await api('/admin/especialidades');
  } catch (err) {
    pintarEn(nodo, el('p', { class: 'alerta', role: 'alert', texto: err.message }));
    return;
  }
  const elegidas = new Set((esp?.especialidades || []).map((s) => s.id));

  let fotoNueva = null;
  const vista = el('div', { class: 'foto-editor__vista' });
  const ayudaFoto = el('p', { class: 'campo__ayuda', texto: 'JPG, PNG o WEBP de hasta 5 MB. Se recorta en cuadrado y se reduce sola.' });
  const errorFoto = el('p', { class: 'campo__error', role: 'alert', hidden: true });
  const entrada = el('input', { type: 'file', id: 'esp-foto', class: 'sr-only', accept: FOTO_TIPOS.join(',') });
  const quitar = el('button', { type: 'button', class: 'btn btn--fantasma btn--compacto', texto: 'Quitar foto' });
  const elegir = el('label', { for: 'esp-foto', class: 'btn btn--secundario btn--compacto', tabindex: '0',
    onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); entrada.click(); } } });

  function pintarFoto() {
    const actual = fotoNueva === false ? null : (fotoNueva || esp?.foto || null);
    pintarEn(vista, retratoEspecialista({ nombre: nombreActual(), foto: actual }, 'retrato retrato--grande'));
    quitar.hidden = !actual;
    elegir.textContent = actual ? 'Cambiar foto' : 'Elegir foto';
  }
  entrada.addEventListener('change', async () => {
    const archivo = entrada.files[0];
    entrada.value = '';
    if (!archivo) return;
    errorFoto.hidden = true;
    try {
      fotoNueva = await prepararFoto(archivo);
      pintarFoto();
    } catch (err) {
      errorFoto.textContent = err.message;
      errorFoto.hidden = false;
    }
  });
  quitar.addEventListener('click', () => { fotoNueva = false; pintarFoto(); });

  const errorEspecialidades = el('p', { class: 'campo__error', id: 'esp-especialidades-error', hidden: true });
  const alerta = el('p', { class: 'alerta', role: 'alert', hidden: true });
  const form = el('form', { novalidate: true, class: 'form-especialista' },
    el('div', { class: 'foto-editor' },
      vista,
      el('div', { class: 'foto-editor__acciones' },
        elegir,
        quitar,
        entrada,
        ayudaFoto,
        errorFoto)),
    campoForm('nombre', 'Nombre completo', 'text', { value: esp?.nombre || '', autocomplete: 'off', maxlength: '120', placeholder: 'Ej.: Dra. Ximena Acosta Oliveros' }),
    campoForm('titulo', 'Título o cargo (opcional)', 'text', { value: esp?.titulo || '', autocomplete: 'off', maxlength: '120', placeholder: 'Ej.: Odontóloga · Ortodoncista' }),
    el('fieldset', { class: 'campo', 'aria-describedby': 'esp-especialidades-error' },
      el('legend', { class: 'campo__etiqueta', texto: 'Especialidades que atiende' }),
      el('div', { class: 'publicar__opciones' },
        especialidades.map((s) => el('label', { class: 'casilla-opcion' + (s.activo === false ? ' casilla-opcion--inactiva' : '') },
          el('input', { type: 'checkbox', name: 'especialidad', value: String(s.id), checked: elegidas.has(s.id) }),
          el('span', { texto: s.activo === false ? `${s.nombre} (inactiva)` : s.nombre })))),
      errorEspecialidades),
    alerta,
    el('div', { class: 'acciones' },
      el('button', { type: 'submit', class: 'btn btn--primario', texto: esp ? 'Guardar cambios' : 'Agregar especialista' }),
      el('button', { type: 'button', class: 'btn btn--secundario', 'data-cerrar': true, texto: 'Cancelar' })));

  function nombreActual() { return form.nombre?.value.trim(); }
  form.nombre.addEventListener('input', () => { if (!fotoNueva && !esp?.foto) pintarFoto(); });

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const boton = form.querySelector('[type="submit"]');
    limpiarErroresForm(form);
    errorEspecialidades.hidden = true;
    alerta.hidden = true;
    boton.disabled = true;
    const cuerpo = {
      nombre: form.nombre.value,
      titulo: form.titulo.value,
      especialidadIds: [...form.querySelectorAll('input[name="especialidad"]:checked')].map((c) => Number(c.value)),
    };
    let guardado = esp;
    try {
      guardado = esp
        ? await api(`/superadmin/especialistas/${esp.id}`, { metodo: 'PATCH', cuerpo })
        : await api('/superadmin/especialistas', { metodo: 'POST', cuerpo });
      if (typeof fotoNueva === 'string') {
        await api(`/superadmin/especialistas/${guardado.id}/foto`, { metodo: 'PUT', cuerpo: { imagen: fotoNueva } });
      } else if (fotoNueva === false && esp?.foto) {
        await api(`/superadmin/especialistas/${guardado.id}/foto`, { metodo: 'DELETE' });
      }
      panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status',
        texto: esp ? 'Perfil actualizado.' : `Especialista agregado: ${guardado.nombre}. Publica sus horas en Horarios.` });
      dialogo.cerrar();
      panel.refrescar();
    } catch (err) {
      boton.disabled = false;
      if (guardado && !esp) {
        esp = guardado;
        boton.textContent = 'Guardar cambios';
      }
      const campos = { ...(err.campos || {}) };
      if (campos.especialidadIds) {
        errorEspecialidades.textContent = campos.especialidadIds;
        errorEspecialidades.hidden = false;
        delete campos.especialidadIds;
      }
      const sueltos = mostrarErroresForm(form, campos);
      if (!err.campos || sueltos.length) { alerta.textContent = sueltos.join(' ') || err.message; alerta.hidden = false; }
    }
  });

  pintarEn(nodo, form);
  pintarFoto();
  form.nombre.focus();
}

function cambiarActivoEspecialista(e) {
  confirmarAccion({
    titulo: e.activo ? '¿Desactivar al especialista?' : '¿Activar al especialista?',
    texto: e.activo
      ? `${e.nombre} deja de aparecer para agendar. Sus citas ya agendadas y su historial se conservan.`
      : `${e.nombre} vuelve a aparecer para agendar en las horas que tenga publicadas.`,
    si: e.activo ? 'Desactivar' : 'Activar',
    accion: async () => {
      await api(`/superadmin/especialistas/${e.id}`, { metodo: 'PATCH', cuerpo: { activo: !e.activo } });
      panel.aviso = el('p', { class: 'alerta alerta--exito', role: 'status', texto: e.activo ? 'Especialista desactivado.' : 'Especialista activado.' });
      panel.refrescar();
    },
  });
}
