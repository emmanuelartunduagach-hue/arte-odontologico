// sessionStorage y no localStorage: la sesión se borra al cerrar la pestaña.

const CLAVE_SESION = 'arte-sesion';

const PANELES = {
  administrador: 'panel-secretaria.html',
  superadmin: 'panel-secretaria.html',
};

const esDueno = (usuario) => usuario?.rol === 'superadmin';

function guardarSesion({ token, usuario }) {
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ token, usuario }));
  } catch {
    // Almacenamiento bloqueado (navegación privada): la sesión dura mientras la página esté abierta.
    window.__sesionEnMemoria = { token, usuario };
  }
}

function obtenerSesion() {
  let sesion = window.__sesionEnMemoria || null;
  try {
    const guardada = sessionStorage.getItem(CLAVE_SESION);
    if (guardada) sesion = JSON.parse(guardada);
  } catch {  }

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
  try { sessionStorage.removeItem(CLAVE_SESION); } catch {  }
}

// Sin verificar la firma: eso lo hace el servidor.
function tokenVencido(token) {
  try {
    const carga = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof carga.exp === 'number' && carga.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

function destinoDe(usuario) {
  if (usuario.debeCambiarContrasena) return 'cambiar-contrasena.html';
  return PANELES[usuario.rol] || 'index.html';
}

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

document.addEventListener('click', (e) => {
  if (!e.target.closest('[data-cerrar-sesion]')) return;
  e.preventDefault();
  cerrarSesion();
  location.replace('index.html');
});
