/* Agendar una cita sin crear cuenta.

   Flujo (contrato API v2):
     tarjeta de especialidad → especialista → día (calendario) →
     hora → datos del paciente → confirmación.

   Las utilidades (el, calendario, fechas…) están en js/comun.js. */

let especialidades = null;  // lista que devuelve GET /especialidades
let turno = 0;              // descarta respuestas de un flujo ya abandonado
const estado = {};

/* ---------- Tarjetas de especialidades ---------- */

async function cargarEspecialidades() {
  if (!especialidades) especialidades = await api('/especialidades');
  return especialidades;
}

async function pintarEspecialidades() {
  const contenedor = document.getElementById('lista-especialidades');
  if (!contenedor) return;

  let lista;
  try {
    lista = await cargarEspecialidades();
  } catch {
    // Sin API se muestra el catálogo base para que la página no quede vacía;
    // al tocar una tarjeta se explica que no hay conexión.
    lista = SERVICIOS.map((s) => ({ codigo: s.id, nombre: s.nombre, descripcion: s.desc }));
  }

  const iconoPorCodigo = Object.fromEntries(SERVICIOS.map((s) => [s.id, s.icono]));
  contenedor.replaceChildren(...lista.map((e) => {
    const marca = el('span', { class: 'servicio__icono' });
    marca.innerHTML = svgIcono(iconoPorCodigo[e.codigo]); // SVG estático del propio proyecto
    return el('button', { type: 'button', class: 'servicio', 'data-abrir': 'modal-agendar', 'data-especialidad': e.codigo },
      marca,
      el('span', {},
        el('span', { class: 'servicio__nombre', texto: e.nombre }),
        el('span', { class: 'servicio__desc', texto: e.descripcion || '' })));
  }));
}

/* ---------- Flujo ---------- */

function reiniciar() {
  Object.keys(estado).forEach((k) => delete estado[k]);
  Object.assign(estado, {
    paso: 'cargando', mensaje: 'Cargando…', error: null, reintentar: null,
    especialidad: null, especialistas: [], especialista: null,
    mes: null, dias: null, fecha: null, horas: null, franja: null,
    datos: {}, enviando: false, cita: null, pasoPintado: null,
  });
}

async function comenzar(codigo) {
  const mio = ++turno;
  reiniciar();
  estado.mensaje = 'Cargando especialistas…';
  pintar();
  try {
    const lista = await cargarEspecialidades();
    const esp = lista.find((e) => e.codigo === codigo);
    if (!esp) throw new ErrorApi('Esa especialidad no está disponible por ahora.', 404);
    const especialistas = await api(`/especialidades/${esp.id}/especialistas`);
    if (mio !== turno) return;
    estado.especialidad = esp;
    estado.especialistas = especialistas;
    if (especialistas.length === 1) return elegirEspecialista(especialistas[0]);
    estado.paso = 'especialista';
    pintar();
  } catch (error) {
    if (mio === turno) fallar(error, () => comenzar(codigo));
  }
}

function fallar(error, reintentar) {
  estado.paso = 'error';
  estado.error = error;
  estado.reintentar = reintentar;
  pintar();
}

async function elegirEspecialista(esp) {
  const mio = ++turno;
  estado.especialista = esp;
  estado.mes = hoyColombia().slice(0, 7);
  estado.fecha = estado.horas = estado.franja = null;
  estado.paso = 'dia';
  await cargarMes(mio);
}

async function cargarMes(mio = turno) {
  estado.dias = null;
  pintar();
  try {
    const r = await api(`/especialistas/${estado.especialista.id}/calendario?mes=${estado.mes}`);
    if (mio !== turno) return;
    estado.dias = new Map(r.dias.map((d) => [d.fecha, d.horasLibres]));
  } catch (error) {
    if (mio !== turno) return;
    return fallar(error, () => { estado.paso = 'dia'; cargarMes(); });
  }
  pintar();
}

function cambiarMes(delta) {
  const [a, m] = estado.mes.split('-').map(Number);
  const nuevo = new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 7);
  if (nuevo < hoyColombia().slice(0, 7)) return;
  estado.mes = nuevo;
  estado.fecha = estado.horas = estado.franja = null;
  cargarMes(++turno);
}

