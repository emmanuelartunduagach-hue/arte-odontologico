/* Proveedor de WhatsApp con cuatro modos (variable WHATSAPP_MODO):

   - manual  (por defecto): no envía nada. El mensaje queda
     "pendiente" y la secretaria lo envía desde su WhatsApp Business
     con un clic en el panel (enlace wa.me con el texto ya escrito).
     Funciona sin trámites con Meta.
   - consola: imprime el mensaje en la terminal y lo marca como
     enviado. Útil para desarrollo y demostraciones.
   - twilio: lo envía Twilio con el texto completo. Pensado para las
     pruebas con el WhatsApp Sandbox de Twilio mientras la clínica
     tramita la API de Meta. Necesita TWILIO_ACCOUNT_SID,
     TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_DESDE.
   - api: lo envía la API de WhatsApp Cloud de Meta usando una
     plantilla aprobada. Necesita WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
     y las plantillas WHATSAPP_PLANTILLA_<TIPO> aprobadas en Meta.

   Devuelve { estado: 'enviada' | 'pendiente', detalle }. Si algo
   falla lanza un error; NotificacionService lo registra como
   'fallida' sin tumbar la operación de la cita, y la secretaria
   puede enviarlo a mano desde el panel. */

const VERSION_API = () => process.env.WHATSAPP_API_VERSION || 'v21.0';

function modo() {
  const m = (process.env.WHATSAPP_MODO || 'manual').toLowerCase();
  return ['manual', 'consola', 'twilio', 'api'].includes(m) ? m : 'manual';
}

async function enviar({ destino, texto, tipo, datos }) {
  const modoActual = modo();

  if (modoActual === 'manual') {
    return { estado: 'pendiente', detalle: 'Por enviar desde el panel' };
  }

  if (modoActual === 'consola') {
    console.log(`\n[WhatsApp -> +${destino}] (${tipo})\n${texto}\n`);
    return { estado: 'enviada', detalle: 'consola' };
  }

  if (modoActual === 'twilio') return enviarConTwilio({ destino, texto });

  // Modo api: plantilla aprobada en Meta. Los parámetros van en el
  // orden {{1}} nombre, {{2}} fecha, {{3}} hora, {{4}} especialista,
  // {{5}} dirección, {{6}} enlace; la plantilla usa los que necesite.
  const token = process.env.WHATSAPP_TOKEN;
  const telefonoId = process.env.WHATSAPP_PHONE_ID;
  const plantilla = process.env[`WHATSAPP_PLANTILLA_${tipo.toUpperCase()}`];
  if (!token || !telefonoId || !plantilla) {
    throw new Error(`Falta configurar WHATSAPP_TOKEN, WHATSAPP_PHONE_ID o WHATSAPP_PLANTILLA_${tipo.toUpperCase()}`);
  }

  const cantidad = Number(process.env[`WHATSAPP_PARAMETROS_${tipo.toUpperCase()}`] || 6);
  const valores = [datos.nombre, datos.fecha, datos.hora, datos.especialista, datos.direccion, datos.enlace];
  const parametros = valores.slice(0, cantidad).map((text) => ({ type: 'text', text: String(text) }));

  const respuesta = await fetch(
    `https://graph.facebook.com/${VERSION_API()}/${telefonoId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destino,
        type: 'template',
        template: {
          name: plantilla,
          language: { code: process.env.WHATSAPP_IDIOMA || 'es' },
          components: [{ type: 'body', parameters: parametros }],
        },
      }),
    }
  );

  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(`Meta respondió ${respuesta.status}: ${cuerpo?.error?.message || 'sin detalle'}`);
  }
  return { estado: 'enviada', detalle: cuerpo?.messages?.[0]?.id || 'enviado' };
}

/* Twilio: POST /Messages.json con autenticación básica (SID y token).
   En el Sandbox, cada número que recibe debe haberse unido antes
   enviando "join <código>" al número del sandbox; si no, Twilio
   responde con error y el mensaje queda "fallida" en el panel. */
async function enviarConTwilio({ destino, texto }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const desde = (process.env.TWILIO_WHATSAPP_DESDE || '').replace(/^whatsapp:/, '');
  if (!sid || !token || !desde) {
    throw new Error('Falta configurar TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN o TWILIO_WHATSAPP_DESDE');
  }

  const respuesta = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: `whatsapp:${desde.startsWith('+') ? desde : `+${desde}`}`,
      To: `whatsapp:+${String(destino).replace(/^\+/, '')}`,
      Body: texto,
    }),
  });

  const cuerpo = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(`Twilio respondió ${respuesta.status}: ${cuerpo?.message || 'sin detalle'}${cuerpo?.code ? ` (código ${cuerpo.code})` : ''}`);
  }
  return { estado: 'enviada', detalle: cuerpo?.sid || 'enviado' };
}

module.exports = { enviar, modo };
