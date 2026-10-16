const { Router } = require('express');
const controlador = require('../controllers/citas.controller');
const { limitePeticiones } = require('../middleware/limitePeticiones');

const router = Router();

const limiteEscritura = limitePeticiones({
  maximo: Number(process.env.LIMITE_ESCRITURAS_POR_IP) || 15,
  ventanaMinutos: 15,
});
const limiteLectura = limitePeticiones({
  maximo: Number(process.env.LIMITE_LECTURAS_POR_IP) || 60,
  ventanaMinutos: 15,
});

router.post('/', limiteEscritura, controlador.crear);
router.get('/gestion/:codigo', limiteLectura, controlador.verGestion);
router.post('/gestion/:codigo/reprogramar', limiteEscritura, controlador.reprogramarGestion);
router.post('/gestion/:codigo/cancelar', limiteEscritura, controlador.cancelarGestion);

module.exports = router;