async function elegirDia(fecha) {
  const mio = ++turno;
  estado.fecha = fecha;
  estado.horas = null;
  estado.franja = null;
  pintar();
  try {
    const horas = await api(`/especialistas/${estado.especialista.id}/horas?fecha=${fecha}`);
    if (mio !== turno) return;
    estado.horas = horas;
  } catch (error) {
    if (mio !== turno) return;
    return fallar(error, () => { estado.paso = 'dia'; elegirDia(fecha); });
  }
  pintar();
  document.querySelector('#agendar-cuerpo .horas, #agendar-cuerpo [data-sin-horas]')?.scrollIntoView({ block: 'nearest' });
}

function elegirHora(franja) {
  estado.franja = franja;
  estado.paso = 'datos';
  pintar();
}

function volverA(paso) {
  if (paso === 'especialista') {
    estado.especialista = estado.fecha = estado.horas = estado.franja = estado.dias = null;
    estado.paso = 'especialista';
    pintar();
  } else {
    estado.franja = null;
    estado.paso = 'dia';
    if (estado.fecha) elegirDia(estado.fecha); else pintar();
  }
}

/* ---------- Pintado ---------- */

function pintar() {
  const cuerpo = document.getElementById('agendar-cuerpo');
  if (!cuerpo) return;

  const idPrevio = document.activeElement?.dataset?.idFoco;
  const pintores = { cargando: pintarCargando, error: pintarError, especialista: pintarEspecialista, dia: pintarDia, datos: pintarDatos, listo: pintarListo };
  const nodos = [].concat(pintores[estado.paso]()).filter(Boolean);
  if (typeof window.API_DEMO === 'function') {
    nodos.unshift(el('p', { class: 'alerta alerta--info', texto: 'Modo demostración: los datos son de prueba y no se guarda nada.' }));
  }
  cuerpo.replaceChildren(...nodos);

  document.getElementById('agendar-sub').textContent = subtitulo();

  if (estado.pasoPintado !== estado.paso) cuerpo.querySelector('[data-foco]')?.focus();
  else if (idPrevio) cuerpo.querySelector(`[data-id-foco="${idPrevio}"]`)?.focus();
  estado.pasoPintado = estado.paso;
}

function subtitulo() {
  if (estado.paso === 'listo') return 'Tu cita quedó registrada.';
  if (estado.especialidad) return estado.especialidad.nombre;
  return 'Agenda tu cita en pocos pasos.';
}

function titulo(texto) {
  return el('h3', { class: 'agendar__titulo', tabindex: '-1', 'data-foco': true, texto });
}

function resumen(conHora) {
  return el('dl', { class: 'resumen' },
    dato('Especialidad', estado.especialidad.nombre),
    dato('Especialista', estado.especialista.nombre, estado.especialistas.length > 1 ? () => volverA('especialista') : null),
    conHora && dato('Fecha y hora', `${fechaLarga(estado.fecha)}, ${horaLarga(estado.franja.hora)}`, () => volverA('dia')));
}

function pintarCargando() {
  return el('p', { class: 'estado-carga', role: 'status', texto: estado.mensaje });
}

function pintarError() {
  return [
    el('p', { class: 'alerta', role: 'alert', texto: estado.error.message }),
    el('button', { type: 'button', class: 'btn btn--primario', onclick: estado.reintentar, texto: 'Reintentar' }),
  ];
}

function pintarEspecialista() {
  return [
    titulo('Elige tu especialista'),
    estado.especialistas.length
      ? el('ul', { class: 'opciones' }, estado.especialistas.map((e) =>
        el('li', {}, el('button', { type: 'button', class: 'opcion', onclick: () => elegirEspecialista(e), texto: e.nombre }))))
      : el('p', { class: 'alerta', texto: 'Por ahora no hay especialistas disponibles para esta especialidad. Escríbenos por WhatsApp y te ayudamos.' }),
  ];
}

function pintarDia() {
  const calendario = calendarioMes({
    mes: estado.mes, dias: estado.dias, fecha: estado.fecha,
    alElegirDia: elegirDia, alCambiarMes: cambiarMes,
  });
  const horas = estado.fecha
    ? listaHoras({ fecha: estado.fecha, horas: estado.horas, alElegirHora: elegirHora })
    : null;

  return [titulo('Elige el día y la hora'), resumen(false), calendario, horas];
}

/* ---------- Formulario de datos ---------- */

function campo(nombre, etiqueta, tipo, extra = {}) {
  const id = `agendar-${nombre}`;
  return el('div', { class: 'campo' },
    el('label', { class: 'campo__etiqueta', for: id, texto: etiqueta }),
    el('input', { class: 'campo__control', id, name: nombre, type: tipo, value: estado.datos[nombre] || '', 'aria-describedby': `error-${nombre}`, ...extra }),
    el('p', { class: 'campo__error', id: `error-${nombre}`, hidden: true }));
}

