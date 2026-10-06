/* Cliente de la API.

   Todas las peticiones pasan por `api()`. Los errores del servidor
   (formato { error, campos }) se convierten en `ErrorApi`, de modo que
   las pantallas solo tienen que atrapar una excepción y mostrar
   `mensaje` (apto para el usuario) o `campos` (uno por campo). */

class ErrorApi extends Error {
  constructor(mensaje, estado = 0, campos = null) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;   // código HTTP; 0 = sin conexión
    this.campos = campos;   // { campo: 'mensaje' } solo en errores de formulario
  }
}

async function api(ruta, { metodo = 'GET', cuerpo } = {}) {
  // Modo demostración (js/api-demo.js): solo existe en localhost con ?demo=1.
  if (typeof window.API_DEMO === 'function') return window.API_DEMO(ruta, metodo, cuerpo);

  let respuesta;
  try {
    respuesta = await fetch(CONFIG.API + ruta, {
      method: metodo,
      headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi('No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.');
  }

  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new ErrorApi(datos.error || 'Ocurrió un error inesperado. Intenta de nuevo.', respuesta.status, datos.campos || null);
  }
  return datos;
}
