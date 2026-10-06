/* Límite de peticiones por IP, en memoria.
   Frena bots que intenten llenar la agenda desde el formulario
   público. Es sencillo a propósito: se reinicia si se reinicia el
   servidor y no se comparte entre varias instancias, lo cual basta
   para un consultorio con un solo servidor.

   Al publicar detrás de un proxy (Render, Railway, Nginx...) hay que
   activar `app.set('trust proxy', 1)` para que req.ip sea la IP real;
   ver PROXY_CONFIABLE en .env.example. */

function limitePeticiones({ maximo, ventanaMinutos, mensaje }) {
  const ventanaMs = ventanaMinutos * 60 * 1000;
  const registros = new Map(); // ip -> { cuenta, inicio }

  // Limpieza periódica para que el mapa no crezca sin control.
  const limpieza = setInterval(() => {
    const ahora = Date.now();
    for (const [ip, r] of registros) {
      if (ahora - r.inicio > ventanaMs) registros.delete(ip);
    }
  }, ventanaMs);
  limpieza.unref();

  return (req, res, next) => {
    const ip = req.ip || 'desconocida';
    const ahora = Date.now();
    let registro = registros.get(ip);

    if (!registro || ahora - registro.inicio > ventanaMs) {
      registro = { cuenta: 0, inicio: ahora };
      registros.set(ip, registro);
    }

    registro.cuenta += 1;
    if (registro.cuenta > maximo) {
      const segundos = Math.ceil((registro.inicio + ventanaMs - ahora) / 1000);
      res.set('Retry-After', String(segundos));
      return res.status(429).json({
        error: mensaje || 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
      });
    }
    next();
  };
}

module.exports = { limitePeticiones };
