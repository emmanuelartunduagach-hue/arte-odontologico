-- Migración 005: las citas pedidas por la web quedan confirmadas
SET NAMES utf8mb4;

USE arte_odontologico;

ALTER TABLE citas
  ADD COLUMN origen ENUM('web','consultorio') NOT NULL DEFAULT 'web' AFTER estado;

UPDATE citas c
  JOIN pacientes p ON p.id = c.paciente_id
   SET c.origen = 'consultorio'
 WHERE p.origen = 'consultorio'
   AND c.confirmada_en IS NOT NULL
   AND ABS(TIMESTAMPDIFF(SECOND, c.creado_en, c.confirmada_en)) <= 5;

ALTER TABLE citas
  ALTER COLUMN estado SET DEFAULT 'confirmada';
