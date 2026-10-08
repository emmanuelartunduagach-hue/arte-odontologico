/* Modo demostración — SOLO PARA DESARROLLO.

   Simula la API (contrato v2) para poder ver y probar el flujo de
   agendar sin backend ni base de datos. Se activa únicamente si la
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
    };
    if (!variantes[codigo]) return null;
    return (CITAS[codigo] = { ...base, ...variantes[codigo] });
  }
  function reglasDemo(cita) {
    if (cita.estado === 'cancelada') return { puedeReprogramar: false, puedeCancelar: false, motivo: 'Esta cita fue cancelada.' };
    if (cita.fecha <= sumarDias(hoyColombia(), 1)) return { puedeReprogramar: false, puedeCancelar: false, motivo: 'Faltan menos de 24 horas para tu cita. Para cambiarla, comunícate con el consultorio.' };
    if (cita.reprogramaciones >= 1) return { puedeReprogramar: false, puedeCancelar: true, motivo: 'Ya reprogramaste esta cita una vez. Si necesitas otro cambio, cancélala y agenda una nueva.' };
    return { puedeReprogramar: true, puedeCancelar: true, motivo: null };
  }

  // ---- Sesión ----
  // Usuarios de prueba (contraseña Demo1234):
  //   secretaria@demo.co → panel de la secretaria
  //   paciente@demo.co   → mis citas
  //   nuevo@demo.co      → clave temporal: obliga a cambiarla
  const USUARIOS = {
    'secretaria@demo.co': { id: 1, nombre: 'Secretaria de Prueba', rol: 'administrador', debeCambiarContrasena: false },
    'paciente@demo.co': { id: 2, nombre: 'Ana Pérez', rol: 'paciente', debeCambiarContrasena: false },
    'nuevo@demo.co': { id: 3, nombre: 'Paciente Nuevo', rol: 'paciente', debeCambiarContrasena: true },
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

  // Citas de paciente@demo.co, en memoria (se pierden al recargar). La de
  // dentro de 12 días ya se reprogramó una vez: solo se puede cancelar.
  let MIS_CITAS = null;
  function citasDePaciente() {
    if (MIS_CITAS) return MIS_CITAS;
    const hoy = hoyColombia();
    const cita = (dias, hora, estado, especialidad, reprogramaciones = 0) => ({
      id: 100 + dias, estado, paciente: 'Ana Pérez', especialidad, especialistaId: 31,
      especialista: 'Dra. Prueba Uno', fecha: sumarDias(hoy, dias), hora, sede: 'Rivera',
      direccion: 'Carrera 7 No. 3-61, Rivera', reprogramaciones,
    });
    MIS_CITAS = [
      cita(12, '15:30', 'confirmada', 'Ortodoncia', 1),
      cita(3, '09:30', 'confirmada', 'Odontología general'),
      cita(-20, '08:00', 'atendida', 'Odontología general'),
      cita(-45, '10:00', 'cancelada', 'Diseño de sonrisa'),
    ];
    return MIS_CITAS;
  }
  const conReglas = (c) => ({ ...c, ...reglasDemo(c) });
  const ordenarMisCitas = () => citasDePaciente().sort((a, b) => `${b.fecha} ${b.hora}`.localeCompare(`${a.fecha} ${a.hora}`));

  const PERFILES = {
    1: { id: 1, nombreCompleto: 'Secretaria de Prueba', documento: '1000000001', correo: 'secretaria@demo.co', telefono: '573000000001', rol: 'administrador' },
    2: { id: 2, nombreCompleto: 'Ana Pérez', documento: '1075123456', correo: 'paciente@demo.co', telefono: '573001234567', rol: 'paciente' },
    3: { id: 3, nombreCompleto: 'Paciente Nuevo', documento: '1075999888', correo: 'nuevo@demo.co', telefono: '573109998877', rol: 'paciente' },
  };

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
    ].map(([dias, hora, paciente, estado, especialistaId], i) => ({
      id: 200 + i, estado, paciente, especialidadId: 3, especialidad: 'Ortodoncia', especialistaId,
      especialista: ESPECIALISTAS_ADMIN.find((e) => e.id === especialistaId).nombre,
      fecha: sumarDias(hoy, dias), hora, sede: 'Rivera', direccion: 'Carrera 7 No. 3-61, Rivera', reprogramaciones: 0,
      documento: `10751234${i}`, telefono: `57300123456${i}`, correo: i === 2 ? 'carlos@ejemplo.co' : null,
      pacienteId: null, canceladaPor: estado === 'cancelada' ? 'paciente' : null,
    }));
    return AGENDA;
  }
  // Mensajes de WhatsApp en memoria (modo manual: quedan por enviar).
  const TEXTOS_TIPO = {
    confirmacion: 'quedó agendada', reprogramacion: 'fue reprogramada', cancelacion: 'fue cancelada', recordatorio: 'es mañana',
  };
  const NOTIFICACIONES = [];
  function notificacionDemo(cita, tipo) {
    const mensaje = `Hola ${cita.paciente.split(' ')[0]}, tu cita en Arte Odontológico del ${cita.fecha} a las ${cita.hora} con ${cita.especialista} ${TEXTOS_TIPO[tipo]}.`;
    const n = {
      id: NOTIFICACIONES.length + 1, citaId: cita.id, tipo, estado: 'pendiente', destino: cita.telefono, mensaje, detalle: null,
      creadoEn: new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '), paciente: cita.paciente,
      enlaceWhatsApp: `https://wa.me/${cita.telefono}?text=${encodeURIComponent(mensaje)}`,
    };
    NOTIFICACIONES.unshift(n);
    return { id: n.id, estado: n.estado, enlaceWhatsApp: n.enlaceWhatsApp };
  }
  let RECORDATORIOS_HECHOS = false;

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

    if (metodo === 'GET' && url.pathname === '/mis-citas') {
      exigir('paciente');
      return usuario.id === 2 ? ordenarMisCitas().map(conReglas) : [];
    }

    // Reprogramar o cancelar con sesión: mismas reglas que el enlace.
    // La hora 10:00 simula que otra persona la acaba de tomar.
    if (metodo === 'POST' && partes[0] === 'mis-citas' && partes[1]) {
      exigir('paciente');
      const cita = usuario.id === 2 && citasDePaciente().find((c) => c.id === Number(partes[1]));
      if (!cita) throw new ErrorApi('Cita no encontrada.', 404);
      const reglas = reglasDemo(cita);

      if (partes[2] === 'reprogramar') {
        if (!reglas.puedeReprogramar) throw new ErrorApi(reglas.motivo, 409);
        const [, fecha, hora] = String(cuerpo.franjaId).split('|');
        if (hora === '10:00') throw new ErrorApi('Esa hora acaba de ser tomada por otra persona. Elige otra.', 409);
        Object.assign(cita, { fecha, hora, reprogramaciones: cita.reprogramaciones + 1 });
        return { mensaje: 'Tu cita fue reprogramada.', cita: conReglas(cita), whatsapp: 'pendiente' };
      }
      if (partes[2] === 'cancelar') {
        if (!reglas.puedeCancelar) throw new ErrorApi(reglas.motivo, 409);
        cita.estado = 'cancelada';
        return { mensaje: 'Tu cita fue cancelada. La hora quedó libre para otra persona.' };
      }
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

    if (metodo === 'GET' && url.pathname === '/admin/especialistas') {
      exigir('administrador');
      return ESPECIALISTAS_ADMIN;
    }

    if (partes[0] === 'admin' && partes[1] === 'citas' && partes[2]) {
      exigir('administrador');
      const cita = agendaDemo().find((c) => c.id === Number(partes[2]));
      if (!cita) throw new ErrorApi('Cita no encontrada.', 404);
      if (cita.estado !== 'confirmada') throw new ErrorApi(`La cita ya está ${cita.estado.replace('_', ' ')}.`, 409);

      if (metodo === 'PATCH' && partes[3] === 'estado') {
        if (cuerpo.estado === 'cancelada') {
          Object.assign(cita, { estado: 'cancelada', canceladaPor: 'administrador' });
          return { mensaje: 'Cita cancelada.', notificacion: notificacionDemo(cita, 'cancelacion') };
        }
        cita.estado = cuerpo.estado;
        return { mensaje: cuerpo.estado === 'atendida' ? 'Cita marcada como atendida.' : 'Cita marcada como no asistió.' };
      }

      if (metodo === 'POST' && partes[3] === 'reprogramar') {
        const [especialistaId, fecha, hora] = String(cuerpo.franjaId).split('|');
        if (hora === '10:00') throw new ErrorApi('Esa hora acaba de ser tomada. Elige otra.', 409);
        const esp = ESPECIALISTAS_ADMIN.find((e) => e.id === Number(especialistaId));
        Object.assign(cita, { fecha, hora, especialistaId: esp?.id ?? cita.especialistaId, especialista: esp?.nombre ?? cita.especialista });
        return { mensaje: 'Cita reprogramada.', cita: { ...cita }, notificacion: notificacionDemo(cita, 'reprogramacion') };
      }
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
      const fecha = sumarDias(hoyColombia(), 1);
      const citas = RECORDATORIOS_HECHOS ? [] : agendaDemo().filter((c) => c.fecha === fecha && c.estado === 'confirmada');
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

    if (metodo === 'POST' && url.pathname === '/citas') {
      if (cuerpo.documento === '999999999') {
        throw new ErrorApi('Ya tienes una cita activa. Cancélala o espera a que pase para pedir otra.', 409);
      }
      const [, fecha, hora] = String(cuerpo.franjaId).split('|');
      const esp = ESPECIALIDADES.find((e) => e.id === cuerpo.especialidadId);
      return {
        mensaje: 'Cita confirmada.',
        cita: {
          id: 1, estado: 'confirmada', paciente: cuerpo.nombreCompleto,
          especialidad: esp?.nombre, especialista: 'Especialista de demostración',
          fecha, hora, sede: 'Rivera', direccion: 'Carrera 7 No. 3-61', reprogramaciones: 0,
        },
        whatsapp: 'pendiente',
      };
    }

    // ---- Gestionar cita (gestionar-cita.html?codigo=…) ----
    // Códigos de prueba: DEMO-0000 (se puede todo), DEMO-REPROGRAMADA
    // (ya reprogramó una vez), DEMO-CERCA (faltan menos de 24 h),
    // DEMO-CANCELADA. Cualquier otro devuelve 404.
    if (partes[0] === 'citas' && partes[1] === 'gestion' && partes[2]) {
      const cita = citaDemo(partes[2]);
      if (!cita) throw new ErrorApi('El enlace no es válido o ya no está vigente.', 404);

      if (metodo === 'GET' && !partes[3]) return { cita: { ...cita }, ...reglasDemo(cita) };

      if (metodo === 'POST' && partes[3] === 'reprogramar') {
        if (!reglasDemo(cita).puedeReprogramar) throw new ErrorApi('Esta cita ya no se puede reprogramar.', 409);
        const [, fecha, hora] = String(cuerpo.franjaId).split('|');
        if (hora === '10:00' ) throw new ErrorApi('Esa hora acaba de ser tomada. Elige otra.', 409);
        Object.assign(cita, { fecha, hora, reprogramaciones: cita.reprogramaciones + 1 });
        return { mensaje: 'Cita reprogramada.', cita: { ...cita }, ...reglasDemo(cita), whatsapp: 'pendiente' };
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
