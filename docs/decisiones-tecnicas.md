# Decisiones técnicas

Registro de las decisiones tomadas durante el desarrollo y su justificación.
Sirve como material de apoyo para la sustentación.

## 1. Descartar el código exportado de Figma

El boceto se generó con Figma Make y se entregó como proyecto React + Vite +
TypeScript + Tailwind. Se descartó por tres razones:

- **Dependencias sin uso.** El `package.json` declaraba 54 dependencias
  (MUI, Radix UI, react-dnd, react-slick, recharts, embla-carousel, entre otras)
  y el código solo usaba tres. Había además 46 componentes de shadcn/ui que
  ningún archivo importaba.
- **Contradicción con la propuesta aprobada.** El producto final aprobado
  especifica frontend en HTML, CSS y JavaScript. Mantener React habría exigido
  un cambio de alcance adicional.
- **Instalación rota.** `react` y `react-dom` estaban declarados como
  `peerDependencies` opcionales, no como dependencias, de modo que `npm install`
  no instalaba React.

Se conservó el diseño visual y el flujo de navegación; se reescribió la
implementación.

## 2. Rol del usuario determinado por el servidor

En el boceto, el formulario de ingreso incluía un menú desplegable para elegir
entre "Paciente" y "Administrador". Cualquier visitante podía entrar al panel
administrativo seleccionándolo.

El rol pasa a ser un atributo de la tabla `usuarios` y se incluye en el token
firmado por el servidor. El cliente nunca lo envía. El middleware
`requiereRol()` valida el permiso en cada endpoint protegido.

## 3. Capa de notificaciones con proveedores intercambiables

La propuesta aprobada exige notificaciones por correo, pero se está tramitando
el cambio a WhatsApp por su mayor tasa de lectura.

`NotificacionService` expone un único método `enviar()` y delega en el proveedor
configurado en la variable de entorno `NOTIFICACIONES_CANAL`. Cambiar de canal
—o activar ambos— no requiere modificar los controladores.

Esto evita que la entrega dependa de la verificación de empresa ante Meta, que
puede tardar semanas y no está bajo control del equipo.

## 4. Imágenes locales en lugar de enlaces externos

El boceto enlazaba cinco imágenes alojadas en Unsplash. Se retiraron: dependen
de un servidor externo y de una licencia que el consultorio no posee. Se
reemplazaron por marcadores locales, pendientes de sustituir por fotografías
propias del consultorio.

## 5. Sustitución del carrusel automático

El boceto incluía un carrusel que avanzaba solo cada 4,5 segundos. Se reemplazó
por una galería estática y una sección "Cómo funciona" que explica el flujo de
agendamiento. El movimiento automático compite con la lectura, dificulta el uso
con lector de pantalla y no aportaba información nueva.

## 6. Restricciones de integridad en la base de datos

La regla "una franja horaria no puede tener dos citas" se aplica con una
restricción `UNIQUE` sobre `citas.franja_id`, no solo con una validación en el
código. Si dos pacientes envían la solicitud al mismo tiempo, el motor rechaza
la segunda.

## 7. Modelo de dos sedes

El consultorio atiende en dos ubicaciones: Neiva (Carrera 7 No. 6-45, Centro) y
Rivera (Carrera 7 No. 3-61). Este dato no aparecía en la propuesta aprobada ni en
el prototipo, y se conoció al recibir el material del consultorio.

Se agregó la tabla `sedes` y `franjas_horarias` pasa a depender de ella. La
restricción de unicidad cambió de `(fecha, hora_inicio)` a
`(sede_id, fecha, hora_inicio)`: la misma hora puede ofrecerse en ambas sedes,
pero no duplicarse dentro de una.

Sin este cambio, publicar disponibilidad para las 10:00 a.m. en Neiva habría
bloqueado esa hora en Rivera, y el paciente no tendría forma de saber a cuál
dirección presentarse.

Queda pendiente decidir con el consultorio si un mismo servicio se presta en
ambas sedes o si cada una tiene su propia oferta. De ser lo segundo, hará falta
una tabla intermedia `sedes_servicios`.

## 8. Carrusel automático y tipografía de titulares

La decisión 5 sustituyó el carrusel automático del boceto por una galería
estática. A pedido del consultorio, la galería vuelve a moverse sola, pero de
otra forma: una tira que se desliza de manera continua y lenta (unos 35 px por
segundo), sin saltos ni botones. Se implementa con una animación CSS, sin
librerías. Salvaguardas: se detiene al pasar el cursor, las copias que genera
el bucle se ocultan a los lectores de pantalla y, si el sistema tiene
activado "reducir movimiento", no se anima y queda como una tira que se
desplaza a mano. Las fotos mantienen su proporción real para no recortar los
afiches con texto.

