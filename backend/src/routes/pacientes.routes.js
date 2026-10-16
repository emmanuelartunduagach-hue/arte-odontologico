const { Router } = require('express');
const controlador = require('../controllers/pacientes.controller');
const historia = require('../controllers/historia.controller');
const odontograma = require('../controllers/odontograma.controller');
const { requiereSesion, requiereRol } = require('../middleware/autenticacion');

const router = Router();

router.use(requiereSesion, requiereRol('administrador'));

router.post('/', controlador.crear);
router.get('/', controlador.listar);
router.get('/:id', historia.ficha);
router.get('/:id/historia', historia.listar);
router.post('/:id/historia', historia.crear);
router.get('/:id/odontograma', odontograma.listar);
router.post('/:id/odontograma', odontograma.crear);

module.exports = router;
