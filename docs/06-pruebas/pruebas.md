# Pruebas — Arte Odontológico

Versión del 7 de octubre de 2026.

## 1. Estrategia

| Tipo | Qué cubre | Cómo se ejecuta | Estado |
|---|---|---|---|
| Integración automatizada | API completa contra MySQL 8 real, sobre una base creada desde `schema.sql` | Script `integracion.js` (Node) que levanta la API, llama cada endpoint y revisa la base | 117 de 117 correctas |
| Equivalencia de migraciones | Que crear la base desde cero y actualizar una base antigua con las migraciones 001 y 002 den el mismo esquema | Comparación de `SHOW CREATE TABLE` en ambos caminos | Idénticos |
| Unitarias puntuales | Límite de peticiones por IP, textos de WhatsApp, modos del proveedor | Scripts de Node | Correctas |
| Manuales guiadas | Lo mismo, en el equipo de desarrollo y con la base local | Guías en PowerShell de esta carpeta | Pendientes de ejecutar |
| Revisión de código independiente | Seguridad, condiciones de carrera, zona horaria, validaciones | Revisión por un agente distinto del que escribió el código | 3 hallazgos, corregidos |
| Interfaz (frontend) de punta a punta | Agendar y gestionar la cita (reprogramar, cancelar, enlace inválido) en el navegador, contra la API real | Navegador automatizado (Playwright) | Correctas el 6 y 7 de octubre |
| Interfaz en celular y panel de la secretaria | Flujos en 360, 768 y 1280 px | Por definir | Pendiente |

**Entorno de las pruebas automatizadas:** Linux, Node.js 22, MySQL 8.0.46. La base se borra y se recrea en cada corrida.

## 2. Hallazgos de la revisión de código (corregidos)

| Severidad | Hallazgo | Corrección |
|---|---|---|
| Media | Sin iniciar sesión, cualquiera podía agendar con el documento de un paciente registrado; se saltaba el límite de citas y las citas aparecían en la cuenta de esa persona | La cita solo queda a nombre de un usuario si agenda con su sesión; sin sesión aplica el límite. Al crear un usuario se vinculan solo las citas con su mismo documento **y** teléfono |
| Media | El texto de los mensajes guardaba el código del enlace de gestión en claro | Al marcar el mensaje como enviado, el código se borra del texto guardado |
| Baja | Una fecha inválida en los filtros de la agenda producía error 500 | Se valida antes de calcular el rango; responde 400 |

## 3. Resultados de la prueba de integración

Corrida del 7 de octubre de 2026: **117 de 117 comprobaciones correctas.**

**Preparación**

| # | Comprobación | Resultado |
|---|---|---|
| 1 | secretaria ingresa | Correcta |

**Especialidades**

| # | Comprobación | Resultado |
|---|---|---|
| 2 | admin lista 9 especialidades | Correcta |
| 3 | crea especialidad con código sin tildes | Correcta |
| 4 | código repetido -> sufijo -2 | Correcta |
| 5 | desactiva especialidad | Correcta |
| 6 | nombre muy corto -> 400 | Correcta |
| 7 | públicas: 10 activas, sin la desactivada | Correcta |
| 8 | /servicios sigue respondiendo (alias) | Correcta |

**Especialistas**

| # | Comprobación | Resultado |
|---|---|---|
| 9 | crea especialista con 2 especialidades | Correcta |
| 10 | crea segundo especialista | Correcta |
| 11 | especialista sin especialidades -> 400 | Correcta |
| 12 | especialidad inexistente -> 400 | Correcta |
| 13 | general tiene 2 especialistas | Correcta |
| 14 | ortodoncia tiene 1 especialista | Correcta |
| 15 | especialidad desactivada -> 404 | Correcta |

**Disponibilidad**

| # | Comprobación | Resultado |
|---|---|---|
| 16 | publica 2 días x 3 horas | Correcta |
| 17 | fecha pasada -> 400 | Correcta |
| 18 | hora mal escrita -> 400 | Correcta |
| 19 | publica hora cercana (<24h) | Correcta |
| 20 | publica horas de Carlos | Correcta |
| 21 | publicar una hora repetida no la duplica | Correcta |
| 22 | calendario marca el día con 3 horas libres | Correcta |
| 23 | calendario mes inválido -> 400 | Correcta |
| 24 | horas libres del día | Correcta |

**Agendar sin cuenta**

| # | Comprobación | Resultado |
|---|---|---|
| 25 | agenda sin cuenta -> 201 confirmada | Correcta |
| 26 | guarda documento y teléfono normalizados (+57) | Correcta |
| 27 | sin correo se guarda vacío (es opcional) | Correcta |
| 28 | correo mal escrito -> 400 | Correcta |
| 29 | guarda autorización con versión | Correcta |
| 30 | guarda solo el hash del código | Correcta |
| 31 | la hora tomada desaparece | Correcta |
| 32 | sin usuario: solo 1 cita activa -> 409 | Correcta |
| 33 | hora ocupada -> 409 | Correcta |
| 34 | dos personas a la vez por la misma hora: una gana, otra 409 | Correcta |
| 35 | sin autorización -> 400 | Correcta |
| 36 | campo trampa lleno -> 400 | Correcta |
| 37 | especialista no atiende la especialidad -> 400 | Correcta |
| 38 | datos malos -> 400 con un mensaje por campo | Correcta |

