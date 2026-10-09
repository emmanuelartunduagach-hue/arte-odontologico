-- ============================================================
--  Arte Odontológico — Esquema de base de datos
--  Motor: MySQL 8.0+
--  Modelo relacional normalizado hasta 3FN.
-- ============================================================

-- Tildes y eñes correctas aunque el cliente use otra codificación.
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS arte_odontologico
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE arte_odontologico;

-- ------------------------------------------------------------
--  usuarios
--  Quienes inician sesión: la secretaria (rol administrador).
--  Los pacientes NO tienen usuario: están en `pacientes`. El
--  valor 'paciente' del rol se conserva solo por compatibilidad
--  con bases anteriores. En el boceto el rol se elegía desde un
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
  rol                 ENUM('paciente','administrador') NOT NULL DEFAULT 'administrador',
  activo              BOOLEAN       NOT NULL DEFAULT TRUE,
  -- TRUE mientras el usuario use la contraseña temporal que le dio el
  -- administrador; el frontend lo obliga a cambiarla al ingresar.
  debe_cambiar_contrasena BOOLEAN   NOT NULL DEFAULT FALSE,

  -- Ley 1581 de 2012: se debe poder demostrar cuándo y bajo qué
  -- versión de la política el titular autorizó el tratamiento.
  autorizacion_datos      BOOLEAN   NOT NULL DEFAULT FALSE,
  fecha_autorizacion      DATETIME  NULL,
  version_politica_datos  VARCHAR(10) NULL,
  autorizacion_registrada_por INT UNSIGNED NULL,  -- administrador que la recogió

  -- Administrador que creó este usuario (si aplica).
  creado_por          INT UNSIGNED  NULL,

  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_usuarios_correo    UNIQUE (correo),
  CONSTRAINT uq_usuarios_documento UNIQUE (documento),
  CONSTRAINT fk_usuario_creador    FOREIGN KEY (creado_por)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_usuario_autorizador FOREIGN KEY (autorizacion_registrada_por)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_usuarios_rol (rol)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  pacientes
