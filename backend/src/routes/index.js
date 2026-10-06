/* Índice de rutas de la API. */
const { Router } = require('express');
const router = Router();

router.get('/salud', (req, res) => {
  res.json({ estado: 'ok', hora: new Date().toISOString() });
});

router.use('/auth',      require('./auth.routes'));
router.use('/servicios', require('./servicios.routes'));
router.use('/pacientes', require('./pacientes.routes'));

// Pendientes de implementar:
// router.use('/citas',    require('./citas.routes'));
// router.use('/franjas',  require('./franjas.routes'));

module.exports = router;
