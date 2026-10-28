-- Performance indexes for production H61 dashboard (Neon PostgreSQL)
-- Safe to run multiple times (IF NOT EXISTS)

-- clarkistas_records: only had PK(id) — every filtered query was a seq scan
CREATE INDEX IF NOT EXISTS idx_clark_fecha        ON clarkistas_records(fecha);
CREATE INDEX IF NOT EXISTS idx_clark_fecha_turno  ON clarkistas_records(fecha, turno);
CREATE INDEX IF NOT EXISTS idx_clark_operario     ON clarkistas_records(operario);
CREATE INDEX IF NOT EXISTS idx_clark_circuito     ON clarkistas_records(circuito);

-- tiempos_muertos: routes filter by operario without date range (RRHH full history)
CREATE INDEX IF NOT EXISTS idx_tm_operario        ON tiempos_muertos(operario);
