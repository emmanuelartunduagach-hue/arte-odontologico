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
