-- ============================================================
--  Migración 005: las citas pedidas por la web quedan confirmadas
--  (9 de octubre de 2026)
--
--  La secretaria ya no aprueba las citas: al pedirla, la cita queda
--  confirmada, se crea o enlaza la ficha del paciente y le llega el
--  WhatsApp. Para que el panel muestre "Novedades de la web", cada
--  cita guarda de dónde vino (`origen`).
--
--  Para bases YA creadas que tienen aplicadas de la 001 a la 004.
--  Si creas la base desde cero con el schema.sql actual, NO la
--  necesitas. Ejecutar UNA sola vez.
--
--  Las citas existentes se marcan como 'web', salvo las de pacientes
--  registrados en el consultorio que quedaron confirmadas en el mismo
--  momento de crearse (las agendó la secretaria). Las que estén
--  pendientes siguen así: se aceptan o rechazan desde la Agenda.
-- ============================================================

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
