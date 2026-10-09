/* Error con código HTTP y mensaje apto para el cliente.
   El manejador central de app.js responde `publico` al cliente y
   deja el resto de la información solo en la consola. */
class ErrorHttp extends Error {
  constructor(status, publico, campos) {
    super(publico);
    this.status = status;
    this.publico = publico;
    this.campos = campos; // errores por campo, ej. { correo: 'Ya existe...' }
    this.extra = null;    // datos adicionales para el cliente, ej. { pacienteId }
  }
}

module.exports = { ErrorHttp };
