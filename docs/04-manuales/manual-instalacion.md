# Manual de instalación — Arte Odontológico

**Proyecto:** plataforma web de agendamiento de citas para el consultorio Arte Odontológico\
**Programa:** Ingeniería de Software — Fundación Escuela Tecnológica de Neiva Jesús Oviedo Pérez\
**Autores:** Emmanuel Artunduaga Charry · Jawer Leonardo Manrique Yosa\
**Versión del documento:** 0.9 (borrador) · 6 de octubre de 2026

> Pendiente: completar la sección 8 (publicación en servidor) cuando se elija el proveedor, y pasar el documento a la plantilla oficial de la FET.

## 1. Propósito

Este manual explica cómo instalar y poner en marcha el sistema en un equipo de desarrollo o en un servidor: requisitos, base de datos, configuración, arranque y verificación.

## 2. Componentes del sistema

| Componente | Tecnología | Carpeta |
|---|---|---|
| Base de datos | MySQL 8.0 o superior | `backend/database/` |
| API REST | Node.js 18+ con Express 4 | `backend/` |
| Cliente web | HTML, CSS y JavaScript sin frameworks | `frontend/` |
| Notificaciones | WhatsApp (modos manual, consola o API de Meta) | configuración en `backend/.env` |

## 3. Requisitos

**Software**
- Node.js 18 o superior (las pruebas automáticas se corrieron con Node 22). Incluye `npm`.
- MySQL Server 8.0 o superior, y MySQL Workbench (recomendado en Windows).
- Git.
- Un navegador actualizado (Chrome, Edge o Firefox).
- Para desarrollo: Visual Studio Code con la extensión Live Server.

**Hardware mínimo (servidor o equipo de desarrollo):** 2 GB de RAM libres y 1 GB de disco.

**Red:** el backend escucha por defecto en el puerto 3000 y MySQL en el 3306.

## 4. Obtener el código

```bash
git clone https://github.com/emmanuelartunduagach-hue/arte-odontologico.git
cd arte-odontologico
```

El repositorio es privado: la cuenta de GitHub debe tener acceso.

## 5. Base de datos

### 5.1 Instalación nueva (recomendada)

1. Abrir MySQL Workbench y conectarse al servidor local con el usuario `root` (o un usuario con permiso para crear bases de datos).
2. **File → Open SQL Script…** y abrir `backend/database/schema.sql`.
3. Ejecutar todo el script (botón del rayo).

El script crea la base `arte_odontologico`, las 9 tablas, la vista `v_agenda` y los datos iniciales: la sede de Rivera y 9 especialidades. No crea usuarios ni especialistas.

Desde la línea de comandos (Linux o macOS):

```bash
mysql -u root -p < backend/database/schema.sql
```

> En PowerShell de Windows el operador `<` no funciona. Usar Workbench, o dentro del cliente `mysql` el comando `source C:/ruta/backend/database/schema.sql`.

### 5.2 Actualizar una base existente

Si la base se creó con una versión anterior del proyecto, ejecutar **una sola vez y en orden** las migraciones de `backend/database/migraciones/`:

| Migración | Qué hace |
|---|---|
| `001_alta_pacientes_por_administrador.sql` | Clave temporal y registro de quién crea cada paciente |
| `002_especialistas_y_citas_sin_usuario.sql` | Especialistas, franjas por especialista, citas sin cuenta, historia clínica. **Borra franjas y citas existentes** (pensado para datos de prueba) |

### 5.3 Usuario de base de datos para producción

En un servidor no se debe usar `root`. Crear un usuario solo para la aplicación:

```sql
CREATE USER 'arte_app'@'localhost' IDENTIFIED BY 'una-clave-larga-y-aleatoria';
GRANT SELECT, INSERT, UPDATE, DELETE ON arte_odontologico.* TO 'arte_app'@'localhost';
FLUSH PRIVILEGES;
```

## 6. Backend

### 6.1 Dependencias

```bash
cd backend
npm install
```

