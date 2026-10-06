const { Router } = require('express');
const controlador = require('../controllers/auth.controller');
const { requiereSesion } = require('../middleware/autenticacion');

const router = Router();

router.post('/ingreso', controlador.ingresar);
router.post('/cambiar-contrasena', requiereSesion, controlador.cambiarContrasena);
router.get('/perfil', requiereSesion, controlador.perfil);

module.exports = router;
