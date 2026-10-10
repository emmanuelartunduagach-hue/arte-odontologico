# Manual de instalación — Arte Odontológico

**Proyecto:** plataforma web de agendamiento de citas para el consultorio Arte Odontológico\
**Programa:** Ingeniería de Software — Fundación Escuela Tecnológica de Neiva Jesús Oviedo Pérez\
**Autores:** Emmanuel Artunduaga Charry · Jawer Leonardo Manrique Yosa\
**Versión del documento:** 0.95 (borrador) · 10 de octubre de 2026

> Pendiente: confirmar el proveedor (la sección 8.2 describe Railway, la opción recomendada) y pasar el documento a la plantilla oficial de la FET.

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

El script crea la base `arte_odontologico`, las 10 tablas, la vista `v_agenda` y los datos iniciales: la sede de Rivera y 9 especialidades. No crea usuarios ni especialistas.

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
| `003_pacientes_sin_login_y_aprobacion.sql` | Tabla `pacientes` (sin login), citas pendientes y rechazadas, `confirmada_en` y mensaje de rechazo. Conserva los datos: copia los pacientes que había en `usuarios` |
| `004_datos_paciente_y_hora_anterior.sql` | Nombres y apellidos por separado, tipo de documento, teléfono fijo y motivo de consulta; hora anterior de las citas que el paciente reprograma. Conserva los datos: parte el nombre que ya existía y deja el tipo de documento en CC |
| `005_citas_confirmadas_al_pedir.sql` | Las citas de la web nacen confirmadas: columna `origen` (web o consultorio) y estado por defecto `confirmada`. Las pendientes que existan se mantienen para aceptarlas o rechazarlas |

Antes de una migración, saca un respaldo. En PowerShell de Windows (ajusta la versión de la carpeta si no es 8.0):

```powershell
$bin = "C:\Program Files\MySQL\MySQL Server 8.0\bin"
& "$bin\mysqldump.exe" -u root -p arte_odontologico --result-file=respaldo.sql
& "$bin\mysql.exe" -u root -p -e "source backend/database/migraciones/004_datos_paciente_y_hora_anterior.sql"
```

