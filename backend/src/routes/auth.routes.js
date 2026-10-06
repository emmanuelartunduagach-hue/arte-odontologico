const { Router } = require('express');
const controlador = require('../controllers/auth.controller');
const { requiereSesion } = require('../middleware/autenticacion');

const router = Router();

router.post('/ingreso', controlador.ingresar);
router.post('/cambiar-contrasena', requiereSesion, controlador.cambiarContrasena);

module.exports = router;
