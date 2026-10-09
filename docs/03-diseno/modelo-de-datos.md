# Modelo de datos — Arte Odontológico

Versión del 9 de octubre de 2026 · MySQL 8.0 · motor InnoDB · codificación `utf8mb4`.\
Fuente de verdad: `backend/database/schema.sql`. Cambios para bases existentes: `backend/database/migraciones/`.

## Diagrama entidad-relación

![Diagrama entidad-relación](diagrama-er.png)

El diagrama se genera desde `diagrama-er.mmd` (Mermaid).

**Cómo leerlo:**
- Una cita pertenece a una hora publicada (franja), y cada franja es de un especialista en la sede.
- La cita guarda los datos que la persona escribió al pedirla. Cuando la secretaria la acepta, queda ligada al paciente del mismo documento (que se crea si no existía).
- Cada paciente tiene su historia clínica. Los pacientes no inician sesión: en `usuarios` solo está la secretaria.

## Tablas

### `usuarios`
Quienes inician sesión: la secretaria (rol `administrador`). El valor `paciente` del rol solo se conserva por compatibilidad con bases anteriores; esas cuentas no pueden ingresar.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `nombre_completo` | VARCHAR(120) | |
| `documento` | VARCHAR(20) UNIQUE | Solo dígitos |
| `correo` | VARCHAR(160) UNIQUE | Usuario de ingreso |
| `telefono` | VARCHAR(20) | Con indicativo (57…) |
| `contrasena_hash` | VARCHAR(255) | bcrypt |
| `rol` | ENUM('paciente','administrador') | Por defecto `administrador` |
| `activo` | BOOLEAN | Cuenta desactivada = no puede ingresar |
| `debe_cambiar_contrasena` | BOOLEAN | TRUE mientras use una clave temporal |

### `pacientes`
Ficha de cada paciente, sin usuario ni contraseña. Se crea sola al aceptar su primera cita pedida por la web (`origen = 'web'`) o la crea la secretaria si llega al consultorio (`origen = 'consultorio'`).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | INT UNSIGNED PK | |
| `nombres`, `apellidos` | VARCHAR(60) | Por separado desde la migración 004 |
| `nombre_completo` | VARCHAR(121) | **Columna generada**: nombres + apellidos. La búsqueda y los listados la siguen usando |
| `tipo_documento` | ENUM('CC','TI','RC','CE','PA','PPT') | Cédula, tarjeta de identidad, registro civil, cédula de extranjería, pasaporte, permiso por protección temporal |
| `documento` | VARCHAR(20) UNIQUE | Así se reconoce al paciente cuando vuelve a pedir cita |
| `telefono` | VARCHAR(20) | Celular (WhatsApp) con indicativo (57…) |
| `telefono_fijo` | VARCHAR(20) NULL | Opcional |
| `correo` | VARCHAR(160) | No es único: una madre puede usar el suyo para sus hijos |
| `origen` | ENUM('web','consultorio') | |
| `motivo_consulta` | VARCHAR(500) NULL | A qué vino, cuando la secretaria lo registra en el consultorio |
| `autorizacion_datos`, `fecha_autorizacion`, `version_politica_datos` | | Prueba de la autorización (Ley 1581 de 2012) |
| `creado_por` | FK → usuarios | Secretaria que lo registró o aceptó su primera cita |

### `servicios` (especialidades)
| Columna | Tipo | Notas |
|---|---|---|
| `id` | PK | |
| `codigo` | VARCHAR(40) UNIQUE | Identificador estable (sirve al frontend para el ícono) |
| `nombre`, `descripcion` | | |
| `activo` | BOOLEAN | Las inactivas no se ofrecen al público |
| `duracion_minutos` | SMALLINT | Heredada; el sistema ya no la usa |

### `especialistas` y `especialista_especialidad`
Odontólogos que atienden. No tienen usuario. La tabla intermedia (llave primaria compuesta) permite que un especialista atienda varias especialidades.

### `sedes`
Una fila activa: Rivera (Carrera 7 No. 3-61). La tabla se conserva por si el consultorio abre otra sede.

### `franjas_horarias`
Cada fila es una hora que la secretaria publicó a mano para un especialista.

