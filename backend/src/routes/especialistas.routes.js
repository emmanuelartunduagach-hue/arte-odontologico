/* Públicas: calendario del mes y horas libres de un día. */
const { Router } = require('express');
const controlador = require('../controllers/especialistas.controller');

const router = Router();

router.get('/:id/calendario', controlador.calendario);
router.get('/:id/horas', controlador.horas);

module.exports = router;
