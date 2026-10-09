/* Textos de los mensajes de WhatsApp.
   Solo llevan fecha, hora, especialista y dirección: nada clínico,
   porque cualquiera puede escribir un número ajeno al agendar y el
   mensaje le llegaría a un tercero (Ley 1581 de 2012). */
const { fechaEnTexto, horaEnTexto } = require('../../utils/tiempo');

const URL_PUBLICA = () => (process.env.URL_PUBLICA || 'http://localhost:5500').replace(/\/+$/, '');

function enlaceGestion(codigo) {
  return `${URL_PUBLICA()}/gestionar-cita.html?codigo=${encodeURIComponent(codigo)}`;
}

/* "ANA MARÍA PÉREZ" -> "Ana" */
function primerNombre(nombreCompleto) {
  const primero = String(nombreCompleto).trim().split(/\s+/)[0] || '';
  return primero.charAt(0).toUpperCase() + primero.slice(1).toLowerCase();
}

/* Los mismos datos se usan para el texto libre (modo manual o
   consola) y como parámetros de la plantilla aprobada (modo api). */
function datosDelMensaje(cita, codigo) {
  return {
    nombre: primerNombre(cita.nombrePaciente),
    fecha: fechaEnTexto(cita.fecha),
    hora: horaEnTexto(cita.hora),
    especialista: cita.especialista,
    direccion: `${cita.direccion}, ${cita.ciudad}`,
    enlace: codigo ? enlaceGestion(codigo) : URL_PUBLICA(),
  };
}

const TEXTOS = {
  confirmacion: (d) =>
    `Hola ${d.nombre}, tu cita en Arte Odontológico quedó confirmada para el ${d.fecha} a las ${d.hora} con ${d.especialista}, en ${d.direccion}. Para reprogramar o cancelar: ${d.enlace}`,
  reprogramacion: (d) =>
    `Hola ${d.nombre}, tu cita en Arte Odontológico fue reprogramada para el ${d.fecha} a las ${d.hora} con ${d.especialista}, en ${d.direccion}. Si necesitas cancelarla: ${d.enlace}`,
  cancelacion: (d) =>
    `Hola ${d.nombre}, tu cita en Arte Odontológico del ${d.fecha} a las ${d.hora} fue cancelada. Si quieres, agenda una nueva en ${d.enlace}`,
  // El consultorio no pudo atender la hora pedida: se invita a pedir otra.
  rechazo: (d) =>
    `Hola ${d.nombre}, no pudimos confirmar tu cita en Arte Odontológico del ${d.fecha} a las ${d.hora}; por favor pide otra hora en ${d.enlace} o responde este mensaje y te ayudamos.`,
  // Sin enlace: se envía unas 24 horas antes, cuando ya pasó el plazo
  // para reprogramar o cancelar desde la web.
  recordatorio: (d) =>
    `Hola ${d.nombre}, te recordamos tu cita en Arte Odontológico el ${d.fecha} a las ${d.hora} con ${d.especialista}, en ${d.direccion}. Si no puedes asistir, avísanos respondiendo este mensaje.`,
};

/* Tipos cuyo mensaje lleva el enlace "Gestionar mi cita". */
const LLEVA_ENLACE = new Set(['confirmacion', 'reprogramacion']);

function construir(tipo, cita, codigo) {
  const datos = datosDelMensaje(cita, LLEVA_ENLACE.has(tipo) ? codigo : null);
  return { texto: TEXTOS[tipo](datos), datos };
}

/* Enlace que abre WhatsApp (app o web) con el mensaje ya escrito. */
function enlaceWhatsApp(telefono, texto) {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(texto)}`;
}

module.exports = { construir, enlaceWhatsApp, enlaceGestion, LLEVA_ENLACE };