> En PowerShell, si aparece un error de "ejecución de scripts deshabilitada", usar `npm.cmd` en lugar de `npm` (por ejemplo `npm.cmd install`).

### 6.2 Archivo de configuración `.env`

Copiar la plantilla y completarla. **El archivo `.env` nunca se sube a Git.**

```bash
cp .env.example .env        # en Windows: copy .env.example .env
```

| Variable | Obligatoria | Descripción | Ejemplo |
|---|---|---|---|
| `PORT` | No | Puerto de la API | `3000` |
| `ORIGEN_PERMITIDO` | Sí | Dirección del frontend autorizada por CORS | `http://localhost:5500` |
| `DB_HOST`, `DB_PORT` | Sí | Servidor MySQL | `localhost`, `3306` |
| `DB_USER`, `DB_PASSWORD` | Sí | Usuario de MySQL | `arte_app` |
| `DB_NAME` | Sí | Nombre de la base | `arte_odontologico` |
| `JWT_SECRET` | Sí | Clave para firmar las sesiones. Cadena larga y aleatoria | ver comando abajo |
| `JWT_EXPIRA` | No | Duración de la sesión | `8h` |
| `URL_PUBLICA` | Sí | Dirección pública del frontend; se usa en los enlaces de WhatsApp | `https://arteodontologico.com` |
| `PROXY_CONFIABLE` | No | `1` si el servidor está detrás de un proxy (Render, Railway, Nginx) | `1` |
| `HORAS_MINIMAS_GESTION` | No | Horas antes de la cita hasta las que el paciente puede reprogramar o cancelar | `24` |
| `LIMITE_CITAS_ACTIVAS_SIN_USUARIO` | No | Citas activas a la vez por documento sin cuenta (0 = sin límite) | `1` |
| `LIMITE_ESCRITURAS_POR_IP`, `LIMITE_LECTURAS_POR_IP` | No | Peticiones públicas por IP cada 15 minutos | `15`, `60` |
| `RECORDATORIOS_AUTOMATICOS` | No | `false` desactiva el recordatorio automático | `true` |
| `RECORDATORIO_DESDE`, `RECORDATORIO_HASTA` | No | Horas (de Colombia) entre las que se generan los recordatorios | `8`, `19` |
| `RECORDATORIO_HORAS_MINIMAS` | No | No recordar citas agendadas hace menos de estas horas | `12` |
| `WHATSAPP_MODO` | No | `manual`, `consola` o `api` (ver sección 7) | `manual` |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | Solo modo `api` | Credenciales de Meta | — |
| `WHATSAPP_PLANTILLA_*` | Solo modo `api` | Nombres de las plantillas aprobadas | `cita_agendada` |

