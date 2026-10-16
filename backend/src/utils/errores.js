class ErrorHttp extends Error {
  constructor(status, publico, campos) {
    super(publico);
    this.status = status;
    this.publico = publico;
    this.campos = campos;
    this.extra = null;
  }
}

module.exports = { ErrorHttp };
