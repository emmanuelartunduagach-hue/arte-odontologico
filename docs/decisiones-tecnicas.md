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

## 21. Sesión en el navegador y límite de intentos de ingreso (8 de octubre)

El token se guarda en `sessionStorage` y no en `localStorage`: se borra al
cerrar la pestaña. En el computador compartido del consultorio, una sesión de
la secretaria olvidada abierta daría acceso a historias clínicas a quien use
el equipo después. El costo es que cada pestaña nueva pide ingresar otra vez.

Las páginas con sesión llaman a `exigirSesion(rol)` al cargar: sin sesión
llevan a Ingresar, con otro rol llevan al panel que corresponde y, si la clave
es temporal, obligan a cambiarla primero. Esto ordena la navegación, pero no
es la seguridad: cada ruta del backend vuelve a validar el token y el rol. Si
la API responde 401 a una petición con token, la sesión se borra y se vuelve a
Ingresar con el aviso "Tu sesión venció".

`POST /auth/ingreso` tiene su propio límite de peticiones (10 por IP cada 15
minutos) para frenar a quien intente adivinar contraseñas. Los intentos
exitosos también cuentan, lo que no afecta el uso normal.

## 22. Twilio como proveedor de pruebas de WhatsApp (8 de octubre)

La API de WhatsApp Cloud exige una app en Meta for Developers, y crear la
cuenta no fue posible a tiempo. Para probar el envío automático sin esa
cuenta se agregó el modo `twilio`, que usa el WhatsApp Sandbox de Twilio:
se registra con correo y celular, tiene crédito de prueba y envía el texto
completo del mensaje, sin plantillas aprobadas.

Es solo para pruebas: en el sandbox cada número debe unirse antes enviando
un código. La entrega a la clínica sigue siendo el modo `manual`, como
respaldo, o el modo `api` cuando la clínica tenga su cuenta de Meta.
Cambiar de uno a otro es solo la variable `WHATSAPP_MODO`.

Si el envío automático falla, la cita igual queda registrada y la API
devuelve el enlace de WhatsApp con el texto listo, para que la secretaria
lo envíe a mano desde el panel.

## 23. El paciente con sesión gestiona su cita desde "Mis citas" (8 de octubre; reemplazada por la 24)

Antes, el paciente con usuario solo veía sus citas: para reprogramar o
cancelar tenía que buscar el enlace del WhatsApp. Ahora lo hace desde su
panel con `POST /mis-citas/:id/reprogramar` y `POST /mis-citas/:id/cancelar`.

Las reglas son exactamente las del enlace (una reprogramación, hasta 24 horas
antes, con el mismo especialista), y el código que las aplica es el mismo:
`reprogramarPorPaciente` y `cancelarPorPaciente` en el controlador de citas.
Así no puede pasar que una regla cambie en un camino y no en el otro, ni que
el paciente evite el límite usando el panel en vez del enlace.

Si la cita no es del paciente de la sesión, la respuesta es 404 y no 403: con
403 alguien podría probar números de cita y saber cuáles existen.

Al reprogramar desde el panel no se tiene el código del enlace en claro (en la
base solo está su hash), así que el WhatsApp de confirmación lleva un enlace
nuevo y el anterior deja de servir, como cuando reprograma la secretaria.

## 24. Citas por aprobar y pacientes sin login (9 de octubre)

El flujo acordado con el equipo es más simple: la persona pide la cita, la
secretaria la acepta y entonces le llega el WhatsApp con los datos y el
enlace; unas 24 horas antes, el recordatorio. Quien llega al consultorio sin
pasar por la web se registra en el panel y sigue el mismo flujo.

- **La cita pedida por la web queda `pendiente`** y aparta la hora (la
  columna `franja_ocupada` solo la libera si está cancelada o rechazada), así
  nadie más la toma mientras la secretaria decide. Rechazar la libera y
  envía un mensaje invitando a pedir otra hora.
- **Los pacientes no tienen usuario ni contraseña.** Tener dos tipos de
  cuenta confundía (paciente con usuario, sin usuario, clave temporal…) y el
  enlace del WhatsApp ya cubre lo que el paciente necesita. Se quitan "Mis
  citas" (decisión 23), las claves temporales y el restablecimiento de
  claves de pacientes. Solo la secretaria inicia sesión, desde "Acceso del
  consultorio" en el pie de la página.
- **Tabla `pacientes` aparte de `usuarios`.** Una ficha de paciente no debe
  poder usarse para ingresar, y el correo de un paciente no puede ser único
  (una madre usa el suyo para sus hijos). La ficha se crea sola al aceptar la
  primera cita, buscando por documento, o la crea la secretaria en el
  consultorio. Así la historia clínica se va completando con cada cita.
- **El correo pasa a ser obligatorio**, para tener otro medio de contacto en
  la ficha.
- **Si el paciente reprograma, la nueva hora vuelve a pendiente:** la
  secretaria debe confirmar también el cambio.
- **Recordatorio 24 horas antes** en lugar de "el día anterior": se revisa
  cada 30 minutos qué citas confirmadas empiezan en las próximas 24 horas.
  Como solo se envía entre las 8:00 y las 19:00, una cita de las 7:00 lo
  recibe a las 8:00 del día anterior.

