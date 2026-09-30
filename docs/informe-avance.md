# Informe de avance

**Proyecto:** Desarrollo de una plataforma web para el consultorio Arte Odontológico
**Programa:** Ingeniería de Software — Fundación Escuela Tecnológica de Neiva Jesús Oviedo Pérez
**Integrantes:** Emmanuel Artunduaga Charry · Jawer Leonardo Manrique Yosa
**Fecha del informe:** septiembre de 2026
**Entrega final prevista:** 11 de noviembre de 2026

---

## 1. Estado general

El proyecto se encuentra en la transición entre las fases de **diseño del sistema**
y **desarrollo e implementación** del plan de trabajo aprobado.

| Fase del plan de trabajo | Estado |
|---|---|
| Levantamiento de requerimientos | Completada |
| Diseño de interfaz y estructura | Completada |
| Desarrollo de la plataforma | En curso |
| Integración de notificaciones y pruebas | No iniciada |
| Ajustes finales y documentación | No iniciada |

---

## 2. Trabajo realizado en este período

### 2.1 Prototipo de interfaz

Se elaboró un prototipo navegable en Figma que cubre las tres áreas del sistema:
página pública, panel del paciente y panel administrativo. El prototipo definió
el flujo de agendamiento que adopta la aplicación:

> El administrador publica las franjas disponibles → el paciente elige tratamiento,
> fecha y hora → la cita queda en estado *pendiente* → el administrador la confirma
> o la cancela.

### 2.2 Auditoría del código generado por el prototipo

El prototipo permitía exportar código. Se auditó antes de adoptarlo y se
encontraron los siguientes problemas, documentados en `docs/decisiones-tecnicas.md`:

| Hallazgo | Impacto |
|---|---|
| 54 dependencias declaradas, 3 en uso real | Peso innecesario y superficie de mantenimiento |
| 46 componentes de interfaz nunca importados | Código muerto |
| React y React-DOM mal declarados | La instalación no funcionaba |
| Rol de usuario elegido desde el formulario de ingreso | Cualquier visitante podía entrar como administrador |
| Contraseñas almacenadas sin cifrar | Incumplimiento de buenas prácticas de seguridad |
| Cinco imágenes enlazadas a un servidor externo | Dependencia y licencia no verificable |
| Todos los datos en memoria del navegador | La información se perdía al recargar |
| Frontend en React | No coincide con el stack aprobado (HTML, CSS, JavaScript) |

Se decidió conservar el diseño visual y el flujo de navegación, y reescribir la
implementación desde cero.

### 2.3 Arquitectura definida

Se estableció una arquitectura en tres capas, coherente con el producto final
aprobado:

```
Cliente (HTML, CSS, JavaScript)
        │  peticiones HTTP con JSON
        ▼
API REST (Node.js + Express)
        │  consultas SQL parametrizadas
        ▼
Base de datos (MySQL 8)
```

### 2.4 Modelo de datos

Se diseñó y escribió el esquema relacional completo, normalizado hasta la tercera
forma normal, con cinco tablas:

| Tabla | Función |
|---|---|
| `usuarios` | Pacientes y administradores, diferenciados por el campo `rol` |
| `servicios` | Catálogo de tratamientos del consultorio |
| `franjas_horarias` | Disponibilidad publicada por el administrador |
| `citas` | Reservas, con su estado y trazabilidad |
| `notificaciones` | Bitácora de cada aviso enviado, con su estado |

Decisiones de integridad relevantes:

- `UNIQUE (franja_id)` en `citas` impide a nivel del motor que dos pacientes
  reserven la misma franja, aunque las peticiones lleguen simultáneamente.
- Las contraseñas se almacenan como hash bcrypt en `contrasena_hash`.
- Se registran `autorizacion_datos`, `fecha_autorizacion` y
  `version_politica_datos` para poder demostrar el consentimiento del paciente,
  como exige la Ley 1581 de 2012.

### 2.5 Sistema de diseño

