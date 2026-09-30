/* Proveedor de correo (Nodemailer).
   PENDIENTE: implementar el transporte y las plantillas. */

async function enviar({ tipo, cita, paciente }) {
  throw new Error('ProveedorCorreo sin implementar');
}

module.exports = { enviar };
