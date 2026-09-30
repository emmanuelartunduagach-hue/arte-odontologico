/* Configuración del frontend. Único punto donde viven los
   valores que cambian entre desarrollo y producción. */
const CONFIG = {
  API: 'http://localhost:3000/api',

  // Número de contacto del consultorio (formato internacional, sin +).
  WHATSAPP: '573187153718',
  WHATSAPP_ALTERNO: '573108120241',

  MENSAJE_WHATSAPP: 'Hola, quiero información sobre Arte Odontológico.',
};

Object.freeze(CONFIG);
