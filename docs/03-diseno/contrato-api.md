# Arte Odontológico — Contrato de la API v2

Versión del 6 de octubre de 2026. Describe la API en `main` más la rama `feature/B-20-historia-clinica`. El alcance funcional está en `docs/02-requerimientos/alcance-v2.md`.

Base: `CONFIG.API` (en local `http://localhost:3000/api`). Todo es JSON.

## Reglas generales

- **Errores:** `{ "error": "mensaje para mostrar", "campos": { "campo": "mensaje" } }`. `campos` solo aparece en errores de formulario: muestra cada mensaje junto a su campo.
- **Códigos:**
  - 400: datos inválidos.
  - 401 en una ruta con sesión: sesión vencida, así que se borra la sesión y se lleva a Ingresar.
  - 403: sin permiso.
  - 404: no existe.
  - 409: conflicto (hora tomada, regla del negocio); se muestra el `error` tal cual.
  - 429: demasiados intentos; se muestra el `error`.
- **Sesión:** `Authorization: Bearer <token>`.
- **Fechas** `AAAA-MM-DD`, **horas** `HH:MM` (24 h), **meses** `AAAA-MM`. Todas en hora de Colombia.
- **Teléfonos:** el usuario escribe `300 123 4567`; el servidor guarda `573001234567`.
- **Texto que viene de la API:** se inserta siempre con `textContent`, nunca con `innerHTML`.

## 1. Público: agendar sin cuenta

Flujo de pantallas: especialidad → especialista → calendario → hora → datos → confirmación.

| Paso | Petición | Respuesta |
|---|---|---|
| Especialidades | `GET /especialidades` | `[{ id, codigo, nombre, descripcion }]` (el ícono se asocia por `codigo`) |
| Especialistas | `GET /especialidades/:id/especialistas` | `[{ id, nombre }]` |
| Calendario del mes | `GET /especialistas/:id/calendario?mes=2026-10` | `{ especialistaId, mes, dias: [{ fecha, horasLibres }] }`. **Resalta solo los días que vienen en `dias`; los demás van bloqueados.** Sin `mes`, usa el mes actual |
| Horas del día | `GET /especialistas/:id/horas?fecha=2026-10-15` | `[{ franjaId, hora: "08:30" }]` |
| Agendar | `POST /citas` | ver abajo |

**`POST /citas`**
```json
{ "especialidadId": 1, "franjaId": 42, "nombreCompleto": "Ana Pérez",
  "documento": "1075123456", "telefono": "318 715 3718",
  "correo": "", "autorizacionDatos": true, "sitioWeb": "" }
```
- **El formulario de datos va al final**, cuando ya eligió especialidad, especialista, día y hora. Arriba muestra el resumen de lo elegido ("Ortodoncia · Dra. Laura Gómez · jueves 15 de octubre, 8:30 a. m.") con la opción "Cambiar".
- `correo` es **opcional**: puede ir vacío. Si viene mal escrito → 400 con `campos.correo`. Nombre, documento y teléfono son obligatorios.
- `autorizacionDatos`: casilla **sin marcar por defecto** con enlace a `politica-datos.html`. Sin ella → 400 con `campos.autorizacionDatos`.
- `sitioWeb`: **campo trampa contra bots**. Inclúyelo en el formulario oculto con CSS (no con `type="hidden"`), con `tabindex="-1"` y `autocomplete="off"`, y envíalo vacío.
- Si el paciente **tiene sesión**, envía también su token: la cita queda a su nombre y no aplica el límite. Para precargar el formulario usa `GET /auth/perfil`.
- **201:** `{ mensaje, cita: { id, estado, paciente, especialidad, especialista, fecha, hora, sede, direccion, reprogramaciones }, enlaceGestion, whatsapp: "enviado" | "pendiente" }`
  - Muestra el resumen y el **`enlaceGestion`** con un botón "Copiar enlace" y el texto "Guárdalo: con él puedes reprogramar o cancelar".
  - Si `whatsapp` es `"pendiente"`: "Te enviaremos la confirmación por WhatsApp".
- **409** posibles:
  - La hora se tomó o ya no está → volver a pedir las horas del día.
  - Esa persona ya tiene una cita activa (límite de 1 sin usuario).

## 2. Público: "Gestionar mi cita" (`gestionar-cita.html?codigo=…`)

La página lee `codigo` de la URL.

| Acción | Petición | Respuesta |
|---|---|---|
| Ver | `GET /citas/gestion/:codigo` | `{ cita, puedeReprogramar, puedeCancelar, motivo }` |
| Reprogramar | `POST /citas/gestion/:codigo/reprogramar` `{ franjaId }` | `{ mensaje, cita, puedeReprogramar, puedeCancelar, motivo, whatsapp }` |
| Cancelar | `POST /citas/gestion/:codigo/cancelar` | `{ mensaje }` |

