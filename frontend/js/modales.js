/* Manejo de modales accesibles: apertura por [data-abrir],
   cierre por [data-cerrar], clic en el fondo o tecla Escape.
   Devuelve el foco al elemento que lo abrió.               */

let elementoQueAbrio = null;

function abrirModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  document.querySelectorAll('.modal:not([hidden])').forEach(m => (m.hidden = true));
  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  const primerCampo = modal.querySelector('input, button, select, textarea');
  if (primerCampo) primerCampo.focus();
}

function cerrarModal(modal) {
  modal.hidden = true;
  document.body.style.overflow = '';
  if (elementoQueAbrio) elementoQueAbrio.focus();
}

document.addEventListener('click', (e) => {
  const disparador = e.target.closest('[data-abrir]');
  if (disparador) {
    e.preventDefault();
    elementoQueAbrio = disparador;
    abrirModal(disparador.dataset.abrir);
    return;
  }

  const cerrar = e.target.closest('[data-cerrar]');
  if (cerrar) {
    cerrarModal(cerrar.closest('.modal'));
    return;
  }

  // Clic en el fondo oscuro, fuera del panel.
  if (e.target.classList.contains('modal')) cerrarModal(e.target);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const abierto = document.querySelector('.modal:not([hidden])');
  if (abierto) cerrarModal(abierto);
});
