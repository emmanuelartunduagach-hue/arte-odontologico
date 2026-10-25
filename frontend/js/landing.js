document.addEventListener('DOMContentLoaded', () => {
  configurarWhatsApp();
  prepararFormularios();
  vigilarDesplazamiento();
  configurarCarruseles();
});

// Carrusel: avanza solo, pero la persona lo puede mover a izquierda o derecha cuando quiera.
// - Mouse: arrastrar la pista. Celular: deslizar con el dedo. Teclado: flechas sobre la pista.
// - Botones anterior / siguiente / pausar (la alternativa a arrastrar y el control de pausa que
//   piden las pautas de accesibilidad WCAG 2.5.7 y 2.2.2).
// - El movimiento automático se detiene mientras haya interacción y vuelve solo unos segundos después.
const CARRUSEL = {
  VELOCIDAD_PX_S: 35,
  ESPERA_TRAS_INTERACCION_MS: 3500,
  ESPERA_TRAS_SALIR_MS: 600,
  COPIAS: 3,
};

const ICONOS_CARRUSEL = {
  anterior: '<path d="m15 6-6 6 6 6"/>',
  siguiente: '<path d="m9 6 6 6-6 6"/>',
  pausa: '<path d="M9 6v12M15 6v12"/>',
  reanudar: '<path d="M8 5.5v13l10-6.5z"/>',
};

function botonCarrusel(clase, etiqueta, ...iconos) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = `carrusel__boton ${clase}`;
  boton.setAttribute('aria-label', etiqueta);
  boton.innerHTML = iconos
    .map(([clave, claseIcono]) => `<svg viewBox="0 0 24 24" aria-hidden="true"${claseIcono ? ` class="${claseIcono}"` : ''}>${ICONOS_CARRUSEL[clave]}</svg>`)
    .join('');
  return boton;
}

function configurarCarruseles() {
  const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-carrusel]').forEach((carrusel) => iniciarCarrusel(carrusel, !sinMovimiento.matches));
}

