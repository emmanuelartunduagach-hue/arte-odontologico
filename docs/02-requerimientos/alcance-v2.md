# Arte Odontológico — Alcance v2

Versión del 6 de octubre de 2026, ajustada el 9 de octubre · Emmanuel Artunduaga Charry · Jawer Leonardo Manrique Yosa

El sistema pasa a ser una página donde cualquier paciente pide su cita sin crear cuenta, la secretaria la acepta desde su panel y al paciente le llega la confirmación por WhatsApp. La entrega es en unas 2 semanas, con la página publicada en un servidor. Este documento reemplaza al alcance del anteproyecto en todo lo que lo contradiga.

## 1. Qué cambió

Los cambios salen de la reunión con el docente asesor del 5 de octubre de 2026, de la conversación con la clínica y del ajuste del 9 de octubre (citas por aprobar y pacientes sin login).

| Tema | Antes (anteproyecto) | Ahora |
|---|---|---|
| Sedes | Neiva y Rivera | Solo Rivera |
| Cuentas de pacientes | El paciente se registraba solo | Los pacientes no tienen usuario ni contraseña: son un registro (ficha) con su historia clínica. Solo la secretaria inicia sesión |
| Agendar cita | Con sesión iniciada | Sin iniciar sesión: nombres, apellidos, tipo y número de documento, correo y celular. La cita queda confirmada de una vez |
| Selección | Servicio, sede y hora | Especialidad, especialista y día en un calendario |
| Notificaciones | Correo | Solo WhatsApp |
| Reprogramar | Opcional | Obligatorio: una sola vez por cita |
| Historia clínica | Por definir | Obligatoria: la secretaria la ve y la actualiza |
| Especialistas | No existían | Se registran por nombre; no inician sesión |
| Duración de citas | Por servicio | No se maneja |
| Entrega | 11 de noviembre | En unas 2 semanas, publicada en servidor |
| Documentación | Por definir | Manual de usuario, manual técnico y manual de instalación |

## 2. Flujo del paciente

**Pedir la cita (sin cuenta)**
1. Elige la especialidad.
2. Ve los especialistas de esa especialidad, por nombre, y elige uno.
3. Ve un calendario del mes: los días con al menos una hora libre salen resaltados y los demás bloqueados.
4. Toca un día y elige una hora libre.
5. Ve el resumen de lo elegido y escribe nombres, apellidos, tipo y número de documento, correo, celular y, si quiere, teléfono fijo. Marca la casilla de autorización de datos, que viene sin marcar y con enlace a la política.
6. Pide la cita. Queda **confirmada** de una vez (decisión 27): le llega un WhatsApp con fecha, hora, especialista y dirección, más un enlace a "Gestionar mi cita". Si es su primera cita, se crea su ficha de paciente (por documento).
- La secretaria no tiene que aprobar nada: ve las citas nuevas en "Novedades de la web".
- Unas 24 horas antes de la cita le llega un recordatorio.

**Gestionar mi cita** (desde el enlace, sin iniciar sesión)
- **Reprogramar:** usa el mismo calendario del especialista. La hora anterior se libera. Solo se permite una vez; el cambio queda confirmado y le llega el aviso por WhatsApp.
- **Cancelar:** la hora vuelve al calendario.
- Si ya reprogramó una vez, solo queda "Cancelar y pedir una cita nueva".
- Ambas opciones se cierran 24 horas antes de la cita; después solo la secretaria puede moverla.

**Si llega al consultorio sin pasar por la web**
- La secretaria lo registra en el panel (nombre, documento, celular, correo y autorización de datos) y le agenda la cita desde su ficha. La cita queda confirmada de una vez y le llega el mismo WhatsApp. De ahí en adelante sigue el flujo normal.

**Historia clínica**
- Cada paciente tiene su ficha con citas e historia clínica. La secretaria la complementa después de cada cita atendida.

## 3. Funciones de la secretaria

Hay un solo usuario administrador: la secretaria. Los especialistas no inician sesión.

| Área | Qué puede hacer |
|---|---|
| Especialidades | Crear, editar, activar o desactivar |
| Especialistas | Registrar por nombre, asignar una o varias especialidades, activar o desactivar |
| Disponibilidad | Por especialista y fecha, marcar a mano las horas de atención; quitar o agregar horas; copiar a varios días. No deja quitar una hora que ya tiene cita |
| Novedades de la web | Ver en Inicio las citas pedidas por la web en las últimas 48 horas (ya confirmadas) y los cambios de hora y cancelaciones que hizo el paciente |
| Agenda | Ver citas por día, especialista o estado; buscar; marcar atendida o no asistió; reprogramar o cancelar sin límite |
| Pacientes | Registrar a quien llega al consultorio, buscar por nombre, documento, celular o correo, ver la ficha con citas e historia y agendarle una cita |
| Historia clínica | Ver y agregar entradas; corregir con anotación, sin borrar |
| Mensajes de WhatsApp | Se envían solos; si alguno falla, aparece en Inicio para enviarlo a mano |
| Ingreso | "Acceso del consultorio" en el pie de la página principal; solo para la secretaria |

