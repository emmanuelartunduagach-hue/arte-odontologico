# Arte Odontológico — Contrato de la API v2

Versión del 9 de octubre de 2026 (flujo de citas por aprobar y pacientes sin login). El alcance funcional está en `docs/02-requerimientos/alcance-v2.md`.

Base: `CONFIG.API` (en local `http://localhost:3000/api`). Todo es JSON.

## Reglas generales

- **Errores:** `{ "error": "mensaje para mostrar", "campos": { "campo": "mensaje" } }`. `campos` solo aparece en errores de formulario: muestra cada mensaje junto a su campo.
- **Códigos:**
  - 400: datos inválidos.
  - 401 en una ruta con sesión: sesión vencida, así que se borra la sesión y se lleva al acceso del consultorio.
  - 403: sin permiso.
  - 404: no existe.
  - 409: conflicto (hora tomada, regla del negocio); se muestra el `error` tal cual.
  - 429: demasiados intentos; se muestra el `error`.
- **Sesión:** `Authorization: Bearer <token>`.
- **Fechas** `AAAA-MM-DD`, **horas** `HH:MM` (24 h), **meses** `AAAA-MM`. Todas en hora de Colombia.
- **Teléfonos:** el usuario escribe `300 123 4567`; el servidor guarda `573001234567`.
- **Texto que viene de la API:** se inserta siempre con `textContent`, nunca con `innerHTML`.

## Flujo de una cita

1. La persona pide la cita en la web y queda **confirmada** de una vez (decisión 27): se crea su ficha de paciente, o se enlaza si ya existía, y le llega el WhatsApp con los datos y el enlace para reprogramar o cancelar.
2. La secretaria **no aprueba** nada: ve las citas nuevas, los cambios de hora y las cancelaciones del paciente en "Novedades de la web" (Inicio). La fila de la agenda solo muestra el nombre; el documento y el teléfono se ven en la ficha, aunque la API los sigue devolviendo (decisión 28).
3. Unas 24 horas antes le llega el recordatorio.

Las citas `pendiente` que quedaron de antes de este cambio se siguen aceptando o rechazando desde el panel.

Quien llega al consultorio sin pasar por la web: la secretaria lo registra (`POST /pacientes`) y le agenda la cita (`POST /admin/citas`), que queda confirmada de una vez. Los pacientes **no tienen usuario ni contraseña**; solo la secretaria inicia sesión.

Estados de una cita: `pendiente`, `confirmada`, `rechazada`, `cancelada`, `atendida`, `no_asistio`.

## 1. Público: pedir una cita sin cuenta

Flujo de pantallas: especialidad → especialista → calendario → hora → datos → cita confirmada.

| Paso | Petición | Respuesta |
|---|---|---|
| Especialidades | `GET /especialidades` | `[{ id, codigo, nombre, descripcion }]` (el ícono se asocia por `codigo`) |
| Especialistas | `GET /especialidades/:id/especialistas` | `[{ id, nombre }]` |
| Calendario del mes | `GET /especialistas/:id/calendario?mes=2026-10` | `{ especialistaId, mes, dias: [{ fecha, horasLibres }] }`. **Resalta solo los días que vienen en `dias`; los demás van bloqueados.** Sin `mes`, usa el mes actual |
| Horas del día | `GET /especialistas/:id/horas?fecha=2026-10-15` | `[{ franjaId, hora: "08:30" }]` |
| Pedir la cita | `POST /citas` | ver abajo |