La migración 003 lleva las bases existentes al modelo nuevo sin perder datos:
copia los pacientes de `usuarios` a `pacientes` con el mismo id, de modo que
sus citas e historia clínica siguen apuntando a ellos.

## 25. Datos completos del paciente, cambio de hora visible y modo oscuro (9 de octubre)

Después de revisar el flujo con el consultorio:

- **Nombres y apellidos por separado, tipo de documento y teléfono fijo.**
  El formulario de pedir cita y el registro en el consultorio piden lo
  mismo: nombres, apellidos, tipo y número de documento, correo, celular
  (WhatsApp) y un teléfono fijo opcional. Los tipos son los usados en
  Colombia (CC, TI, RC, CE, PA y PPT); el pasaporte admite letras. El nombre
  completo se volvió una **columna generada** (`nombres + apellidos`) en
  `pacientes` y en `citas`: todo lo que ya lo leía (agenda, búsqueda,
  mensajes, la vista `v_agenda`) sigue igual y no puede quedar desalineado.
- **Motivo de consulta** (`pacientes.motivo_consulta`, opcional): cuando la
  secretaria registra a quien llega al consultorio, anota a qué vino. Se
  muestra en la ficha. No reemplaza la historia clínica, que se sigue
  llenando después de cada cita atendida.
- **Cambio de hora visible.** Cuando el paciente reprograma desde su enlace,
  la cita guarda la hora que tenía (`citas.franja_anterior_id`) y en las
  solicitudes por confirmar aparece "Cambio de hora · antes: …". Así la
  secretaria distingue una solicitud nueva de un cambio.
- **Rechazar a la vista.** En las solicitudes, "Aceptar" y "Rechazar" son
  dos botones visibles; "Cambiar hora" queda en "Más".
- **Mensaje de límite según el caso.** Si la persona ya tiene una solicitud
  pendiente, no tiene enlace todavía: el mensaje le dice que espere la
  confirmación por WhatsApp. Si ya está confirmada, que use su enlace.
- **Acceso del consultorio con un candado** junto a "Agendar cita", en el
  encabezado, además del enlace del pie de página.
- **Modo oscuro en el panel.** Se activa desde el menú de la cuenta y se
  recuerda en el navegador; si la secretaria nunca eligió, sigue el tema del
  sistema. Se implementó con las mismas variables de `tokens.css`,
  redefinidas bajo `:root[data-tema="oscuro"]`, y tres roles nuevos
  (`--acento-texto`, `--sobre-marca`, `--fondo-encabezado`) para separar el
  morado como texto del morado como fondo. Contrastes verificados: texto
  principal 14:1, secundario 8.6:1, botones 7.5:1. La página pública sigue
  en modo claro.

- **Sin sección de Mensajes.** Con el envío automático por la API de
  WhatsApp, la secretaria no tiene que enviar nada: se quitan la sección
  Mensajes, su contador del menú y la tarjeta "mensajes por enviar" de
  Inicio. Como red de seguridad, si un envío falla (token vencido, Meta
  caído) o el servidor está en modo manual, Inicio muestra "WhatsApp sin
  enviar" con el botón para enviarlo a mano; si no hay ninguno, no aparece.
  Los recordatorios se siguen generando solos cada 30 minutos.

La migración 004 lleva las bases existentes al modelo nuevo sin perder
datos: parte el nombre que ya existía (con 4 palabras o más, las 2 primeras
son nombres; con 2 o 3, la primera) y deja el tipo de documento en CC.

## 26. Política de tratamiento de datos, versión 1.1 (9 de octubre)

`politica-datos.html` se reescribió para el flujo actual: sin cuentas de
paciente, con historia clínica, motivo de consulta, mensajes por WhatsApp y
los datos nuevos del formulario. Sigue el contenido mínimo del Decreto 1377
de 2013 (compilado en el Decreto 1074 de 2015): responsable, finalidades,
derechos, área que atiende las solicitudes, procedimiento y vigencia.

- **Datos sensibles y menores:** la historia clínica y el motivo de consulta
  son datos de salud; la autorización en el consultorio es explícita y por
  escrito. Para menores autoriza el representante legal.
- **Encargados y transmisión internacional:** Meta (WhatsApp) recibe el
  celular y el texto del aviso; el proveedor de alojamiento se completa al
  publicar. Los mensajes no llevan datos de salud.
- **Conservación:** historia clínica mínimo 15 años desde la última atención
  (Resolución 839 de 2017), por lo que no se elimina aunque se pida.
- **Plazos:** consultas 10 días hábiles (+5) y reclamos 15 días hábiles (+8),
  artículos 14 y 15 de la Ley 1581.
- `VERSION_POLITICA_DATOS` pasa a `1.1` en los modelos de citas y pacientes,
  para que cada autorización quede ligada al texto que se aceptó.

Quedan marcados en ámbar los datos que solo puede dar el consultorio: nombre
legal y NIT o cédula del responsable, correo para solicitudes, quién las
atiende, proveedor de alojamiento y fecha de vigencia.