Queda una limitación conocida: sin botón de pausa, quien no use el cursor
(teclado, pantalla táctil) no puede detener el movimiento. Si el consultorio
lo necesita, se puede añadir un botón de pausa.

Los titulares usan Playfair Display (serif de alto contraste, estilo Didone),
tomada como referencia de una tipografía de moda y estética que propuso el
equipo. Es una alternativa libre en Google Fonts. La interfaz y los datos
siguen en Inter. Los títulos de sección suben de tamaño para que la persona
sepa de inmediato en qué parte de la página está.

Las fotografías se procesaron antes de publicarse: se recortaron los iconos de
Instagram que traían las capturas y se ocultaron los datos personales del
paciente visibles en la radiografía (Ley 1581 de 2012).

La sección "Cómo funciona" se eliminó de la página pública (6 de octubre):
describía un registro propio del paciente que ya no existe tras el Alcance v2
(el paciente agenda sin cuenta). Si más adelante se quiere explicar el flujo
nuevo, se agrega de nuevo con el texto actualizado.

Agendar desde la página pública (6 de octubre): se quitó "Crear cuenta"; solo
la secretaria crea usuarios, así que el encabezado conserva únicamente
"Ingresar" (sirve para la secretaria y para pacientes con usuario). "Agendar
mi cita" baja a la sección Especialidades y cada especialidad abre un modal
con los pasos: especialista (se omite si hay uno solo), calendario con solo
los días con agenda, hora y datos (nombre, identificación, celular, correo
opcional, autorización de datos y campo trampa contra bots). Termina con el
enlace para gestionar la cita. Se hizo en un modal para no salir de la página;
si el equipo prefiere una página aparte, el cambio es solo de ubicación. Solo
queda la sede Rivera. Para ver el flujo sin backend existe js/api-demo.js, que
solo se activa en localhost con ?demo=1 y no guarda datos.
---

## Actualización del 6 de octubre de 2026 (alcance v2)

Tras la reunión con el docente asesor del 5 de octubre cambió el alcance (ver
`docs/02-requerimientos/alcance-v2.md`). Las decisiones 3, 6 y 7 quedan
reemplazadas por las siguientes; se conservan arriba como registro histórico.

## 9. Agendar sin cuenta; las cuentas las crea la secretaria

Antes el paciente se registraba solo. Ahora cualquier persona agenda con nombre,
documento y teléfono (correo opcional), y la secretaria crea el usuario cuando
el paciente ya asistió. Así no se llena la base de cuentas de personas que nunca
van al consultorio.

Los datos de quien agenda se guardan en la propia cita (`nombre_paciente`,
`documento_paciente`, `telefono_paciente`, `correo_paciente`) y no en
`usuarios`. Al crear la cuenta se vinculan las citas anteriores con el mismo
documento **y** teléfono. Una cita solo queda a nombre de un usuario si agenda
con su sesión iniciada: escribir el documento de otra persona no basta.

## 10. Una sola sede (reemplaza la decisión 7)

El consultorio atiende solo en Rivera. Se conserva la tabla `sedes` con una
fila activa; Neiva queda desactivada en las bases migradas. Si se abre otra
sede no hay que rehacer el modelo.

## 11. Disponibilidad por especialista, publicada a mano

Se agregaron `especialistas` y `especialista_especialidad` (un especialista
puede atender varias especialidades). Las franjas pasan a ser de un
especialista, únicas por `(especialista_id, fecha, hora_inicio)`. La secretaria
las publica a mano porque dependen de la disponibilidad real de cada
especialista; el sistema no genera horarios. No se maneja duración de citas.

Quitar una hora la desactiva (`activa = FALSE`) en vez de borrarla, porque
citas antiguas pueden referenciarla. No se puede quitar una hora con cita viva.

## 12. Doble reserva con columna generada (reemplaza la decisión 6)

Con citas canceladas que no se borran, `UNIQUE (franja_id)` impediría volver a
ofrecer una hora cancelada. Se reemplazó por la columna generada
`franja_ocupada = IF(estado = 'cancelada', NULL, franja_id)` con índice único:
dos citas vivas no pueden ocupar la misma hora (el motor rechaza la segunda,
aun con peticiones simultáneas) y una cancelada libera la hora sola. La prueba
de integración envía dos reservas simultáneas por la misma hora y verifica que
solo una gane.

## 13. Solo WhatsApp, con tres modos de envío (reemplaza la decisión 3)

