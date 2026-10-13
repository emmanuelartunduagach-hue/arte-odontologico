/* Rutas exclusivas del dueño (rol superadmin): administradores y
   aprobación de cambios en la historia clínica. */
const { Router } = require('express');
const { requiereSesion, requiereRol } = require('../middleware/autenticacion');
const controlador = require('../controllers/superadmin.controller');

const router = Router();

router.use(requiereSesion, requiereRol('superadmin'));

router.get('/administradores', controlador.listarAdministradores);
router.post('/administradores', controlador.crearAdministrador);
router.patch('/administradores/:id', controlador.actualizarAdministrador);
router.post('/administradores/:id/restablecer', controlador.restablecerAdministrador);
router.delete('/administradores/:id', controlador.eliminarAdministrador);

router.get('/solicitudes', controlador.listarSolicitudes);
router.post('/solicitudes/historia/:id/aprobar', controlador.aprobarCorreccion);
router.post('/solicitudes/historia/:id/rechazar', controlador.rechazarCorreccion);
router.post('/solicitudes/odontograma/:id/aprobar', controlador.aprobarAnulacion);
router.post('/solicitudes/odontograma/:id/rechazar', controlador.rechazarAnulacion);

module.exports = router;
