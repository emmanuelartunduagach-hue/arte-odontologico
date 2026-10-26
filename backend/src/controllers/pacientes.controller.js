const pacienteModelo = require('../models/paciente.model');
const citaModelo = require('../models/cita.model');
const { validarDatosPersona } = require('../utils/validaciones');
const { ErrorHttp } = require('../utils/errores');
const { calcularPagina } = require('../utils/paginacion');

async function crear(req, res, next) {
  try {
    const { valores, errores } = validarDatosPersona(req.body);
    const motivoConsulta = typeof req.body?.motivoConsulta === 'string' ? req.body.motivoConsulta.trim() : '';
    if (motivoConsulta.length > 500) {
      errores.motivoConsulta = 'El motivo de consulta puede tener hasta 500 caracteres.';
    }
    if (req.body?.autorizacionDatos !== true) {
      errores.autorizacionDatos = 'Confirma que el paciente autorizó el tratamiento de sus datos personales.';
    }
    if (Object.keys(errores).length > 0) {
      throw new ErrorHttp(400, 'Revisa los datos del formulario.', errores);
    }

    const existente = await pacienteModelo.buscarPorDocumento(valores.documento);
    if (existente) {
      const mensaje = `Ya existe un paciente con este documento: ${existente.nombreCompleto}.`;
      const error = new ErrorHttp(409, mensaje, { documento: mensaje });
      error.extra = { pacienteId: existente.id };
      throw error;
    }

    let id;
    try {
      id = await pacienteModelo.crear({
        ...valores, motivoConsulta: motivoConsulta || null, origen: 'consultorio', creadoPor: req.usuario.id,
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        const mensaje = 'Ya existe un paciente con este documento.';
        throw new ErrorHttp(409, mensaje, { documento: mensaje });
      }
      throw error;
    }

    const citasVinculadas = await citaModelo.vincularPaciente(valores, id);

    res.status(201).json({
      mensaje: 'Paciente creado correctamente.',
      paciente: await pacienteModelo.buscarPorId(id),
      citasVinculadas,
    });
  } catch (error) {
    next(error);
  }
}

// Sin «pagina» responde la lista simple (hasta 100); con «pagina» responde una página y los totales.
async function listar(req, res, next) {
  try {
    const busqueda = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    if (req.query.pagina === undefined) {
      res.json(await pacienteModelo.listar(busqueda));
      return;
    }
    const total = await pacienteModelo.contar(busqueda);
    const { pagina, porPagina, paginas, desde } = calcularPagina(total, req.query.pagina, req.query.porPagina);
    const items = await pacienteModelo.listarPagina(busqueda, desde, porPagina);
    res.json({ items, total, pagina, porPagina, paginas });
  } catch (error) {
    next(error);
  }
}

module.exports = { crear, listar };
