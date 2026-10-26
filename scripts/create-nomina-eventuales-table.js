/**
 * Create nomina_eventuales table in Neon PostgreSQL
 * Run: node scripts/create-nomina-eventuales-table.js
 */
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = "postgresql://neondb_owner:npg_1Pu5tKnkvcpD@ep-orange-pond-awso2777-pooler.c-12.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

async function main() {
  console.log("Creating nomina_eventuales table...");
  const sql = neon(DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS nomina_eventuales (
      codigo_empleado  INTEGER NOT NULL,
      nombre           TEXT NOT NULL DEFAULT '',
      jornada          TEXT NOT NULL DEFAULT '',
      usuario          TEXT PRIMARY KEY,
      perfil           TEXT NOT NULL DEFAULT '',
      sector           TEXT NOT NULL DEFAULT '',
      activo           TEXT NOT NULL DEFAULT '',
      fecha_alta       TEXT NOT NULL DEFAULT '',
      fecha_baja       TEXT NOT NULL DEFAULT '',
      motivo_baja      TEXT NOT NULL DEFAULT '',
      dias_activos     INTEGER NOT NULL DEFAULT 0,
      anio             INTEGER NOT NULL DEFAULT 0,
      nacimiento       TEXT NOT NULL DEFAULT '',
      edad             INTEGER NOT NULL DEFAULT 0,
      primera_medicion TEXT NOT NULL DEFAULT ''
    )
  `;

  console.log("✓ nomina_eventuales table created/verified");

  const result = await sql`SELECT COUNT(*) as cnt FROM nomina_eventuales`;
  console.log(`Current rows: ${result[0].cnt}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
