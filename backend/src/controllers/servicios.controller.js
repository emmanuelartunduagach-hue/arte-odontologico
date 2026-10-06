/* Catálogo de servicios (público: lo ve cualquier visitante). */
const servicioModelo = require('../models/servicio.model');

/* GET /api/servicios */
async function listar(req, res, next) {
  try {
    const servicios = await servicioModelo.listarActivos();
    res.json(servicios);
  } catch (error) {
    next(error);
  }
}

module.exports = { listar };