El correo se eliminó. El envío automático por la API de Meta depende de
trámites de la clínica, así que el proveedor tiene tres modos, elegidos en
`WHATSAPP_MODO`:

- `manual`: la secretaria envía cada mensaje con un clic desde su WhatsApp
  Business. Es el respaldo que garantiza la entrega.
- `consola`: para desarrollo y demostraciones.
- `api`: envío automático con plantillas aprobadas.

Si el envío falla, la cita no se deshace; el mensaje queda como `fallida` para
enviarlo a mano. Los mensajes no llevan información clínica.

## 14. Enlace "Gestionar mi cita" con código secreto

Sin cuenta, el paciente necesita una forma segura de reprogramar o cancelar. Al
agendar se genera un código aleatorio de 32 bytes que viaja en el enlace del
WhatsApp. En `citas` solo se guarda su hash SHA-256. Cuando la secretaria
reprograma, se genera un código nuevo y el anterior deja de servir. Al marcar
un mensaje como enviado, el código se borra del texto guardado.

Reglas: el paciente reprograma una sola vez y solo hasta 24 horas antes. El
límite de una vez se verifica dentro de la misma sentencia `UPDATE`, para que
dos clics seguidos no cuenten doble.

## 15. Historia clínica inalterable

La historia clínica no se edita ni se borra (Resolución 1995 de 1999). Solo
existen inserciones. Una corrección es una entrada nueva con `corrige_a`
apuntando a la original, que se conserva intacta con su autor y fecha.

## 16. Hora de Colombia calculada en el servidor de aplicación

Las franjas guardan fecha y hora locales del consultorio. La hora actual de
Bogotá se calcula en Node con `Intl` y se pasa a las consultas, de modo que las
reglas ("hora futura", "24 horas antes") no dependen de la zona horaria del
servidor donde se publique.

## 17. Migraciones verificadas

Cada cambio de esquema se escribe dos veces: en `schema.sql` (instalación nueva)
y en una migración numerada (bases existentes). Antes de entregar se comprueba
que ambos caminos producen exactamente el mismo esquema.

## 18. Página para gestionar la cita (7 de octubre)

La página gestionar-cita.html
lee `codigo` de la URL y muestra la cita con los botones que permiten
`puedeReprogramar` y `puedeCancelar`; si alguno es falso explica el `motivo`.
Reprogramar reutiliza el calendario y las horas del mismo especialista y pide
una confirmación antes de guardar, porque solo se puede una vez. Cancelar usa
un diálogo propio (no `confirm()`); si ya reprogramó, el botón dice "Cancelar y
pedir una cita nueva". Un enlace inválido muestra el 404 del contrato. Para no
duplicar código, las utilidades y el calendario pasaron a js/comun.js,
compartido con el flujo de agendar. El modo demo acepta los códigos
DEMO-0000, DEMO-REPROGRAMADA, DEMO-CERCA y DEMO-CANCELADA. En la confirmación
de agendar solo se muestra `cita.direccion`, que ya trae la ciudad.

## 19. Recordatorio sin enlace y restablecimiento de claves (7 de octubre)

El recordatorio se envía el día anterior a la cita. Para entonces ya pasó el
plazo de 24 horas para reprogramar o cancelar desde la web, así que el mensaje
no lleva enlace: invita a responder el WhatsApp si la persona no puede asistir.
Así tampoco hace falta generar un código nuevo, y el enlace de la confirmación
sigue sirviendo.

El servidor revisa cada 30 minutos, solo entre las horas configuradas
(`RECORDATORIO_DESDE` y `RECORDATORIO_HASTA`), las citas confirmadas de mañana
que se agendaron hace más de 12 horas. Una cita recibe un solo recordatorio
(otro si se reprograma). También se puede lanzar a mano desde el panel o con
`npm run recordatorios`.

"Olvidé mi contraseña" no usa correo ni enlaces de recuperación: el sistema no
envía correos y los pacientes con cuenta ya conocen el consultorio. La
secretaria genera una clave temporal nueva desde la ficha del paciente, y el
paciente debe cambiarla al ingresar. La clave de la secretaria se restablece
desde el servidor con `npm run restablecer-admin`; no existe una ruta web para
eso.

## 20. Saltos de línea normalizados

Se agregó `.gitattributes` para que todo archivo de texto se guarde con saltos
de línea LF en el repositorio, sin importar el sistema operativo de quien hace
el commit. Antes, algunos commits hechos desde Windows guardaban CRLF y GitHub
mostraba archivos completos como modificados cuando solo cambiaban unas líneas.
