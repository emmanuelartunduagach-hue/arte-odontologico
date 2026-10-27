// Revisión de la configuración al arrancar: node --test
const test = require('node:test');
const assert = require('node:assert/strict');

const { avisosDeConfiguracion, normalizarModoWhatsapp } = require('../src/utils/configuracion');

test('URL_PUBLICA: acepta un dominio completo con https', () => {
  assert.deepEqual(avisosDeConfiguracion({ URL_PUBLICA: 'https://arte-odontologico-production.up.railway.app' }), []);
});

test('URL_PUBLICA: avisa de un valor sin dominio, como un marcador de posición', () => {
  assert.equal(avisosDeConfiguracion({ URL_PUBLICA: 'pendiente' }).length, 1);
  assert.equal(avisosDeConfiguracion({ URL_PUBLICA: 'https://pendiente' }).length, 1);
  assert.equal(avisosDeConfiguracion({}).length, 1);
});

test('URL_PUBLICA: localhost sirve en desarrollo, pero no en producción', () => {
  assert.deepEqual(avisosDeConfiguracion({ URL_PUBLICA: 'http://localhost:5500' }), []);
  assert.equal(avisosDeConfiguracion({ URL_PUBLICA: 'http://localhost:5500', NODE_ENV: 'production' }).length, 1);
});

test('WHATSAPP_MODO: ignora espacios, comillas y mayúsculas', () => {
  assert.equal(normalizarModoWhatsapp(' "Twilio" '), 'twilio');
  assert.equal(normalizarModoWhatsapp(undefined), 'manual');
  assert.deepEqual(avisosDeConfiguracion({ URL_PUBLICA: 'https://a.co', WHATSAPP_MODO: ' Consola ' }), []);
});

test('WHATSAPP_MODO: avisa de un modo inválido y de credenciales que faltan', () => {
  assert.equal(avisosDeConfiguracion({ URL_PUBLICA: 'https://a.co', WHATSAPP_MODO: 'twillio' }).length, 1);
  const faltan = avisosDeConfiguracion({ URL_PUBLICA: 'https://a.co', WHATSAPP_MODO: 'twilio' });
  assert.equal(faltan.length, 1);
  assert.match(faltan[0], /TWILIO_ACCOUNT_SID/);
  assert.deepEqual(avisosDeConfiguracion({
    URL_PUBLICA: 'https://a.co', WHATSAPP_MODO: 'twilio',
    TWILIO_ACCOUNT_SID: 'x', TWILIO_AUTH_TOKEN: 'y', TWILIO_WHATSAPP_DESDE: '+14155238886',
  }), []);
});
