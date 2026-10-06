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
