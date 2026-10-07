/* Modo demostración — SOLO PARA DESARROLLO.

   Simula la API (contrato v2) para poder ver y probar el flujo de
   agendar sin backend ni base de datos. Se activa únicamente si la
   página se abre en localhost/127.0.0.1 con `?demo=1`; en cualquier
   otro caso este archivo no hace nada. No guarda ningún dato.

   Ejemplo: http://localhost:5500/frontend/index.html?demo=1
   Para probar el error de "ya tiene una cita activa" usa el documento
   999999999. */

(function () {
  const esLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!esLocal || !new URLSearchParams(location.search).has('demo')) return;

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

  window.API_DEMO = async function (ruta, metodo, cuerpo) {
    await espera(350);
    const url = new URL(ruta, 'http://demo');
    const partes = url.pathname.split('/').filter(Boolean);

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
        enlaceGestion: `${location.origin}/frontend/gestionar-cita.html?codigo=DEMO-0000&demo=1`,
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
