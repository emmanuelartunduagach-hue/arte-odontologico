/* Índice de rutas de la API. */
const { Router } = require('express');
const { requiereSesion, requiereRol } = require('../middleware/autenticacion');
const citas = require('../controllers/citas.controller');

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

// Paciente con usuario
const soloPaciente = [requiereSesion, requiereRol('paciente')];
router.get('/mis-citas', soloPaciente, citas.misCitas);
router.post('/mis-citas/:id/reprogramar', soloPaciente, citas.reprogramarMia);
router.post('/mis-citas/:id/cancelar', soloPaciente, citas.cancelarMia);

// Secretaria
router.use('/pacientes', require('./pacientes.routes'));
router.use('/admin',     require('./admin.routes'));

module.exports = router;
