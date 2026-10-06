# Arte Odontológico — Alcance v2

Versión del 6 de octubre de 2026 · Emmanuel Artunduaga Charry · Jawer Leonardo Manrique Yosa

El sistema pasa a ser una página donde cualquier paciente agenda su cita sin crear cuenta, con aviso por WhatsApp, y un panel único para la secretaria. La entrega es en unas 2 semanas, con la página publicada en un servidor. Este documento reemplaza al alcance del anteproyecto en todo lo que lo contradiga.

## 1. Qué cambió

Los cambios salen de la reunión con el docente asesor del 5 de octubre de 2026 y de la conversación con la clínica.

| Tema | Antes (anteproyecto) | Ahora |
|---|---|---|
| Sedes | Neiva y Rivera | Solo Rivera |
| Cuentas de pacientes | El paciente se registraba solo | La secretaria crea el usuario cuando el paciente ya asistió al consultorio |
| Agendar cita | Con sesión iniciada | Sin iniciar sesión: nombre, documento y teléfono (correo opcional) |
| Selección | Servicio, sede y hora | Especialidad, especialista y día en un calendario |
| Notificaciones | Correo | Solo WhatsApp |
| Reprogramar | Opcional | Obligatorio: una sola vez por cita |
| Historia clínica | Por definir | Obligatoria: la secretaria la ve y la actualiza |
| Especialistas | No existían | Se registran por nombre; no inician sesión |
| Duración de citas | Por servicio | No se maneja |
| Entrega | 11 de noviembre | En unas 2 semanas, publicada en servidor |
| Documentación | Por definir | Manual de usuario, manual técnico y manual de instalación |

## 2. Flujo del paciente

**Agendar (sin cuenta)**
1. Elige la especialidad.
2. Ve los especialistas de esa especialidad, por nombre, y elige uno.
3. Ve un calendario del mes: los días con al menos una hora libre salen resaltados y los demás bloqueados.
4. Toca un día y elige una hora libre.
5. Ve el resumen de lo elegido y escribe nombre, documento, teléfono y, si quiere, correo. Marca la casilla de autorización de datos, que viene sin marcar y con enlace a la política.
6. Confirma. La cita queda confirmada y le llega un WhatsApp con fecha, hora, especialista y dirección, más un enlace a "Gestionar mi cita".

**Gestionar mi cita** (desde el enlace, sin iniciar sesión)
- **Reprogramar:** usa el mismo calendario del especialista. La hora anterior se libera. Solo se permite una vez.
- **Cancelar:** la hora vuelve al calendario.
- Si ya reprogramó una vez, solo queda "Cancelar y pedir una cita nueva".
- Ambas opciones se cierran 24 horas antes de la cita; después solo la secretaria puede moverla.

**Después de la primera visita**
- Si el paciente asistió, la secretaria le crea un usuario. El sistema genera una clave temporal, que el paciente cambia en su primer ingreso. Las citas que pidió antes sin cuenta quedan asociadas a su usuario.
- Con usuario, el paciente ve sus citas y agenda con sus datos ya cargados.

## 3. Funciones de la secretaria

Hay un solo usuario administrador: la secretaria. Los especialistas no inician sesión.

| Área | Qué puede hacer |
|---|---|
| Especialidades | Crear, editar, activar o desactivar |
| Especialistas | Registrar por nombre, asignar una o varias especialidades, activar o desactivar |
| Disponibilidad | Por especialista y fecha, marcar a mano las horas de atención; quitar o agregar horas; copiar a varios días. No deja quitar una hora que ya tiene cita |
| Agenda | Ver citas por día, especialista o estado; buscar; marcar atendida o no asistió; reprogramar o cancelar sin límite |
| Pacientes | Crear usuario (genera clave temporal), buscar por nombre, documento o correo, ver la ficha con citas e historia |
| Historia clínica | Ver y agregar entradas; corregir con anotación, sin borrar |
| Mensajes de WhatsApp | Ver los pendientes, enviarlos con un clic desde su WhatsApp Business y marcarlos como enviados |
| Ingreso | Un solo formulario "Ingresar" para la secretaria y los pacientes con usuario; el sistema lleva a cada uno a su panel |

## 4. Reglas del negocio

