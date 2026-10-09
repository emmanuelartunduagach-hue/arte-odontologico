-- ============================================================
--  Migración 002: especialistas, franjas por especialista y
--  citas sin usuario (alcance v2, 6 de octubre de 2026)
--
--  Para bases YA creadas que tienen aplicada la migración 001.
--  Si creas la base desde cero con el schema.sql actual, NO la
--  necesitas: ya incluye todo esto.
--  Ejecutar UNA sola vez.
--
--  OJO: borra las franjas y citas de prueba que existan (en
--  desarrollo no hay datos reales). Los usuarios, servicios y
--  sedes se conservan.
-- ============================================================

-- Tildes y eñes correctas aunque el cliente use otra codificación.
SET NAMES utf8mb4;

USE arte_odontologico;

-- Datos de prueba que ya no encajan en el modelo nuevo
DELETE FROM notificaciones;
DELETE FROM citas;
DELETE FROM franjas_horarias;

-- ------------------------------------------------------------
--  Una sola sede: Rivera. Neiva se desactiva (no se borra).
-- ------------------------------------------------------------
UPDATE sedes SET activa = FALSE WHERE nombre = 'Neiva';

-- ------------------------------------------------------------
--  Especialistas y sus especialidades
-- ------------------------------------------------------------
CREATE TABLE especialistas (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre     VARCHAR(120) NOT NULL,
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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

-- ------------------------------------------------------------
--  Franjas: pasan a ser de un especialista
-- ------------------------------------------------------------
-- La llave foránea de la sede usaba el índice uq_franja: se le
-- da su propio índice antes de quitarlo.
ALTER TABLE franjas_horarias
  ADD INDEX fk_franja_sede (sede_id);

ALTER TABLE franjas_horarias
  DROP INDEX uq_franja,
  DROP INDEX idx_franja_fecha,
  CHANGE disponible activa BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN especialista_id INT UNSIGNED NOT NULL AFTER sede_id,
  ADD CONSTRAINT uq_franja_especialista UNIQUE (especialista_id, fecha, hora_inicio),
  ADD CONSTRAINT fk_franja_especialista FOREIGN KEY (especialista_id)
    REFERENCES especialistas(id) ON DELETE RESTRICT,
  ADD INDEX idx_franja_fecha (especialista_id, fecha, activa);

-- ------------------------------------------------------------
--  Citas: se puede agendar sin usuario
-- ------------------------------------------------------------
ALTER TABLE citas
  DROP FOREIGN KEY fk_cita_paciente,
  DROP FOREIGN KEY fk_cita_franja;

ALTER TABLE citas
  DROP INDEX uq_cita_franja,
  MODIFY paciente_id INT UNSIGNED NULL,
  MODIFY estado ENUM('pendiente','confirmada','cancelada','atendida','no_asistio')
    NOT NULL DEFAULT 'confirmada',
  ADD COLUMN nombre_paciente     VARCHAR(120) NOT NULL AFTER notas,
  ADD COLUMN documento_paciente  VARCHAR(20)  NOT NULL AFTER nombre_paciente,
  ADD COLUMN telefono_paciente   VARCHAR(20)  NOT NULL AFTER documento_paciente,
  ADD COLUMN correo_paciente     VARCHAR(160) NULL AFTER telefono_paciente,
  ADD COLUMN autorizacion_datos      BOOLEAN NOT NULL DEFAULT FALSE AFTER correo_paciente,
  ADD COLUMN fecha_autorizacion      DATETIME NULL AFTER autorizacion_datos,
  ADD COLUMN version_politica_datos  VARCHAR(10) NULL AFTER fecha_autorizacion,
  ADD COLUMN codigo_gestion_hash CHAR(64) NULL AFTER version_politica_datos,
  ADD COLUMN reprogramaciones    TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER codigo_gestion_hash,
  ADD COLUMN cancelada_por       ENUM('paciente','administrador') NULL AFTER reprogramaciones,
  ADD COLUMN franja_ocupada INT UNSIGNED
    AS (IF(estado = 'cancelada', NULL, franja_id)) STORED AFTER cancelada_por,
  ADD CONSTRAINT uq_cita_franja_ocupada UNIQUE (franja_ocupada),
  ADD CONSTRAINT uq_cita_codigo UNIQUE (codigo_gestion_hash),
  ADD INDEX idx_citas_franja (franja_id),
  ADD INDEX idx_citas_documento (documento_paciente),
  ADD INDEX idx_citas_telefono (telefono_paciente);

ALTER TABLE citas
  ADD CONSTRAINT fk_cita_paciente FOREIGN KEY (paciente_id)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_cita_franja FOREIGN KEY (franja_id)
    REFERENCES franjas_horarias(id) ON DELETE RESTRICT;

-- ------------------------------------------------------------
--  Notificaciones: se guarda el texto y se permiten varias del
--  mismo tipo (la secretaria puede reprogramar varias veces)
-- ------------------------------------------------------------
ALTER TABLE notificaciones
  DROP FOREIGN KEY fk_notif_cita;

ALTER TABLE notificaciones
  DROP INDEX uq_notif,
  MODIFY tipo ENUM('confirmacion','reprogramacion','recordatorio','cancelacion') NOT NULL,
  ADD COLUMN mensaje TEXT NULL AFTER destino,
  ADD INDEX idx_notif_cita (cita_id, tipo),
  ADD CONSTRAINT fk_notif_cita FOREIGN KEY (cita_id)
    REFERENCES citas(id) ON DELETE CASCADE;

-- ------------------------------------------------------------
--  Historia clínica
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
    REFERENCES usuarios(id) ON DELETE RESTRICT,
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

-- ------------------------------------------------------------
--  Vista de la agenda
-- ------------------------------------------------------------
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
