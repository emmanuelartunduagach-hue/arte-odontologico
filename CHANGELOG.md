# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). El proyecto usa versiones `mayor.menor.parche`.

## [1.0.0] — Entrega final (octubre de 2026)

Primera versión completa, publicada en <https://arte-odontologico-production.up.railway.app>.

### Incluye

- Solicitud de citas en línea sin cuenta: especialidad, especialista, día y hora, con autorización de tratamiento de datos.
- «Gestionar mi cita» con enlace privado: reprogramar una vez o cancelar hasta 24 horas antes.
- Panel de la secretaria (rol `administrador`): agenda, horarios por especialista, pacientes, historia clínica de solo inserción y odontograma FDI.
- Panel de la propietaria (rol `superadmin`): aprobación de correcciones de la historia y de anulaciones del odontograma, equipo y especialistas.
- Mensajes por WhatsApp (confirmación, cambios, cancelación y recordatorio 24 horas antes) con proveedor intercambiable: manual, consola, Twilio y API de Meta.
- API REST (Node.js 20 y Express 4) con 54 rutas, MySQL 8 (11 tablas y una vista) y despliegue en Railway.
- Seguridad: contraseñas con bcrypt, sesión con JWT, consultas con parámetros, rol verificado en el servidor, límite de peticiones por IP y enlaces de gestión guardados como hash.
- Documentación en `docs/`: alcance, modelo de datos, contrato de la API, decisiones técnicas, manuales y pruebas.

### Ajustes posteriores a la entrega (25 de octubre)

Detalle en la decisión 33 de `docs/decisiones-tecnicas.md`.

- Cabeceras de seguridad (`helmet` con política de contenido), CORS cerrado por defecto, firma de sesión solo con HS256 y cierre ordenado del servidor.
- Pruebas unitarias y verificación automática con GitHub Actions en cada pull request.
- Paginación en las listas del panel (pacientes, agenda, solicitudes y equipo).
- Revisión de la configuración al arrancar: aviso si `URL_PUBLICA` o `WHATSAPP_MODO` son inválidos o faltan credenciales del proveedor de mensajes.

### Limitaciones conocidas

- El envío automático por la API de Meta espera la aprobación de las plantillas; Twilio se usa solo para pruebas.
- Sin evaluación formal de usabilidad (ISO 9241-11) ni auditoría de accesibilidad (WCAG 2.2).
- El script de las pruebas de integración contra MySQL no está en el repositorio.
