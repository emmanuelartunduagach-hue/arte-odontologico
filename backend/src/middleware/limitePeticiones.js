function limitePeticiones({ maximo, ventanaMinutos, mensaje }) {
  const ventanaMs = ventanaMinutos * 60 * 1000;
  const registros = new Map();

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
