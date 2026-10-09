/* Modo demostración — SOLO PARA DESARROLLO.

   Simula la API (contrato v2) para poder ver y probar el flujo completo
   (pedir cita, aceptarla o rechazarla en el panel, pacientes e historia
   clínica) sin backend ni base de datos. Se activa únicamente si la
   página se abre en localhost/127.0.0.1 con `?demo=1`; en cualquier
   otro caso este archivo no hace nada. No guarda ningún dato.

   Ejemplo: http://localhost:5500/frontend/index.html?demo=1
   Queda activo en esa pestaña hasta cerrarla o abrir una página con ?demo=0.
   Para probar el error de "ya tiene una cita activa" usa el documento
   999999999. */

(function () {
  const esLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!esLocal) return;

  // El modo se recuerda en la pestaña para que siga activo al pasar del
  // ingreso a los paneles. `?demo=0` lo apaga.
  const parametro = new URLSearchParams(location.search).get('demo');
  try {
    if (parametro === '0') sessionStorage.removeItem('arte-demo');
    else if (parametro !== null) sessionStorage.setItem('arte-demo', '1');
    if (sessionStorage.getItem('arte-demo') !== '1') return;
  } catch {
    if (parametro === null || parametro === '0') return;
  }

  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const dos = (n) => String(n).padStart(2, '0');

  const ESPECIALIDADES = [
    [1, 'general', 'Odontología general', 'Limpieza, resinas y control preventivo.'],
    [2, 'sonrisa', 'Diseño de sonrisa', 'Carillas y blanqueamiento estético.'],
    [3, 'ortodoncia', 'Ortodoncia', 'Brackets y alineadores para corregir mordida.'],
    [4, 'odontopediatria', 'Odontopediatría y ortopedia', 'Atención dental para niños y niñas.'],
    [5, 'endodoncia', 'Endodoncia', 'Tratamiento de conducto para salvar la pieza.'],
    [6, 'periodoncia', 'Periodoncia', 'Tratamiento de encías y soporte dental.'],
    [7, 'cirugia', 'Cirugía oral', 'Extracciones y cordales incluidos.'],
    [8, 'maxilofacial', 'Cirugía maxilofacial', 'Procedimientos de mayor complejidad.'],
    [9, 'rehabilitacion', 'Rehabilitación oral', 'Coronas, puentes y prótesis.'],
  ].map(([id, codigo, nombre, descripcion]) => ({ id, codigo, nombre, descripcion }));

  // Nombres ficticios: dejan claro que son datos de prueba.
  const ESPECIALISTAS = {
    3: [{ id: 31, nombre: 'Dra. Prueba Uno' }, { id: 32, nombre: 'Dr. Prueba Dos' }],
    7: [],
  };
  const especialistasDe = (id) => ESPECIALISTAS[id] ?? [{ id: id * 10 + 1, nombre: 'Dra. Prueba Uno' }];

  function hoyColombia() {
    return new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
  }

  // Lunes a sábado con horas libres desde mañana; cada 5.º día queda "lleno".
  function diasConHoras(mes) {
    const [a, m] = mes.split('-').map(Number);
    const total = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const hoy = hoyColombia();
    const dias = [];
    for (let d = 1; d <= total; d++) {
      const fecha = `${mes}-${dos(d)}`;
      const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
      if (fecha <= hoy || dow === 0 || d % 5 === 0) continue;
      dias.push({ fecha, horasLibres: horasDe(fecha).length });
    }
    return dias;
  }

  function horasDe(fecha) {
    const d = Number(fecha.slice(8));
    const base = ['08:00', '08:30', '09:30', '10:00', '11:00', '14:00', '15:30', '16:30'];
    return base.filter((_, i) => (i + d) % 4 !== 0);
  }

  const CITAS = {};
  function sumarDias(fecha, n) {
    const [a, m, d] = fecha.split('-').map(Number);
    return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
  }
  function citaDemo(codigo) {
    if (CITAS[codigo]) return CITAS[codigo];
    const base = { id: 1, estado: 'confirmada', paciente: 'Ana Pérez', especialidad: 'Ortodoncia',
      especialistaId: 31, especialista: 'Dra. Prueba Uno', fecha: sumarDias(hoyColombia(), 5), hora: '09:30',
      sede: 'Rivera', direccion: 'Carrera 7 No. 3-61, Rivera', reprogramaciones: 0 };
    const variantes = {
      'DEMO-0000': {},
      'DEMO-REPROGRAMADA': { reprogramaciones: 1 },
      'DEMO-CERCA': { fecha: sumarDias(hoyColombia(), 1) },
      'DEMO-CANCELADA': { estado: 'cancelada' },
      'DEMO-PENDIENTE': { estado: 'pendiente', reprogramaciones: 1 },
    };
    if (!variantes[codigo]) return null;
    return (CITAS[codigo] = { ...base, ...variantes[codigo] });
  }
  function reglasDemo(cita) {
    if (cita.estado === 'cancelada') return { puedeReprogramar: false, puedeCancelar: false, motivo: 'Esta cita fue cancelada.' };
    if (cita.estado === 'rechazada') return { puedeReprogramar: false, puedeCancelar: false, motivo: 'El consultorio no pudo confirmar esta cita. Puedes pedir una nueva.' };
    if (cita.fecha <= sumarDias(hoyColombia(), 1)) return { puedeReprogramar: false, puedeCancelar: false, motivo: 'Faltan menos de 24 horas para tu cita. Para cambiarla, comunícate con el consultorio.' };
    if (cita.estado === 'pendiente') return { puedeReprogramar: false, puedeCancelar: true, motivo: 'Tu nueva hora está pendiente de confirmación. Te avisaremos por WhatsApp cuando el consultorio la confirme.' };
    if (cita.reprogramaciones >= 1) return { puedeReprogramar: false, puedeCancelar: true, motivo: 'Ya reprogramaste esta cita una vez. Si necesitas otro cambio, cancélala y agenda una nueva.' };
    return { puedeReprogramar: true, puedeCancelar: true, motivo: null };
  }

  // ---- Sesión ----
  // Solo la secretaria inicia sesión (contraseña Demo1234):
  //   secretaria@demo.co → panel de la secretaria
  //   nuevo@demo.co      → clave temporal: obliga a cambiarla
  const USUARIOS = {
    'secretaria@demo.co': { id: 1, nombre: 'Secretaria de Prueba', rol: 'administrador', debeCambiarContrasena: false },
    'nuevo@demo.co': { id: 3, nombre: 'Secretaria Nueva', rol: 'administrador', debeCambiarContrasena: true },
  };
  const CLAVE_DEMO = 'Demo1234';

  // Token con la forma de un JWT (sin firma real) para que js/sesion.js
  // pueda leer el vencimiento y el rol.
  function tokenDemo(usuario) {
    const b64 = (obj) => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const exp = Math.floor(Date.now() / 1000) + 8 * 3600;
    return `${b64({ alg: 'none' })}.${b64({ id: usuario.id, rol: usuario.rol, nombre: usuario.nombre, exp })}.demo`;
  }
  function usuarioDelToken(token) {
    try {
      const { id } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return Object.values(USUARIOS).find((u) => u.id === id) || null;
    } catch {
      return null;
    }
  }

  const PERFILES = {
    1: { id: 1, nombreCompleto: 'Secretaria de Prueba', documento: '1000000001', correo: 'secretaria@demo.co', telefono: '573000000001', rol: 'administrador' },
    3: { id: 3, nombreCompleto: 'Secretaria Nueva', documento: '1000000003', correo: 'nuevo@demo.co', telefono: '573000000003', rol: 'administrador' },
  };

  const ahoraTexto = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  // Pacientes (registro sin login) e historia clínica, en memoria.
  const PACIENTES = [
    ['Laura Méndez', 'web'], ['Ana Pérez', 'web'], ['Carlos Gómez', 'consultorio'], ['Luisa Rojas', 'web'],
    ['Pedro Díaz', 'consultorio'], ['Sofía Ramírez', 'web'], ['Jorge Castro', 'web'], ['Marta Ruiz', 'consultorio'],
  ].map(([nombreCompleto, origen], i) => ({
    id: i + 1, nombreCompleto, documento: `10751234${i}`, telefono: `57300123456${i}`,
    correo: `${nombreCompleto.split(' ')[0].toLowerCase()}@ejemplo.co`, origen,
    fechaAutorizacion: '2026-09-15 10:00:00', creadoEn: '2026-09-15 10:00:00',
  }));
  const HISTORIA = [];
  function entradaHistoria(pacienteId, datos) {
    const e = {
      id: HISTORIA.length + 1, pacienteId, fechaAtencion: datos.fechaAtencion, procedimiento: datos.procedimiento,
      notas: datos.notas || null, especialidad: datos.especialidad || null, especialista: datos.especialista || null,
      citaId: datos.citaId || null, corrigeA: datos.corrigeA || null, autor: 'Secretaria de Prueba', creadoEn: ahoraTexto(),
    };
    HISTORIA.push(e);
    return e;
  }
  entradaHistoria(1, { fechaAtencion: sumarDias(hoyColombia(), -1), procedimiento: 'Control de brackets', notas: 'Se ajustó el arco superior.', especialidad: 'Ortodoncia', especialista: 'Dra. Prueba Uno' });
  function historiaDe(pacienteId) {
    const lista = HISTORIA.filter((e) => e.pacienteId === pacienteId);
    return lista.map((e) => ({ ...e, correcciones: lista.filter((x) => x.corrigeA === e.id).map((x) => x.id) }))
      .sort((a, b) => b.fechaAtencion.localeCompare(a.fechaAtencion) || b.id - a.id);
  }

  // Agenda de la secretaria: citas de ayer a 6 días, en memoria (se
  // pierden al recargar). Ortodoncia la atienden los especialistas 31 y 32.
  const ESPECIALISTAS_ADMIN = [
    { id: 31, nombre: 'Dra. Prueba Uno', activo: true, especialidades: [{ id: 3, nombre: 'Ortodoncia' }] },
    { id: 32, nombre: 'Dr. Prueba Dos', activo: true, especialidades: [{ id: 3, nombre: 'Ortodoncia' }, { id: 1, nombre: 'Odontología general' }] },
    { id: 11, nombre: 'Dra. Prueba Tres', activo: false, especialidades: [{ id: 1, nombre: 'Odontología general' }] },
  ];
  let AGENDA = null;
  function agendaDemo() {
    if (AGENDA) return AGENDA;
    const hoy = hoyColombia();
    AGENDA = [
      [-1, '10:00', 'Laura Méndez', 'atendida', 31], [0, '07:00', 'Ana Pérez', 'confirmada', 31],
      [0, '09:30', 'Carlos Gómez', 'confirmada', 32], [0, '11:00', 'Luisa Rojas', 'cancelada', 31],
      [0, '17:30', 'Pedro Díaz', 'confirmada', 31], [1, '08:30', 'Sofía Ramírez', 'confirmada', 32],
      [3, '15:00', 'Jorge Castro', 'confirmada', 31], [6, '09:00', 'Marta Ruiz', 'confirmada', 32],
      // Solicitudes de la web por aceptar (aún sin ficha de paciente).
      [1, '10:30', 'Valentina Torres', 'pendiente', 31], [4, '14:00', 'Andrés Mejía', 'pendiente', 32],
    ].map(([dias, hora, paciente, estado, especialistaId], i) => {
      const ficha = PACIENTES.find((x) => x.nombreCompleto === paciente);
      return {
        id: 200 + i, estado, paciente, especialidadId: 3, especialidad: 'Ortodoncia', especialistaId,
        especialista: ESPECIALISTAS_ADMIN.find((e) => e.id === especialistaId).nombre,
        fecha: sumarDias(hoy, dias), hora, sede: 'Rivera', direccion: 'Carrera 7 No. 3-61, Rivera', reprogramaciones: 0,
        documento: ficha ? ficha.documento : `10759876${i}`, telefono: ficha ? ficha.telefono : `57310987654${i}`,
        correo: ficha ? ficha.correo : `${paciente.split(' ')[0].toLowerCase()}@ejemplo.co`,
        pacienteId: ficha ? ficha.id : null, canceladaPor: estado === 'cancelada' ? 'paciente' : null,
      };
    });
    try {
      AGENDA.push(...JSON.parse(sessionStorage.getItem('arte-demo-solicitudes') || '[]'));
    } catch { /* nada guardado */ }
    return AGENDA;
  }
  // Disponibilidad en memoria: horas publicadas por especialista. Se
  // arranca con las horas de ejemplo de horasDe() de lunes a sábado.
  const FRANJAS = new Map();          // clave "esp|fecha|hora" → { id, especialistaId, fecha, hora, activa }
  const FRANJA_POR_ID = new Map();
  function franja(especialistaId, fecha, hora) {
    const clave = `${especialistaId}|${fecha}|${hora}`;
    if (!FRANJAS.has(clave)) {
      const f = { id: FRANJAS.size + 1, especialistaId, fecha, hora, activa: false };
      FRANJAS.set(clave, f);
      FRANJA_POR_ID.set(f.id, f);
    }
    return FRANJAS.get(clave);
  }
  const SEMBRADAS = new Set();
  function franjasDe(especialistaId, desde, hasta) {
    const lista = [];
    for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 1)) {
      const clave = `${especialistaId}|${fecha}`;
      const [a, m, d] = fecha.split('-').map(Number);
      if (!SEMBRADAS.has(clave) && new Date(Date.UTC(a, m - 1, d)).getUTCDay() !== 0) {
        horasDe(fecha).forEach((h) => { franja(especialistaId, fecha, h).activa = true; });
      }
      SEMBRADAS.add(clave);
      [...FRANJAS.values()].filter((f) => f.activa && f.especialistaId === especialistaId && f.fecha === fecha)
        .sort((x, y) => x.hora.localeCompare(y.hora))
        .forEach((f) => {
          const cita = agendaDemo().find((c) => c.especialistaId === especialistaId && c.fecha === f.fecha && c.hora === f.hora && !['cancelada', 'rechazada'].includes(c.estado));
          lista.push({ id: f.id, fecha: f.fecha, hora: f.hora, cita: cita ? { id: cita.id, paciente: cita.paciente, estado: cita.estado } : null });
        });
    }
    return lista;
  }

  // Mensajes de WhatsApp en memoria (modo manual: quedan por enviar).
  const TEXTOS_TIPO = {
    confirmacion: 'quedó confirmada', reprogramacion: 'fue reprogramada', cancelacion: 'fue cancelada', recordatorio: 'es en 24 horas',
    rechazo: 'no se pudo confirmar; pide otra hora en la página',
  };
  const NOTIFICACIONES = [];
  function notificacionDemo(cita, tipo) {
    const mensaje = `Hola ${cita.paciente.split(' ')[0]}, tu cita en Arte Odontológico del ${cita.fecha} a las ${cita.hora} con ${cita.especialista} ${TEXTOS_TIPO[tipo]}.`;
    const n = {
      id: NOTIFICACIONES.length + 1, citaId: cita.id, tipo, estado: 'pendiente', destino: cita.telefono, mensaje, detalle: null,
      creadoEn: ahoraTexto(), paciente: cita.paciente,
      enlaceWhatsApp: `https://wa.me/${cita.telefono}?text=${encodeURIComponent(mensaje)}`,
    };
    NOTIFICACIONES.unshift(n);
    return { id: n.id, estado: n.estado, enlaceWhatsApp: n.enlaceWhatsApp };
  }
  let RECORDATORIOS_HECHOS = false;

  /** Cita nueva en la agenda en memoria a partir de un franjaId "esp|fecha|hora". */
  function nuevaCita(cuerpo, persona, estado) {
    const [especialistaId, fecha, hora] = String(cuerpo.franjaId).split('|');
    const esp = ESPECIALIDADES.find((e) => e.id === Number(cuerpo.especialidadId));
    const especialista = especialistasDe(esp?.id).find((e) => e.id === Number(especialistaId))
      || ESPECIALISTAS_ADMIN.find((e) => e.id === Number(especialistaId));
    const cita = {
      id: 300 + agendaDemo().length, estado, paciente: persona.nombreCompleto, especialidadId: esp?.id, especialidad: esp?.nombre,
      especialistaId: Number(especialistaId), especialista: especialista?.nombre || 'Especialista de demostración',
      fecha, hora, sede: 'Rivera', direccion: 'Carrera 7 No. 3-61, Rivera', reprogramaciones: 0,
      documento: persona.documento, telefono: persona.telefono, correo: persona.correo,
      pacienteId: estado === 'confirmada' ? persona.id : null, canceladaPor: null,
    };
    agendaDemo().push(cita);
    if (estado === 'pendiente') {
      // Se recuerda en la pestaña para verla al pasar al panel de la secretaria.
      try {
        const guardadas = JSON.parse(sessionStorage.getItem('arte-demo-solicitudes') || '[]');
        sessionStorage.setItem('arte-demo-solicitudes', JSON.stringify([...guardadas, cita]));
      } catch { /* sin almacenamiento: solo dura en esta página */ }
    }
    return cita;
  }

  window.API_DEMO = async function (ruta, metodo, cuerpo, token) {
    await espera(350);
    const url = new URL(ruta, 'http://demo');
    const partes = url.pathname.split('/').filter(Boolean);

    if (metodo === 'POST' && url.pathname === '/auth/ingreso') {
      const usuario = USUARIOS[String(cuerpo.correo).toLowerCase()];
      if (!usuario || cuerpo.contrasena !== CLAVE_DEMO) throw new ErrorApi('Correo o contraseña incorrectos.', 401);
      return { token: tokenDemo(usuario), usuario: { ...usuario } };
    }

    const usuario = token ? usuarioDelToken(token) : null;
    const exigir = (rol) => {
      if (!usuario) throw new ErrorApi('Debes iniciar sesión', 401);
      if (rol && usuario.rol !== rol) throw new ErrorApi('No tienes permiso para esta acción', 403);
    };

    if (metodo === 'POST' && url.pathname === '/auth/cambiar-contrasena') {
      exigir();
      if (cuerpo.contrasenaActual !== CLAVE_DEMO) {
        const mensaje = 'La contraseña actual no es correcta.';
        throw new ErrorApi(mensaje, 400, { contrasenaActual: mensaje });
      }
      return { mensaje: 'Contraseña actualizada correctamente.' };
    }

    if (metodo === 'GET' && url.pathname === '/auth/perfil') {
      exigir();
      return { ...PERFILES[usuario.id] };
    }

    if (metodo === 'GET' && url.pathname === '/admin/citas') {
      exigir('administrador');
      const p = url.searchParams;
      const desde = p.get('fecha') || p.get('desde') || hoyColombia();
      const hasta = p.get('fecha') || p.get('hasta') || sumarDias(desde, 30);
      const q = (p.get('q') || '').toLowerCase();
      return agendaDemo().filter((c) => c.fecha >= desde && c.fecha <= hasta
        && (!p.get('especialistaId') || c.especialistaId === Number(p.get('especialistaId')))
        && (!p.get('estado') || c.estado === p.get('estado'))
        && (!q || [c.paciente, c.documento, c.telefono].some((v) => v.toLowerCase().includes(q))))
        .map((c) => ({ ...c }));
    }

    if (partes[0] === 'admin' && partes[1] === 'especialistas' && partes[3] === 'franjas') {
      exigir('administrador');
      const especialistaId = Number(partes[2]);
      if (metodo === 'GET') {
        const desde = url.searchParams.get('desde') || hoyColombia();
        return franjasDe(especialistaId, desde, url.searchParams.get('hasta') || sumarDias(desde, 30));
      }
      if (metodo === 'POST') {
        cuerpo.fechas.forEach((fecha) => {
          franjasDe(especialistaId, fecha, fecha);  // siembra el día antes de sumar horas
          cuerpo.horas.forEach((h) => { franja(especialistaId, fecha, h).activa = true; });
        });
        return { mensaje: 'Horas publicadas.', total: cuerpo.fechas.length * cuerpo.horas.length };
      }
    }

    if (metodo === 'DELETE' && partes[0] === 'admin' && partes[1] === 'franjas') {
      exigir('administrador');
      const f = FRANJA_POR_ID.get(Number(partes[2]));
      if (!f || !f.activa) throw new ErrorApi('Hora no encontrada.', 404);
      const cita = agendaDemo().find((c) => c.especialistaId === f.especialistaId && c.fecha === f.fecha && c.hora === f.hora && !['cancelada', 'rechazada'].includes(c.estado));
      if (cita) throw new ErrorApi(`Esta hora tiene una cita de ${cita.paciente}. Reprográmala o cancélala antes de quitar la hora.`, 409);
      f.activa = false;
      return { mensaje: 'Hora quitada.' };
    }

    if (metodo === 'GET' && url.pathname === '/admin/especialistas') {
      exigir('administrador');
      return ESPECIALISTAS_ADMIN;
    }

    // Agendar a un paciente desde su ficha: queda confirmada.
    if (metodo === 'POST' && url.pathname === '/admin/citas') {
      exigir('administrador');
      const paciente = PACIENTES.find((x) => x.id === Number(cuerpo.pacienteId));
      if (!paciente) throw new ErrorApi('Paciente no encontrado.', 404);
      const cita = nuevaCita(cuerpo, paciente, 'confirmada');
      return { mensaje: 'Cita agendada.', cita: { ...cita }, notificacion: notificacionDemo(cita, 'confirmacion') };
    }

    if (partes[0] === 'admin' && partes[1] === 'citas' && partes[2]) {
      exigir('administrador');
      const cita = agendaDemo().find((c) => c.id === Number(partes[2]));
      if (!cita) throw new ErrorApi('Cita no encontrada.', 404);

      if (metodo === 'POST' && partes[3] === 'aceptar') {
        if (cita.estado !== 'pendiente') throw new ErrorApi(`La cita ya está ${cita.estado.replace('_', ' ')}.`, 409);
        let paciente = PACIENTES.find((x) => x.documento === cita.documento);
        const nuevo = !paciente;
        if (nuevo) {
          paciente = { id: PACIENTES.length + 1, nombreCompleto: cita.paciente, documento: cita.documento, telefono: cita.telefono,
            correo: cita.correo, origen: 'web', fechaAutorizacion: ahoraTexto(), creadoEn: ahoraTexto() };
          PACIENTES.push(paciente);
        }
        Object.assign(cita, { estado: 'confirmada', pacienteId: paciente.id });
        return { mensaje: nuevo ? 'Cita aceptada. Se creó la ficha del paciente.' : 'Cita aceptada.', cita: { ...cita },
          pacienteId: paciente.id, pacienteNuevo: nuevo, notificacion: notificacionDemo(cita, 'confirmacion') };
      }
      if (metodo === 'POST' && partes[3] === 'rechazar') {
        if (cita.estado !== 'pendiente') throw new ErrorApi(`La cita ya está ${cita.estado.replace('_', ' ')}.`, 409);
        cita.estado = 'rechazada';
        return { mensaje: 'Solicitud rechazada. La hora quedó libre.', notificacion: notificacionDemo(cita, 'rechazo') };
      }

      if (metodo === 'PATCH' && partes[3] === 'estado') {
        if (cita.estado === 'pendiente') throw new ErrorApi('La cita está pendiente: primero acéptala o recházala.', 409);
        if (cita.estado !== 'confirmada') throw new ErrorApi(`La cita ya está ${cita.estado.replace('_', ' ')}.`, 409);
        if (cuerpo.estado === 'cancelada') {
          Object.assign(cita, { estado: 'cancelada', canceladaPor: 'administrador' });
          return { mensaje: 'Cita cancelada.', notificacion: notificacionDemo(cita, 'cancelacion') };
        }
        cita.estado = cuerpo.estado;
        return { mensaje: cuerpo.estado === 'atendida' ? 'Cita marcada como atendida.' : 'Cita marcada como no asistió.' };
      }

      if (metodo === 'POST' && partes[3] === 'reprogramar') {
        if (!['pendiente', 'confirmada'].includes(cita.estado)) throw new ErrorApi('Solo se pueden reprogramar citas pendientes o confirmadas.', 409);
        const [especialistaId, fecha, hora] = String(cuerpo.franjaId).split('|');
        if (hora === '10:00') throw new ErrorApi('Esa hora acaba de ser tomada. Elige otra.', 409);
        const esp = ESPECIALISTAS_ADMIN.find((e) => e.id === Number(especialistaId));
        Object.assign(cita, { fecha, hora, especialistaId: esp?.id ?? cita.especialistaId, especialista: esp?.nombre ?? cita.especialista });
        const notificacion = cita.estado === 'confirmada' ? notificacionDemo(cita, 'reprogramacion') : null;
        return { mensaje: 'Cita reprogramada.', cita: { ...cita }, notificacion };
      }
    }

    // ---- Pacientes e historia clínica ----
    if (partes[0] === 'pacientes') {
      exigir('administrador');
      if (metodo === 'GET' && !partes[1]) {
        const q = (url.searchParams.get('q') || '').toLowerCase();
        return PACIENTES.filter((x) => !q || [x.nombreCompleto, x.documento, x.telefono, x.correo].some((v) => v.toLowerCase().includes(q)))
          .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto)).map((x) => ({ ...x }));
      }
      if (metodo === 'POST' && !partes[1]) {
        const doc = String(cuerpo.documento || '').trim();
        const existente = PACIENTES.find((x) => x.documento === doc);
        if (existente) {
          const mensaje = `Ya existe un paciente con este documento: ${existente.nombreCompleto}.`;
          throw new ErrorApi(mensaje, 409, { documento: mensaje }, { pacienteId: existente.id });
        }
        const paciente = { id: PACIENTES.length + 1, nombreCompleto: cuerpo.nombreCompleto.trim(), documento: doc,
          telefono: `57${String(cuerpo.telefono).replace(/\D/g, '').slice(-10)}`, correo: cuerpo.correo.trim().toLowerCase(),
          origen: 'consultorio', fechaAutorizacion: ahoraTexto(), creadoEn: ahoraTexto() };
        PACIENTES.push(paciente);
        return { mensaje: 'Paciente creado correctamente.', paciente: { ...paciente }, citasVinculadas: 0 };
      }
      const paciente = PACIENTES.find((x) => x.id === Number(partes[1]));
      if (!paciente) throw new ErrorApi('Paciente no encontrado.', 404);
      if (metodo === 'GET' && !partes[2]) {
        const citas = agendaDemo().filter((c) => c.pacienteId === paciente.id || (!c.pacienteId && c.documento === paciente.documento))
          .sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`))
          .map(({ id, estado, especialidadId, especialidad, especialistaId, especialista, fecha, hora }) => ({ id, estado, especialidadId, especialidad, especialistaId, especialista, fecha, hora }));
        return { paciente: { ...paciente }, citas, historia: historiaDe(paciente.id) };
      }
      if (metodo === 'POST' && partes[2] === 'historia') {
        const cita = cuerpo.citaId && agendaDemo().find((c) => c.id === Number(cuerpo.citaId));
        return entradaHistoria(paciente.id, { ...cuerpo, fechaAtencion: cuerpo.fechaAtencion || cita?.fecha,
          especialidad: cita?.especialidad, especialista: cita?.especialista });
      }
    }

    if (metodo === 'POST' && partes[0] === 'admin' && partes[1] === 'historia' && partes[3] === 'correccion') {
      exigir('administrador');
      const original = HISTORIA.find((e) => e.id === Number(partes[2]));
      if (!original) throw new ErrorApi('Entrada no encontrada.', 404);
      return entradaHistoria(original.pacienteId, { ...original, ...Object.fromEntries(Object.entries(cuerpo).filter(([, v]) => v)), corrigeA: original.id, citaId: original.citaId });
    }

    if (partes[0] === 'admin' && partes[1] === 'notificaciones') {
      exigir('administrador');
      if (!NOTIFICACIONES.length) {
        // Uno de ejemplo para que la sección no arranque vacía.
        notificacionDemo(agendaDemo().find((c) => c.paciente === 'Sofía Ramírez'), 'confirmacion');
      }
      if (metodo === 'GET') return NOTIFICACIONES.filter((n) => n.estado === (url.searchParams.get('estado') || 'pendiente')).map((n) => ({ ...n }));
      if (metodo === 'PATCH') {
        const n = NOTIFICACIONES.find((x) => x.id === Number(partes[2]));
        if (!n) throw new ErrorApi('Mensaje no encontrado.', 404);
        n.estado = 'enviada';
        return { mensaje: 'Mensaje marcado como enviado.' };
      }
    }

    if (metodo === 'POST' && url.pathname === '/admin/recordatorios') {
      exigir('administrador');
      // Confirmadas que empiezan en las próximas 24 horas.
      const ahora = new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 16);
      const limite = new Date(Date.now() + 19 * 3600 * 1000).toISOString().slice(0, 16);
      const fecha = limite.slice(0, 10);
      const citas = RECORDATORIOS_HECHOS ? [] : agendaDemo().filter((c) => c.estado === 'confirmada'
        && `${c.fecha}T${c.hora}` > ahora && `${c.fecha}T${c.hora}` <= limite);
      RECORDATORIOS_HECHOS = true;
      const resultados = citas.map((c) => ({ citaId: c.id, estado: notificacionDemo(c, 'recordatorio').estado }));
      return { fecha, revisadas: citas.length, resultados };
    }

    if (metodo === 'GET' && url.pathname === '/especialidades') return ESPECIALIDADES;

    if (metodo === 'GET' && partes[0] === 'especialidades' && partes[2] === 'especialistas') {
      return especialistasDe(Number(partes[1]));
    }

    if (metodo === 'GET' && partes[0] === 'especialistas' && partes[2] === 'calendario') {
      const mes = url.searchParams.get('mes') || hoyColombia().slice(0, 7);
      return { especialistaId: Number(partes[1]), mes, dias: diasConHoras(mes) };
    }

    if (metodo === 'GET' && partes[0] === 'especialistas' && partes[2] === 'horas') {
      const fecha = url.searchParams.get('fecha');
      return horasDe(fecha).map((hora) => ({ franjaId: `${partes[1]}|${fecha}|${hora}`, hora }));
    }

    // Pedir cita desde la web: queda pendiente y aparece en el panel de
    // la secretaria (en esta misma pestaña del navegador) para aceptarla o rechazarla.
    if (metodo === 'POST' && url.pathname === '/citas') {
      if (cuerpo.documento === '999999999') {
        throw new ErrorApi('Ya tienes una cita pedida. Para pedir otra, primero asiste a esa cita o cancélala desde el enlace que te llegó por WhatsApp.', 409);
      }
      const cita = nuevaCita(cuerpo, {
        nombreCompleto: cuerpo.nombreCompleto.trim(), documento: cuerpo.documento.trim(),
        telefono: `57${String(cuerpo.telefono).replace(/\D/g, '').slice(-10)}`, correo: cuerpo.correo.trim(),
      }, 'pendiente');
      return { mensaje: 'Recibimos tu solicitud. Te confirmaremos por WhatsApp.', cita: { ...cita } };
    }

    // ---- Gestionar cita (gestionar-cita.html?codigo=…) ----
    // Códigos de prueba: DEMO-0000 (se puede todo), DEMO-REPROGRAMADA
    // (ya reprogramó una vez), DEMO-CERCA (faltan menos de 24 h),
    // DEMO-CANCELADA, DEMO-PENDIENTE (cambio esperando confirmación).
    // Cualquier otro devuelve 404.
    if (partes[0] === 'citas' && partes[1] === 'gestion' && partes[2]) {
      const cita = citaDemo(partes[2]);
      if (!cita) throw new ErrorApi('El enlace no es válido o ya no está vigente.', 404);

      if (metodo === 'GET' && !partes[3]) return { cita: { ...cita }, ...reglasDemo(cita) };

      if (metodo === 'POST' && partes[3] === 'reprogramar') {
        if (!reglasDemo(cita).puedeReprogramar) throw new ErrorApi('Esta cita ya no se puede reprogramar.', 409);
        const [, fecha, hora] = String(cuerpo.franjaId).split('|');
        if (hora === '10:00' ) throw new ErrorApi('Esa hora acaba de ser tomada. Elige otra.', 409);
        Object.assign(cita, { fecha, hora, estado: 'pendiente', reprogramaciones: cita.reprogramaciones + 1 });
        return { mensaje: 'Recibimos tu cambio. Te confirmaremos la nueva hora por WhatsApp.', cita: { ...cita }, ...reglasDemo(cita) };
      }

      if (metodo === 'POST' && partes[3] === 'cancelar') {
        if (!reglasDemo(cita).puedeCancelar) throw new ErrorApi('Esta cita ya no se puede cancelar.', 409);
        cita.estado = 'cancelada';
        return { mensaje: 'Cita cancelada.' };
      }
    }

    throw new ErrorApi('Recurso no encontrado (demostración).', 404);
  };
})();
