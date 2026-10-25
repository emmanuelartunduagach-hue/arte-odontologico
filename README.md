# Arte Odontológico — Sistema web de citas

Proyecto de aplicación · Ingeniería de Software · FET Neiva
Emmanuel Artunduaga Charry · Jawer Leonardo Manrique Yosa

Aplicación web para el consultorio odontológico Arte Odontológico (sede Rivera, Huila).
Las personas piden su cita en línea sin crear una cuenta y reciben por WhatsApp la
confirmación, los cambios y el recordatorio. La secretaria y la propietaria administran
desde un panel la agenda, los horarios, los pacientes, la historia clínica y el odontograma.

Publicada en: <https://arte-odontologico-production.up.railway.app>

## Qué hace

- **Paciente (sin cuenta):** elige especialidad, especialista, día y hora; deja sus datos y
  la autorización de tratamiento de datos; la cita queda confirmada. Con el enlace
  «Gestionar mi cita» del WhatsApp reprograma una vez o cancela, hasta 24 horas antes.
- **Secretaria (rol `administrador`):** agenda, horarios por especialista, pacientes, historia
  clínica (solo inserciones) y odontograma.
- **Propietaria (rol `superadmin`):** todo lo anterior, más aprobar las correcciones de la
  historia y las anulaciones del odontograma, administrar al equipo y a los especialistas.

## Estructura

```
arte-odontologico/
├── package.json              Instala el backend y lo arranca (publicación en Railway)
├── backend/                  API REST (Node.js + Express + MySQL)
│   ├── database/
│   │   ├── schema.sql        Esquema completo (instalación nueva)
│   │   └── migraciones/      001–007, para bases existentes
│   └── src/
│       ├── config/           Conexión a MySQL
│       ├── routes/           Definición de endpoints
│       ├── controllers/      Validación y reglas de negocio
│       ├── models/           Consultas SQL
│       ├── middleware/       Sesión, rol y límite de peticiones
│       ├── services/         Notificaciones de WhatsApp y recordatorios
│       ├── utils/            Validaciones, fechas, códigos y errores
│       └── scripts/          Administrador, propietaria, recordatorios y datos de prueba
├── frontend/                 Cliente en HTML, CSS y JavaScript (sin framework)
│   ├── index.html            Página pública y flujo de agendar
│   ├── gestionar-cita.html   Reprogramar o cancelar con el enlace
│   ├── panel-secretaria.html Panel (secretaria y propietaria)
│   ├── politica-datos.html   Política de tratamiento de datos
│   ├── css/                  tokens.css → base.css → [pantalla].css
│   ├── js/                   Un módulo por pantalla y módulos comunes
│   └── assets/img/
└── docs/                     Documentación (ver docs/README.md)
```

## Instalación en desarrollo

**Requisitos:** Node.js 20 o superior, MySQL 8.

```bash
# 1. Base de datos
mysql -u root -p < backend/database/schema.sql

# 2. Backend
cd backend
cp .env.example .env      # completar credenciales
npm install
npm run crear-admin       # cuenta de la secretaria
npm run dev               # http://localhost:3000/api

# 3. Frontend
# Con el backend encendido, también se entrega en http://localhost:3000
# o se abre frontend/index.html con Live Server (http://localhost:5500).
```

Para la propietaria: `npm run superadmin` (pide la clave `SUPERADMIN_CLAVE` del `.env`).
La instalación completa y la publicación en Railway están en
`docs/04-manuales/manual-instalacion.md`.

## Arquitectura del CSS

Los estilos se cargan en cascada y en este orden:

1. `tokens.css` — variables de color, tipografía, espaciado y sombras. Única fuente de
   valores; no debe haber colores sueltos fuera de este archivo.
2. `base.css` — reset, tipografía y componentes compartidos.
3. `[pantalla].css` — estilos exclusivos de cada pantalla (`landing.css`, `panel.css`).
