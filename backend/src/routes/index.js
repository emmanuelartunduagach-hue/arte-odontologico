const { Router } = require('express');

const router = Router();

router.get('/salud', (req, res) => {
  res.json({ estado: 'ok', hora: new Date().toISOString() });
});

router.use('/auth',           require('./auth.routes'));
router.use('/especialidades', require('./especialidades.routes'));
router.use('/servicios',      require('./especialidades.routes'));
router.use('/especialistas',  require('./especialistas.routes'));
router.use('/citas',          require('./citas.routes'));

router.use('/pacientes', require('./pacientes.routes'));
router.use('/admin',     require('./admin.routes'));

router.use('/superadmin', require('./superadmin.routes'));

module.exports = router;