Generar `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 6.3 Crear el usuario administrador (secretaria)

```bash
npm run crear-admin
```

El script pide nombre, documento, correo, teléfono y contraseña (mínimo 8 caracteres, con letra y número). La contraseña se guarda cifrada con bcrypt. **Es la única forma de crear un administrador**: no existe ninguna pantalla ni ruta de la API para hacerlo.

Si la secretaria olvida su contraseña:

```bash
npm run restablecer-admin
```

Pide el correo del administrador y la contraseña nueva dos veces.

### 6.4 Arrancar

```bash
npm run dev      # desarrollo: se reinicia solo al guardar cambios
npm start        # producción
```

Debe mostrar:

```
Conexión a MySQL establecida.
API escuchando en http://localhost:3000/api
```

Si dice `No fue posible conectar con MySQL`, revisar que el servicio de MySQL esté encendido y los datos `DB_*` del `.env`.

## 7. Notificaciones por WhatsApp

| Modo (`WHATSAPP_MODO`) | Uso | Requisitos |
|---|---|---|
| `manual` (por defecto) | Los mensajes quedan pendientes en el panel de la secretaria, que los envía con un clic desde su WhatsApp Business | Ninguno |
| `consola` | El mensaje se imprime en la terminal del backend | Ninguno. Para desarrollo y demostraciones |
| `api` | El servidor envía el mensaje automáticamente con la API de WhatsApp Cloud | App en Meta for Developers, número verificado, plantillas aprobadas, método de pago |

Para el modo `api`:
1. Crear una app con el caso de uso WhatsApp en <https://developers.facebook.com>.
2. Copiar el **Phone number ID** a `WHATSAPP_PHONE_ID` y un token permanente de usuario del sistema a `WHATSAPP_TOKEN`.
3. Crear y aprobar en el administrador de WhatsApp las plantillas de categoría "utilidad". Sus parámetros van en este orden: `{{1}}` nombre, `{{2}}` fecha, `{{3}}` hora, `{{4}}` especialista, `{{5}}` dirección y `{{6}}` enlace.
4. Escribir sus nombres en `WHATSAPP_PLANTILLA_CONFIRMACION`, `_REPROGRAMACION`, `_CANCELACION` y `_RECORDATORIO`.

Si el envío falla, la cita igual queda registrada y el mensaje aparece como "fallida" en el panel para enviarlo a mano.

La plantilla del recordatorio usa solo los 5 primeros parámetros (no lleva enlace): `WHATSAPP_PARAMETROS_RECORDATORIO=5`.

**Recordatorio del día anterior.** Mientras el backend esté encendido, revisa cada 30 minutos (entre `RECORDATORIO_DESDE` y `RECORDATORIO_HASTA`) las citas de mañana y genera su recordatorio. Si el servidor se apaga de noche, se puede programar `npm run recordatorios` una vez al día con el Programador de tareas de Windows o con `cron` en Linux.

## 8. Frontend

**Desarrollo:** abrir la carpeta del proyecto en Visual Studio Code, clic derecho sobre `frontend/index.html` → **Open with Live Server**. Debe abrir en `http://localhost:5500` (el mismo origen configurado en `ORIGEN_PERMITIDO`).

La dirección de la API se configura en `frontend/js/config.js`:

```js
const CONFIG = { API: 'http://localhost:3000/api' };
```

**Publicación en servidor:** *pendiente de definir el proveedor.* La opción más simple es servir `frontend/` desde el mismo Express (un solo despliegue, sin CORS). Requisitos mínimos de la publicación: HTTPS, base de datos MySQL 8 accesible desde el backend, variables de entorno configuradas en el panel del proveedor (no en archivos), `PROXY_CONFIABLE=1` y `URL_PUBLICA` con el dominio real.

## 9. Verificación rápida

| Prueba | Cómo | Resultado esperado |
|---|---|---|
| API viva | Abrir `http://localhost:3000/api/salud` | `{"estado":"ok", ...}` |
| Base cargada | Abrir `http://localhost:3000/api/especialidades` | Lista de 9 especialidades |
| Administrador | Ingresar en el frontend con el correo creado en 6.3 | Abre el panel de la secretaria |

La guía completa de pruebas está en `docs/06-pruebas/`.

## 10. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `npm` no se reconoce o "scripts deshabilitados" en PowerShell | Política de ejecución de Windows | Usar `npm.cmd` |
| `Failed to connect to MySQL at localhost:3306` | El servicio MySQL está detenido | Iniciar el servicio (Servicios de Windows → MySQL80). Si no arranca, revisar el archivo `.err` de la carpeta de datos de MySQL |
| `Falta JWT_SECRET en el archivo .env` | `.env` incompleto | Generar la clave (6.2) |
| El navegador muestra error de CORS | El frontend no está en la dirección de `ORIGEN_PERMITIDO` | Abrirlo con Live Server en `http://localhost:5500` |
| `Unknown column` o `Table doesn't exist` | Base creada con una versión anterior | Ejecutar las migraciones (5.2) |
| Tildes raras (`OdontologÃ­a`) | Script cargado con otra codificación | Recrear la base con el `schema.sql` actual, que fija `utf8mb4` |
| HTTP 429 "Demasiados intentos" | Límite de peticiones por IP | Esperar 15 minutos o subir `LIMITE_ESCRITURAS_POR_IP` en desarrollo |