Se sustituyó el estilo genérico del prototipo por un sistema de diseño propio
documentado en `frontend/css/tokens.css`:

- Paleta violeta desaturada, más adecuada a un contexto de salud que el morado
  saturado del prototipo. Colores de estado (confirmada, pendiente, cancelada)
  deliberadamente apagados, para que en la tabla de citas el color informe sin
  saturar la lectura.
- Dos familias tipográficas con roles diferenciados: Fraunces para titulares e
  Inter para interfaz y datos.
- Escala de espaciado y jerarquía de elevación de dos niveles.

Se verificó que todas las variables usadas en las hojas de estilo estén definidas.

### 2.6 Página pública implementada

La página pública está construida en HTML semántico, con:

- Estructura de secciones y encabezados jerárquicos.
- Enlace de salto al contenido y foco visible, para navegación por teclado.
- Formularios con etiquetas asociadas y validación en cliente.
- Diseño adaptable a móvil, tableta y escritorio.
- Respeto de la preferencia `prefers-reduced-motion`.
- Casilla de autorización de tratamiento de datos y política publicada.

### 2.7 Base del backend

Se implementaron los cimientos de la API:

- Pool de conexiones a MySQL con verificación al arranque.
- Aplicación Express con CORS, manejo centralizado de errores y endpoint
  `GET /api/salud` para comprobar que el servicio responde.
- Middleware `requiereSesion` y `requiereRol`, que corrigen el fallo de
  autorización detectado en el prototipo.
- Servicio de notificaciones con proveedores intercambiables.

---

## 3. Cambio propuesto a la documentación

Se solicita autorización para modificar el canal de notificaciones:

**Objetivo específico 3 aprobado:**
> Integrar un sistema de notificaciones automáticas vía correo electrónico.

**Redacción propuesta:**
> Integrar un sistema de notificaciones automáticas multicanal, con envío por
> correo electrónico y por WhatsApp.

**Justificación.** La tasa de lectura de WhatsApp es considerablemente mayor que
la del correo electrónico en el contexto local, y el recordatorio de una cita solo
cumple su función si el paciente lo lee. El plan de trabajo aprobado ya contempla
"Integración de WhatsApp y pruebas" en los meses 4 a 6, de modo que el cambio
alinea los objetivos con el cronograma.

**Alcance.** No se elimina el correo electrónico: se conserva como canal base y
WhatsApp se incorpora como canal adicional. La arquitectura ya implementada
permite activar uno, otro o ambos mediante configuración.

**Riesgo identificado.** El envío automatizado por WhatsApp requiere la API de
WhatsApp Business, que exige verificación de la empresa ante Meta y plantillas
aprobadas. Ese trámite depende del consultorio y no del equipo. Al mantener el
correo como canal base, la entrega no queda condicionada a ese trámite.

**Consideración legal.** El envío de mensajes a pacientes requiere autorización
expresa del titular. El contenido se limita a fecha, hora y estado de la cita,
sin información clínica.

---

## 4. Próximos pasos

| Actividad | Entregable |
|---|---|
| Endpoints de autenticación | Registro e ingreso con bcrypt y token firmado |
| Endpoints de citas | Crear, consultar, cancelar y cambiar estado |
| Pantallas del paciente | Panel, agendar cita, mis citas, perfil |
| Pantallas del administrador | Métricas, tabla de citas, gestión de horarios |
| Proveedor de correo | Confirmación y recordatorio con Nodemailer |
| Recordatorio programado | Tarea que envía el aviso 24 horas antes |
| Pruebas y despliegue | Verificación funcional y publicación en hosting |
| Manuales | Manual de usuario y manual de instalación |

---

## 5. Anexos

| Archivo | Contenido |
|---|---|
| `README.md` | Estructura del proyecto e instrucciones de instalación |
| `docs/decisiones-tecnicas.md` | Justificación de cada decisión de arquitectura |
| `backend/database/schema.sql` | Esquema completo de la base de datos |
| `frontend/index.html` | Página pública funcional |
| `frontend/css/tokens.css` | Sistema de diseño |
