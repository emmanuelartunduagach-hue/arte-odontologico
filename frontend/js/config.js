const CONFIG = {
  // En desarrollo la API corre aparte (puerto 3000); publicado, va en el mismo dominio.
  API: location.port === '5500' ? `${location.protocol}//${location.hostname}:3000/api` : '/api',

  WHATSAPP: '573187153718',
  WHATSAPP_ALTERNO: '573108120241',

  MENSAJE_WHATSAPP: 'Hola, quiero información sobre Arte Odontológico.',
};

Object.freeze(CONFIG);