## 4. Reglas del negocio

| Regla | Valor acordado |
|---|---|
| Datos para agendar | Nombres, apellidos, tipo y número de documento, correo y celular; teléfono fijo opcional |
| Estado al pedir la cita | Confirmada de inmediato (decisión 27) |
| Estado al agendar la secretaria | Confirmada de inmediato |
| Reprogramaciones por el paciente | 1 por cita; el cambio queda confirmado. Después solo puede cancelar y pedir otra |
| Plazo para reprogramar o cancelar | Hasta 24 horas antes |
| Reprogramaciones por la secretaria | Sin límite y no cuentan al paciente |
| Citas canceladas o rechazadas | Se marcan "cancelada" o "rechazada", no se borran |
| Citas pendientes o confirmadas por documento | Máximo 1 a la vez desde la web (configurable) — por confirmar |
| Inasistencias | Se registran; el bloqueo tras 2 inasistencias está por decidir |
| Doble reserva | Imposible: cada hora admite una sola cita viva (restricción en la base de datos) |
| Protección contra bots | Límite de peticiones por IP y campo trampa en el formulario |
| Duración de la cita | No se maneja |

## 5. Notificaciones por WhatsApp

Los mensajes llevan solo fecha, hora, especialista y dirección, nada clínico, porque cualquiera puede escribir un número ajeno al agendar.

| Momento | Mensaje |
|---|---|
| Al pedir la cita | Hola Ana, tu cita en Arte Odontológico quedó confirmada para el jueves 15 de octubre a las 3:00 p. m. con Dra. Laura Gómez, en Carrera 7 No. 3-61, Rivera. Para reprogramar o cancelar: [enlace] |
| Al rechazar una cita pendiente antigua | Hola Ana, no pudimos confirmar tu cita en Arte Odontológico del [día] a las [hora]; por favor pide otra hora en [página] o responde este mensaje y te ayudamos. |
| Al reprogramar | Hola Ana, tu cita en Arte Odontológico fue reprogramada para el [día] a las [hora] con [especialista], en [dirección]. Si necesitas cancelarla: [enlace] |
| Al cancelar | Hola Ana, tu cita en Arte Odontológico del [día] a las [hora] fue cancelada. Si quieres, agenda una nueva en [página] |
| Recordatorio (24 horas antes) | Hola Ana, te recordamos tu cita en Arte Odontológico el [día] a las [hora] con [especialista], en [dirección]. Si no puedes asistir, avísanos respondiendo este mensaje. |

| Modo de envío | Cómo funciona | Requisito |
|---|---|---|
| Twilio (pruebas) | El servidor envía el texto con el WhatsApp Sandbox de Twilio | Cuenta de Twilio; cada número debe unirse al sandbox |
| Manual (respaldo garantizado) | El mensaje queda pendiente en el panel; la secretaria toca "Enviar por WhatsApp", se abre su WhatsApp Business con el texto listo y lo marca como enviado | Ninguno |
| Consola | El mensaje se imprime en el servidor | Para desarrollo y demostración |
| API automática | El servidor envía el mensaje solo, con plantillas aprobadas | App en Meta for Developers y número y método de pago de la clínica |

## 6. Datos personales e historia clínica

- **Autorización de datos (Ley 1581 de 2012):** casilla sin marcar por defecto, con enlace a la política. Cada cita guarda la autorización, la fecha y la versión de la política. La ficha del paciente guarda la misma información y qué secretaria la creó.
- **Política de datos:** reescrita (versión 1.1, decisión 26). Falta que el consultorio confirme el nombre legal y NIT o cédula del responsable, el correo para solicitudes, quién las atiende, el proveedor de alojamiento y la fecha de vigencia.
- **Historia clínica:** cada entrada tiene fecha, especialidad, especialista, procedimiento, notas y autor. "Editar" significa agregar entradas o anotar correcciones; nunca borrar ni sobrescribir (Resolución 1995 de 1999). Solo la secretaria tiene acceso.
- **Contraseñas:** solo la secretaria tiene; cifradas con bcrypt.

Nada de esto es asesoría legal: debe confirmarse con el docente y la clínica.

## 7. Pendientes por confirmar

- [ ] Fecha exacta de entrega y de la publicación en servidor
- [ ] WhatsApp automático: app en Meta for Developers (Emmanuel); la clínica decide mismo número o número nuevo y método de pago
- [ ] Dónde se publica: servidor, base MySQL en línea y dominio con HTTPS (¿hay presupuesto?)
- [ ] Responsable del tratamiento de datos y fecha de vigencia de la política
- [ ] Confirmar el límite de 1 cita activa por documento; decidir el bloqueo por inasistencias
- [ ] Lista real de especialidades y especialistas de la clínica
- [ ] Horario de atención de la sede de Rivera
- [ ] Estructura del Excel de la clínica (hojas y columnas, sin datos reales) para la importación
- [ ] Plantilla oficial de la FET para la documentación