**Gestionar mi cita**

| # | Comprobación | Resultado |
|---|---|---|
| 39 | enlace muestra la cita y permite todo | Correcta |
| 40 | enlace inválido -> 404 | Correcta |
| 41 | no muestra documento ni teléfono | Correcta |
| 42 | reprogramar a otro especialista -> 400 | Correcta |
| 43 | reprograma 1 vez -> 200, ya no puede otra | Correcta |
| 44 | la hora anterior queda libre | Correcta |
| 45 | segunda reprogramación -> 409 con el motivo | Correcta |

**Mensajes (modo manual)**

| # | Comprobación | Resultado |
|---|---|---|
| 46 | mensajes pendientes: confirmación y reprogramación | Correcta |
| 47 | mensaje con nombre, sin datos clínicos, y enlace wa.me | Correcta |
| 48 | el mensaje trae el enlace de gestión | Correcta |
| 49 | marca mensaje como enviado | Correcta |
| 50 | aparece en enviados | Correcta |
| 51 | cancela desde el enlace | Correcta |
| 52 | la hora vuelve a estar libre | Correcta |
| 53 | cita cancelada: no se puede nada | Correcta |
| 54 | cancelar de nuevo -> 409 | Correcta |
| 55 | cancelada no se borra | Correcta |

**Menos de 24 h**

| # | Comprobación | Resultado |
|---|---|---|
| 56 | agenda una hora cercana | Correcta |
| 57 | a menos de 24 h no puede reprogramar ni cancelar | Correcta |
| 58 | cancelar a menos de 24 h -> 409 | Correcta |

**Secretaria: agenda y reprogramar**

| # | Comprobación | Resultado |
|---|---|---|
| 59 | agenda lista las citas con documento y teléfono | Correcta |
| 60 | agenda muestra el correo opcional normalizado | Correcta |
| 61 | agenda filtra por búsqueda | Correcta |
| 62 | agenda filtra por estado | Correcta |
| 63 | secretaria reprograma a otro especialista de la misma especialidad | Correcta |
| 64 | reprogramación de la secretaria no cuenta al paciente | Correcta |
| 65 | el enlace anterior deja de servir (se envió uno nuevo) | Correcta |
| 66 | el enlace nuevo del mensaje funciona | Correcta |

**Quitar horas**

| # | Comprobación | Resultado |
|---|---|---|
| 67 | no deja quitar una hora con cita -> 409 | Correcta |
| 68 | quita una hora libre | Correcta |
| 69 | la hora quitada ya no se ofrece | Correcta |
| 70 | vista de la secretaria muestra quién ocupa cada hora | Correcta |
| 71 | volver a publicarla la reactiva | Correcta |

**Asistencia**

| # | Comprobación | Resultado |
|---|---|---|
| 72 | no se marca asistencia antes de la hora -> 409 | Correcta |
| 73 | marca no asistió | Correcta |
| 74 | no se marca dos veces -> 409 | Correcta |
| 75 | secretaria cancela -> aviso de cancelación | Correcta |

**Usuario del paciente**

| # | Comprobación | Resultado |
|---|---|---|
| 76 | secretaria crea usuario y se vinculan sus citas anteriores | Correcta |
| 77 | paciente ingresa (debe cambiar clave) | Correcta |
| 78 | mis-citas trae la cita que pidió sin cuenta | Correcta |
| 79 | perfil para precargar el formulario | Correcta |
| 80 | con usuario puede tener varias citas y quedan a su nombre | Correcta |
| 81 | sin sesión, con el documento de un paciente registrado: aplica el límite | Correcta |
| 82 | sin sesión la cita no queda a nombre de nadie | Correcta |
| 83 | desde inválido -> 400 (no 500) | Correcta |
| 84 | al marcar enviado se borra el código del texto guardado | Correcta |
| 85 | cambio de clave en MySQL real | Correcta |
| 86 | búsqueda de pacientes en MySQL real | Correcta |

**Historia clínica**

| # | Comprobación | Resultado |
|---|---|---|
| 87 | agrega entrada a la historia | Correcta |
| 88 | fecha futura -> 400 | Correcta |
| 89 | cita de otro paciente -> 400 | Correcta |
| 90 | procedimiento vacío -> 400 | Correcta |
| 91 | corrección sin explicar -> 400 | Correcta |
| 92 | corrección crea entrada nueva que apunta a la original | Correcta |
| 93 | la original sigue intacta y lista su corrección | Correcta |
| 94 | ficha: datos, citas e historia | Correcta |
| 95 | paciente no ve historias por la API de la secretaria -> 403 | Correcta |
| 96 | id que no es paciente -> 404 | Correcta |
| 97 | no existe ruta para borrar historia -> 404 | Correcta |

