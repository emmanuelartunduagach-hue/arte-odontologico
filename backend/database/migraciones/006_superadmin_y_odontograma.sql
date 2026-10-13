-- ============================================================
--  Migración 006: dueño (superadmin), correcciones con aprobación
--  y odontograma (13 de octubre de 2026)
--
--  1. Nuevo rol 'superadmin' para el dueño del consultorio: ve y
--     cambia todo, crea, edita y elimina administradores y aprueba
--     las correcciones a la historia clínica. Solo se crea con el
--     script `npm run superadmin` (clave especial del servidor).
--  2. Una corrección de la historia que pide un administrador queda
--     'pendiente' hasta que el dueño la apruebe ('vigente') o la
--     rechace ('rechazada'). Nada se borra: la fila rechazada queda
--     como registro, con quién la revisó y por qué.
--  3. Odontograma: hallazgos por diente (numeración FDI, adultos y
--     niños) y por cara. No se borran: anular uno lo pide un
--     administrador y lo aprueba el dueño.
--
--  Para bases YA creadas que tienen aplicadas de la 001 a la 005.
--  Si creas la base desde cero con el schema.sql actual, NO la
--  necesitas. Ejecutar UNA sola vez.
-- ============================================================

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
  -- Un hallazgo "por hacer" pasa a "realizado" una sola vez, con autor y fecha.
  realizado_por    INT UNSIGNED NULL,
  realizado_en     DATETIME     NULL,
  -- Anulación (si se registró por error): la pide un administrador
  -- y la decide el dueño. Mientras no se apruebe, el hallazgo sigue vigente.
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
