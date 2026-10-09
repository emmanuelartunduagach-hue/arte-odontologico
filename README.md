# Arte Odontológico — Sistema de agendamiento de citas

Proyecto de aplicación · Ingeniería de Software · FET Neiva
Emmanuel Artunduaga Charry · Jawer Leonardo Manrique Yosa

Aplicación web para el consultorio Arte Odontológico: agendamiento de citas en
línea, autenticación con perfiles de paciente y administrador, y notificaciones
automáticas.

## Estructura

```
arte-odontologico/
├── backend/                  API REST (Node.js + Express + MySQL)
│   ├── database/schema.sql   Script de creación de la base de datos
│   └── src/
│       ├── config/           Conexión a MySQL
│       ├── routes/           Definición de endpoints
│       ├── controllers/      Lógica de cada endpoint
│       ├── models/           Consultas SQL
│       ├── middleware/       Autenticación y control de rol
│       └── services/         Notificaciones (correo / WhatsApp)
├── frontend/                 Cliente en HTML, CSS y JavaScript
│   ├── css/                  tokens.css → base.css → [pantalla].css
│   ├── js/
│   ├── assets/img/
│   ├── paciente/             Pantallas del paciente
│   └── admin/                Pantallas del administrador
└── docs/                     Documentación del proyecto
```

## Instalación

**Requisitos:** Node.js 18 o superior, MySQL 8.

```bash
# 1. Base de datos
mysql -u root -p < backend/database/schema.sql

# 2. Backend
cd backend
cp .env.example .env      # completar credenciales
npm install
npm run dev               # http://localhost:3000/api

# 3. Frontend
# Abrir frontend/index.html con Live Server (VS Code)
```

## Abrir el proyecto en Windows

Con MySQL encendido y el backend configurado, haz doble clic en
`INICIAR-PROYECTO.cmd` y abre http://localhost:5500. Deja la ventana abierta
mientras trabajas. Este inicio sirve tanto la API como el frontend; cierra
cualquier backend o Live Server anterior que ocupe los puertos 3000 o 5500.

También puedes ejecutar `npm.cmd run local` desde `backend`.

Al recibir cambios de GitHub, revisa las migraciones nuevas en
`backend/database/migraciones/`: actualizar el código no actualiza MySQL.
Consulta la sección 5.2 del manual de instalación antes de aplicarlas y
haz un respaldo. No ejecutes de nuevo las migraciones que ya estén aplicadas.

## Arquitectura del CSS

Los estilos se cargan en cascada y en este orden:

1. `tokens.css` — variables de color, tipografía y espaciado. Única fuente de
   valores; no debe haber colores sueltos fuera de este archivo.
2. `base.css` — reset, tipografía y componentes compartidos.
3. `[pantalla].css` — estilos exclusivos de cada pantalla.
