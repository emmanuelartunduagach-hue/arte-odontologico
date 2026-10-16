const notificacionModelo = require('../models/notificacion.model');
const { enlaceWhatsApp } = require('../services/notificaciones/mensajes');
const { ErrorHttp } = require('../utils/errores');
const { aId } = require('../utils/validaciones');
const { enviarRecordatorios } = require('../services/recordatorios');

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

async function ejecutarRecordatorios(req, res, next) {
  try {
    res.json(await enviarRecordatorios({ ignorarHorario: true }));
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, marcarEnviada, ejecutarRecordatorios };
