/* Mis citas (mis-citas.html), panel del paciente con usuario.

   Contrato API v2, sección 3:
     GET /mis-citas  → citas con el formato de `cita`, la más reciente primero.

   Reprogramar o cancelar con sesión aún no existe en la API: por ahora
   el paciente usa el enlace que le llegó por WhatsApp. */

const sesion = exigirSesion('paciente');
const cuerpo = document.getElementById('panel-cuerpo');

/** Reemplaza el contenido; acepta nodos, listas y valores falsos (se omiten). */
function pintar(...nodos) {
  cuerpo.replaceChildren(...nodos.flat(2).filter(Boolean));
}

const NOMBRE_ESTADO = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  atendida: 'Atendida',
  no_asistio: 'No asistió',
};

const ESTADOS_VIVOS = ['pendiente', 'confirmada'];

function esProxima(cita) {
  const hoy = hoyColombia();
  return ESTADOS_VIVOS.includes(cita.estado) && cita.fecha >= hoy;
}

function tarjeta(cita) {
  return el('article', { class: 'cita' + (esProxima(cita) ? '' : ' cita--pasada') },
    el('div', { class: 'cita__cabecera' },
      el('h3', { class: 'cita__titulo', texto: `${fechaLarga(cita.fecha)}, ${horaLarga(cita.hora)}` }),
      el('span', { class: `estado estado--${cita.estado}`, texto: NOMBRE_ESTADO[cita.estado] || cita.estado })),
    el('dl', { class: 'resumen' },
      dato('Especialidad', cita.especialidad),
      dato('Especialista', cita.especialista),
      dato('Dirección', cita.direccion)));
}

function encabezado() {
  const nombre = sesion.usuario.nombre.split(' ')[0];
  return [
    typeof window.API_DEMO === 'function'
      && el('p', { class: 'alerta alerta--info', texto: 'Modo demostración: los datos son de prueba y no se guarda nada.' }),
    el('h1', { class: 'gestion__titulo', texto: `Hola, ${nombre}` }),
    el('div', { class: 'acciones' },
      el('a', { class: 'btn btn--primario', href: 'index.html#especialidades', texto: 'Agendar una cita' }),
      el('a', { class: 'btn btn--secundario', href: 'cambiar-contrasena.html', texto: 'Cambiar contraseña' })),
  ];
}

async function cargar() {
  pintar(encabezado(),
    el('p', { class: 'estado-carga', role: 'status', texto: 'Cargando tus citas…' }));

  let citas;
  try {
    citas = await api('/mis-citas');
  } catch (err) {
    pintar(encabezado(),
      el('p', { class: 'alerta', role: 'alert', texto: err.message }),
      el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'btn btn--secundario', onclick: cargar, texto: 'Reintentar' })));
    return;
  }

  // La API las entrega de la más reciente a la más antigua; las próximas
  // se muestran de la más cercana a la más lejana.
  const proximas = citas.filter(esProxima).reverse();
  const anteriores = citas.filter((c) => !esProxima(c));

  pintar(encabezado(),
    el('h2', { class: 'lista-citas__grupo', texto: 'Próximas citas' }),
    proximas.length
      ? [
        el('p', { class: 'gestion__intro', texto: 'Para reprogramar o cancelar, usa el enlace que te llegó por WhatsApp o comunícate con el consultorio.' }),
        el('div', { class: 'lista-citas' }, proximas.map(tarjeta)),
      ]
      : el('p', { class: 'gestion__intro', texto: 'No tienes citas próximas.' }),
    anteriores.length > 0 && [
      el('h2', { class: 'lista-citas__grupo', texto: 'Historial' }),
      el('div', { class: 'lista-citas' }, anteriores.map(tarjeta)),
    ]);
}

if (sesion) {
  document.querySelector('[data-nombre-usuario]').textContent = sesion.usuario.nombre;
  cargar();
}
