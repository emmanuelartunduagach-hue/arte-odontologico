/* Proveedor de WhatsApp (Cloud API de Meta).

   PENDIENTE. Antes de implementar hace falta:
   1. Aprobación del docente para cambiar el canal en la propuesta.
   2. Cuenta de Meta Business verificada del consultorio.
   3. Plantillas de tipo "utilidad" aprobadas por Meta.

   El contenido del mensaje se limita a fecha, hora y estado.
   No debe incluir información clínica: es dato sensible bajo la
   Ley 1581 de 2012 y WhatsApp no es un canal cifrado extremo a
   extremo desde el lado del negocio. */

async function enviar({ tipo, cita, paciente }) {
  throw new Error('ProveedorWhatsApp sin implementar');
}

module.exports = { enviar };
