-- ============================================================
--  Migración 007: perfil de los especialistas (16 de octubre de 2026)
--
--  La dueña (superadmin) crea y edita a los especialistas desde su
--  panel, con un perfil interno: título o cargo y foto. Nada de esto
--  se muestra a los pacientes.
--
--  La foto se guarda en la base (no como archivo) porque el servidor
--  publicado borra los archivos subidos en cada despliegue; así además
--  entra en los respaldos. El panel la reduce a 400×400 px antes de
--  subirla (unos 30–60 KB).
--
--  Para bases YA creadas que tienen aplicadas de la 001 a la 006.
--  Si creas la base desde cero con el schema.sql actual, NO la
--  necesitas. Ejecutar UNA sola vez.
-- ============================================================

SET NAMES utf8mb4;

USE arte_odontologico;

ALTER TABLE especialistas
  ADD COLUMN titulo         VARCHAR(120) NULL AFTER nombre,
  ADD COLUMN foto           MEDIUMBLOB   NULL AFTER titulo,
  ADD COLUMN foto_tipo      VARCHAR(20)  NULL AFTER foto,
  ADD COLUMN actualizado_en DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP AFTER creado_en;
