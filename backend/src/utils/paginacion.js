// Cálculo común de páginas para los listados. Los valores salen de la URL, así que se
// normalizan a enteros dentro de un rango seguro antes de usarlos en una consulta.
function calcularPagina(total, paginaPedida, porPaginaPedido, { porDefecto = 20, maximo = 50 } = {}) {
  const entero = (valor) => (/^\d+$/.test(String(valor ?? '')) ? Number(valor) : 0);
  const porPagina = Math.min(entero(porPaginaPedido) || porDefecto, maximo);
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(entero(paginaPedida), 1), paginas);
  return { pagina, porPagina, paginas, desde: (pagina - 1) * porPagina };
}

module.exports = { calcularPagina };
