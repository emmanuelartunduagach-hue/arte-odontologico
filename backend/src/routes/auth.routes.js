const { Router } = require('express');
const controlador = require('../controllers/auth.controller');

const router = Router();

router.post('/registro', controlador.registrar);
router.post('/ingreso', controlador.ingresar);

module.exports = router;