**`POST /citas`**
```json
{ "especialidadId": 1, "franjaId": 42, "nombres": "Ana María", "apellidos": "Pérez Gómez",
  "tipoDocumento": "CC", "documento": "1075123456", "telefono": "318 715 3718",
  "telefonoFijo": "", "correo": "ana@correo.co", "autorizacionDatos": true, "sitioWeb": "" }
```
- **El formulario de datos va al final**, cuando ya eligió especialidad, especialista, día y hora. Arriba muestra el resumen de lo elegido ("Ortodoncia · Dra. Laura Gómez · jueves 15 de octubre, 8:30 a. m.") con la opción "Cambiar".
- Nombres, apellidos, tipo y número de documento, celular y **correo** son obligatorios; `telefonoFijo` es opcional. Si falta o viene mal escrito → 400 con el mensaje en `campos`.
- `tipoDocumento`: `CC` (cédula de ciudadanía), `TI` (tarjeta de identidad), `RC` (registro civil), `CE` (cédula de extranjería), `PA` (pasaporte) o `PPT` (permiso por protección temporal). El pasaporte acepta letras y números; los demás, solo números (5 a 20). Puntos, espacios y guiones se quitan.
- `nombres` y `apellidos`: 2 a 60 caracteres cada uno, sin números. En las respuestas, `paciente` sigue siendo el nombre completo.
- `autorizacionDatos`: casilla **sin marcar por defecto** con enlace a `politica-datos.html`. Sin ella → 400 con `campos.autorizacionDatos`.
- `sitioWeb`: **campo trampa contra bots**. Inclúyelo en el formulario oculto con CSS (no con `type="hidden"`), con `tabindex="-1"` y `autocomplete="off"`, y envíalo vacío.
- **201:** `{ mensaje, cita: { id, estado: "confirmada", paciente, especialidad, especialista, fecha, hora, sede, direccion, reprogramaciones } }`
  - Muestra "¡Tu cita quedó confirmada!" con el resumen.
  - El servidor crea la ficha del paciente si su documento es nuevo, o enlaza la cita a la ficha existente si coincide el celular o el correo (si no coincide ninguno, no la enlaza: alguien pudo escribir un documento ajeno; la cita igual aparece en esa ficha para revisarla).
  - El enlace para reprogramar o cancelar **no** viene en la respuesta: llega por WhatsApp al teléfono escrito, para que únicamente lo tenga el dueño de ese número.
- **409** posibles:
  - La hora se tomó o ya no está → volver a pedir las horas del día.
  - Esa persona (por documento) ya tiene una cita pendiente o confirmada (límite `LIMITE_CITAS_ACTIVAS_POR_DOCUMENTO`, por defecto 1). El mensaje distingue los dos casos: si la que tiene está **pendiente**, explica que se le avisará por WhatsApp cuando la confirmen (todavía no tiene enlace); si está **confirmada**, que la cancele desde el enlace del WhatsApp.

## 2. Público: "Gestionar mi cita" (`gestionar-cita.html?codigo=…`)

La página lee `codigo` de la URL.

| Acción | Petición | Respuesta |
|---|---|---|
| Ver | `GET /citas/gestion/:codigo` | `{ cita, puedeReprogramar, puedeCancelar, motivo }` |
| Reprogramar | `POST /citas/gestion/:codigo/reprogramar` `{ franjaId }` | `{ mensaje, cita, puedeReprogramar, puedeCancelar, motivo }` |
| Cancelar | `POST /citas/gestion/:codigo/cancelar` | `{ mensaje }` |

- **Botones:** muéstralos según `puedeReprogramar` y `puedeCancelar`. Si alguno es `false`, muestra `motivo`: menos de 24 horas, ya reprogramó una vez, cambio pendiente de confirmación, cita cancelada, rechazada o ya pasó.
- **Reprogramar** usa el mismo calendario y las mismas horas de `cita.especialistaId`; solo se permite **una vez**. El cambio queda **confirmado de una vez** y llega el WhatsApp de reprogramación con **el mismo enlace**, que sigue sirviendo.
- **Después de reprogramar una vez** solo queda "Cancelar y pedir una cita nueva": cancela y lleva al flujo de agendar.
- **Confirmación:** pide confirmar antes de cancelar con un diálogo propio de la página, no con `confirm()`.
- **404:** "El enlace no es válido o ya no está vigente". Ocurre cuando llega un mensaje con un enlace nuevo (la secretaria reprogramó la cita).

## 3. Sesión (solo la secretaria)

Los pacientes no tienen cuenta. El acceso está en el pie de la página principal ("Acceso del consultorio") y lleva a `panel-secretaria.html`. La sesión se guarda en `sessionStorage` (`frontend/js/sesion.js`) y `api()` envía el token sola.

| Petición | Notas |
|---|---|
| `POST /auth/ingreso` `{ correo, contrasena }` | `{ token, usuario: { id, nombre, rol, debeCambiarContrasena } }`. Si `debeCambiarContrasena`, lleva a cambiar la clave antes de todo. Correo o clave incorrectos → **401**; más de 10 intentos en 15 minutos desde la misma IP → **429** |
| `POST /auth/cambiar-contrasena` `{ contrasenaActual, contrasenaNueva }` | Clave actual incorrecta → **400** (no 401) |
| `GET /auth/perfil` | `{ id, nombreCompleto, documento, correo, telefono, rol }` |

