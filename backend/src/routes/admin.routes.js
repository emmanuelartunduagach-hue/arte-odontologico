const { Router } = require('express');
const { requiereSesion, requiereRol } = require('../middleware/autenticacion');
const especialidades = require('../controllers/especialidades.controller');
const especialistas = require('../controllers/especialistas.controller');
const citas = require('../controllers/citas.controller');
const notificaciones = require('../controllers/notificaciones.controller');
const historia = require('../controllers/historia.controller');
const odontograma = require('../controllers/odontograma.controller');

const router = Router();

router.use(requiereSesion, requiereRol('administrador'));

router.get('/especialidades', especialidades.listarTodas);
router.post('/especialidades', especialidades.crear);
router.patch('/especialidades/:id', especialidades.actualizar);

router.get('/especialistas', especialistas.listarTodos);
router.get('/especialistas/:id/franjas', especialistas.listarFranjas);
router.post('/especialistas/:id/franjas', especialistas.publicarFranjas);
router.delete('/franjas/:id', especialistas.quitarFranja);

router.get('/citas', citas.agenda);
router.get('/citas/novedades', citas.novedades);
router.post('/citas', citas.crearAdmin);
router.post('/citas/:id/aceptar', citas.aceptar);
router.post('/citas/:id/rechazar', citas.rechazar);
router.patch('/citas/:id/estado', citas.cambiarEstado);
router.post('/citas/:id/reprogramar', citas.reprogramarAdmin);

router.get('/notificaciones', notificaciones.listar);
router.patch('/notificaciones/:id', notificaciones.marcarEnviada);
router.post('/recordatorios', notificaciones.ejecutarRecordatorios);

router.post('/historia/:id/correccion', historia.corregir);
router.post('/odontograma/:id/realizado', odontograma.marcarRealizado);
router.post('/odontograma/:id/anular', odontograma.anular);

module.exports = router;
