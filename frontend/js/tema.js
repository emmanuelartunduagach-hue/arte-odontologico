/* Modo oscuro del panel de la secretaria.

   Se carga en el <head>, antes de pintar, para que la página no
   parpadee en blanco al abrir. Si la secretaria nunca eligió, sigue
   la preferencia del sistema (Windows, Android, iOS); si eligió con
   el botón del menú de la cuenta, se recuerda en este navegador.

   El almacenamiento puede no estar disponible (modo privado o
   bloqueado): entonces solo se sigue al sistema. */
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

  // Si cambia el tema del sistema y la secretaria no ha elegido, se sigue.
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (!guardado()) aplicar(actual());
  });

  document.addEventListener('DOMContentLoaded', () => {
    aplicar(actual());
    document.querySelectorAll('[data-alternar-tema]').forEach((boton) => {
      boton.addEventListener('click', () => {
        const nuevo = raiz.getAttribute('data-tema') === 'oscuro' ? 'claro' : 'oscuro';
        try { localStorage.setItem(CLAVE, nuevo); } catch { /* solo dura esta visita */ }
        aplicar(nuevo);
      });
    });
  });
})();
