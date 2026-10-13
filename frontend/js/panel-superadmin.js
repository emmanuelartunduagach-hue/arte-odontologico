/* Panel del dueño (rol superadmin) · Solicitudes y Equipo.

   Solo se montan si la sesión es del dueño (panel-secretaria.js). El
   servidor exige el rol en cada ruta /superadmin: esto es solo la vista.

   Contrato:
     GET  /superadmin/solicitudes                         { correcciones, anulaciones }
     POST /superadmin/solicitudes/historia/:id/aprobar
     POST /superadmin/solicitudes/historia/:id/rechazar     { motivo }
     POST /superadmin/solicitudes/odontograma/:id/aprobar
     POST /superadmin/solicitudes/odontograma/:id/rechazar  { motivo }
     GET    /superadmin/administradores
     POST   /superadmin/administradores                   { nombreCompleto, documento, correo, telefono }
     PATCH  /superadmin/administradores/:id               { ...campos, activo? }
     POST   /superadmin/administradores/:id/restablecer
     DELETE /superadmin/administradores/:id
   Crear y restablecer responden `contrasenaTemporal` una sola vez. */

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

/* ---------- Solicitudes ---------- */

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
        ? el('ul', { class: 'solicitudes' }, correcciones.map(tarjetaCorreccion))
        : el('div', { class: 'vacio' }, el('p', { texto: 'No hay correcciones por aprobar.' }))),

    el('section', { class: 'bloque-panel', 'aria-labelledby': 'titulo-anulaciones' },
      el('h2', { id: 'titulo-anulaciones', class: 'bloque-panel__titulo',
        texto: `Anulaciones del odontograma (${anulaciones.length})` }),
      anulaciones.length
        ? el('ul', { class: 'solicitudes' }, anulaciones.map(tarjetaAnulacion))
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

/* ---------- Equipo (administradores) ---------- */

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
      ? el('ul', { class: 'lista-filas equipo' }, lista.map(filaAdministrador))
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

/* Muestra la clave temporal en el diálogo (es la única vez que se ve). */
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
      // confirmarAccion cierra el diálogo al terminar: la clave se muestra después.
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