| Regla | Valor acordado |
|---|---|
| Datos para agendar | Nombre, documento y teléfono; correo opcional |
| Estado al agendar | Confirmada de inmediato |
| Reprogramaciones por el paciente | 1 por cita; después solo puede cancelar y pedir otra |
| Plazo para reprogramar o cancelar | Hasta 24 horas antes |
| Reprogramaciones por la secretaria | Sin límite y no cuentan al paciente |
| Citas canceladas | Se marcan "cancelada", no se borran |
| Citas activas por documento sin usuario | Máximo 1 (configurable) — por confirmar |
| Inasistencias | Se registran; el bloqueo tras 2 inasistencias está por decidir |
| Doble reserva | Imposible: cada hora admite una sola cita viva (restricción en la base de datos) |
| Protección contra bots | Límite de peticiones por IP y campo trampa en el formulario |
| Duración de la cita | No se maneja |

## 5. Notificaciones por WhatsApp

Los mensajes llevan solo fecha, hora, especialista y dirección, nada clínico, porque cualquiera puede escribir un número ajeno al agendar.

| Momento | Mensaje |
|---|---|
| Al agendar | Hola Ana, tu cita en Arte Odontológico quedó agendada para el jueves 15 de octubre a las 3:00 p. m. con Dra. Laura Gómez, en Carrera 7 No. 3-61, Rivera. Para reprogramar o cancelar: [enlace] |
| Al reprogramar | Hola Ana, tu cita en Arte Odontológico fue reprogramada para el [día] a las [hora] con [especialista], en [dirección]. Si necesitas cancelarla: [enlace] |
| Al cancelar | Hola Ana, tu cita en Arte Odontológico del [día] a las [hora] fue cancelada. Si quieres, agenda una nueva en [página] |
| Recordatorio (día anterior) | Hola Ana, te recordamos tu cita en Arte Odontológico el [día] a las [hora] con [especialista], en [dirección]. Si no puedes asistir: [enlace] |

| Modo de envío | Cómo funciona | Requisito |
|---|---|---|
| Manual (respaldo garantizado) | El mensaje queda pendiente en el panel; la secretaria toca "Enviar por WhatsApp", se abre su WhatsApp Business con el texto listo y lo marca como enviado | Ninguno |
| Consola | El mensaje se imprime en el servidor | Para desarrollo y demostración |
| API automática | El servidor envía el mensaje solo, con plantillas aprobadas | App en Meta for Developers y número y método de pago de la clínica |

## 6. Datos personales e historia clínica

- **Autorización de datos (Ley 1581 de 2012):** casilla sin marcar por defecto, con enlace a la política. Cada cita guarda la autorización, la fecha y la versión de la política. Al crear un usuario, queda registrado qué secretaria recogió la autorización.
- **Política de datos:** hay que actualizarla (canal WhatsApp, sede Rivera) y definir el responsable del tratamiento y la fecha de vigencia.
- **Historia clínica:** cada entrada tiene fecha, especialidad, especialista, procedimiento, notas y autor. "Editar" significa agregar entradas o anotar correcciones; nunca borrar ni sobrescribir (Resolución 1995 de 1999). Solo la secretaria tiene acceso.
- **Contraseñas:** cifradas con bcrypt.

Nada de esto es asesoría legal: debe confirmarse con el docente y la clínica.

## 7. Pendientes por confirmar

- [ ] Fecha exacta de entrega y de la publicación en servidor
- [ ] WhatsApp automático: app en Meta for Developers (Emmanuel); la clínica decide mismo número o número nuevo y método de pago
- [ ] Dónde se publica: servidor, base MySQL en línea y dominio con HTTPS (¿hay presupuesto?)
- [ ] Responsable del tratamiento de datos y fecha de vigencia de la política
- [ ] Si el paciente con usuario puede ver su propia historia clínica
- [ ] Confirmar el límite de 1 cita activa sin usuario; decidir el bloqueo por inasistencias
- [ ] Lista real de especialidades y especialistas de la clínica
- [ ] Horario de atención de la sede de Rivera
- [ ] Estructura del Excel de la clínica (hojas y columnas, sin datos reales) para la importación
- [ ] Plantilla oficial de la FET para la documentación
