/* Pacientes. Solo la secretaria.

   Un paciente es un registro con su historia clínica, sin usuario ni
   contraseña: gestiona su cita con el enlace que le llega por WhatsApp.
   Se crea de dos formas:
   - solo, cuando la secretaria acepta su primera cita pedida por la web
     (ver citas.controller.js, `aceptar`);
   - a mano, aquí, cuando llega al consultorio sin haber pasado por la web. */
const pacienteModelo = require('../models/paciente.model');
const citaModelo = require('../models/cita.model');
const { validarDatosPersona } = require('../utils/validaciones');
const { ErrorHttp } = require('../utils/errores');

/* POST /api/pacientes
   { nombres, apellidos, tipoDocumento, documento, telefono, telefonoFijo?,
     correo, motivoConsulta?, autorizacionDatos: true }
   autorizacionDatos: la secretaria confirma que el paciente autorizó el
   tratamiento de sus datos (Ley 1581 de 2012).
   motivoConsulta: a qué vino la persona (hasta 500 caracteres). */
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

    // Las citas que pidió antes por la web con el mismo documento y
    // celular quedan en su ficha.
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

/* GET /api/pacientes?q=texto
   Hasta 100 pacientes; `q` filtra por nombre, documento, celular o correo. */
async function listar(req, res, next) {
  try {
    const busqueda = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    res.json(await pacienteModelo.listar(busqueda));
  } catch (error) {
    next(error);
  }
}

module.exports = { crear, listar };
