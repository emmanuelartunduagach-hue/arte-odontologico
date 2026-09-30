/* Construcción de la aplicación Express: middlewares globales,
   montaje de rutas y manejo de errores. */
const express = require('express');
const cors = require('cors');
const rutas = require('./routes');

const app = express();

app.use(cors({ origin: process.env.ORIGEN_PERMITIDO || '*' }));
app.use(express.json());

app.use('/api', rutas);

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

// Manejador central de errores: evita filtrar detalles internos
// al cliente mientras deja la traza completa en consola.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.publico || 'Error interno del servidor',
  });
});

module.exports = app;
