-- Migración 007: perfil de los especialistas (16 de octubre de 2026)
SET NAMES utf8mb4;

USE arte_odontologico;

ALTER TABLE especialistas
  ADD COLUMN titulo         VARCHAR(120) NULL AFTER nombre,
  ADD COLUMN foto           MEDIUMBLOB   NULL AFTER titulo,
  ADD COLUMN foto_tipo      VARCHAR(20)  NULL AFTER foto,
  ADD COLUMN actualizado_en DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP AFTER creado_en;
