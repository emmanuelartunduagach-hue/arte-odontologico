/* Catálogo de servicios del consultorio.
   Provisional en el frontend: en la siguiente iteración se
   consume desde GET /api/servicios (tabla `servicios`). */
const SERVICIOS = [
  { id: 'general',        nombre: 'Odontología general',  desc: 'Limpieza, resinas y control preventivo.',        icono: 'diente' },
  { id: 'sonrisa',        nombre: 'Diseño de sonrisa',    desc: 'Carillas y blanqueamiento estético.',            icono: 'brillo' },
  { id: 'ortodoncia',     nombre: 'Ortodoncia',           desc: 'Brackets y alineadores para corregir mordida.',  icono: 'alinear' },
  { id: 'odontopediatria',nombre: 'Odontopediatría y ortopedia', desc: 'Atención dental para niños y niñas.',            icono: 'nino' },
  { id: 'endodoncia',     nombre: 'Endodoncia',           desc: 'Tratamiento de conducto para salvar la pieza.',  icono: 'pulso' },
  { id: 'periodoncia',    nombre: 'Periodoncia',          desc: 'Tratamiento de encías y soporte dental.',        icono: 'escudo' },
  { id: 'cirugia',        nombre: 'Cirugía oral',         desc: 'Extracciones y cordales incluidos.',             icono: 'bisturi' },
  { id: 'maxilofacial',   nombre: 'Cirugía maxilofacial', desc: 'Procedimientos de mayor complejidad.',           icono: 'hueso' },
  { id: 'rehabilitacion', nombre: 'Rehabilitación oral',  desc: 'Coronas, puentes y prótesis.',                   icono: 'renovar' },
];

/* Iconos en línea. Se retiró lucide-react (dependencia de React
   del boceto) porque el proyecto ya no usa React. */
const ICONOS = {
  diente:  '<path d="M12 5.5C10.5 4.3 8.8 3.7 7.2 4.1 5 4.7 3.8 6.6 4 9c.2 2.3 1 4.4 1.6 6.5.4 1.4.7 2.9 1.1 4.2.3.9 1.5 1 1.9.2.6-1.2.8-2.6 1.1-3.9.2-1 .5-2 1.3-2h.2c.8 0 1.1 1 1.3 2 .3 1.3.5 2.7 1.1 3.9.4.8 1.6.7 1.9-.2.4-1.3.7-2.8 1.1-4.2.6-2.1 1.4-4.2 1.6-6.5.2-2.4-1-4.3-3.2-4.9-1.6-.4-3.3.2-4.8 1.4Z"/>',
  brillo:  '<path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/><circle cx="12" cy="12" r="3.5"/>',
  alinear: '<rect x="3" y="9" width="18" height="6" rx="1.5"/><path d="M8 9v6M12 9v6M16 9v6"/>',
  nino:    '<circle cx="12" cy="8" r="4"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
  pulso:   '<path d="M3 12h3.5l2-5 3.5 10 2.5-6 1.5 3H21"/>',
  escudo:  '<path d="M12 3 5 6v5.5c0 4.3 2.9 8.2 7 9.5 4.1-1.3 7-5.2 7-9.5V6l-7-3Z"/>',
  bisturi: '<path d="M14 4 4 14l3 3L20 8V4h-4Z"/><path d="M4 20h6"/>',
  hueso:   '<path d="M7 11a2.5 2.5 0 1 1 1.8-4.3A2.5 2.5 0 1 1 12 8l4 4a2.5 2.5 0 1 1 1.3 4.2A2.5 2.5 0 1 1 13 17l-4-4Z"/>',
  renovar: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v5h-5"/>',
};

function svgIcono(nombre) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[nombre] || ''}</svg>`;
}
