const { Router } = require('express');
const controlador = require('../controllers/servicios.controller');

const router = Router();

router.get('/', controlador.listar);

module.exports = router;