## 4. Panel de la secretaria (todo exige rol administrador)

**Especialidades**
- `GET /admin/especialidades` → `[{ id, codigo, nombre, descripcion, activo, especialistasActivos }]`
- `POST /admin/especialidades` `{ nombre, descripcion? }` → 201
- `PATCH /admin/especialidades/:id` `{ nombre?, descripcion?, activo? }`

**Especialistas**
- `GET /admin/especialistas` → `[{ id, nombre, activo, especialidades: [{ id, nombre }] }]`
- `POST /admin/especialistas` `{ nombre, especialidadIds: [1, 3] }` (al menos una) → 201
- `PATCH /admin/especialistas/:id` `{ nombre?, activo?, especialidadIds? }`

**Disponibilidad**
- **Ver:** `GET /admin/especialistas/:id/franjas?desde=&hasta=` (por defecto hoy + 30 días) → `[{ id, fecha, hora, cita: null | { id, paciente, estado } }]`. Pinta cada hora libre u ocupada con el nombre del paciente.
- **Publicar:** `POST /admin/especialistas/:id/franjas` `{ fechas: ["2026-10-15", "2026-10-16"], horas: ["08:00", "08:30"] }` → 201 `{ total }`. Publica cada hora en cada fecha; varias fechas sirven de "copiar a varios días". Sugerencia de UI: cuadrícula de 7:00 a 18:00 cada 30 minutos con casillas.
- **Quitar:** `DELETE /admin/franjas/:id`. Si la hora tiene cita → **409** con el nombre del paciente; hay que reprogramar o cancelar primero.

**Novedades de la web y agenda**
- **Novedades de la web:** `GET /admin/citas/novedades?horas=48` → citas con origen web de las últimas horas (1 a 720; por defecto 48): las pedidas en ese lapso y las que el paciente reprogramó o canceló desde su enlace. Cada una trae `novedad`: `nueva` | `cambio` | `cancelada`, más `creadoEn`, `actualizadoEn`, `fechaAnterior` y `horaAnterior`. Las pendientes antiguas no se incluyen.
- **Citas antiguas sin confirmar:** `GET /admin/citas?estado=pendiente&desde=&hasta=` (solo existen si se pidieron antes de la decisión 27).
- **Aceptar** (solo citas pendientes antiguas): `POST /admin/citas/:id/aceptar` → `{ mensaje, cita, pacienteId, pacienteNuevo, notificacion }`. Enlaza la cita con el paciente del mismo documento o crea su ficha (`pacienteNuevo: true`) y envía el WhatsApp de confirmación con el enlace. Si la hora ya pasó → **409**.
- **Rechazar** (solo citas pendientes antiguas): `POST /admin/citas/:id/rechazar` → `{ mensaje, notificacion }`. Libera la hora y envía un WhatsApp invitando a pedir otra.
- **Agendar a un paciente** (llegó al consultorio o llamó): `POST /admin/citas` `{ pacienteId, especialidadId, franjaId }` → 201 `{ mensaje, cita, notificacion }`. Queda confirmada de una vez.
- **Ver:** `GET /admin/citas?fecha=` o `?desde=&hasta=`, más `&especialistaId=&estado=&q=` (`q` busca por nombre, documento o teléfono) → citas con `especialidadId`, `tipoDocumento`, `documento`, `telefono`, `telefonoFijo`, `correo`, `pacienteId`, `origen` (`web` | `consultorio`), `canceladaPor`, `creadoEn`, `fechaAnterior` y `horaAnterior`. Las dos últimas traen la hora que tenía la cita antes de que **el paciente** la reprogramara (o `null`): el panel muestra "Cambio de hora · antes: …" en las solicitudes pendientes, para que la secretaria sepa qué cambio está aprobando.
- **Cambiar estado:** `PATCH /admin/citas/:id/estado` `{ estado: "atendida" | "no_asistio" | "cancelada" }`. Solo para citas confirmadas (una pendiente se acepta o se rechaza). Atendida o no asistió solo se permite cuando ya llegó la hora.
- **Reprogramar:** `POST /admin/citas/:id/reprogramar` `{ franjaId }`. Para citas pendientes o confirmadas; no tiene límite y puede pasar la cita a otro especialista de la misma especialidad. Respuesta: `{ mensaje, cita, notificacion }`; `notificacion` es `null` si la cita estaba pendiente (el paciente se entera al aceptarla).
- **Cancelar** (`PATCH …/estado` con `cancelada`) responde `{ mensaje, notificacion }`. `notificacion` es `{ id, estado, enlaceWhatsApp }`: si `estado` es `pendiente`, el panel ofrece "Enviar por WhatsApp" y "Marcar como enviado" ahí mismo.