Se usa `--result-file` y no `>` porque en PowerShell `>` guarda el archivo en UTF-16 y después `mysql` no lo puede leer.

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
| `LIMITE_CITAS_ACTIVAS_POR_DOCUMENTO` | No | Citas pendientes o confirmadas a la vez por documento (0 = sin límite). Se acepta el nombre anterior `LIMITE_CITAS_ACTIVAS_SIN_USUARIO` | `1` |
| `LIMITE_ESCRITURAS_POR_IP`, `LIMITE_LECTURAS_POR_IP` | No | Peticiones públicas por IP cada 15 minutos | `15`, `60` |
| `LIMITE_INGRESOS_POR_IP` | No | Intentos de ingreso por IP cada 15 minutos | `10` |
| `RECORDATORIOS_AUTOMATICOS` | No | `false` desactiva el recordatorio automático | `true` |
| `RECORDATORIO_DESDE`, `RECORDATORIO_HASTA` | No | Horas (de Colombia) entre las que se generan los recordatorios | `8`, `19` |
| `RECORDATORIO_HORAS_MINIMAS` | No | No recordar citas agendadas hace menos de estas horas | `12` |
| `WHATSAPP_MODO` | No | `manual`, `consola`, `twilio` o `api` (ver sección 7) | `manual` |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_DESDE` | Solo modo `twilio` | Credenciales de Twilio y número del sandbox | — |
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
| `twilio` | El servidor envía el mensaje automáticamente con Twilio. Para pruebas con el WhatsApp Sandbox mientras la clínica tramita la API de Meta | Cuenta de Twilio (sin Facebook); cada número que recibe se une antes al sandbox |
| `api` | El servidor envía el mensaje automáticamente con la API de WhatsApp Cloud | App en Meta for Developers, número verificado, plantillas aprobadas, método de pago |

Para el modo `twilio` (pruebas):
1. En <https://console.twilio.com>, abrir **Messaging → Try it out → Send a WhatsApp message**. Ahí aparecen el número del sandbox (por ejemplo `+1 415 523 8886`) y un código del tipo `join palabra-palabra`.
2. Desde cada celular que vaya a recibir mensajes de prueba, enviar ese `join …` por WhatsApp al número del sandbox. Twilio responde confirmando.
3. En `backend/.env`:
   ```
   WHATSAPP_MODO=twilio
   TWILIO_ACCOUNT_SID=ACxxxxxxxx...   # Account Info, en la página principal de la consola
   TWILIO_AUTH_TOKEN=...              # junto al SID; no se sube a Git
   TWILIO_WHATSAPP_DESDE=+14155238886 # número del sandbox
   ```
4. Reiniciar el backend y agendar una cita poniendo como teléfono uno de los celulares unidos al sandbox.

El sandbox es solo para pruebas: si un número no se ha unido, o pasó mucho tiempo desde su último mensaje al sandbox, Twilio rechaza el envío. Ese mensaje queda "con error" en el panel y se puede enviar a mano. En ese caso basta con volver a enviar el `join …`.

Para el modo `api`:
1. Crear una app con el caso de uso WhatsApp en <https://developers.facebook.com>.
2. Copiar el **Phone number ID** a `WHATSAPP_PHONE_ID` y un token permanente de usuario del sistema a `WHATSAPP_TOKEN`.
3. Crear y aprobar en el administrador de WhatsApp las plantillas de categoría "utilidad". Sus parámetros van en este orden: `{{1}}` nombre, `{{2}}` fecha, `{{3}}` hora, `{{4}}` especialista, `{{5}}` dirección y `{{6}}` enlace.
4. Escribir sus nombres en `WHATSAPP_PLANTILLA_CONFIRMACION`, `_REPROGRAMACION`, `_CANCELACION`, `_RECHAZO` y `_RECORDATORIO` (la de rechazo solo se usa con citas pendientes de antes de la migración 005).

Si el envío falla, la cita igual queda registrada y el mensaje aparece como "fallida" en el panel para enviarlo a mano.

La plantilla del recordatorio usa solo los 5 primeros parámetros (no lleva enlace): `WHATSAPP_PARAMETROS_RECORDATORIO=5`.

**Recordatorio 24 horas antes.** Mientras el backend esté encendido, revisa cada 30 minutos (entre `RECORDATORIO_DESDE` y `RECORDATORIO_HASTA`) las citas confirmadas que empiezan en las próximas 24 horas y genera su recordatorio. Una cita de las 7:00 lo recibe a las 8:00 del día anterior. Si el servidor se apaga de noche, se puede programar `npm run recordatorios` cada hora con el Programador de tareas de Windows o con `cron` en Linux.

## 8. Frontend y publicación

**Desarrollo:** abrir la carpeta del proyecto en Visual Studio Code, clic derecho sobre `frontend/index.html` → **Open with Live Server**. Debe abrir en `http://localhost:5500` (el mismo origen configurado en `ORIGEN_PERMITIDO`). Con `npm run dev` corriendo, el backend también entrega el frontend en `http://localhost:3000`.

La dirección de la API está en `frontend/js/config.js` y no hay que cambiarla: si la página se abre desde el puerto 5500 (Live Server) usa `http://localhost:3000/api`; en cualquier otro caso usa `/api`, en el mismo dominio.

### 8.1 Cómo se publica

Un solo servicio: Express atiende la API en `/api` y entrega la carpeta `frontend/` en el resto de rutas (`SERVIR_FRONTEND=true`, valor por defecto). Así hay un solo dominio con HTTPS y no hace falta CORS. El `package.json` de la raíz del repositorio instala el backend (`postinstall`) y lo arranca (`npm start`), para que el proveedor pueda construir desde la raíz.

Requisitos de cualquier servidor: Node.js 20 o superior, MySQL 8 accesible desde el backend, HTTPS, proceso siempre encendido (los recordatorios se revisan cada 30 minutos dentro del mismo proceso, así que no sirven planes que apagan el servicio cuando no hay visitas) y las variables de entorno en el panel del proveedor, no en archivos.

### 8.2 Publicación en Railway (opción recomendada)

Plan **Hobby**: USD 5 al mes, que incluyen USD 5 de consumo; una app pequeña con su base de datos suele quedar en ese rango. El plan gratuito no alcanza porque después de la prueba solo permite un servicio por proyecto, y aquí son dos (la app y MySQL).

