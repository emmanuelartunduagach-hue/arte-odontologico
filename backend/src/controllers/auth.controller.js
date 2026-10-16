const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usuarioModelo = require('../models/usuario.model');
const { validarContrasena } = require('../utils/validaciones');
const { ErrorHttp } = require('../utils/errores');

const RONDAS_BCRYPT = 10;

// Se compara aunque el correo no exista, para que el tiempo de respuesta no revele qué correos están registrados.
const HASH_FALSO = bcrypt.hashSync('relleno-sin-uso', RONDAS_BCRYPT);

const MENSAJE_CREDENCIALES = 'Correo o contraseña incorrectos.';
const ROLES_CON_INGRESO = ['administrador', 'superadmin'];

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

    if (!usuario || !coincide || !usuario.activo || !ROLES_CON_INGRESO.includes(usuario.rol)) {
      throw new ErrorHttp(401, MENSAJE_CREDENCIALES);
    }

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre_completo },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRA || '8h' }
    );

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre_completo,
        rol: usuario.rol,
        debeCambiarContrasena: Boolean(usuario.debe_cambiar_contrasena),
      },
    });
  } catch (error) {
    next(error);
  }
}

async function cambiarContrasena(req, res, next) {
  try {
    const actual = typeof req.body?.contrasenaActual === 'string' ? req.body.contrasenaActual : '';
    const nueva = typeof req.body?.contrasenaNueva === 'string' ? req.body.contrasenaNueva : '';

    const errores = {};
    if (!actual) errores.contrasenaActual = 'Escribe tu contraseña actual.';
    const mensajeNueva = validarContrasena(nueva);
    if (mensajeNueva) {
      errores.contrasenaNueva = mensajeNueva;
    } else if (nueva === actual) {
      errores.contrasenaNueva = 'La contraseña nueva debe ser distinta de la actual.';
    }
    if (Object.keys(errores).length > 0) {
      throw new ErrorHttp(400, 'Revisa los datos del formulario.', errores);
    }

    const usuario = await usuarioModelo.buscarPorId(req.usuario.id);
    if (!usuario || !usuario.activo) {
      throw new ErrorHttp(401, 'Sesión inválida o expirada');
    }

    if (!(await bcrypt.compare(actual, usuario.contrasena_hash))) {
      const mensaje = 'La contraseña actual no es correcta.';
      // 400 y no 401: el frontend trata el 401 como sesión vencida.
      throw new ErrorHttp(400, mensaje, { contrasenaActual: mensaje });
    }

    const contrasenaHash = await bcrypt.hash(nueva, RONDAS_BCRYPT);
    await usuarioModelo.actualizarContrasena(usuario.id, contrasenaHash);

    res.json({ mensaje: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    next(error);
  }
}

async function perfil(req, res, next) {
  try {
    const datos = await usuarioModelo.perfil(req.usuario.id);
    if (!datos) throw new ErrorHttp(401, 'Sesión inválida o expirada');
    res.json(datos);
  } catch (error) {
    next(error);
  }
}

module.exports = { ingresar, cambiarContrasena, perfil };
