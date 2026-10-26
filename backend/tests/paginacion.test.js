const test = require('node:test');
const assert = require('node:assert/strict');
const { calcularPagina } = require('../src/utils/paginacion');

test('paginación: valores por defecto y cálculo de páginas', () => {
  assert.deepEqual(calcularPagina(83, undefined, undefined), { pagina: 1, porPagina: 20, paginas: 5, desde: 0 });
  assert.deepEqual(calcularPagina(83, '2', '20'), { pagina: 2, porPagina: 20, paginas: 5, desde: 20 });
});

test('paginación: una página fuera de rango se ajusta al límite', () => {
  assert.equal(calcularPagina(83, '99', '20').pagina, 5);
  assert.equal(calcularPagina(83, '0', '20').pagina, 1);
  assert.equal(calcularPagina(0, '3', '20').paginas, 1);
});

test('paginación: el tamaño de página tiene tope y rechaza basura', () => {
  assert.equal(calcularPagina(1000, '1', '5000').porPagina, 50);
  assert.equal(calcularPagina(1000, '1', '-3').porPagina, 20);
  assert.equal(calcularPagina(1000, '1', '1; DROP TABLE pacientes').porPagina, 20);
  assert.equal(calcularPagina(1000, 'abc', '10').pagina, 1);
});
