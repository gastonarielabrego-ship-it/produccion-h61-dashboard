/**
 * Create PostgreSQL schema on Neon for the H61 Production Dashboard
 * This replaces the Turso (SQLite) schema with proper PostgreSQL DDL
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_1Pu5tKnkvcpD@ep-orange-pond-awso2777-pooler.c-12.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

async function main() {
  console.log("🚀 Creating PostgreSQL schema on Neon...\n");
  
  const sql = neon(DATABASE_URL);

  // 1. production_records
  console.log("📋 Creating production_records table...");
  await sql`
    CREATE TABLE IF NOT EXISTS production_records (
      id          SERIAL PRIMARY KEY,
      funcion     TEXT    NOT NULL,
      funcion_desc TEXT   NOT NULL DEFAULT '',
      fecha       INTEGER NOT NULL,
      turno       TEXT    NOT NULL,
      turno_desc  TEXT    NOT NULL DEFAULT '',
      tarea       TEXT    DEFAULT '',
      operario    TEXT    NOT NULL,
      nombre      TEXT    NOT NULL DEFAULT '',
      actividad   INTEGER NOT NULL DEFAULT 0,
      circuito    TEXT    NOT NULL DEFAULT '',
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
    )
  `;
  console.log("  ✅ production_records created");

  // Indexes for production_records
  await sql`CREATE INDEX IF NOT EXISTS idx_fecha ON production_records(fecha)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_turno ON production_records(turno)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_circuito ON production_records(circuito)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_funcion ON production_records(funcion)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_operario ON production_records(operario)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_fecha_turno ON production_records(fecha, turno)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_fecha_circ ON production_records(fecha, circuito)`;
  console.log("  ✅ production_records indexes created");

  // 2. clarkistas_records
  console.log("📋 Creating clarkistas_records table...");
  await sql`
    CREATE TABLE IF NOT EXISTS clarkistas_records (
      id          SERIAL PRIMARY KEY,
      funcion     TEXT    NOT NULL,
      funcion_desc TEXT   NOT NULL DEFAULT '',
      fecha       INTEGER NOT NULL,
      turno       TEXT    NOT NULL,
      turno_desc  TEXT    NOT NULL DEFAULT '',
      tarea       TEXT    DEFAULT '',
      operario    TEXT    NOT NULL,
      nombre      TEXT    NOT NULL DEFAULT '',
      actividad   INTEGER NOT NULL DEFAULT 0,
      circuito    TEXT    NOT NULL DEFAULT '',
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
    )
  `;
  console.log("  ✅ clarkistas_records created");

  // 3. tiempos_muertos
  console.log("📋 Creating tiempos_muertos table...");
  await sql`
    CREATE TABLE IF NOT EXISTS tiempos_muertos (
      id          SERIAL PRIMARY KEY,
      fecha       INTEGER NOT NULL,
      turno       TEXT    NOT NULL,
      operario    TEXT    NOT NULL,
      nombre      TEXT    NOT NULL DEFAULT '',
      estado      TEXT    DEFAULT '',
      motivo      INTEGER DEFAULT NULL,
      minutos     INTEGER NOT NULL DEFAULT 0,
      observacion TEXT    DEFAULT '',
      usuario_alta TEXT   DEFAULT ''
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_tm_fecha ON tiempos_muertos(fecha)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tm_fecha_operario ON tiempos_muertos(fecha, operario)`;
  console.log("  ✅ tiempos_muertos created with indexes");

  // 4. nomina_override
  console.log("📋 Creating nomina_override table...");
  await sql`
    CREATE TABLE IF NOT EXISTS nomina_override (
      operario    TEXT PRIMARY KEY,
      nombre      TEXT    NOT NULL DEFAULT '',
      fecha_alta  TEXT    NOT NULL DEFAULT ''
    )
  `;
  console.log("  ✅ nomina_override created");

  // 5. errores_records
  console.log("📋 Creating errores_records table...");
  await sql`
    CREATE TABLE IF NOT EXISTS errores_records (
      id              SERIAL PRIMARY KEY,
      fecha_prep      INTEGER NOT NULL,
      fecha_ctrl      INTEGER NOT NULL,
      id_operario     TEXT    DEFAULT '',
      tipo_control    TEXT    DEFAULT '',
      controlador     TEXT    DEFAULT '',
      codigo_producto TEXT    DEFAULT '',
      producto        TEXT    DEFAULT '',
      errores         INTEGER DEFAULT 1,
      motivo          TEXT    DEFAULT ''
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_errores_fecha ON errores_records(fecha_prep)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_errores_controlador ON errores_records(controlador)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_errores_motivo ON errores_records(motivo)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_errores_tipo_ctrl ON errores_records(tipo_control)`;
  console.log("  ✅ errores_records created with indexes");

  // 6. rendimientos_records
  console.log("📋 Creating rendimientos_records table...");
  await sql`
    CREATE TABLE IF NOT EXISTS rendimientos_records (
      id          SERIAL PRIMARY KEY,
      nombre      TEXT    DEFAULT '',
      dia         TEXT    DEFAULT '',
      fecha       INTEGER DEFAULT NULL,
      bultos      INTEGER DEFAULT 0,
      hs_brutas   DOUBLE PRECISION DEFAULT 0,
      tm_hs       DOUBLE PRECISION DEFAULT 0,
      hs_netas    DOUBLE PRECISION DEFAULT 0,
      produccion  DOUBLE PRECISION DEFAULT 0,
      bh_bruta    DOUBLE PRECISION DEFAULT 0,
      bh_neta     DOUBLE PRECISION DEFAULT 0
    )
  `;
  console.log("  ✅ rendimientos_records created");

  // 7. horas_extras_records
  console.log("📋 Creating horas_extras_records table...");
  await sql`
    CREATE TABLE IF NOT EXISTS horas_extras_records (
      id              SERIAL PRIMARY KEY,
      cod_empleado    INTEGER DEFAULT NULL,
      empresa         TEXT    DEFAULT '',
      nombre          TEXT    DEFAULT '',
      sector          TEXT    DEFAULT '',
      fecha           INTEGER DEFAULT NULL,
      dia             TEXT    DEFAULT '',
      hs_trabajadas   INTEGER DEFAULT 0,
      hs_extras_50    INTEGER DEFAULT 0,
      hs_extras_100   INTEGER DEFAULT 0,
      hs_noct_100     INTEGER DEFAULT 0,
      hs_noc_trab     INTEGER DEFAULT 0,
      jornada         TEXT    DEFAULT ''
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_he_fecha ON horas_extras_records(fecha)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_he_nombre ON horas_extras_records(nombre)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_he_dia ON horas_extras_records(dia)`;
  console.log("  ✅ horas_extras_records created with indexes");

  console.log("\n✅ All tables and indexes created successfully on Neon!");
  
  // Verify by listing tables
  const tables = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
  `;
  console.log("\n📊 Tables in Neon database:");
  for (const t of tables) {
    console.log(`  - ${t.tablename}`);
  }
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