function pintarDatos() {
  const form = el('form', { id: 'form-agendar', novalidate: true, onsubmit: enviar, oninput: guardarBorrador },
    campo('nombreCompleto', 'Nombre completo', 'text', { autocomplete: 'name', 'aria-required': 'true' }),
    el('div', { class: 'rejilla-2' },
      campo('documento', 'Documento de identidad', 'text', { inputmode: 'numeric', autocomplete: 'off', 'aria-required': 'true' }),
      campo('telefono', 'Celular', 'tel', { autocomplete: 'tel', placeholder: '300 123 4567', 'aria-required': 'true' })),
    campo('correo', 'Correo electrónico (opcional)', 'email', { autocomplete: 'email' }),

    // Campo trampa contra bots: oculto con CSS (no con type="hidden"), fuera del
    // orden de tabulación y de los lectores de pantalla. Debe viajar vacío.
    el('div', { class: 'trampa', 'aria-hidden': 'true' },
      el('label', { for: 'agendar-sitioWeb', texto: 'Sitio web' }),
      el('input', { id: 'agendar-sitioWeb', type: 'text', name: 'sitioWeb', tabindex: '-1', autocomplete: 'off' })),

    el('div', { class: 'campo' },
      el('label', { class: 'casilla' },
        el('input', { type: 'checkbox', name: 'autorizacionDatos', checked: estado.datos.autorizacionDatos, 'aria-describedby': 'error-autorizacionDatos' }),
        el('span', {}, 'Autorizo a Arte Odontológico a tratar mis datos personales para agendar y gestionar mi cita, según la ',
          el('a', { href: 'politica-datos.html', target: '_blank', rel: 'noopener noreferrer', texto: 'política de tratamiento de datos' }), '.')),
      el('p', { class: 'campo__error', id: 'error-autorizacionDatos', hidden: true })),

    el('div', { class: 'alerta', role: 'alert', hidden: true, 'data-alerta': true }),
    el('button', { type: 'submit', class: 'btn btn--primario btn--bloque btn--grande', texto: 'Confirmar cita' }));

  return [titulo('Tus datos'), resumen(true), form];
}

function guardarBorrador(e) {
  const f = e.currentTarget;
  estado.datos = {
    nombreCompleto: f.nombreCompleto.value, documento: f.documento.value,
    telefono: f.telefono.value, correo: f.correo.value, autorizacionDatos: f.autorizacionDatos.checked,
  };
}

function validar(d) {
  const errores = {};
  if (d.nombreCompleto.trim().length < 3) errores.nombreCompleto = 'Escribe tu nombre completo.';
  if (!/^\d{5,20}$/.test(d.documento.trim())) errores.documento = 'Escribe tu documento solo con números (de 5 a 20 dígitos).';
  if (!/^\d{7,15}$/.test(d.telefono.replace(/[\s\-+]/g, ''))) errores.telefono = 'Escribe un celular válido, por ejemplo 300 123 4567.';
  if (d.correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo.trim())) errores.correo = 'Escribe un correo válido o déjalo vacío.';
  if (!d.autorizacionDatos) errores.autorizacionDatos = 'Debes autorizar el tratamiento de tus datos para agendar.';
  return errores;
}

