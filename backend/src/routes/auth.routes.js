const { Router } = require('express');
const controlador = require('../controllers/auth.controller');
const { requiereSesion } = require('../middleware/autenticacion');
const { limitePeticiones } = require('../middleware/limitePeticiones');

const router = Router();

// Frena a quien intente adivinar contraseñas: intentos por IP cada 15 minutos.
const limiteIngreso = limitePeticiones({
  maximo: Number(process.env.LIMITE_INGRESOS_POR_IP) || 10,
  ventanaMinutos: 15,
  mensaje: 'Demasiados intentos de ingreso. Espera unos minutos e inténtalo de nuevo.',
});

router.post('/ingreso', limiteIngreso, controlador.ingresar);
router.post('/cambiar-contrasena', requiereSesion, controlador.cambiarContrasena);
router.get('/perfil', requiereSesion, controlador.perfil);

module.exports = router;
