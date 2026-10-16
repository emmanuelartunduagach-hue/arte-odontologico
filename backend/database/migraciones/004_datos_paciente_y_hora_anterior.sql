-- Migración 004: datos completos del paciente y hora anterior
SET NAMES utf8mb4;

USE arte_odontologico;

ALTER TABLE pacientes
  ADD COLUMN nombres         VARCHAR(60)  NOT NULL DEFAULT '' AFTER id,
  ADD COLUMN apellidos       VARCHAR(60)  NOT NULL DEFAULT '' AFTER nombres,
  ADD COLUMN tipo_documento  ENUM('CC','TI','RC','CE','PA','PPT') NOT NULL DEFAULT 'CC' AFTER nombre_completo,
  ADD COLUMN telefono_fijo   VARCHAR(20)  NULL AFTER telefono,
  ADD COLUMN motivo_consulta VARCHAR(500) NULL AFTER origen;

UPDATE pacientes
   SET nombres = LEFT(IF(LENGTH(TRIM(nombre_completo)) - LENGTH(REPLACE(TRIM(nombre_completo), ' ', '')) >= 3,
                         SUBSTRING_INDEX(TRIM(nombre_completo), ' ', 2),
                         SUBSTRING_INDEX(TRIM(nombre_completo), ' ', 1)), 60),
       apellidos = LEFT(TRIM(SUBSTRING(TRIM(nombre_completo),
                         CHAR_LENGTH(IF(LENGTH(TRIM(nombre_completo)) - LENGTH(REPLACE(TRIM(nombre_completo), ' ', '')) >= 3,
                                        SUBSTRING_INDEX(TRIM(nombre_completo), ' ', 2),
                                        SUBSTRING_INDEX(TRIM(nombre_completo), ' ', 1))) + 1)), 60);

ALTER TABLE pacientes
  ALTER COLUMN nombres DROP DEFAULT,
  ALTER COLUMN apellidos DROP DEFAULT,
  MODIFY nombre_completo VARCHAR(121)
    AS (CONCAT_WS(' ', nombres, NULLIF(apellidos, ''))) STORED NOT NULL;

ALTER TABLE citas
  ADD COLUMN franja_anterior_id      INT UNSIGNED NULL AFTER franja_id,
  ADD COLUMN nombres_paciente        VARCHAR(60) NOT NULL DEFAULT '' AFTER notas,
  ADD COLUMN apellidos_paciente      VARCHAR(60) NOT NULL DEFAULT '' AFTER nombres_paciente,
  ADD COLUMN tipo_documento_paciente ENUM('CC','TI','RC','CE','PA','PPT') NOT NULL DEFAULT 'CC' AFTER nombre_paciente,
  ADD COLUMN telefono_fijo_paciente  VARCHAR(20) NULL AFTER telefono_paciente,
  ADD CONSTRAINT fk_cita_franja_anterior FOREIGN KEY (franja_anterior_id)
    REFERENCES franjas_horarias(id) ON DELETE SET NULL;

UPDATE citas
   SET nombres_paciente = LEFT(IF(LENGTH(TRIM(nombre_paciente)) - LENGTH(REPLACE(TRIM(nombre_paciente), ' ', '')) >= 3,
                                  SUBSTRING_INDEX(TRIM(nombre_paciente), ' ', 2),
                                  SUBSTRING_INDEX(TRIM(nombre_paciente), ' ', 1)), 60),
       apellidos_paciente = LEFT(TRIM(SUBSTRING(TRIM(nombre_paciente),
                                  CHAR_LENGTH(IF(LENGTH(TRIM(nombre_paciente)) - LENGTH(REPLACE(TRIM(nombre_paciente), ' ', '')) >= 3,
                                                 SUBSTRING_INDEX(TRIM(nombre_paciente), ' ', 2),
                                                 SUBSTRING_INDEX(TRIM(nombre_paciente), ' ', 1))) + 1)), 60);

ALTER TABLE citas
  ALTER COLUMN nombres_paciente DROP DEFAULT,
  ALTER COLUMN apellidos_paciente DROP DEFAULT,
  MODIFY nombre_paciente VARCHAR(121)
    AS (CONCAT_WS(' ', nombres_paciente, NULLIF(apellidos_paciente, ''))) STORED NOT NULL;
