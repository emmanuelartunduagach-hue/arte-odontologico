/* Configuración del frontend. Único punto donde viven los
   valores que cambian entre desarrollo y producción. */
const CONFIG = {
  // En desarrollo el frontend se abre con Live Server (puerto 5500) y la API
  // corre aparte en el 3000. Publicado, Express sirve las dos cosas desde el
  // mismo dominio, así que basta la ruta relativa (y no hace falta CORS).
  API: location.port === '5500' ? `${location.protocol}//${location.hostname}:3000/api` : '/api',

  // Número de contacto del consultorio (formato internacional, sin +).
  WHATSAPP: '573187153718',
  WHATSAPP_ALTERNO: '573108120241',

  MENSAJE_WHATSAPP: 'Hola, quiero información sobre Arte Odontológico.',
};

Object.freeze(CONFIG);
