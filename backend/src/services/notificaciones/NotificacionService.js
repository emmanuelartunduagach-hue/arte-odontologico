const citaModelo = require('../../models/cita.model');
const notificacionModelo = require('../../models/notificacion.model');
const { generarCodigoGestion } = require('../../utils/codigos');
const mensajes = require('./mensajes');
const ProveedorWhatsApp = require('./proveedores/ProveedorWhatsApp');

async function notificarCita({ citaId, tipo, codigo }) {
  let notificacionId;
  let enlace = null;
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