**Mensajes de WhatsApp**

> Desde el 9 de octubre los mensajes se envían solos (`WHATSAPP_MODO=api`) y el panel no tiene sección de Mensajes. Inicio consulta `?estado=fallida` y `?estado=pendiente` y, solo si hay alguno, muestra "WhatsApp sin enviar" con las acciones de abajo. Las rutas siguen igual.
- `GET /admin/notificaciones?estado=pendiente` (o `fallida`, `enviada`) → `[{ id, citaId, paciente, tipo, destino, mensaje, enlaceWhatsApp, creadoEn }]`
- Botón **"Enviar por WhatsApp"**: abre `enlaceWhatsApp` en pestaña nueva. Abre la app o WhatsApp Web de la clínica con el texto listo.
- Luego, botón **"Marcar como enviado"**: `PATCH /admin/notificaciones/:id` `{ estado: "enviada" }`.
- **Tipos de mensaje:** `confirmacion`, `reprogramacion`, `cancelacion`, `rechazo` y `recordatorio`.
- **Recordatorio 24 horas antes:** el servidor revisa cada 30 minutos, dentro del horario configurado, las citas confirmadas que empiezan en las próximas 24 horas; aparecen como mensajes de tipo `recordatorio` (sin enlace). Para generarlos ya: `POST /admin/recordatorios` → `{ fecha, revisadas, resultados: [{ citaId, estado }] }`.

**Pacientes** (registro sin usuario ni contraseña)
- `POST /pacientes` `{ nombres, apellidos, tipoDocumento, documento, telefono, telefonoFijo?, correo, motivoConsulta?, autorizacionDatos: true }` → 201 `{ mensaje, paciente, citasVinculadas }`. Mismas reglas de los datos que en `POST /citas`; `motivoConsulta` (a qué vino, hasta 500 caracteres) es opcional. Para quien llega al consultorio. `citasVinculadas`: citas que pidió antes por la web con el mismo documento y celular. Documento repetido → **409** con `pacienteId` del existente, para ofrecer "Abrir su ficha".
- `GET /pacientes?q=` → `[{ id, nombres, apellidos, nombreCompleto, tipoDocumento, documento, telefono, telefonoFijo, correo, origen: "web" | "consultorio", motivoConsulta, fechaAutorizacion, creadoEn }]`; busca por nombre, documento, celular o correo. `nombreCompleto` lo calcula la base (nombres + apellidos).

**Ficha del paciente e historia clínica**
- `GET /pacientes/:id` → `{ paciente, citas: [{ id, estado, especialidadId, especialidad, especialistaId, especialista, fecha, hora }], historia: [...] }` — la pantalla de ficha en una sola petición. `citas` incluye las que pidió por la web con su documento y aún están pendientes.
- `GET /pacientes/:id/historia` → entradas, la atención más reciente primero: `[{ id, fechaAtencion, especialidad, especialista, citaId, procedimiento, notas, corrigeA, correcciones: [ids], autor, creadoEn }]`.
- `POST /pacientes/:id/historia` `{ fechaAtencion, procedimiento, notas?, especialidadId?, especialistaId?, citaId? }` → 201. Con `citaId` (de ese paciente) se pueden omitir fecha, especialidad y especialista. Fecha futura → 400.
- `POST /admin/historia/:id/correccion` `{ notas, procedimiento?, fechaAtencion? }` → 201: crea una entrada nueva que corrige a la indicada; `notas` (qué se corrige y por qué) es obligatorio.
- **No hay editar ni borrar**: la historia clínica no se modifica (Resolución 1995 de 1999). En pantalla, una entrada con `correcciones` se muestra tachada o marcada "Corregida" con enlace a su corrección; la corrección muestra "Corrige la entrada del <fecha>". Sugerencia: botón "Agregar a la historia" junto a cada cita marcada como atendida, con `citaId` ya puesto.

## Aún no existe

- Importación desde Excel.
