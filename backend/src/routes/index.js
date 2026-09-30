/* Índice de rutas de la API. */
const { Router } = require('express');
const router = Router();

router.get('/salud', (req, res) => {
  res.json({ estado: 'ok', hora: new Date().toISOString() });
});

// Pendientes de implementar:
// router.use('/auth',     require('./auth.routes'));
// router.use('/citas',    require('./citas.routes'));
// router.use('/franjas',  require('./franjas.routes'));
// router.use('/servicios',require('./servicios.routes'));

module.exports = router;