function iniciarCarrusel(carrusel, conMovimiento) {
  const pista = carrusel.querySelector('.carrusel__pista');
  const carril = carrusel.querySelector('.carrusel__carril');
  if (!pista || !carril) return;

  const originales = [...carril.children];
  carrusel.classList.add('carrusel--js');
  pista.tabIndex = 0;

  // Con movimiento, el carril tiene varias copias de las fotos para poder dar la vuelta sin saltos.
  // Quien pidió menos movimiento recibe una tira normal, sin copias ni avance automático.
  if (conMovimiento) {
    for (let i = 1; i < CARRUSEL.COPIAS; i += 1) {
      originales.forEach((item) => {
        const copia = item.cloneNode(true);
        copia.setAttribute('aria-hidden', 'true');
        copia.querySelector('img')?.setAttribute('alt', '');
        carril.appendChild(copia);
      });
    }
  }

  let periodo = 0;                // ancho de una vuelta completa de fotos
  let posicion = 0;               // posición exacta (con decimales) mientras avanza sola
  let ultimaAsignada = 0;         // lo último que el carrusel mismo puso en scrollLeft
  let reanudarEn = 0;             // hasta cuándo se espera antes de volver a avanzar
  let cuadro = 0;
  let ultimoCuadro = 0;
  let corriendo = false;

  const estado = { visible: false, encima: false, tecladoEnfocado: false, tocando: false, pausaManual: false };

  function medir() {
    if (!conMovimiento) return;
    const primera = originales[0].getBoundingClientRect().left;
    const siguiente = carril.children[originales.length].getBoundingClientRect().left;
    const nuevo = siguiente - primera;
    if (nuevo <= 0) return;
    const fraccion = periodo ? ((pista.scrollLeft % periodo) / periodo) : 0;
    periodo = nuevo;
    pista.scrollLeft = periodo + fraccion * periodo;   // se queda en la copia del medio
    ultimaAsignada = pista.scrollLeft;
    posicion = ultimaAsignada;
  }

  // Si la persona se alejó de la copia del medio, se vuelve a ella sin que se note (las copias son iguales).
  function recentrar() {
    if (!periodo) return;
    const x = pista.scrollLeft;
    if (x < periodo) pista.scrollLeft = x + periodo;
    else if (x >= 2 * periodo) pista.scrollLeft = x - periodo;
    ultimaAsignada = pista.scrollLeft;
    posicion = ultimaAsignada;
  }

  function esperar(ms) {
    reanudarEn = Math.max(reanudarEn, performance.now() + ms);
  }

  function puedeAvanzar(ahora) {
    return conMovimiento && estado.visible && !document.hidden && !estado.encima && !estado.tecladoEnfocado
      && !estado.tocando && !estado.pausaManual && ahora >= reanudarEn;
  }

  function avanzar(ahora) {
    const segundos = Math.min((ahora - ultimoCuadro) / 1000, 0.1);
    ultimoCuadro = ahora;
    if (puedeAvanzar(ahora)) {
      if (!corriendo) { posicion = pista.scrollLeft; corriendo = true; }
      posicion += CARRUSEL.VELOCIDAD_PX_S * segundos;
      if (posicion >= 2 * periodo) posicion -= periodo;
      pista.scrollLeft = posicion;
      ultimaAsignada = posicion;
    } else {
      corriendo = false;
    }
    cuadro = requestAnimationFrame(avanzar);
  }

  function arrancar() {
    if (!conMovimiento || cuadro || !estado.visible || document.hidden) return;
    ultimoCuadro = performance.now();
    cuadro = requestAnimationFrame(avanzar);
  }
  function detener() {
    cancelAnimationFrame(cuadro);
    cuadro = 0;
    corriendo = false;
  }

  // Cualquier desplazamiento que no hizo el carrusel lo hizo la persona (dedo, rueda, teclado, botones).
  let temporizadorRecentrado = 0;
  pista.addEventListener('scroll', () => {
    if (Math.abs(pista.scrollLeft - ultimaAsignada) <= 2) return;
    esperar(CARRUSEL.ESPERA_TRAS_INTERACCION_MS);
    clearTimeout(temporizadorRecentrado);
    temporizadorRecentrado = setTimeout(recentrar, 160);
  }, { passive: true });

  // Mouse: arrastrar.
  let arrastre = null;
  pista.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    arrastre = { x: e.clientX, inicio: pista.scrollLeft };
    pista.setPointerCapture(e.pointerId);
    carrusel.classList.add('carrusel--arrastrando');
    estado.tocando = true;
  });
  pista.addEventListener('pointermove', (e) => {
    if (arrastre) pista.scrollLeft = arrastre.inicio - (e.clientX - arrastre.x);
  });
  function soltar() {
    if (!arrastre) return;
    arrastre = null;
    carrusel.classList.remove('carrusel--arrastrando');
    estado.tocando = false;
    esperar(CARRUSEL.ESPERA_TRAS_INTERACCION_MS);
  }
  pista.addEventListener('pointerup', soltar);
  pista.addEventListener('pointercancel', soltar);
  pista.addEventListener('dragstart', (e) => e.preventDefault());

  // Dedo: el navegador desliza; aquí solo se evita competir mientras el dedo esté puesto.
  pista.addEventListener('touchstart', () => { estado.tocando = true; }, { passive: true });
  const levantarDedo = () => { estado.tocando = false; esperar(CARRUSEL.ESPERA_TRAS_INTERACCION_MS); };
  pista.addEventListener('touchend', levantarDedo, { passive: true });
  pista.addEventListener('touchcancel', levantarDedo, { passive: true });

  // Rueda o trackpad.
  pista.addEventListener('wheel', () => esperar(CARRUSEL.ESPERA_TRAS_INTERACCION_MS), { passive: true });

  // El mouse encima detiene el avance; al salir vuelve enseguida.
  carrusel.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') estado.encima = true; });
  carrusel.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    estado.encima = false;
    esperar(CARRUSEL.ESPERA_TRAS_SALIR_MS);
  });

  // Foco de teclado dentro del carrusel: se detiene mientras se navega con el teclado.
  carrusel.addEventListener('focusin', () => { estado.tecladoEnfocado = !!carrusel.querySelector(':focus-visible'); });
  carrusel.addEventListener('focusout', () => {
    estado.tecladoEnfocado = false;
    esperar(CARRUSEL.ESPERA_TRAS_SALIR_MS);
  });

  // Controles: anterior, pausa y siguiente.
  const controles = document.createElement('div');
  controles.className = 'carrusel__controles';
  const anterior = botonCarrusel('carrusel__boton--anterior', 'Fotos anteriores', ['anterior']);
  const siguiente = botonCarrusel('carrusel__boton--siguiente', 'Fotos siguientes', ['siguiente']);
  const mover = (direccion) => {
    const paso = Math.max(pista.clientWidth * 0.8, 160);
    pista.scrollBy({ left: direccion * paso, behavior: conMovimiento ? 'smooth' : 'auto' });
    esperar(CARRUSEL.ESPERA_TRAS_INTERACCION_MS);
  };
  anterior.addEventListener('click', () => mover(-1));
  siguiente.addEventListener('click', () => mover(1));
  controles.append(anterior);

  if (conMovimiento) {
    const pausa = botonCarrusel('carrusel__boton--pausa', 'Pausar el movimiento automático', ['pausa', 'icono-pausa'], ['reanudar', 'icono-reanudar']);
    pausa.setAttribute('aria-pressed', 'false');
    pausa.addEventListener('click', () => {
      estado.pausaManual = !estado.pausaManual;
      pausa.setAttribute('aria-pressed', String(estado.pausaManual));
      pausa.setAttribute('aria-label', estado.pausaManual ? 'Reanudar el movimiento automático' : 'Pausar el movimiento automático');
      if (!estado.pausaManual) esperar(CARRUSEL.ESPERA_TRAS_SALIR_MS);
    });
    controles.append(pausa);
  }
  controles.append(siguiente);
  carrusel.appendChild(controles);

  // No gastar batería si el carrusel no se ve en pantalla o la pestaña está oculta.
  new IntersectionObserver(([entrada]) => {
    estado.visible = entrada.isIntersecting;
    if (estado.visible) arrancar(); else detener();
  }, { threshold: 0.05 }).observe(carrusel);
  document.addEventListener('visibilitychange', () => { if (document.hidden) detener(); else arrancar(); });

  medir();
  window.addEventListener('resize', medir);
  carrusel.querySelectorAll('img').forEach((img) => { if (!img.complete) img.addEventListener('load', medir); });
}

