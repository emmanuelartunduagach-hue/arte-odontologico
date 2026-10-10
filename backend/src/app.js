/* Construcción de la aplicación Express: middlewares globales,
   montaje de rutas y manejo de errores. */
const path = require('path');
const express = require('express');
const cors = require('cors');
const rutas = require('./routes');

const app = express();

// Detrás de un proxy (al publicar) para que req.ip sea la IP real
// del visitante; lo usa el límite de peticiones.
if (process.env.PROXY_CONFIABLE) app.set('trust proxy', Number(process.env.PROXY_CONFIABLE) || 1);

app.use(cors({ origin: process.env.ORIGEN_PERMITIDO || '*' }));
app.use(express.json({ limit: '100kb' }));

app.use('/api', rutas);

// Ruta de la API no encontrada
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

/* Al publicar, el mismo servidor entrega el frontend (página, panel, CSS,
   JS e imágenes): un solo servicio y un solo dominio. En desarrollo se
   puede seguir usando Live Server; SERVIR_FRONTEND=false lo apaga. */
if (String(process.env.SERVIR_FRONTEND).toLowerCase() !== 'false') {
  const carpetaFrontend = path.join(__dirname, '..', '..', 'frontend');
  app.use(express.static(carpetaFrontend, { extensions: ['html'], maxAge: '1h' }));
  app.use((req, res) => {
    res.status(404).sendFile(path.join(carpetaFrontend, 'index.html'));
  });
}

// Manejador central de errores: evita filtrar detalles internos
// al cliente mientras deja la traza completa en consola.
app.use((err, req, res, next) => {
  console.error(err);
  const estado = err.status || 500;
  const cuerpo = {
    error: err.publico || (estado < 500 ? 'Solicitud inválida' : 'Error interno del servidor'),
  };
  if (err.campos) cuerpo.campos = err.campos;
  if (err.extra) Object.assign(cuerpo, err.extra); // datos útiles, ej. el id de un registro repetido
  res.status(estado).json(cuerpo);
});

module.exports = app;