**Recordatorio del día anterior**

| # | Comprobación | Resultado |
|---|---|---|
| 98 | citas de mañana creadas | Correcta |
| 99 | recordatorio solo para la cita de mañana agendada hace >12 h y no cancelada | Correcta |
| 100 | mensaje de recordatorio sin enlace y pendiente (modo manual) | Correcta |
| 101 | el enlace de la confirmación sigue sirviendo | Correcta |
| 102 | ejecutarlo de nuevo no repite recordatorios | Correcta |
| 103 | si se reprograma, vuelve a recordarse | Correcta |
| 104 | paciente no puede lanzar recordatorios -> 403 | Correcta |

**Olvidé mi contraseña**

| # | Comprobación | Resultado |
|---|---|---|
| 105 | secretaria genera clave temporal nueva | Correcta |
| 106 | la clave anterior ya no sirve | Correcta |
| 107 | ingresa con la temporal y debe cambiarla | Correcta |
| 108 | restablecer a quien no es paciente -> 404 | Correcta |
| 109 | un paciente no puede restablecer claves -> 403 | Correcta |

**Permisos**

| # | Comprobación | Resultado |
|---|---|---|
| 110 | paciente no entra al panel -> 403 | Correcta |
| 111 | sin sesión -> 401 | Correcta |
| 112 | secretaria no usa mis-citas -> 403 | Correcta |

**Desactivar especialista**

| # | Comprobación | Resultado |
|---|---|---|
| 113 | desactiva especialista | Correcta |
| 114 | especialista inactivo: calendario 404 | Correcta |
| 115 | y ya no aparece en su especialidad | Correcta |
| 116 | cambia especialidades de un especialista | Correcta |

**Textos**

| # | Comprobación | Resultado |
|---|---|---|
| 117 | la vista v_agenda funciona | Correcta |


### Pruebas del 9 de octubre: migración 004, formularios, cambio de hora y modo oscuro

Hechas contra la API real con MySQL 8.0.46 (base nueva con `schema.sql` y base migrada de la 003 a la 004) y en el navegador (Chromium) a 1366, 1000 y 390 px, en modo claro, oscuro y de demostración.

| # | Comprobación | Resultado |
|---|---|---|
| 118 | la migración 004 corre sin errores y parte bien los nombres existentes (4, 2, 3 y 1 palabra) | Correcta |
| 119 | la estructura migrada es igual a la de una base nueva (salvo el orden de un índice) | Correcta |
| 120 | pedir cita con nombres, apellidos, tipo de documento y teléfono fijo guarda todo; el nombre completo se calcula | Correcta |
| 121 | aceptar crea la ficha con los datos nuevos | Correcta |
| 122 | registrar en el consultorio con motivo de consulta; la ficha lo muestra | Correcta |
| 123 | límite por documento: mensaje distinto si la cita está pendiente o confirmada | Correcta |
| 124 | el paciente reprograma: la solicitud muestra "Cambio de hora" con la hora anterior | Correcta |
| 125 | el enlace viejo muestra la ayuda de usar el último WhatsApp | Correcta |
| 126 | la ventana de rechazar no repite el punto ("a. m.") | Correcta |
| 127 | Aceptar, Rechazar y Más caben en la fila a 390, 1000 y 1366 px | Correcta |
| 128 | modo oscuro: se activa, se recuerda al recargar y vuelve a claro | Correcta |
| 129 | ninguna pantalla tiene barra horizontal a 390 px | Correcta |
| 130 | el límite de 10 ingresos por IP responde 429 | Correcta |
| 131 | el menú del panel ya no tiene Mensajes (4 secciones) e Inicio muestra 2 datos | Correcta |
| 132 | un WhatsApp fallido aparece en Inicio como "WhatsApp sin enviar"; "Ya lo envié" lo quita | Correcta |
| 133 | modo demostración: al aceptar, "Se avisó al paciente por WhatsApp" | Correcta |

## 4. Guías de prueba manual

- `pruebas-alta-pacientes.txt`: pedir cita, aceptar y rechazar, cambio de hora, registro en el consultorio con motivo de consulta, ficha y modo oscuro.
- `pruebas-agenda-citas.txt`: especialistas, disponibilidad, calendario, agendar sin cuenta, gestionar la cita, panel de la secretaria.

## 5. Pendiente
- Ejecutar las guías manuales en el equipo de desarrollo y registrar el resultado aquí (fecha, quién, resultado).
- Pruebas del frontend en computador y celular (360, 768 y 1280 px).
- Prueba en el servidor publicado.
