/* Contraseñas temporales para los pacientes que crea el administrador.
   Usa `crypto.randomInt` (aleatoriedad segura) y evita caracteres que se
   confunden al leerlos o dictarlos (0/O, 1/l/I). Siempre incluye al menos
   una letra y un número, para cumplir la misma regla que la contraseña
   que el paciente elegirá después. */
const { randomInt } = require('crypto');

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const DIGITOS = '23456789';

function generarContrasenaTemporal(longitud = 10) {
  const todos = LETRAS + DIGITOS;
  const caracteres = [LETRAS[randomInt(LETRAS.length)], DIGITOS[randomInt(DIGITOS.length)]];

  while (caracteres.length < longitud) {
    caracteres.push(todos[randomInt(todos.length)]);
  }

  // Mezcla (Fisher-Yates) para que la letra y el número no queden siempre al inicio.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}

module.exports = { generarContrasenaTemporal };
