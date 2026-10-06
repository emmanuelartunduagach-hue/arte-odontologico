/* Mensajes de WhatsApp para la secretaria.

   En modo manual (WHATSAPP_MODO=manual) los mensajes quedan
   "pendiente": el panel muestra cada uno con un botón que abre su
   WhatsApp Business con el texto ya escrito (enlaceWhatsApp). Al
   enviarlo, la secretaria lo marca como enviado. */
const notificacionModelo = require('../models/notificacion.model');
const { enlaceWhatsApp } = require('../services/notificaciones/mensajes');
const { ErrorHttp } = require('../utils/errores');
const { aId } = require('../utils/validaciones');

/* GET /api/admin/notificaciones?estado=pendiente|fallida|enviada */
async function listar(req, res, next) {
  try {
    const estado = req.query.estado || 'pendiente';
    if (!['pendiente', 'fallida', 'enviada'].includes(estado)) throw new ErrorHttp(400, 'Estado no válido.');
    const filas = await notificacionModelo.listar({ estado });
    res.json(filas.map((n) => ({ ...n, enlaceWhatsApp: enlaceWhatsApp(n.destino, n.mensaje || '') })));
  } catch (error) {
    next(error);
  }
}

/* PATCH /api/admin/notificaciones/:id   { estado: 'enviada' } */
async function marcarEnviada(req, res, next) {
  try {
    const id = aId(req.params.id);
    const notificacion = id ? await notificacionModelo.buscarPorId(id) : null;
    if (!notificacion) throw new ErrorHttp(404, 'Mensaje no encontrado.');
    if (req.body?.estado !== 'enviada') throw new ErrorHttp(400, 'Solo se puede marcar como enviada.');
    await notificacionModelo.marcar(id, 'enviada', 'Enviado a mano desde el panel');
    res.json({ mensaje: 'Mensaje marcado como enviado.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, marcarEnviada };