| Columna | Notas |
|---|---|
| `especialista_id`, `sede_id` | FK |
| `fecha`, `hora_inicio` | Hora local del consultorio |
| `activa` | FALSE cuando la secretaria la quita (no se borra si alguna cita antigua la referencia) |
| UNIQUE (`especialista_id`, `fecha`, `hora_inicio`) | Un especialista no publica dos veces la misma hora |

Una franja está **libre** si está activa, todavía no pasó y no tiene una cita viva.

### `citas`
| Columna | Notas |
|---|---|
| `paciente_id` | FK → pacientes. NULL mientras la cita pedida por la web está pendiente; se llena al aceptarla |
| `servicio_id`, `franja_id` | Especialidad y hora |
| `franja_anterior_id` | FK → franjas_horarias (NULL). La hora que tenía antes de que el paciente la reprogramara desde su enlace; el panel la muestra en la solicitud como "Cambio de hora" |
| `estado` | `pendiente` (pedida por la web), `confirmada`, `rechazada`, `cancelada`, `atendida`, `no_asistio` |
| `nombres_paciente`, `apellidos_paciente`, `tipo_documento_paciente`, `documento_paciente`, `telefono_paciente`, `correo_paciente` | Datos de quien pide la cita; todos obligatorios (el correo es NULL en citas anteriores al 9 de octubre) |
| `telefono_fijo_paciente` | Opcional |
| `nombre_paciente` | **Columna generada**: nombres + apellidos (la usan la agenda, los mensajes y la vista `v_agenda`) |
| `autorizacion_datos`, `fecha_autorizacion`, `version_politica_datos` | Autorización dada al agendar |
| `codigo_gestion_hash` | SHA-256 del código del enlace "Gestionar mi cita" (UNIQUE) |
| `reprogramaciones` | Las que hizo el paciente (máximo 1) |
| `cancelada_por` | `paciente` o `administrador` |
| `confirmada_en` | Cuándo la aceptó la secretaria (el recordatorio no se envía a citas aceptadas hace muy poco) |
| `franja_ocupada` | **Columna generada**: `franja_id` si la cita no está cancelada ni rechazada, NULL si lo está. Su índice único garantiza que una hora tenga una sola cita viva, aun con peticiones simultáneas. Una cita pendiente ya aparta la hora |

### `notificaciones`
Bitácora de mensajes de WhatsApp: `tipo` (`confirmacion`, `reprogramacion`, `cancelacion`, `rechazo`, `recordatorio`), `estado` (`pendiente`, `enviada`, `fallida`), `destino`, `mensaje` (texto enviado o por enviar) y `detalle` (id del proveedor o error).

### `historia_clinica`
| Columna | Notas |
|---|---|
| `paciente_id` | FK → pacientes |
| `fecha_atencion` | No puede ser futura |
| `servicio_id`, `especialista_id`, `cita_id` | Opcionales |
| `procedimiento`, `notas` | |
| `corrige_a` | FK → historia_clinica: la entrada que esta corrige |
| `creado_por`, `creado_en` | Autor y momento |

No se actualiza ni se borra (Resolución 1995 de 1999). Las llaves foráneas usan `ON DELETE RESTRICT` hacia el paciente y la entrada corregida.

### Vista `v_agenda`
Une citas, especialidad, especialista y sede para consultas de la agenda.

## Decisiones de diseño
- **Datos de quien pide la cita dentro de la cita**: permite pedirla sin cuenta. La ficha en `pacientes` solo se crea cuando la secretaria acepta, así no se llena de registros de solicitudes falsas o rechazadas.
- **Pacientes separados de `usuarios`**: los pacientes no inician sesión, y separar las tablas evita que una ficha se pueda usar para ingresar.
- **Columna generada para la doble reserva**: la regla queda en el motor y no depende de que el código la recuerde.
- **Desactivar en vez de borrar** franjas, especialistas y especialidades: conserva la integridad de las citas antiguas.
- **Normalización:** tercera forma normal. La excepción deliberada son los datos de contacto copiados en la cita, que son la "foto" de lo que la persona escribió al agendar.
