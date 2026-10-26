// Pruebas unitarias sin base de datos: node --test
const test = require('node:test');
const assert = require('node:assert/strict');

const v = require('../src/utils/validaciones');
const t = require('../src/utils/tiempo');
const { generarCodigoGestion, hashCodigo, pareceCodigo } = require('../src/utils/codigos');
const { limitePeticiones } = require('../src/middleware/limitePeticiones');

test('contraseña: exige longitud, una letra y un número', () => {
  assert.notEqual(v.validarContrasena('corta1'), '');
  assert.notEqual(v.validarContrasena('sinnumeross'), '');
  assert.notEqual(v.validarContrasena('12345678'), '');
  assert.notEqual(v.validarContrasena('a1'.repeat(40)), '');
  assert.equal(v.validarContrasena('Clave1234'), '');
});

test('teléfono: agrega el indicativo 57 a los celulares colombianos', () => {
  assert.equal(v.normalizarTelefono('300 123 4567'), '573001234567');
  assert.equal(v.normalizarTelefono('+57 300 123 4567'), '573001234567');
});

test('nombre: recorta y colapsa espacios', () => {
  assert.equal(v.normalizarNombre('  Ana   María  '), 'Ana María');
  assert.equal(v.normalizarNombre(null), '');
});

test('fechas, horas y meses: solo formatos válidos', () => {
  assert.equal(v.esFecha('2026-10-27'), true);
  assert.equal(v.esFecha('2026-02-30'), false);
  assert.equal(v.esFecha('27/10/2026'), false);
  assert.equal(v.esHora('07:40'), true);
  assert.equal(v.esHora('24:00'), false);
  assert.equal(v.esHora('7:40'), false);
  assert.equal(v.esMes('2026-10'), true);
  assert.equal(v.esMes('2026-13'), false);
});

test('identificadores: solo enteros positivos', () => {
  assert.equal(v.aId('15'), 15);
  assert.equal(v.aId(7), 7);
  assert.equal(v.aId('0'), null);
  assert.equal(v.aId('-3'), null);
  assert.equal(v.aId('1; DROP TABLE citas'), null);
  assert.equal(v.aId(undefined), null);
});

test('datos de la persona: acepta un caso válido y rechaza uno inválido', () => {
  const bueno = v.validarDatosPersona({
    nombres: 'Ana', apellidos: 'Pérez', tipoDocumento: 'CC', documento: '1.075.000.000',
    telefono: '300 123 4567', correo: 'ana@example.com',
  });
  assert.deepEqual(bueno.errores, {});
  assert.equal(bueno.valores.documento, '1075000000');
  assert.equal(bueno.valores.nombreCompleto, 'Ana Pérez');

  const malo = v.validarDatosPersona({
    nombres: 'A1', apellidos: '', tipoDocumento: 'XX', documento: 'abc', telefono: '12', correo: 'no-es-correo',
  });
  for (const campo of ['nombres', 'apellidos', 'tipoDocumento', 'documento', 'telefono', 'correo']) {
    assert.ok(malo.errores[campo], `debería reportar error en ${campo}`);
  }
});

test('hora de Colombia: sumar días y límites del mes', () => {
  assert.equal(t.sumarDias('2026-10-31', 1), '2026-11-01');
  assert.equal(t.sumarDias('2026-03-01', -1), '2026-02-28');
  assert.deepEqual(t.limitesDeMes('2028-02'), { desde: '2028-02-01', hasta: '2028-02-29' });
  assert.match(t.hoyBogota(), /^\d{4}-\d{2}-\d{2}$/);
});

test('hora en texto: formato de 12 horas', () => {
  assert.equal(t.horaEnTexto('00:15'), '12:15 a. m.');
  assert.equal(t.horaEnTexto('12:00'), '12:00 p. m.');
  assert.equal(t.horaEnTexto('19:40'), '7:40 p. m.');
});

test('código de gestión: aleatorio, con forma válida y guardado como hash', () => {
  const a = generarCodigoGestion();
  const b = generarCodigoGestion();
  assert.notEqual(a.codigo, b.codigo);
  assert.equal(pareceCodigo(a.codigo), true);
  assert.equal(a.hash, hashCodigo(a.codigo));
  assert.notEqual(a.hash, a.codigo);
  assert.equal(pareceCodigo('corto'), false);
  assert.equal(pareceCodigo("'; DROP TABLE citas;--"), false);
});

test('límite de peticiones: bloquea al pasar el máximo y avisa cuánto esperar', () => {
  const limite = limitePeticiones({ maximo: 2, ventanaMinutos: 1 });
  const respuesta = () => {
    const r = { cabeceras: {} };
    r.set = (k, val) => { r.cabeceras[k] = val; };
    r.status = (c) => { r.codigo = c; return r; };
    r.json = (cuerpo) => { r.cuerpo = cuerpo; return r; };
    return r;
  };
  const pasa = () => { let ok = false; limite({ ip: '1.2.3.4' }, respuesta(), () => { ok = true; }); return ok; };
  assert.equal(pasa(), true);
  assert.equal(pasa(), true);

  const bloqueada = respuesta();
  let siguio = false;
  limite({ ip: '1.2.3.4' }, bloqueada, () => { siguio = true; });
  assert.equal(siguio, false);
  assert.equal(bloqueada.codigo, 429);
  assert.ok(Number(bloqueada.cabeceras['Retry-After']) > 0);

  // Otra IP no se ve afectada.
  let otra = false;
  limite({ ip: '5.6.7.8' }, respuesta(), () => { otra = true; });
  assert.equal(otra, true);
});