1. Entrar a railway.com con la cuenta de GitHub del repositorio y activar el plan Hobby.
2. **New Project → Deploy from GitHub repo →** `arte-odontologico`, rama `main`. Directorio raíz: la raíz del repositorio (no `backend/`, porque el servidor también necesita `frontend/`).
3. En el mismo proyecto: **+ New → Database → MySQL**.
4. En el servicio de la app, pestaña **Variables**, crear (las que van entre `${{ }}` son referencias a la base de datos que Railway completa solo):

   | Variable | Valor |
   |---|---|
   | `DB_HOST` | `${{MySQL.MYSQLHOST}}` |
   | `DB_PORT` | `${{MySQL.MYSQLPORT}}` |
   | `DB_USER` | `${{MySQL.MYSQLUSER}}` |
   | `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |
   | `DB_NAME` | `arte_odontologico` |
   | `JWT_SECRET` | una clave nueva y larga (ver sección 6), distinta a la de desarrollo |
   | `PROXY_CONFIABLE` | `1` |
   | `URL_PUBLICA` | el dominio público del paso 6, con `https://` |
   | `WHATSAPP_MODO` y sus datos | como en la sección 7 (en producción, `api` con las plantillas aprobadas, o `manual` mientras tanto) |

   El resto (`HORAS_MINIMAS_GESTION`, límites, recordatorios) puede quedar con los valores por defecto.
5. **Crear las tablas.** En el servicio MySQL → **Connect → Public network** aparecen el host y el puerto públicos. Desde el PC, con MySQL Workbench o con la consola:

   ```powershell
   & "$bin\mysql.exe" -h HOST_PUBLICO -P PUERTO_PUBLICO -u root -p -e "source backend/database/schema.sql"
   ```

   `schema.sql` crea la base `arte_odontologico` con todas las tablas hasta la migración 005 y el catálogo inicial.
6. **Dominio:** en el servicio de la app → **Settings → Networking → Generate Domain** (queda algo como `arte-odontologico.up.railway.app`), o **Custom Domain** si el consultorio tiene uno. Copiarlo en `URL_PUBLICA`.
7. **Crear la cuenta de la secretaria** contra la base publicada. En `backend/`, crear un archivo `.env.railway` (no se sube: `.env.*` está en `.gitignore`) con `DB_HOST`, `DB_PORT`, `DB_USER` y `DB_PASSWORD` públicos del paso 5 y `DB_NAME=arte_odontologico`, y ejecutar:

   ```powershell
   node -r dotenv/config src/scripts/crearAdmin.js dotenv_config_path=.env.railway
   ```

   Borrar el archivo después.
8. Verificar: `https://DOMINIO/api/salud` responde `{"estado":"ok"}`, la página principal carga, se puede pedir una cita y llega el WhatsApp con un enlace que abre `https://DOMINIO/gestionar-cita.html`.

Cada vez que se fusiona un PR en `main`, Railway vuelve a publicar solo. Si un cambio trae una migración nueva, se aplica antes con el mismo comando del paso 5 cambiando el archivo.

**Respaldos:** una vez por semana, y siempre antes de una migración:

```powershell
& "$bin\mysqldump.exe" -h HOST_PUBLICO -P PUERTO_PUBLICO -u root -p --result-file="respaldo-AAAA-MM-DD.sql" arte_odontologico
```

### 8.3 Otras opciones

- **AWS Lightsail (instancia con Node.js):** precio fijo mensual y control total, pero hay que instalar MySQL, Nginx y el certificado HTTPS y mantener el servidor a mano. Con la misma estructura: `npm install` en la raíz y `npm start` con un gestor de procesos (pm2).
- **Vercel o Netlify:** no convienen, porque ejecutan funciones que se apagan entre visitas: se pierden los recordatorios cada 30 minutos y el límite de peticiones en memoria, y no incluyen MySQL.

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
| HTTP 429 "Demasiados intentos" | Límite de peticiones por IP | Esperar 15 minutos o subir `LIMITE_ESCRITURAS_POR_IP` (o `LIMITE_INGRESOS_POR_IP` si es al ingresar) en desarrollo |
