/* Registro e ingreso de usuarios. */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usuarioModelo = require('../models/usuario.model');
const { validarUsuario } = require('../utils/validaciones');
const { ErrorHttp } = require('../utils/errores');

const RONDAS_BCRYPT = 10;

// Hash de relleno: se compara cuando el correo no existe para que
// la respuesta tarde lo mismo y no revele qué correos están registrados.
const HASH_FALSO = bcrypt.hashSync('relleno-sin-uso', RONDAS_BCRYPT);

const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos.';

/* POST /api/auth/registro
   Cuerpo: { nombreCompleto, documento, correo, telefono, contrasena,
             autorizacionDatos }
   El rol nunca se lee del cuerpo: toda cuenta creada aquí es paciente. */
async function registrar(req, res, next) {
  try {
    const { valores, errores } = validarUsuario(req.body);

    if (req.body?.autorizacionDatos !== true) {
      errores.autorizacionDatos =
        'Debes autorizar el tratamiento de tus datos personales para registrarte.';
    }

    if (Object.keys(errores).length > 0) {
      throw new ErrorHttp(400, 'Revisa los datos del formulario.', errores);
    }

    const contrasenaHash = await bcrypt.hash(valores.contrasena, RONDAS_BCRYPT);

    let id;
    try {
      id = await usuarioModelo.crearPaciente({ ...valores, contrasenaHash });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        const campo = String(error.sqlMessage).includes('uq_usuarios_documento')
          ? 'documento'
          : 'correo';
        const mensaje =
          campo === 'documento'
            ? 'Ya existe una cuenta con este documento.'
            : 'Ya existe una cuenta con este correo.';
        throw new ErrorHttp(409, mensaje, { [campo]: mensaje });
      }
      throw error;
    }

    res.status(201).json({
      mensaje: 'Cuenta creada correctamente.',
      usuario: { id, nombre: valores.nombreCompleto, rol: 'paciente' },
    });
  } catch (error) {
    next(error);
  }
}

/* POST /api/auth/ingreso
   Cuerpo: { correo, contrasena }
   Respuesta: { token, usuario: { id, nombre, rol } } */
async function ingresar(req, res, next) {
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('Falta JWT_SECRET en el archivo .env');
    }

    const correo = typeof req.body?.correo === 'string' ? req.body.correo.trim().toLowerCase() : '';
    const contrasena = typeof req.body?.contrasena === 'string' ? req.body.contrasena : '';

    if (!correo || !contrasena) {
      throw new ErrorHttp(400, 'Escribe tu correo y tu contraseña.');
    }

    const usuario = await usuarioModelo.buscarPorCorreo(correo);
    const coincide = await bcrypt.compare(
      contrasena,
      usuario ? usuario.contrasena_hash : HASH_FALSO
    );

    // Mismo mensaje si el correo no existe, la clave es incorrecta o la
    // cuenta está desactivada.
    if (!usuario || !coincide || !usuario.activo) {
      throw new ErrorHttp(401, MENSAJE_CREDENCIALES);
    }

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre_completo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRA || '8h' }
    );

    res.json({
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre_completo, rol: usuario.rol },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { registrar, ingresar };
