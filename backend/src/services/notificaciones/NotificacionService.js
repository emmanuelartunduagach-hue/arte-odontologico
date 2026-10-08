/* Servicio de notificaciones por WhatsApp.

   Los controladores solo llaman a `notificarCita()`. Aquí se arma el
   texto, se guarda en la tabla `notificaciones` y se entrega al
   proveedor según WHATSAPP_MODO (manual, consola o api). Cambiar de
   modo es cambiar el .env, sin tocar los controladores.

   Nunca lanza: un fallo al notificar no debe deshacer ni bloquear
   el agendamiento. El fallo queda registrado como 'fallida' y el
   mensaje sigue disponible para enviarlo a mano desde el panel. */

const citaModelo = require('../../models/cita.model');
const notificacionModelo = require('../../models/notificacion.model');
const { generarCodigoGestion } = require('../../utils/codigos');
const mensajes = require('./mensajes');
const ProveedorWhatsApp = require('./proveedores/ProveedorWhatsApp');

/**
 * @param {object} p
 * @param {number} p.citaId
 * @param {'confirmacion'|'reprogramacion'|'cancelacion'|'recordatorio'} p.tipo
 * @param {string} [p.codigo]  código "Gestionar mi cita" en claro, si se tiene.
 *   Si el mensaje necesita enlace y no se pasa, se genera uno nuevo y el
 *   anterior deja de servir (en la base solo se guarda el hash).
 * @returns {Promise<{id?:number, estado:string, enlaceWhatsApp?:string}>}
 */
async function notificarCita({ citaId, tipo, codigo }) {
  let notificacionId;
  let enlace = null;  // si el envío falla, la secretaria lo envía a mano con este enlace
  try {
    const cita = await citaModelo.buscarDetalle(citaId);
    if (!cita) throw new Error(`Cita ${citaId} no encontrada`);

    let codigoUsado = codigo;
    if (mensajes.LLEVA_ENLACE.has(tipo) && !codigoUsado) {
      const nuevo = generarCodigoGestion();
      await citaModelo.actualizarCodigoHash(citaId, nuevo.hash);
      codigoUsado = nuevo.codigo;
    }

    const { texto, datos } = mensajes.construir(tipo, cita, codigoUsado);
    enlace = mensajes.enlaceWhatsApp(cita.telefono, texto);
    notificacionId = await notificacionModelo.crear({
      citaId,
      tipo,
      destino: cita.telefono,
      mensaje: texto,
    });

    const resultado = await ProveedorWhatsApp.enviar({ destino: cita.telefono, texto, tipo, datos });
    await notificacionModelo.marcar(notificacionId, resultado.estado, resultado.detalle);

    return {
      id: notificacionId,
      estado: resultado.estado,
      enlaceWhatsApp: enlace,
    };
  } catch (error) {
    console.error(`No se pudo notificar la cita ${citaId} (${tipo}):`, error.message);
    if (notificacionId) {
      await notificacionModelo.marcar(notificacionId, 'fallida', error.message).catch(() => {});
    }
    return { id: notificacionId, estado: 'fallida', enlaceWhatsApp: notificacionId ? enlace : null };
  }
}

module.exports = { notificarCita };
