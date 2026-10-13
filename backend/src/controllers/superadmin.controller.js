/* Rutas exclusivas del dueño (rol superadmin).

   - Administradores: crear (con contraseña temporal), editar,
     activar o desactivar, restablecer la contraseña y eliminar.
     El dueño no se gestiona desde aquí: solo con el script
     `npm run superadmin` y la clave especial del servidor.
   - Solicitudes: correcciones de la historia clínica y anulaciones de
     hallazgos del odontograma que pidieron los administradores. El
     dueño las aprueba o las rechaza (con motivo). Nada se borra. */
const bcrypt = require('bcrypt');
const { randomInt } = require('crypto');
const usuarioModelo = require('../models/usuario.model');
const historiaModelo = require('../models/historia.model');
const odontogramaModelo = require('../models/odontograma.model');
const { validarUsuario, aId } = require('../utils/validaciones');
const { ErrorHttp } = require('../utils/errores');

const RONDAS_BCRYPT = 10;

/* Contraseña temporal legible: 4 letras + 4 números (sin I, O, 0 ni 1). */
function contrasenaTemporal() {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numeros = '23456789';
  let clave = '';
  for (let i = 0; i < 4; i++) clave += letras[randomInt(letras.length)];
  for (let i = 0; i < 4; i++) clave += numeros[randomInt(numeros.length)];
  return clave;
}

async function administradorPorId(idTexto) {
  const id = aId(idTexto);
  const admin = id ? await usuarioModelo.buscarAdministrador(id) : null;
  if (!admin) throw new ErrorHttp(404, 'Administrador no encontrado.');
  return admin;
}

function errorDuplicado(error) {
  if (error.code !== 'ER_DUP_ENTRY') return error;
  const campo = /correo/.test(error.message) ? 'correo' : 'documento';
  const mensaje = campo === 'correo' ? 'Ya existe un usuario con ese correo.' : 'Ya existe un usuario con ese documento.';
  return new ErrorHttp(409, mensaje, { [campo]: mensaje });
}

/* GET /api/superadmin/administradores */
async function listarAdministradores(req, res, next) {
  try {
    res.json(await usuarioModelo.listarAdministradores());
  } catch (error) {
    next(error);
  }
}

/* POST /api/superadmin/administradores
   { nombreCompleto, documento, correo, telefono }
   Responde la contraseña temporal UNA sola vez: el dueño se la entrega
   al administrador, que debe cambiarla al ingresar. */
async function crearAdministrador(req, res, next) {
  try {
    const { valores, errores } = validarUsuario(req.body || {}, { exigirContrasena: false });
    if (Object.keys(errores).length) throw new ErrorHttp(400, 'Revisa los datos del formulario.', errores);

    const temporal = contrasenaTemporal();
    const contrasenaHash = await bcrypt.hash(temporal, RONDAS_BCRYPT);
    let id;
    try {
      id = await usuarioModelo.crearAdministradorTemporal({ ...valores, contrasenaHash, creadoPor: req.usuario.id });
    } catch (error) {
      throw errorDuplicado(error);
    }
    res.status(201).json({
      mensaje: 'Administrador creado.',
      administrador: await usuarioModelo.buscarAdministrador(id),
      contrasenaTemporal: temporal,
    });
  } catch (error) {
    next(error);
  }
}

/* PATCH /api/superadmin/administradores/:id
   { nombreCompleto?, documento?, correo?, telefono?, activo? } */
async function actualizarAdministrador(req, res, next) {
  try {
    const admin = await administradorPorId(req.params.id);
    const cuerpo = req.body || {};
    const datosCompletos = {
      nombreCompleto: cuerpo.nombreCompleto ?? admin.nombreCompleto,
      documento: cuerpo.documento ?? admin.documento,
      correo: cuerpo.correo ?? admin.correo,
      telefono: cuerpo.telefono ?? admin.telefono,
    };
    const { valores, errores } = validarUsuario(datosCompletos, { exigirContrasena: false });
    if (Object.keys(errores).length) throw new ErrorHttp(400, 'Revisa los datos del formulario.', errores);

    const cambios = { ...valores };
    delete cambios.contrasena;
    if (cuerpo.activo !== undefined) {
      if (typeof cuerpo.activo !== 'boolean') throw new ErrorHttp(400, 'El campo activo debe ser verdadero o falso.');
      cambios.activo = cuerpo.activo;
    }
    try {
      await usuarioModelo.actualizarAdministrador(admin.id, cambios);
    } catch (error) {
      throw errorDuplicado(error);
    }
    res.json({ mensaje: 'Administrador actualizado.', administrador: await usuarioModelo.buscarAdministrador(admin.id) });
  } catch (error) {
    next(error);
  }
}

/* POST /api/superadmin/administradores/:id/restablecer
   Nueva contraseña temporal (se muestra una sola vez). */
