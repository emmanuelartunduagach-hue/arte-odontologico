/* Índice de rutas de la API. */
const { Router } = require('express');

const router = Router();

router.get('/salud', (req, res) => {
  res.json({ estado: 'ok', hora: new Date().toISOString() });
});

// Público
router.use('/auth',           require('./auth.routes'));
router.use('/especialidades', require('./especialidades.routes'));
router.use('/servicios',      require('./especialidades.routes')); // nombre anterior, se conserva
router.use('/especialistas',  require('./especialistas.routes'));
router.use('/citas',          require('./citas.routes'));

// Secretaria
router.use('/pacientes', require('./pacientes.routes'));
router.use('/admin',     require('./admin.routes'));

module.exports = router;
