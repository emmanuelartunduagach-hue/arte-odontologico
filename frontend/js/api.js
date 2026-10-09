/* Cliente de la API.

   Todas las peticiones pasan por `api()`. Los errores del servidor
   (formato { error, campos }) se convierten en `ErrorApi`, de modo que
   las pantallas solo tienen que atrapar una excepción y mostrar
   `mensaje` (apto para el usuario) o `campos` (uno por campo).

   Si hay sesión (js/sesion.js), envía el token. Un 401 con token
   significa sesión vencida: se borra la sesión y se lleva a Ingresar. */

class ErrorApi extends Error {
  constructor(mensaje, estado = 0, campos = null, datos = {}) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;   // código HTTP; 0 = sin conexión
    this.campos = campos;   // { campo: 'mensaje' } solo en errores de formulario
    this.datos = datos;     // cuerpo completo de la respuesta (ej. pacienteId de un repetido)
  }
}

async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  const token = typeof obtenerSesion === 'function' ? obtenerSesion()?.token : null;

  // Modo demostración (js/api-demo.js): solo existe en localhost con ?demo=1.
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
