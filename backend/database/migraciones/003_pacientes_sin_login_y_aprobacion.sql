-- ============================================================
--  Migración 003: pacientes sin login y citas por aprobar
--  (9 de octubre de 2026)
--
--  - Los pacientes pasan a su propia tabla `pacientes`: son un
--    registro con su historia clínica, sin usuario ni contraseña.
--    En `usuarios` solo queda la secretaria (administrador).
--  - La cita pedida por la web queda 'pendiente' hasta que la
--    secretaria la acepte o la rechace ('rechazada').
--  - `confirmada_en`: cuándo se aceptó (para el recordatorio).
--  - Nuevo tipo de mensaje: 'rechazo'.
--
--  Para bases YA creadas que tienen aplicadas la 001 y la 002.
--  Si creas la base desde cero con el schema.sql actual, NO la
--  necesitas. Ejecutar UNA sola vez.
--
--  Conserva los datos: los pacientes que existían en `usuarios`
--  se copian a `pacientes` con el mismo id, así sus citas e
--  historia clínica siguen apuntando a ellos.
-- ============================================================

SET NAMES utf8mb4;

USE arte_odontologico;

-- ------------------------------------------------------------
--  Pacientes
-- ------------------------------------------------------------
CREATE TABLE pacientes (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre_completo     VARCHAR(120)  NOT NULL,
  documento           VARCHAR(20)   NOT NULL,
  telefono            VARCHAR(20)   NOT NULL,   -- con indicativo, ej. 573001234567
  correo              VARCHAR(160)  NOT NULL,   -- no es único: una madre puede usar el suyo para sus hijos
  origen              ENUM('web','consultorio') NOT NULL,

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

INSERT INTO pacientes
  (id, nombre_completo, documento, telefono, correo, origen,
   autorizacion_datos, fecha_autorizacion, version_politica_datos,
   creado_por, creado_en)
SELECT id, nombre_completo, documento, telefono, correo, 'consultorio',
       autorizacion_datos, fecha_autorizacion, version_politica_datos,
       creado_por, creado_en
  FROM usuarios WHERE rol = 'paciente';

-- Citas e historia clínica apuntan ahora a `pacientes`.
ALTER TABLE citas DROP FOREIGN KEY fk_cita_paciente;
ALTER TABLE citas
  ADD CONSTRAINT fk_cita_paciente FOREIGN KEY (paciente_id)
    REFERENCES pacientes(id) ON DELETE SET NULL;

ALTER TABLE historia_clinica DROP FOREIGN KEY fk_hc_paciente;
ALTER TABLE historia_clinica
  ADD CONSTRAINT fk_hc_paciente FOREIGN KEY (paciente_id)
    REFERENCES pacientes(id) ON DELETE RESTRICT;

-- Las cuentas de paciente dejan de existir.
DELETE FROM usuarios WHERE rol = 'paciente';
ALTER TABLE usuarios
  MODIFY rol ENUM('paciente','administrador') NOT NULL DEFAULT 'administrador';

-- ------------------------------------------------------------
--  Citas: pendiente → confirmada o rechazada
-- ------------------------------------------------------------
ALTER TABLE citas
  MODIFY estado ENUM('pendiente','confirmada','rechazada','cancelada','atendida','no_asistio')
    NOT NULL DEFAULT 'pendiente';

-- Una cita rechazada libera la hora, igual que una cancelada.
ALTER TABLE citas
  MODIFY franja_ocupada INT UNSIGNED
    AS (IF(estado IN ('cancelada','rechazada'), NULL, franja_id)) STORED;

ALTER TABLE citas
  ADD COLUMN confirmada_en DATETIME NULL AFTER cancelada_por;

UPDATE citas SET confirmada_en = creado_en WHERE estado <> 'pendiente';

-- ------------------------------------------------------------
--  Mensajes
-- ------------------------------------------------------------
ALTER TABLE notificaciones
  MODIFY tipo ENUM('confirmacion','reprogramacion','recordatorio','cancelacion','rechazo') NOT NULL;
