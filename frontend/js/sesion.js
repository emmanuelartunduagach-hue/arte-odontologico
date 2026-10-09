/* Sesión de la secretaria (los pacientes no tienen cuenta).

   Se guarda en sessionStorage, no en localStorage: se borra al cerrar
   la pestaña, lo que conviene en el computador compartido del
   consultorio. El token lo firma el servidor; aquí solo se lee para
   saber a qué panel llevar a cada quien. La seguridad real está en el
   backend, que valida el token y el rol en cada petición. */

const CLAVE_SESION = 'arte-sesion';

const PANELES = {
  administrador: 'panel-secretaria.html',
};

function guardarSesion({ token, usuario }) {
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ token, usuario }));
  } catch {
    // Almacenamiento bloqueado (navegación privada estricta): la sesión
    // dura solo mientras la página siga abierta.
    window.__sesionEnMemoria = { token, usuario };
  }
}

function obtenerSesion() {
  let sesion = window.__sesionEnMemoria || null;
  try {
    const guardada = sessionStorage.getItem(CLAVE_SESION);
    if (guardada) sesion = JSON.parse(guardada);
  } catch { /* se usa la copia en memoria */ }

  if (!sesion?.token || !sesion?.usuario) return null;
  if (tokenVencido(sesion.token)) {
    cerrarSesion();
    return null;
  }
  return sesion;
}

function actualizarUsuario(cambios) {
  const sesion = obtenerSesion();
  if (sesion) guardarSesion({ token: sesion.token, usuario: { ...sesion.usuario, ...cambios } });
}

function cerrarSesion() {
  window.__sesionEnMemoria = null;
  try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* nada que borrar */ }
}

/** Lee `exp` del token (sin verificar la firma: eso lo hace el servidor). */
function tokenVencido(token) {
  try {
    const carga = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof carga.exp === 'number' && carga.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/** Página a la que va el usuario después de ingresar. */
function destinoDe(usuario) {
  if (usuario.debeCambiarContrasena) return 'cambiar-contrasena.html';
  return PANELES[usuario.rol] || 'index.html';
}

/** Para las páginas con sesión: si no hay sesión, si el rol no es el
    de la página o si falta cambiar la clave temporal, redirige y
    devuelve null. Si todo está bien, devuelve la sesión. */
function exigirSesion(...rolesPermitidos) {
  const sesion = obtenerSesion();
  if (!sesion) {
    location.replace('index.html?ingresar=1');
    return null;
  }
  const { usuario } = sesion;
  const enCambioDeClave = location.pathname.endsWith('cambiar-contrasena.html');
  if (usuario.debeCambiarContrasena && !enCambioDeClave) {
    location.replace('cambiar-contrasena.html');
    return null;
  }
  if (rolesPermitidos.length && !rolesPermitidos.includes(usuario.rol)) {
    location.replace(destinoDe(usuario));
    return null;
  }
  return sesion;
}

/** Botón "Cerrar sesión" de los paneles: [data-cerrar-sesion]. */
document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-cerrar-sesion]')) return;
  e.preventDefault();
  cerrarSesion();
  location.replace('index.html');
});
