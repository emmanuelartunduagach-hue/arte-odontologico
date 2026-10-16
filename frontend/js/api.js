class ErrorApi extends Error {
  constructor(mensaje, estado = 0, campos = null, datos = {}) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
    this.campos = campos;
    this.datos = datos;
  }
}

async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const token = typeof obtenerSesion === 'function' ? obtenerSesion()?.token : null;

  if (typeof window.API_DEMO === 'function') return window.API_DEMO(ruta, metodo, cuerpo, token);

  const cabeceras = {};
  if (cuerpo) cabeceras['Content-Type'] = 'application/json';
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(CONFIG.API + ruta, {
      method: metodo,
      headers: cabeceras,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi('No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (respuesta.status === 401 && token) {
    cerrarSesion();
    location.replace('index.html?ingresar=1&vencida=1');
  }
  if (!respuesta.ok) {
    throw new ErrorApi(datos.error || 'Ocurrió un error inesperado. Intenta de nuevo.', respuesta.status, datos.campos || null, datos);
  }
  return datos;
}
