-- Producción H61 - Schema para Turso (libSQL / SQLite)
-- Ejecutar con: turso db shell <nombre-db> < schema.sql
-- O desde el script de seed

CREATE TABLE IF NOT EXISTS production_records (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  funcion     TEXT    NOT NULL,
  funcion_desc TEXT   NOT NULL,
  fecha       INTEGER NOT NULL,
  turno       TEXT    NOT NULL,
  turno_desc  TEXT    NOT NULL,
  tarea       TEXT,
  operario    TEXT    NOT NULL,
  nombre      TEXT    NOT NULL,
  actividad   INTEGER NOT NULL DEFAULT 0,
  circuito    TEXT    NOT NULL,
  tiempo_mue  INTEGER NOT NULL DEFAULT 0,
  hora_00     INTEGER NOT NULL DEFAULT 0,
  hora_01     INTEGER NOT NULL DEFAULT 0,
  hora_02     INTEGER NOT NULL DEFAULT 0,
  hora_03     INTEGER NOT NULL DEFAULT 0,
  hora_04     INTEGER NOT NULL DEFAULT 0,
  hora_05     INTEGER NOT NULL DEFAULT 0,
  hora_06     INTEGER NOT NULL DEFAULT 0,
  hora_07     INTEGER NOT NULL DEFAULT 0,
  hora_08     INTEGER NOT NULL DEFAULT 0,
  hora_09     INTEGER NOT NULL DEFAULT 0,
  hora_10     INTEGER NOT NULL DEFAULT 0,
  hora_11     INTEGER NOT NULL DEFAULT 0,
  hora_12     INTEGER NOT NULL DEFAULT 0,
  hora_13     INTEGER NOT NULL DEFAULT 0,
  hora_14     INTEGER NOT NULL DEFAULT 0,
  hora_15     INTEGER NOT NULL DEFAULT 0,
  hora_16     INTEGER NOT NULL DEFAULT 0,
  hora_17     INTEGER NOT NULL DEFAULT 0,
  hora_18     INTEGER NOT NULL DEFAULT 0,
  hora_19     INTEGER NOT NULL DEFAULT 0,
  hora_20     INTEGER NOT NULL DEFAULT 0,
  hora_21     INTEGER NOT NULL DEFAULT 0,
  hora_22     INTEGER NOT NULL DEFAULT 0,
  hora_23     INTEGER NOT NULL DEFAULT 0,
  total       INTEGER NOT NULL DEFAULT 0
);

-- Indexes para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_fecha       ON production_records(fecha);
CREATE INDEX IF NOT EXISTS idx_turno       ON production_records(turno);
CREATE INDEX IF NOT EXISTS idx_circuito    ON production_records(circuito);
CREATE INDEX IF NOT EXISTS idx_funcion     ON production_records(funcion);
CREATE INDEX IF NOT EXISTS idx_operario    ON production_records(operario);
CREATE INDEX IF NOT EXISTS idx_fecha_turno ON production_records(fecha, turno);
CREATE INDEX IF NOT EXISTS idx_fecha_circ  ON production_records(fecha, circuito);