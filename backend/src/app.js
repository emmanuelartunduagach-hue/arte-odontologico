const path = require('path');
const express = require('express');
const cors = require('cors');
const rutas = require('./routes');

const app = express();

// Detrás del proxy de Railway, para que req.ip sea la IP real del visitante.
if (process.env.PROXY_CONFIABLE) app.set('trust proxy', Number(process.env.PROXY_CONFIABLE) || 1);

app.use(cors({ origin: process.env.ORIGEN_PERMITIDO || '*' }));
// La foto de un especialista llega en base64: esta ruta acepta un cuerpo mayor.
app.use('/api/superadmin/especialistas', express.json({ limit: '500kb' }));
app.use(express.json({ limit: '100kb' }));

app.use('/api', rutas);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

if (String(process.env.SERVIR_FRONTEND).toLowerCase() !== 'false') {
  const carpetaFrontend = path.join(__dirname, '..', '..', 'frontend');
  app.use(express.static(carpetaFrontend, { extensions: ['html'], maxAge: '1h' }));
  app.use((req, res) => {
    res.status(404).sendFile(path.join(carpetaFrontend, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  const estado = err.status || 500;
  const demasiadoGrande = err.type === 'entity.too.large';
  const cuerpo = {
    error: err.publico || (demasiadoGrande ? 'Lo que enviaste es demasiado grande.'
      : estado < 500 ? 'Solicitud inválida' : 'Error interno del servidor'),
  };
  if (err.campos) cuerpo.campos = err.campos;
  if (err.extra) Object.assign(cuerpo, err.extra);
  res.status(estado).json(cuerpo);
});

module.exports = app;
