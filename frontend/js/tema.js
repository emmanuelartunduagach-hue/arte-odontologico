// Se carga en el <head> para que la página no parpadee en blanco al abrir.
(function () {
  const CLAVE = 'arte-tema-panel';
  const raiz = document.documentElement;

  function guardado() {
    try { return localStorage.getItem(CLAVE); } catch { return null; }
  }

  function sistemaOscuro() {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
  }

  function aplicar(tema) {
    if (tema === 'oscuro') raiz.setAttribute('data-tema', 'oscuro');
    else raiz.removeAttribute('data-tema');
    document.querySelectorAll('[data-alternar-tema]').forEach((boton) => {
      const oscuro = tema === 'oscuro';
      boton.textContent = oscuro ? 'Modo claro' : 'Modo oscuro';
      boton.setAttribute('aria-pressed', String(oscuro));
    });
  }

  const actual = () => guardado() || (sistemaOscuro() ? 'oscuro' : 'claro');
  aplicar(actual());

  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (!guardado()) aplicar(actual());
  });

  document.addEventListener('DOMContentLoaded', () => {
    aplicar(actual());
    document.querySelectorAll('[data-alternar-tema]').forEach((boton) => {
      boton.addEventListener('click', () => {
        const nuevo = raiz.getAttribute('data-tema') === 'oscuro' ? 'claro' : 'oscuro';
        try { localStorage.setItem(CLAVE, nuevo); } catch {  }
        aplicar(nuevo);
      });
    });
  });
})();
