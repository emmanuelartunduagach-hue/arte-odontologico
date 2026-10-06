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

---

## Actualización del 6 de octubre de 2026 (alcance v2)

Tras la reunión con el docente asesor del 5 de octubre cambió el alcance (ver
`docs/02-requerimientos/alcance-v2.md`). Las decisiones 3, 6 y 7 quedan
reemplazadas por las siguientes; se conservan arriba como registro histórico.

## 8. Agendar sin cuenta; las cuentas las crea la secretaria

Antes el paciente se registraba solo. Ahora cualquier persona agenda con nombre,
documento y teléfono (correo opcional), y la secretaria crea el usuario cuando
el paciente ya asistió. Así no se llena la base de cuentas de personas que nunca
van al consultorio.

Los datos de quien agenda se guardan en la propia cita (`nombre_paciente`,
`documento_paciente`, `telefono_paciente`, `correo_paciente`) y no en
`usuarios`. Al crear la cuenta se vinculan las citas anteriores con el mismo
documento **y** teléfono. Una cita solo queda a nombre de un usuario si agenda
con su sesión iniciada: escribir el documento de otra persona no basta.

## 9. Una sola sede (reemplaza la decisión 7)

El consultorio atiende solo en Rivera. Se conserva la tabla `sedes` con una
fila activa; Neiva queda desactivada en las bases migradas. Si se abre otra
sede no hay que rehacer el modelo.

## 10. Disponibilidad por especialista, publicada a mano

Se agregaron `especialistas` y `especialista_especialidad` (un especialista
puede atender varias especialidades). Las franjas pasan a ser de un
especialista, únicas por `(especialista_id, fecha, hora_inicio)`. La secretaria
las publica a mano porque dependen de la disponibilidad real de cada
especialista; el sistema no genera horarios. No se maneja duración de citas.

Quitar una hora la desactiva (`activa = FALSE`) en vez de borrarla, porque
citas antiguas pueden referenciarla. No se puede quitar una hora con cita viva.

## 11. Doble reserva con columna generada (reemplaza la decisión 6)

Con citas canceladas que no se borran, `UNIQUE (franja_id)` impediría volver a
ofrecer una hora cancelada. Se reemplazó por la columna generada
`franja_ocupada = IF(estado = 'cancelada', NULL, franja_id)` con índice único:
dos citas vivas no pueden ocupar la misma hora (el motor rechaza la segunda,
aun con peticiones simultáneas) y una cancelada libera la hora sola. La prueba
de integración envía dos reservas simultáneas por la misma hora y verifica que
solo una gane.

## 12. Solo WhatsApp, con tres modos de envío (reemplaza la decisión 3)

El correo se eliminó. El envío automático por la API de Meta depende de
trámites de la clínica, así que el proveedor tiene tres modos, elegidos en
`WHATSAPP_MODO`:

- `manual`: la secretaria envía cada mensaje con un clic desde su WhatsApp
  Business. Es el respaldo que garantiza la entrega.
- `consola`: para desarrollo y demostraciones.
- `api`: envío automático con plantillas aprobadas.

Si el envío falla, la cita no se deshace; el mensaje queda como `fallida` para
enviarlo a mano. Los mensajes no llevan información clínica.

## 13. Enlace "Gestionar mi cita" con código secreto

Sin cuenta, el paciente necesita una forma segura de reprogramar o cancelar. Al
agendar se genera un código aleatorio de 32 bytes que viaja en el enlace del
WhatsApp. En `citas` solo se guarda su hash SHA-256. Cuando la secretaria
reprograma, se genera un código nuevo y el anterior deja de servir. Al marcar
un mensaje como enviado, el código se borra del texto guardado.

Reglas: el paciente reprograma una sola vez y solo hasta 24 horas antes. El
límite de una vez se verifica dentro de la misma sentencia `UPDATE`, para que
dos clics seguidos no cuenten doble.

## 14. Historia clínica inalterable

La historia clínica no se edita ni se borra (Resolución 1995 de 1999). Solo
existen inserciones. Una corrección es una entrada nueva con `corrige_a`
apuntando a la original, que se conserva intacta con su autor y fecha.

## 15. Hora de Colombia calculada en el servidor de aplicación

Las franjas guardan fecha y hora locales del consultorio. La hora actual de
Bogotá se calcula en Node con `Intl` y se pasa a las consultas, de modo que las
reglas ("hora futura", "24 horas antes") no dependen de la zona horaria del
servidor donde se publique.

## 16. Migraciones verificadas

Cada cambio de esquema se escribe dos veces: en `schema.sql` (instalación nueva)
y en una migración numerada (bases existentes). Antes de entregar se comprueba
que ambos caminos producen exactamente el mismo esquema.
