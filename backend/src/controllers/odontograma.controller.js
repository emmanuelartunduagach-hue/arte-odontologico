const pacienteModelo = require('../models/paciente.model');
const odontogramaModelo = require('../models/odontograma.model');
const { ErrorHttp } = require('../utils/errores');
const { aId } = require('../utils/validaciones');
const { esSuperadmin } = require('../middleware/autenticacion');

const HALLAZGOS = {
  caries:     { nombre: 'Caries', alcance: 'cara' },
  resina:     { nombre: 'Resina', alcance: 'cara' },
  amalgama:   { nombre: 'Amalgama', alcance: 'cara' },
  sellante:   { nombre: 'Sellante', alcance: 'cara' },
  fractura:   { nombre: 'Fractura', alcance: 'ambos' },
  corona:     { nombre: 'Corona', alcance: 'diente' },
  endodoncia: { nombre: 'Endodoncia', alcance: 'diente' },
  extraccion: { nombre: 'Extracción', alcance: 'diente' },
  ausente:    { nombre: 'Ausente', alcance: 'diente', soloRealizado: true },
  implante:   { nombre: 'Implante', alcance: 'diente' },
  protesis:   { nombre: 'Prótesis', alcance: 'diente' },
  otro:       { nombre: 'Otro', alcance: 'ambos' },
};

const CARAS = ['oclusal', 'mesial', 'distal', 'vestibular', 'lingual'];
const ESTADOS = ['por_hacer', 'realizado'];

function esDienteFdi(n) {
  const cuadrante = Math.floor(n / 10);
  const pieza = n % 10;
  if (cuadrante >= 1 && cuadrante <= 4) return pieza >= 1 && pieza <= 8;
  if (cuadrante >= 5 && cuadrante <= 8) return pieza >= 1 && pieza <= 5;
  return false;
}

async function pacientePorId(idTexto) {
  const id = aId(idTexto);
  const paciente = id ? await pacienteModelo.buscarPorId(id) : null;
  if (!paciente) throw new ErrorHttp(404, 'Paciente no encontrado.');
  return paciente;
}

async function hallazgoPorId(idTexto) {
  const id = aId(idTexto);
  const hallazgo = id ? await odontogramaModelo.buscarPorId(id) : null;
  if (!hallazgo) throw new ErrorHttp(404, 'Hallazgo no encontrado.');
  return hallazgo;
}

async function listar(req, res, next) {
  try {
    const paciente = await pacientePorId(req.params.id);
    res.json({
      catalogo: { hallazgos: HALLAZGOS, caras: CARAS },
      hallazgos: await odontogramaModelo.listarDePaciente(paciente.id),
    });
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const paciente = await pacientePorId(req.params.id);
    const cuerpo = req.body || {};
    const errores = {};

    const diente = Number(cuerpo.diente);
    if (!Number.isInteger(diente) || !esDienteFdi(diente)) errores.diente = 'Elige un diente válido.';

    const tipo = HALLAZGOS[cuerpo.hallazgo];
    if (!tipo) errores.hallazgo = 'Elige qué se encontró o qué se hizo.';

    const estado = cuerpo.estado;
    if (!ESTADOS.includes(estado)) errores.estado = 'Indica si está por hacer o ya se realizó.';
    else if (tipo?.soloRealizado && estado !== 'realizado') errores.estado = `${tipo.nombre} solo se registra como existente (realizado).`;

    const caras = Array.isArray(cuerpo.caras) ? [...new Set(cuerpo.caras)] : [];
    const completo = caras.length === 1 && caras[0] === 'completo';
    if (!completo && (caras.length === 0 || !caras.every((c) => CARAS.includes(c)))) {
      errores.caras = 'Marca al menos una cara o el diente completo.';
    } else if (tipo && tipo.alcance === 'diente' && !completo) {
      errores.caras = `${tipo.nombre} se registra en el diente completo.`;
    } else if (tipo && tipo.alcance === 'cara' && completo) {
      errores.caras = `${tipo.nombre} se registra por caras: marca en cuáles.`;
    }

    const notas = typeof cuerpo.notas === 'string' ? cuerpo.notas.trim() : '';
    if (notas.length > 500) errores.notas = 'Las notas admiten hasta 500 caracteres.';

    if (Object.keys(errores).length) throw new ErrorHttp(400, 'Revisa los datos del hallazgo.', errores);

    await odontogramaModelo.crearVarios({
      pacienteId: paciente.id, diente, caras, hallazgo: cuerpo.hallazgo, estado, notas: notas || null,
      creadoPor: req.usuario.id,
    });
    res.status(201).json({
      mensaje: 'Hallazgo guardado en el odontograma.',
      hallazgos: await odontogramaModelo.listarDePaciente(paciente.id),
    });
  } catch (error) {
    next(error);
  }
}

async function marcarRealizado(req, res, next) {
  try {
    const hallazgo = await hallazgoPorId(req.params.id);
    if (!(await odontogramaModelo.marcarRealizado(hallazgo.id, req.usuario.id))) {
      throw new ErrorHttp(409, 'Este hallazgo ya está realizado o está anulado.');
    }
    res.json({ mensaje: 'Marcado como realizado.', hallazgos: await odontogramaModelo.listarDePaciente(hallazgo.pacienteId) });
  } catch (error) {
    next(error);
  }
}

async function anular(req, res, next) {
  try {
    const hallazgo = await hallazgoPorId(req.params.id);
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
    if (motivo.length < 3 || motivo.length > 300) {
      throw new ErrorHttp(400, 'Revisa los datos.', { motivo: 'Explica por qué se anula (entre 3 y 300 caracteres).' });
    }
    const directa = esSuperadmin(req);
    const hecho = await odontogramaModelo.pedirAnulacion(hallazgo.id, { motivo, pedidaPor: req.usuario.id, aprobadaDeUnaVez: directa });
    if (!hecho) {
      throw new ErrorHttp(409, hallazgo.anulacion === 'pendiente'
        ? 'Este hallazgo ya tiene una anulación esperando la aprobación del dueño.'
        : 'Este hallazgo ya está anulado.');
    }
    res.json({
      mensaje: directa ? 'Hallazgo anulado.' : 'Anulación enviada: el hallazgo sigue vigente hasta que el dueño la apruebe.',
      hallazgos: await odontogramaModelo.listarDePaciente(hallazgo.pacienteId),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, crear, marcarRealizado, anular, HALLAZGOS, esDienteFdi };