async function restablecerAdministrador(req, res, next) {
  try {
    const admin = await administradorPorId(req.params.id);
    const temporal = contrasenaTemporal();
    await usuarioModelo.restablecerTemporal(admin.id, await bcrypt.hash(temporal, RONDAS_BCRYPT));
    res.json({ mensaje: 'Contraseña restablecida.', contrasenaTemporal: temporal });
  } catch (error) {
    next(error);
  }
}

/* DELETE /api/superadmin/administradores/:id
   Si el administrador ya registró pacientes, citas o historia, no se
   puede borrar (esos registros dicen quién los hizo): se desactiva. */
async function eliminarAdministrador(req, res, next) {
  try {
    const admin = await administradorPorId(req.params.id);
    try {
      await usuarioModelo.eliminarAdministrador(admin.id);
    } catch (error) {
      if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.code === 'ER_ROW_IS_REFERENCED') {
        throw new ErrorHttp(409, `${admin.nombreCompleto} ya registró pacientes, citas o historia clínica, así que no se puede borrar: esos registros deben decir quién los hizo. Desactívalo para que no pueda ingresar.`);
      }
      throw error;
    }
    res.json({ mensaje: 'Administrador eliminado.' });
  } catch (error) {
    next(error);
  }
}

/* ---------- Solicitudes de cambio en la historia clínica ---------- */

/* GET /api/superadmin/solicitudes
   { correcciones: [...], anulaciones: [...] } pendientes, las más antiguas primero. */
async function listarSolicitudes(req, res, next) {
  try {
    const [correcciones, anulaciones] = await Promise.all([
      historiaModelo.listarPendientes(),
      odontogramaModelo.listarAnulacionesPendientes(),
    ]);
    res.json({ correcciones, anulaciones });
  } catch (error) {
    next(error);
  }
}

function motivoDe(cuerpo) {
  const motivo = typeof cuerpo?.motivo === 'string' ? cuerpo.motivo.trim() : '';
  if (motivo.length < 3 || motivo.length > 300) {
    throw new ErrorHttp(400, 'Revisa los datos.', { motivo: 'Explica por qué se rechaza (entre 3 y 300 caracteres).' });
  }
  return motivo;
}

/* POST /api/superadmin/solicitudes/historia/:id/aprobar | /rechazar { motivo } */
function decidirCorreccion(aprobar) {
  return async (req, res, next) => {
    try {
      const id = aId(req.params.id);
      const entrada = id ? await historiaModelo.buscarPorId(id) : null;
      if (!entrada || !entrada.corrigeA) throw new ErrorHttp(404, 'Solicitud no encontrada.');
      if (entrada.estado !== 'pendiente') throw new ErrorHttp(409, 'Esta solicitud ya fue revisada.');
      const motivo = aprobar ? null : motivoDe(req.body);
      const hecho = await historiaModelo.revisar(entrada.id, {
        estado: aprobar ? 'vigente' : 'rechazada', revisadoPor: req.usuario.id, motivo,
      });
      if (!hecho) throw new ErrorHttp(409, 'Esta solicitud ya fue revisada.');
      res.json({ mensaje: aprobar ? 'Corrección aprobada: ya es parte de la historia.' : 'Corrección rechazada.' });
    } catch (error) {
      next(error);
    }
  };
}

/* POST /api/superadmin/solicitudes/odontograma/:id/aprobar | /rechazar { motivo } */
function decidirAnulacion(aprobar) {
  return async (req, res, next) => {
    try {
      const id = aId(req.params.id);
      const hallazgo = id ? await odontogramaModelo.buscarPorId(id) : null;
      if (!hallazgo || hallazgo.anulacion !== 'pendiente') {
        throw new ErrorHttp(hallazgo ? 409 : 404, hallazgo ? 'Esta solicitud ya fue revisada.' : 'Solicitud no encontrada.');
      }
      const motivo = aprobar ? null : motivoDe(req.body);
      const hecho = await odontogramaModelo.revisarAnulacion(hallazgo.id, { aprobar, revisadoPor: req.usuario.id, motivo });
      if (!hecho) throw new ErrorHttp(409, 'Esta solicitud ya fue revisada.');
      res.json({ mensaje: aprobar ? 'Anulación aprobada: el hallazgo ya no aparece en el odontograma.' : 'Anulación rechazada: el hallazgo sigue vigente.' });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  listarAdministradores,
  crearAdministrador,
  actualizarAdministrador,
  restablecerAdministrador,
  eliminarAdministrador,
  listarSolicitudes,
  aprobarCorreccion: decidirCorreccion(true),
  rechazarCorreccion: decidirCorreccion(false),
  aprobarAnulacion: decidirAnulacion(true),
  rechazarAnulacion: decidirAnulacion(false),
};