--  Registro de cada paciente con su historia clínica. No tienen
--  usuario ni contraseña: gestionan su cita con el enlace que les
--  llega por WhatsApp. Se crean solos cuando la secretaria acepta
--  su primera cita pedida por la web, o los crea ella si llegan
--  en persona al consultorio.
-- ------------------------------------------------------------
CREATE TABLE pacientes (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre_completo     VARCHAR(120)  NOT NULL,
  documento           VARCHAR(20)   NOT NULL,
  telefono            VARCHAR(20)   NOT NULL,   -- con indicativo, ej. 573001234567
  correo              VARCHAR(160)  NOT NULL,   -- no es único: una madre puede usar el suyo para sus hijos
  origen              ENUM('web','consultorio') NOT NULL,

  -- Ley 1581 de 2012: cuándo y bajo qué versión de la política
  -- autorizó el tratamiento de sus datos.
  autorizacion_datos      BOOLEAN   NOT NULL DEFAULT TRUE,
  fecha_autorizacion      DATETIME  NULL,
  version_politica_datos  VARCHAR(10) NULL,

  creado_por          INT UNSIGNED  NULL,       -- secretaria que lo creó o aceptó su primera cita
  creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_pacientes_documento UNIQUE (documento),
  CONSTRAINT fk_paciente_creador FOREIGN KEY (creado_por)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_pacientes_nombre (nombre_completo)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  servicios (especialidades)
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
--  Hoy el consultorio atiende en una sola sede (Rivera). Se
--  conserva la tabla para no rehacer el modelo si abren otra.
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
--  especialistas
--  Odontólogos que atienden. No inician sesión: solo los
--  registra y administra la secretaria (rol administrador).
-- ------------------------------------------------------------
CREATE TABLE especialistas (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(120) NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Un especialista puede atender varias especialidades y una
-- especialidad tiene varios especialistas (muchos a muchos).
-- Las especialidades son las filas de `servicios`.
CREATE TABLE especialista_especialidad (
  especialista_id INT UNSIGNED NOT NULL,
  servicio_id     INT UNSIGNED NOT NULL,

  PRIMARY KEY (especialista_id, servicio_id),
  CONSTRAINT fk_ee_especialista FOREIGN KEY (especialista_id)
    REFERENCES especialistas(id) ON DELETE CASCADE,
  CONSTRAINT fk_ee_servicio FOREIGN KEY (servicio_id)
    REFERENCES servicios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  franjas_horarias
--  Horas publicadas a mano por la secretaria: cada fila es una
--  fecha + hora en la que un especialista puede atender.
--  `activa` = FALSE cuando la secretaria la quita (se conserva
--  si alguna cita antigua la referencia).
--  Si una franja está libre o no lo deciden las citas: está
--  ocupada cuando tiene una cita que no está cancelada.
-- ------------------------------------------------------------
CREATE TABLE franjas_horarias (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sede_id          INT UNSIGNED NOT NULL,
  especialista_id  INT UNSIGNED NOT NULL,
  fecha            DATE NOT NULL,
  hora_inicio      TIME NOT NULL,
  activa           BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por       INT UNSIGNED NOT NULL,
  creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Dos especialistas pueden atender a la misma hora, pero un
  -- especialista no puede tener la misma hora dos veces.
  CONSTRAINT uq_franja_especialista UNIQUE (especialista_id, fecha, hora_inicio),
  CONSTRAINT fk_franja_sede FOREIGN KEY (sede_id)
    REFERENCES sedes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_franja_especialista FOREIGN KEY (especialista_id)
    REFERENCES especialistas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_franja_admin FOREIGN KEY (creado_por)
    REFERENCES usuarios(id) ON DELETE RESTRICT,
  INDEX idx_franja_fecha (especialista_id, fecha, activa)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  citas
--  Cualquier persona pide su cita sin cuenta: se guardan aquí su
--  nombre, documento, teléfono y correo. La cita queda
--  'pendiente' hasta que la secretaria la acepta ('confirmada')
--  o la rechaza ('rechazada'). Al aceptarla se enlaza con el
--  paciente del mismo documento (`paciente_id`), que se crea si
--  no existía.
--
--  Sin doble reserva: `franja_ocupada` vale franja_id mientras
--  la cita no esté cancelada ni rechazada, y NULL si lo está.
--  Una cita pendiente ya aparta la hora. Su
--  índice único impide, a nivel de motor, que dos citas vivas
--  ocupen la misma hora aunque lleguen al mismo tiempo; al
--  cancelar o reprogramar, la hora queda libre sola.
-- ------------------------------------------------------------
CREATE TABLE citas (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id         INT UNSIGNED NULL,
  servicio_id         INT UNSIGNED NOT NULL,   -- especialidad
  franja_id           INT UNSIGNED NOT NULL,
  estado              ENUM('pendiente','confirmada','rechazada','cancelada','atendida','no_asistio')
                        NOT NULL DEFAULT 'pendiente',
  notas               VARCHAR(300) NULL,

  -- Datos de quien pide la cita
  nombre_paciente     VARCHAR(120) NOT NULL,
  documento_paciente  VARCHAR(20)  NOT NULL,
  telefono_paciente   VARCHAR(20)  NOT NULL,   -- con indicativo, ej. 573001234567
  correo_paciente     VARCHAR(160) NULL,       -- obligatorio al pedir la cita (NULL en citas antiguas)

  -- Ley 1581 de 2012: autorización dada al agendar
  autorizacion_datos      BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_autorizacion      DATETIME NULL,
  version_politica_datos  VARCHAR(10) NULL,

  -- Enlace "Gestionar mi cita": se guarda solo el hash SHA-256
  -- del código; el código en claro solo viaja en el enlace.
  codigo_gestion_hash CHAR(64) NULL,
  reprogramaciones    TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- las del paciente (máx. 1)
  cancelada_por       ENUM('paciente','administrador') NULL,
  confirmada_en       DATETIME NULL,           -- cuándo la aceptó la secretaria

  franja_ocupada INT UNSIGNED
    AS (IF(estado IN ('cancelada','rechazada'), NULL, franja_id)) STORED,

  creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT uq_cita_franja_ocupada UNIQUE (franja_ocupada),
  CONSTRAINT uq_cita_codigo UNIQUE (codigo_gestion_hash),
  CONSTRAINT fk_cita_paciente FOREIGN KEY (paciente_id)
    REFERENCES pacientes(id) ON DELETE SET NULL,
  CONSTRAINT fk_cita_servicio FOREIGN KEY (servicio_id)
    REFERENCES servicios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cita_franja   FOREIGN KEY (franja_id)
    REFERENCES franjas_horarias(id) ON DELETE RESTRICT,

  INDEX idx_citas_franja (franja_id),
  INDEX idx_citas_paciente (paciente_id, estado),
  INDEX idx_citas_estado (estado),
  INDEX idx_citas_documento (documento_paciente),
  INDEX idx_citas_telefono (telefono_paciente)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  notificaciones
--  Bitácora de cada mensaje. Guarda el texto para que, si el
--  envío automático no está disponible, la secretaria lo envíe
--  desde su WhatsApp Business con un clic (estado pendiente).
-- ------------------------------------------------------------
CREATE TABLE notificaciones (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  cita_id     INT UNSIGNED NOT NULL,
  canal       ENUM('correo','whatsapp') NOT NULL,
  tipo        ENUM('confirmacion','reprogramacion','recordatorio','cancelacion','rechazo') NOT NULL,
  estado      ENUM('pendiente','enviada','fallida') NOT NULL DEFAULT 'pendiente',
  destino     VARCHAR(160) NOT NULL,   -- número usado
  mensaje     TEXT NULL,               -- texto enviado o por enviar
  detalle     VARCHAR(500) NULL,       -- id del proveedor o error
  programada_para DATETIME NULL,       -- para recordatorios
  enviada_en  DATETIME NULL,
  creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notif_cita FOREIGN KEY (cita_id)
    REFERENCES citas(id) ON DELETE CASCADE,
  INDEX idx_notif_cita (cita_id, tipo),
  INDEX idx_notif_pendientes (estado, programada_para)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
--  historia_clinica
--  Entradas por paciente. No se
--  borran ni se sobrescriben (Resolución 1995 de 1999): una
--  corrección es una entrada nueva que apunta a la corregida.
-- ------------------------------------------------------------
CREATE TABLE historia_clinica (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id      INT UNSIGNED NOT NULL,
  fecha_atencion   DATE NOT NULL,
  servicio_id      INT UNSIGNED NULL,
  especialista_id  INT UNSIGNED NULL,
  cita_id          INT UNSIGNED NULL,
  procedimiento    VARCHAR(200) NOT NULL,
  notas            TEXT NULL,
  corrige_a        INT UNSIGNED NULL,
  creado_por       INT UNSIGNED NOT NULL,
  creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_hc_paciente FOREIGN KEY (paciente_id)
    REFERENCES pacientes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_hc_servicio FOREIGN KEY (servicio_id)
    REFERENCES servicios(id) ON DELETE SET NULL,
  CONSTRAINT fk_hc_especialista FOREIGN KEY (especialista_id)
    REFERENCES especialistas(id) ON DELETE SET NULL,
  CONSTRAINT fk_hc_cita FOREIGN KEY (cita_id)
    REFERENCES citas(id) ON DELETE SET NULL,
  CONSTRAINT fk_hc_corrige FOREIGN KEY (corrige_a)
    REFERENCES historia_clinica(id) ON DELETE RESTRICT,
  CONSTRAINT fk_hc_autor FOREIGN KEY (creado_por)
    REFERENCES usuarios(id) ON DELETE RESTRICT,
  INDEX idx_hc_paciente (paciente_id, fecha_atencion)
) ENGINE=InnoDB;

-- ============================================================
--  Datos iniciales
-- ============================================================

INSERT INTO sedes (nombre, direccion, ciudad, telefono) VALUES
  ('Rivera', 'Carrera 7 No. 3-61', 'Rivera', '3108120241');

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
-- Los especialistas tampoco: los registra la secretaria.

-- ============================================================
--  Vista de apoyo: agenda completa para el panel de la secretaria
-- ============================================================
CREATE OR REPLACE VIEW v_agenda AS
SELECT
  c.id                  AS cita_id,
  c.nombre_paciente     AS paciente,
  c.documento_paciente  AS documento,
  c.telefono_paciente   AS telefono,
  c.paciente_id,
  s.nombre              AS especialidad,
  e.nombre              AS especialista,
  se.nombre             AS sede,
  f.fecha,
  f.hora_inicio,
  c.estado,
  c.reprogramaciones,
  c.creado_en
FROM citas c
JOIN servicios        s  ON s.id  = c.servicio_id
JOIN franjas_horarias f  ON f.id  = c.franja_id
JOIN especialistas    e  ON e.id  = f.especialista_id
JOIN sedes            se ON se.id = f.sede_id;