function vigilarDesplazamiento() {
  const encabezado = document.querySelector('.encabezado');
  if (!encabezado) return;

  const centinela = document.createElement('div');
  centinela.style.cssText = 'position:absolute;top:0;height:1px;width:1px';
  document.body.prepend(centinela);

  new IntersectionObserver(
    ([entrada]) => encabezado.classList.toggle('esta-desplazado', !entrada.isIntersecting),
    { threshold: 0 }
  ).observe(centinela);
}

function configurarWhatsApp() {
  const enlace = document.getElementById('enlace-whatsapp');
  if (enlace) {
    enlace.href = `https://wa.me/${CONFIG.WHATSAPP}?text=${encodeURIComponent(CONFIG.MENSAJE_WHATSAPP)}`;
  }
}

function prepararFormularios() {
  const ingreso = document.getElementById('form-ingreso');
  if (!ingreso) return;
  const error = ingreso.querySelector('[data-error]');
  const boton = ingreso.querySelector('button[type="submit"]');

  const sesion = obtenerSesion();
  if (sesion) {
    document.querySelectorAll('[data-abrir="modal-ingreso"]').forEach((enlace) => {
      enlace.removeAttribute('data-abrir');
      if (enlace.hasAttribute('data-acceso-icono')) {
        enlace.setAttribute('aria-label', 'Ir a mi panel');
        enlace.title = 'Ir a mi panel';
      } else {
        enlace.textContent = 'Mi panel';
      }
      if (enlace.tagName === 'A') enlace.href = destinoDe(sesion.usuario);
      else enlace.addEventListener('click', () => location.assign(destinoDe(sesion.usuario)));
    });
  }

  const parametros = new URLSearchParams(location.search);
  if (parametros.has('ingresar') && !sesion) {
    abrirModal('modal-ingreso');
    if (parametros.has('vencida')) mostrarError(error, 'Tu sesión venció. Ingresa de nuevo.');
  }

  ingreso.addEventListener('submit', async (e) => {
    e.preventDefault();
    ocultarError(error);

    const correo = ingreso.correo.value.trim();
    const contrasena = ingreso.contrasena.value;
    if (!correo || !contrasena) {
      mostrarError(error, 'Escribe tu correo y tu contraseña.');
      (correo ? ingreso.contrasena : ingreso.correo).focus();
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Ingresando…';
    try {
      const respuesta = await api('/auth/ingreso', { metodo: 'POST', cuerpo: { correo, contrasena } });
      guardarSesion(respuesta);
      location.assign(destinoDe(respuesta.usuario));
    } catch (err) {
      mostrarError(error, err.message);
      ingreso.contrasena.value = '';
      ingreso.contrasena.focus();
      boton.disabled = false;
      boton.textContent = 'Ingresar';
    }
  });
}

function mostrarError(nodo, mensaje) {
  if (!nodo) return;
  nodo.textContent = mensaje;
  nodo.hidden = false;
}

function ocultarError(nodo) {
  if (!nodo) return;
  nodo.hidden = true;
}