function limpiarErrores(form) {
  form.querySelectorAll('.campo__error').forEach((p) => { p.hidden = true; p.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
  const alerta = form.querySelector('[data-alerta]');
  alerta.hidden = true;
  alerta.replaceChildren();
}

function mostrarErrores(form, errores) {
  let primero = null;
  const sueltos = [];
  for (const [nombre, mensaje] of Object.entries(errores)) {
    const aviso = form.querySelector(`#error-${nombre}`);
    const entrada = form.elements[nombre];
    if (!aviso || !entrada) { sueltos.push(mensaje); continue; }
    aviso.textContent = mensaje;
    aviso.hidden = false;
    entrada.setAttribute('aria-invalid', 'true');
    primero = primero || entrada;
  }
  if (sueltos.length) mostrarAlerta(form, sueltos.join(' '));
  primero?.focus();
}

function mostrarAlerta(form, mensaje, accion) {
  const alerta = form.querySelector('[data-alerta]');
  alerta.replaceChildren(mensaje, accion && el('div', { class: 'alerta__accion' }, accion));
  alerta.hidden = false;
}

async function enviar(e) {
  e.preventDefault();
  if (estado.enviando) return;
  const form = e.currentTarget;
  const boton = form.querySelector('[type="submit"]');
  const datos = {
    nombreCompleto: form.nombreCompleto.value, documento: form.documento.value, telefono: form.telefono.value,
    correo: form.correo.value, autorizacionDatos: form.autorizacionDatos.checked, sitioWeb: form.sitioWeb.value,
  };

  limpiarErrores(form);
  const errores = validar(datos);
  if (Object.keys(errores).length) return mostrarErrores(form, errores);

  estado.enviando = true;
  boton.disabled = true;
  boton.textContent = 'Agendando…';
  try {
    estado.cita = await api('/citas', {
      metodo: 'POST',
      cuerpo: {
        especialidadId: estado.especialidad.id,
        franjaId: estado.franja.franjaId,
        nombreCompleto: datos.nombreCompleto.trim(),
        documento: datos.documento.trim(),
        telefono: datos.telefono.trim(),
        correo: datos.correo.trim(),
        autorizacionDatos: true,
        sitioWeb: datos.sitioWeb,
      },
    });
    estado.paso = 'listo';
    pintar();
  } catch (error) {
    if (error.campos) mostrarErrores(form, error.campos);
    else if (error.estado === 409) {
      // La hora pudo haberse ocupado, o la persona ya tiene una cita activa:
      // se muestra el mensaje del servidor y se ofrece volver a elegir.
      mostrarAlerta(form, error.message, el('button', { type: 'button', class: 'btn btn--secundario', onclick: () => volverA('dia'), texto: 'Elegir otra hora' }));
    } else mostrarAlerta(form, error.message);
  } finally {
    estado.enviando = false;
    boton.disabled = false;
    boton.textContent = 'Confirmar cita';
  }
}

/* ---------- Confirmación ---------- */

function pintarListo() {
  const { cita, enlaceGestion, whatsapp } = estado.cita;
  const entrada = el('input', { class: 'campo__control', type: 'text', readonly: true, value: enlaceGestion || '', 'aria-label': 'Enlace para gestionar tu cita' });
  const copiar = el('button', { type: 'button', class: 'btn btn--secundario', texto: 'Copiar enlace' });
  copiar.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(enlaceGestion); copiar.textContent = '¡Copiado!'; }
    catch { entrada.select(); copiar.textContent = 'Cópialo con Ctrl+C'; }
  });
  entrada.addEventListener('focus', () => entrada.select());

  return [
    el('div', { class: 'exito' },
      icono('<circle cx="12" cy="12" r="10"/><path d="m8 12.5 2.8 2.8L16 9.5"/>'),
      titulo('¡Tu cita quedó confirmada!')),
    el('dl', { class: 'resumen' },
      cita.paciente && dato('Paciente', cita.paciente),
      cita.especialidad && dato('Especialidad', cita.especialidad),
      cita.especialista && dato('Especialista', cita.especialista),
      dato('Fecha y hora', `${fechaLarga(cita.fecha)}, ${horaLarga(cita.hora)}`),
      cita.direccion && dato('Dónde', cita.direccion)),
    el('p', { class: 'agendar__nota', texto: whatsapp === 'enviado' ? 'Te enviamos la confirmación por WhatsApp.' : 'Te enviaremos la confirmación por WhatsApp.' }),
    enlaceGestion && el('div', { class: 'enlace-gestion' },
      el('p', { class: 'campo__etiqueta', texto: 'Tu enlace para gestionar la cita' }),
      el('div', { class: 'enlace-gestion__fila' }, entrada, copiar),
      el('p', { class: 'campo__ayuda', texto: 'Guárdalo: con él puedes reprogramar o cancelar tu cita.' })),
    el('button', { type: 'button', class: 'btn btn--primario btn--bloque', onclick: () => cerrarModal(document.getElementById('modal-agendar')), texto: 'Listo' }),
  ];
}

/* ---------- Arranque ---------- */

document.addEventListener('DOMContentLoaded', () => {
  pintarEspecialidades();

  // "Agendar mi cita" baja a las especialidades y deja el foco en su título.
  document.querySelectorAll('[data-ir-especialidades]').forEach((enlace) => {
    enlace.addEventListener('click', () => {
      setTimeout(() => document.getElementById('titulo-especialidades')?.focus({ preventScroll: true }), 450);
    });
  });
});

document.addEventListener('click', (e) => {
  const tarjeta = e.target.closest('[data-especialidad]');
  if (tarjeta) comenzar(tarjeta.dataset.especialidad);
});
