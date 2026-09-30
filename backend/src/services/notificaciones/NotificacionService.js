/* Servicio de notificaciones.

   Diseñado como capa de abstracción sobre uno o varios
   proveedores (patrón Strategy). El resto de la aplicación
   llama siempre a `enviar()` y nunca sabe si detrás hay correo,
   WhatsApp o ambos.

   Motivo: la propuesta aprobada exige notificaciones por correo,
   pero se está tramitando el cambio a WhatsApp. Con esta capa,
   cambiar de canal es modificar NOTIFICACIONES_CANAL en el .env,
   sin tocar los controladores. */

const ProveedorCorreo = require('./proveedores/ProveedorCorreo');
const ProveedorWhatsApp = require('./proveedores/ProveedorWhatsApp');

const PROVEEDORES = {
  correo: ProveedorCorreo,
  whatsapp: ProveedorWhatsApp,
};

function canalesActivos() {
  const configurado = (process.env.NOTIFICACIONES_CANAL || 'correo').toLowerCase();
  if (configurado === 'ambos') return ['correo', 'whatsapp'];
  return PROVEEDORES[configurado] ? [configurado] : ['correo'];
}

/**
 * Envía una notificación por todos los canales activos.
 * Nunca lanza: un fallo de envío no debe tumbar el agendamiento
 * de la cita. Devuelve el resultado por canal para registrarlo
 * en la tabla `notificaciones`.
 */
async function enviar({ tipo, cita, paciente }) {
  const resultados = [];

  for (const canal of canalesActivos()) {
    try {
      const detalle = await PROVEEDORES[canal].enviar({ tipo, cita, paciente });
      resultados.push({ canal, estado: 'enviada', detalle });
    } catch (error) {
      console.error(`Fallo al notificar por ${canal}:`, error.message);
      resultados.push({ canal, estado: 'fallida', detalle: error.message });
    }
  }

  return resultados;
}

module.exports = { enviar, canalesActivos };
