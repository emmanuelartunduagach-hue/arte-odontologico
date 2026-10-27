// Revisión de la configuración al arrancar: avisa de los valores que, sin fallar,
// dejarían el sistema funcionando mal (por ejemplo, enlaces rotos o un modo ignorado).

const MODOS_WHATSAPP = ['manual', 'consola', 'twilio', 'api'];

// Quita espacios y comillas sueltas, que suelen colarse al pegar el valor en el panel del hosting.
function normalizarModoWhatsapp(valor) {
  return String(valor || 'manual').trim().replace(/^["']+|["']+$/g, '').trim().toLowerCase();
}

function avisosDeConfiguracion(env = process.env) {
  const avisos = [];

  const url = String(env.URL_PUBLICA || '').trim();
  if (!url) {
    avisos.push('URL_PUBLICA está vacía: los enlaces «Gestionar mi cita» usarán http://localhost:5500.');
  } else {
    let direccion = null;
    try { direccion = new URL(url); } catch { /* se avisa abajo */ }
    const local = direccion && ['localhost', '127.0.0.1'].includes(direccion.hostname);
    if (!direccion || !/^https?:$/.test(direccion.protocol) || (!local && !direccion.hostname.includes('.'))) {
      avisos.push(`URL_PUBLICA («${url}») no es una dirección válida: los enlaces de los mensajes quedarían rotos. Use el dominio completo, con https://.`);
    } else if (local && env.NODE_ENV === 'production') {
      avisos.push('URL_PUBLICA apunta a localhost en producción: los enlaces de los mensajes no abrirían para los pacientes.');
    }
  }

  const modoPedido = env.WHATSAPP_MODO;
  const modo = normalizarModoWhatsapp(modoPedido);
  if (modoPedido !== undefined && String(modoPedido).trim() !== '' && !MODOS_WHATSAPP.includes(modo)) {
    avisos.push(`WHATSAPP_MODO («${modoPedido}») no es válido (use ${MODOS_WHATSAPP.join(', ')}): se usa el modo manual.`);
  }
  if (modo === 'twilio') {
    const faltan = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_DESDE'].filter((n) => !String(env[n] || '').trim());
    if (faltan.length) avisos.push(`WHATSAPP_MODO=twilio, pero faltan: ${faltan.join(', ')}.`);
  }
  if (modo === 'api') {
    const faltan = ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_ID'].filter((n) => !String(env[n] || '').trim());
    if (faltan.length) avisos.push(`WHATSAPP_MODO=api, pero faltan: ${faltan.join(', ')}.`);
  }

  return avisos;
}

module.exports = { MODOS_WHATSAPP, normalizarModoWhatsapp, avisosDeConfiguracion };
