SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS arte_odontologico
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE arte_odontologico;

CREATE TABLE usuarios (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre_completo     VARCHAR(120)  NOT NULL,
  documento           VARCHAR(20)   NOT NULL,
  correo              VARCHAR(160)  NOT NULL,
  telefono            VARCHAR(20)   NOT NULL,
  contrasena_hash     VARCHAR(255)  NOT NULL,  -- bcrypt, nunca texto plano
  rol                 ENUM('paciente','administrador','superadmin') NOT NULL DEFAULT 'administrador',
  activo              BOOLEAN       NOT NULL DEFAULT TRUE,
  debe_cambiar_contrasena BOOLEAN   NOT NULL DEFAULT FALSE,

  autorizacion_datos      BOOLEAN   NOT NULL DEFAULT FALSE,
  fecha_autorizacion      DATETIME  NULL,
  version_politica_datos  VARCHAR(10) NULL,
  autorizacion_registrada_por INT UNSIGNED NULL,  -- administrador que la recogió

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

CREATE TABLE pacientes (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombres             VARCHAR(60)   NOT NULL,
  apellidos           VARCHAR(60)   NOT NULL,
  nombre_completo     VARCHAR(121)
    AS (CONCAT_WS(' ', nombres, NULLIF(apellidos, ''))) STORED NOT NULL,
  tipo_documento      ENUM('CC','TI','RC','CE','PA','PPT') NOT NULL DEFAULT 'CC',
  documento           VARCHAR(20)   NOT NULL,
  telefono            VARCHAR(20)   NOT NULL,   -- celular (WhatsApp) con indicativo, ej. 573001234567
  telefono_fijo       VARCHAR(20)   NULL,       -- opcional
  correo              VARCHAR(160)  NOT NULL,   -- no es único: una madre puede usar el suyo para sus hijos
  origen              ENUM('web','consultorio') NOT NULL,
  motivo_consulta     VARCHAR(500)  NULL,       -- a qué vino, si se registró en el consultorio

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

CREATE TABLE servicios (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo           VARCHAR(40)  NOT NULL,
  nombre           VARCHAR(120) NOT NULL,
  descripcion      VARCHAR(255) NULL,
  duracion_minutos SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  activo           BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_servicios_codigo UNIQUE (codigo)
) ENGINE=InnoDB;

CREATE TABLE sedes (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(60)  NOT NULL,
  direccion  VARCHAR(160) NOT NULL,
  ciudad     VARCHAR(60)  NOT NULL,
  telefono   VARCHAR(20)  NULL,
  activa     BOOLEAN NOT NULL DEFAULT TRUE,

  CONSTRAINT uq_sedes_nombre UNIQUE (nombre)
) ENGINE=InnoDB;

CREATE TABLE especialistas (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre         VARCHAR(120) NOT NULL,
  titulo         VARCHAR(120) NULL,
  foto           MEDIUMBLOB   NULL,
  foto_tipo      VARCHAR(20)  NULL,
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE especialista_especialidad (
  especialista_id INT UNSIGNED NOT NULL,
  servicio_id     INT UNSIGNED NOT NULL,

  PRIMARY KEY (especialista_id, servicio_id),
  CONSTRAINT fk_ee_especialista FOREIGN KEY (especialista_id)
    REFERENCES especialistas(id) ON DELETE CASCADE,
  CONSTRAINT fk_ee_servicio FOREIGN KEY (servicio_id)
    REFERENCES servicios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE franjas_horarias (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sede_id          INT UNSIGNED NOT NULL,
  especialista_id  INT UNSIGNED NOT NULL,
  fecha            DATE NOT NULL,
  hora_inicio      TIME NOT NULL,
  activa           BOOLEAN NOT NULL DEFAULT TRUE,
  creado_por       INT UNSIGNED NOT NULL,
  creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT uq_franja_especialista UNIQUE (especialista_id, fecha, hora_inicio),
  CONSTRAINT fk_franja_sede FOREIGN KEY (sede_id)
    REFERENCES sedes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_franja_especialista FOREIGN KEY (especialista_id)
    REFERENCES especialistas(id) ON DELETE RESTRICT,
  CONSTRAINT fk_franja_admin FOREIGN KEY (creado_por)
    REFERENCES usuarios(id) ON DELETE RESTRICT,
  INDEX idx_franja_fecha (especialista_id, fecha, activa)
) ENGINE=InnoDB;

CREATE TABLE citas (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id         INT UNSIGNED NULL,
  servicio_id         INT UNSIGNED NOT NULL,   -- especialidad
  franja_id           INT UNSIGNED NOT NULL,
  franja_anterior_id  INT UNSIGNED NULL,       -- hora que tenía antes de que el paciente la reprogramara
  estado              ENUM('pendiente','confirmada','rechazada','cancelada','atendida','no_asistio')
                        NOT NULL DEFAULT 'confirmada',
  origen              ENUM('web','consultorio') NOT NULL DEFAULT 'web',  -- quién la agendó
  notas               VARCHAR(300) NULL,

  nombres_paciente    VARCHAR(60)  NOT NULL,
  apellidos_paciente  VARCHAR(60)  NOT NULL,
  nombre_paciente     VARCHAR(121)
    AS (CONCAT_WS(' ', nombres_paciente, NULLIF(apellidos_paciente, ''))) STORED NOT NULL,
  tipo_documento_paciente ENUM('CC','TI','RC','CE','PA','PPT') NOT NULL DEFAULT 'CC',
  documento_paciente  VARCHAR(20)  NOT NULL,
  telefono_paciente   VARCHAR(20)  NOT NULL,   -- celular con indicativo, ej. 573001234567
  telefono_fijo_paciente VARCHAR(20) NULL,
  correo_paciente     VARCHAR(160) NULL,       -- obligatorio al pedir la cita (NULL en citas antiguas)

  autorizacion_datos      BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_autorizacion      DATETIME NULL,
  version_politica_datos  VARCHAR(10) NULL,

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
  CONSTRAINT fk_cita_franja_anterior FOREIGN KEY (franja_anterior_id)
    REFERENCES franjas_horarias(id) ON DELETE SET NULL,

  INDEX idx_citas_franja (franja_id),
  INDEX idx_citas_paciente (paciente_id, estado),
  INDEX idx_citas_estado (estado),
  INDEX idx_citas_documento (documento_paciente),
  INDEX idx_citas_telefono (telefono_paciente)
) ENGINE=InnoDB;

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
  estado           ENUM('vigente','pendiente','rechazada') NOT NULL DEFAULT 'vigente',
  revisado_por     INT UNSIGNED NULL,
  revisado_en      DATETIME     NULL,
  motivo_rechazo   VARCHAR(300) NULL,
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
  CONSTRAINT fk_hc_revisor FOREIGN KEY (revisado_por)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_hc_estado (estado),
  INDEX idx_hc_paciente (paciente_id, fecha_atencion)
) ENGINE=InnoDB;

CREATE TABLE odontograma (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  paciente_id      INT UNSIGNED NOT NULL,
  diente           TINYINT UNSIGNED NOT NULL,   -- FDI: 11–48 permanentes, 51–85 temporales
  cara             ENUM('completo','oclusal','mesial','distal','vestibular','lingual') NOT NULL,
  hallazgo         VARCHAR(20)  NOT NULL,       -- código del catálogo (odontograma.controller.js)
  estado           ENUM('por_hacer','realizado') NOT NULL,
  notas            VARCHAR(500) NULL,
  creado_por       INT UNSIGNED NOT NULL,
  creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  realizado_por    INT UNSIGNED NULL,
  realizado_en     DATETIME     NULL,
  anulacion             ENUM('pendiente','aprobada','rechazada') NULL,
  anulacion_motivo      VARCHAR(300) NULL,
  anulacion_pedida_por  INT UNSIGNED NULL,
  anulacion_pedida_en   DATETIME     NULL,
  anulacion_revisada_por INT UNSIGNED NULL,
  anulacion_revisada_en  DATETIME    NULL,
  anulacion_rechazo     VARCHAR(300) NULL,

  CONSTRAINT fk_odo_paciente FOREIGN KEY (paciente_id)
    REFERENCES pacientes(id) ON DELETE RESTRICT,
  CONSTRAINT fk_odo_autor FOREIGN KEY (creado_por)
    REFERENCES usuarios(id) ON DELETE RESTRICT,
  CONSTRAINT fk_odo_realizo FOREIGN KEY (realizado_por)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_odo_pidio FOREIGN KEY (anulacion_pedida_por)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  CONSTRAINT fk_odo_reviso FOREIGN KEY (anulacion_revisada_por)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_odo_paciente (paciente_id, diente),
  INDEX idx_odo_anulacion (anulacion)
) ENGINE=InnoDB;

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