- **Botones:** muéstralos según `puedeReprogramar` y `puedeCancelar`. Si alguno es `false`, muestra `motivo`: menos de 24 horas, ya reprogramó una vez, cita cancelada o ya pasó.
- **Reprogramar** usa el mismo calendario y las mismas horas de `cita.especialistaId`; solo se permite **una vez**.
- **Después de reprogramar una vez** solo queda "Cancelar y pedir una cita nueva": cancela y lleva al flujo de agendar.
- **Confirmación:** pide confirmar antes de cancelar con un diálogo propio de la página, no con `confirm()`.
- **404:** "El enlace no es válido o ya no está vigente". Ocurre si la secretaria reprogramó la cita, porque se envía un enlace nuevo.

## 3. Sesión (secretaria y pacientes con usuario)

Un solo formulario de **Ingresar** para los dos; el rol decide a qué panel va.

| Petición | Notas |
|---|---|
| `POST /auth/ingreso` `{ correo, contrasena }` | `{ token, usuario: { id, nombre, rol, debeCambiarContrasena } }`. Si `debeCambiarContrasena`, lleva a cambiar la clave antes de todo |
| `POST /auth/cambiar-contrasena` `{ contrasenaActual, contrasenaNueva }` | Clave actual incorrecta → **400** (no 401) |
| `GET /auth/perfil` | `{ id, nombreCompleto, documento, correo, telefono, rol }` |
| `GET /mis-citas` (paciente) | Lista de citas con el formato de `cita` de arriba, la más reciente primero |

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

**Agenda**
- **Ver:** `GET /admin/citas?fecha=` o `?desde=&hasta=`, más `&especialistaId=&estado=&q=` (`q` busca por nombre, documento o teléfono) → citas con `documento`, `telefono`, `correo`, `pacienteId`, `canceladaPor`, `creadoEn`.
- **Cambiar estado:** `PATCH /admin/citas/:id/estado` `{ estado: "atendida" | "no_asistio" | "cancelada" }`. Atendida o no asistió solo se permite cuando ya llegó la hora.
- **Reprogramar:** `POST /admin/citas/:id/reprogramar` `{ franjaId }`. No tiene límite y puede pasar la cita a otro especialista de la misma especialidad.

**Mensajes de WhatsApp (modo manual)**
- `GET /admin/notificaciones?estado=pendiente` (o `fallida`, `enviada`) → `[{ id, citaId, paciente, tipo, destino, mensaje, enlaceWhatsApp, creadoEn }]`
- Botón **"Enviar por WhatsApp"**: abre `enlaceWhatsApp` en pestaña nueva. Abre la app o WhatsApp Web de la clínica con el texto listo.
- Luego, botón **"Marcar como enviado"**: `PATCH /admin/notificaciones/:id` `{ estado: "enviada" }`.
- Conviene un contador de pendientes visible en el menú del panel.

**Pacientes**
- `POST /pacientes` `{ nombreCompleto, documento, correo, telefono, autorizacionDatos: true }` → 201. La respuesta trae la `contrasenaTemporal`, que se muestra **una sola vez** con botón de copiar, y `citasVinculadas`, que son las citas que pidió antes sin cuenta.
- `GET /pacientes?q=` → búsqueda por nombre, documento o correo.

**Ficha del paciente e historia clínica**
- `GET /pacientes/:id` → `{ paciente: { id, nombreCompleto, documento, correo, telefono, activo, ... }, citas: [...], historia: [...] }` — la pantalla de ficha en una sola petición.
- `GET /pacientes/:id/historia` → entradas, la atención más reciente primero: `[{ id, fechaAtencion, especialidad, especialista, citaId, procedimiento, notas, corrigeA, correcciones: [ids], autor, creadoEn }]`.
- `POST /pacientes/:id/historia` `{ fechaAtencion, procedimiento, notas?, especialidadId?, especialistaId?, citaId? }` → 201. Con `citaId` (de ese paciente) se pueden omitir fecha, especialidad y especialista. Fecha futura → 400.
- `POST /admin/historia/:id/correccion` `{ notas, procedimiento?, fechaAtencion? }` → 201: crea una entrada nueva que corrige a la indicada; `notas` (qué se corrige y por qué) es obligatorio.
- **No hay editar ni borrar**: la historia clínica no se modifica (Resolución 1995 de 1999). En pantalla, una entrada con `correcciones` se muestra tachada o marcada "Corregida" con enlace a su corrección; la corrección muestra "Corrige la entrada del <fecha>". Sugerencia: botón "Agregar a la historia" junto a cada cita marcada como atendida, con `citaId` ya puesto.

## Aún no existe

- Recordatorio del día anterior.
- Importación desde Excel.
- Reprogramar o cancelar desde "Mis citas" con sesión. Por ahora el paciente usa el enlace del WhatsApp.
