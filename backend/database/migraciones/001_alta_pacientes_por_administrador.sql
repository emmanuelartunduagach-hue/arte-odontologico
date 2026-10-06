-- ============================================================
--  Migración 001: alta de pacientes por el administrador
--  Para bases YA creadas con el schema.sql anterior.
--  Si creas la base desde cero con el schema.sql actual, NO la
--  necesitas: ya incluye estas columnas.
--  Ejecutar UNA sola vez (MySQL no repite ADD COLUMN sin error).
-- ============================================================

-- Tildes y eñes correctas aunque el cliente use otra codificación.
SET NAMES utf8mb4;

USE arte_odontologico;

ALTER TABLE usuarios
  ADD COLUMN debe_cambiar_contrasena BOOLEAN NOT NULL DEFAULT FALSE AFTER activo,
  ADD COLUMN autorizacion_registrada_por INT UNSIGNED NULL AFTER version_politica_datos,
  ADD COLUMN creado_por INT UNSIGNED NULL AFTER autorizacion_registrada_por,
  ADD CONSTRAINT fk_usuario_creador FOREIGN KEY (creado_por)
    REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_usuario_autorizador FOREIGN KEY (autorizacion_registrada_por)
    REFERENCES usuarios(id) ON DELETE SET NULL;
