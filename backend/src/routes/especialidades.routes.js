/* Públicas: el paciente elige especialidad y luego especialista. */
const { Router } = require('express');
const controlador = require('../controllers/especialidades.controller');

const router = Router();

router.get('/', controlador.listarPublicas);
router.get('/:id/especialistas', controlador.especialistasDe);

module.exports = router;
