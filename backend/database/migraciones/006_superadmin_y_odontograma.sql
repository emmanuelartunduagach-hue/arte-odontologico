-- Migración 006: dueño (superadmin), correcciones con aprobación
SET NAMES utf8mb4;

USE arte_odontologico;

ALTER TABLE usuarios
  MODIFY rol ENUM('paciente','administrador','superadmin') NOT NULL DEFAULT 'administrador';

ALTER TABLE historia_clinica
  ADD COLUMN estado ENUM('vigente','pendiente','rechazada') NOT NULL DEFAULT 'vigente' AFTER corrige_a,
  ADD COLUMN revisado_por   INT UNSIGNED NULL AFTER estado,
  ADD COLUMN revisado_en    DATETIME     NULL AFTER revisado_por,
  ADD COLUMN motivo_rechazo VARCHAR(300) NULL AFTER revisado_en,
  ADD CONSTRAINT fk_hc_revisor FOREIGN KEY (revisado_por)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD INDEX idx_hc_estado (estado);

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
