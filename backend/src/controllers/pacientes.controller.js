/* Gestión de pacientes. Solo la usa el administrador.

   Los pacientes no se registran solos: entregan sus datos en el
   consultorio y el administrador crea su cuenta. Así se evitan cuentas
   falsas y citas que nadie va a cumplir. */
const bcrypt = require('bcrypt');
const usuarioModelo = require('../models/usuario.model');
const { validarUsuario } = require('../utils/validaciones');
const { generarContrasenaTemporal } = require('../utils/contrasenas');
const { ErrorHttp } = require('../utils/errores');

const RONDAS_BCRYPT = 10;

/* POST /api/pacientes
   Cuerpo: { nombreCompleto, documento, correo, telefono, autorizacionDatos }
   autorizacionDatos debe ser true: el administrador confirma que el
   paciente autorizó el tratamiento de sus datos (Ley 1581 de 2012).
   El rol y la contraseña nunca se leen del cuerpo: el rol es siempre
   'paciente' y la contraseña la genera el sistema.
   La contraseña temporal se devuelve UNA sola vez, en esta respuesta. */
async function crear(req, res, next) {
  try {
    const { valores, errores } = validarUsuario(req.body, { exigirContrasena: false });

    if (req.body?.autorizacionDatos !== true) {
      errores.autorizacionDatos =
        'Confirma que el paciente autorizó el tratamiento de sus datos personales.';
    }

    if (Object.keys(errores).length > 0) {
      throw new ErrorHttp(400, 'Revisa los datos del formulario.', errores);
    }

    const contrasenaTemporal = generarContrasenaTemporal();
    const contrasenaHash = await bcrypt.hash(contrasenaTemporal, RONDAS_BCRYPT);

    let id;
    try {
      id = await usuarioModelo.crearPaciente({
        ...valores,
        contrasenaHash,
        creadoPor: req.usuario.id,
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        const campo = String(error.sqlMessage).includes('uq_usuarios_documento')
          ? 'documento'
          : 'correo';
        const mensaje =
          campo === 'documento'
            ? 'Ya existe un paciente con este documento.'
            : 'Ya existe un usuario con este correo.';
        throw new ErrorHttp(409, mensaje, { [campo]: mensaje });
      }
      throw error;
    }

    res.set('Cache-Control', 'no-store'); // la clave temporal no debe quedar en caché
    res.status(201).json({
      mensaje: 'Paciente creado correctamente.',
      paciente: {
        id,
        nombreCompleto: valores.nombreCompleto,
        documento: valores.documento,
        correo: valores.correo,
        telefono: valores.telefono,
      },
      contrasenaTemporal,
    });
  } catch (error) {
    next(error);
  }
}

/* GET /api/pacientes?q=texto
   Lista hasta 100 pacientes; `q` filtra por nombre, documento o correo. */
async function listar(req, res, next) {
  try {
    const busqueda = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const pacientes = await usuarioModelo.listarPacientes(busqueda);
    res.json(pacientes);
  } catch (error) {
    next(error);
  }
}

module.exports = { crear, listar };
