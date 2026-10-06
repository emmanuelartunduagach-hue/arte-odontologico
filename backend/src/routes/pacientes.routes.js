/* Todas las rutas de pacientes son exclusivas del administrador.
   El rol se lee del token firmado, nunca del cuerpo de la petición. */
const { Router } = require('express');
const controlador = require('../controllers/pacientes.controller');
const { requiereSesion, requiereRol } = require('../middleware/autenticacion');

const router = Router();

router.use(requiereSesion, requiereRol('administrador'));

router.post('/', controlador.crear);
router.get('/', controlador.listar);

module.exports = router;
