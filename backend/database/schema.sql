-- ============================================================
--  Arte Odontológico — Esquema de base de datos
--  Motor: MySQL 8.0+
--  Modelo relacional normalizado hasta 3FN.
-- ============================================================

CREATE DATABASE IF NOT EXISTS arte_odontologico
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE arte_odontologico;

-- ------------------------------------------------------------
--  usuarios
--  Pacientes y administradores en una sola tabla, separados
--  por el campo `rol`. En el boceto el rol se elegía desde un
--  menú en el formulario de ingreso, lo que permitía a
--  cualquiera entrar como administrador. Aquí el rol es un
--  atributo del registro y no viaja nunca desde el cliente.
-- ------------------------------------------------------------
CREATE TABLE usuarios (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre_completo     VARCHAR(120)  NOT NULL,
  documento           VARCHAR(20)   NOT NULL,
  correo              VARCHAR(160)  NOT NULL,
  telefono            VARCHAR(20)   NOT NULL,
  contrasena_hash     VARCHAR(255)  NOT NULL,  -- bcrypt, nunca texto plano
  rol                 ENUM('paciente','administrador') NOT NULL DEFAULT 'paciente',
  activo              BOOLEAN       NOT NULL DEFAULT TRUE,

  -- Ley 1581 de 2012: se debe poder demostrar cuándo y bajo qué
  -- versión de la política el titular autorizó el tratamiento.
  autorizacion_datos      BOOLEAN   NOT NULL DEFAULT FALSE,
  fecha_autorizacion      DATETIME  NULL,
  version_politica_datos  VARCHAR(10) NULL,

  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_usuarios_correo    UNIQUE (correo),
  CONSTRAINT uq_usuarios_documento UNIQUE (documento),
  INDEX idx_usuarios_rol (rol)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  servicios
--  Catálogo de tratamientos. En el boceto estaba quemado en el
--  código; al moverlo a base de datos el consultorio puede
--  agregar o retirar tratamientos sin tocar el frontend.
-- ------------------------------------------------------------
CREATE TABLE servicios (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo           VARCHAR(40)  NOT NULL,
  nombre           VARCHAR(120) NOT NULL,
  descripcion      VARCHAR(255) NULL,
  duracion_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  activo           BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_servicios_codigo UNIQUE (codigo)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  sedes
--  El consultorio atiende en dos ubicaciones (Neiva y Rivera).
--  Cada franja horaria pertenece a una sede, de modo que la
--  agenda de una no bloquea la de la otra.
-- ------------------------------------------------------------
CREATE TABLE sedes (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(60)  NOT NULL,
  direccion  VARCHAR(160) NOT NULL,
  ciudad     VARCHAR(60)  NOT NULL,
  telefono   VARCHAR(20)  NULL,
  activa     BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_sedes_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  franjas_horarias
--  Disponibilidad publicada por el administrador. Cada fila es
--  una fecha + hora concreta que un paciente puede reservar.
--  La restricción UNIQUE impide publicar la misma franja dos
--  veces; la lógica de reserva impide que dos pacientes tomen
--  la misma franja.
-- ------------------------------------------------------------
CREATE TABLE franjas_horarias (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sede_id      INT UNSIGNED NOT NULL,
  fecha        DATE NOT NULL,
  hora_inicio  TIME NOT NULL,
  disponible   BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por   INT UNSIGNED NOT NULL,
  creado_en    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- La misma hora puede existir en ambas sedes, pero no dos
  -- veces en la misma sede.
  CONSTRAINT uq_franja UNIQUE (sede_id, fecha, hora_inicio),
  CONSTRAINT fk_franja_sede FOREIGN KEY (sede_id)
    REFERENCES sedes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_franja_admin FOREIGN KEY (creado_por)
    REFERENCES usuarios(id) ON DELETE RESTRICT,
  INDEX idx_franja_fecha (sede_id, fecha, disponible)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  citas
--  Una cita ocupa exactamente una franja. La clave única sobre
--  franja_id garantiza a nivel de motor que no haya doble
--  reserva, aunque dos peticiones lleguen al mismo tiempo.
-- ------------------------------------------------------------
CREATE TABLE citas (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id  INT UNSIGNED NOT NULL,
  servicio_id  INT UNSIGNED NOT NULL,
  franja_id    INT UNSIGNED NOT NULL,
  estado       ENUM('pendiente','confirmada','cancelada','atendida')
                 NOT NULL DEFAULT 'pendiente',
  notas        VARCHAR(300) NULL,

  creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_cita_franja UNIQUE (franja_id),
  CONSTRAINT fk_cita_paciente FOREIGN KEY (paciente_id)
    REFERENCES usuarios(id)  ON DELETE CASCADE,
  CONSTRAINT fk_cita_servicio FOREIGN KEY (servicio_id)
    REFERENCES servicios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cita_franja   FOREIGN KEY (franja_id)
    REFERENCES franjas_horarias(id) ON DELETE RESTRICT,

  INDEX idx_citas_paciente (paciente_id, estado),
  INDEX idx_citas_estado (estado)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  notificaciones
--  Bitácora de cada aviso enviado. Permite demostrar en la
--  sustentación que la notificación salió, reintentar los
--  fallos y evitar envíos duplicados.
-- ------------------------------------------------------------
CREATE TABLE notificaciones (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cita_id     INT UNSIGNED NOT NULL,
  canal       ENUM('correo','whatsapp') NOT NULL,
  tipo        ENUM('confirmacion','recordatorio','cancelacion') NOT NULL,
  estado      ENUM('pendiente','enviada','fallida') NOT NULL DEFAULT 'pendiente',
  destino     VARCHAR(160) NOT NULL,   -- correo o número usado
  detalle     VARCHAR(500) NULL,       -- id del proveedor o error
  programada_para DATETIME NULL,       -- para recordatorios
  enviada_en  DATETIME NULL,
  creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notif_cita FOREIGN KEY (cita_id)
    REFERENCES citas(id) ON DELETE CASCADE,
  CONSTRAINT uq_notif UNIQUE (cita_id, canal, tipo),
  INDEX idx_notif_pendientes (estado, programada_para)
) ENGINE=InnoDB;

-- ============================================================
--  Datos iniciales
-- ============================================================

INSERT INTO sedes (nombre, direccion, ciudad, telefono) VALUES
  ('Neiva',  'Carrera 7 No. 6-45, Centro', 'Neiva',  '3187153718'),
  ('Rivera', 'Carrera 7 No. 3-61',         'Rivera', '3108120241');

INSERT INTO servicios (codigo, nombre, descripcion, duracion_minutos) VALUES
  ('general',         'Odontología general',   'Limpieza, resinas y control preventivo.',       40),
  ('sonrisa',         'Diseño de sonrisa',     'Carillas y blanqueamiento estético.',           60),
  ('ortodoncia',      'Ortodoncia',            'Brackets y alineadores para corregir mordida.', 45),
  ('odontopediatria', 'Odontopediatría y ortopedia', 'Atención dental para niños y niñas.',           30),
  ('endodoncia',      'Endodoncia',            'Tratamiento de conducto para salvar la pieza.', 60),
  ('periodoncia',     'Periodoncia',           'Tratamiento de encías y soporte dental.',       45),
  ('cirugia',         'Cirugía oral',          'Extracciones y cordales incluidos.',            60),
  ('maxilofacial',    'Cirugía maxilofacial',  'Procedimientos de mayor complejidad.',          90),
  ('rehabilitacion',  'Rehabilitación oral',   'Coronas, puentes y prótesis.',                  60);

-- NOTA: el usuario administrador NO se inserta aquí, porque la
-- contraseña debe quedar cifrada con bcrypt. Se crea ejecutando
-- `npm run crear-admin` desde la carpeta backend.

-- ============================================================
--  Vista de apoyo: agenda completa para el panel administrativo
-- ============================================================
CREATE OR REPLACE VIEW v_agenda AS
SELECT
  c.id                AS cita_id,
  u.nombre_completo   AS paciente,
  u.telefono,
  u.correo,
  s.nombre            AS servicio,
  se.nombre           AS sede,
  f.fecha,
  f.hora_inicio,
  c.estado,
  c.creado_en
FROM citas c
JOIN usuarios         u ON u.id = c.paciente_id
JOIN servicios        s ON s.id = c.servicio_id
JOIN franjas_horarias f ON f.id = c.franja_id
JOIN sedes            se ON se.id = f.sede_id;
