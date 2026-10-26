// End-to-end test: parse the real nomina Excel and insert into Neon DB
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: "postgresql://neondb_owner:npg_1Pu5tKnkvcpD@ep-orange-pond-awso2777-pooler.c-12.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
  ssl: { rejectUnauthorized: false },
});

const COLS = "codigo_empleado, nombre, jornada, usuario, perfil, sector, activo, fecha_alta, fecha_baja, motivo_baja, dias_activos, anio, nacimiento, edad, primera_medicion";
const NUM_COLS = 15;

function buildBatchInsert(cols: number, batch: (string | number | null)[][]): { sql: string; params: (string | number | null)[] } {
  const pgPhArr: string[] = [];
  const pgFlat: (string | number | null)[] = [];
  for (let j = 0; j < batch.length; j++) {
    const rowPh = batch[j].map((_, k) => `$${j * cols + k + 1}`).join(",");
    pgPhArr.push(`(${rowPh})`);
    for (let k = 0; k < batch[j].length; k++) pgFlat.push(batch[j][k]);
  }
  return { sql: pgPhArr.join(", "), params: pgFlat };
}

const UPSERT_SQL = `INSERT INTO nomina_eventuales (${COLS}) VALUES @PH ON CONFLICT (usuario) DO UPDATE SET nombre=EXCLUDED.nombre, jornada=EXCLUDED.jornada, perfil=EXCLUDED.perfil, sector=EXCLUDED.sector, activo=EXCLUDED.activo, fecha_alta=EXCLUDED.fecha_alta, fecha_baja=EXCLUDED.fecha_baja, motivo_baja=EXCLUDED.motivo_baja, dias_activos=EXCLUDED.dias_activos, anio=EXCLUDED.anio, nacimiento=EXCLUDED.nacimiento, edad=EXCLUDED.edad, primera_medicion=EXCLUDED.primera_medicion, codigo_empleado=EXCLUDED.codigo_empleado`;

async function main() {
  // Parse Excel
  const buf = fs.readFileSync('upload/NOMINA EVENTUALES.xlsx');
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const header = allRows[0].map((c: any) => String(c ?? '').toUpperCase().trim());
  const colIdx: Record<string, number> = {};
  header.forEach((h: string, i: number) => { colIdx[h] = i; });

  const getStr = (row: any[], ci: number): string => {
    if (ci < 0 || ci >= row.length) return '';
    const v = row[ci];
    return v === null || v === undefined ? '' : String(v).trim();
  };
  const getVal = (row: any[], ci: number): number => {
    if (ci < 0 || ci >= row.length) return 0;
    const v = row[ci];
    return v === null || v === undefined ? 0 : Number(v) || 0;
  };
  const parseDate = (val: string): string => {
    if (!val || val === '*') return '';
    const parts = val.split('/');
    if (parts.length !== 3) return val;
    return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
  };

  const codEmpCol = colIdx["CÓDIGO DE EMPLEADO"] ?? colIdx["CODIGO DE EMPLEADO"] ?? colIdx["CODIGO_EMPLEADO"] ?? -1;
  const nombreCol = colIdx["APELLIDOS, NOMBRE"] ?? colIdx["NOMBRE"] ?? -1;
  const jornadaCol = colIdx["JORNADA"] ?? -1;
  const usuarioCol = colIdx["USUARIO"] ?? -1;
  const perfilCol = colIdx["PERFIL"] ?? -1;
  const sectorCol = colIdx["SECTOR"] ?? -1;
  const activoCol = colIdx["ACTIVO"] ?? -1;
  const fechaAltaCol = colIdx["DÍAS"] ?? colIdx["DIAS"] ?? -1;
  const hoyCol = colIdx["HOY"] ?? -1;
  const fechaBajaCol = colIdx["FECHA DE BAJA"] ?? hoyCol ?? -1;
  const motivoBajaCol = colIdx["MOTIVO DE BAJA"] ?? -1;
  const anioCol = colIdx["AÑO"] ?? colIdx["ANIO"] ?? -1;
  const nacCol = colIdx["NACIMIENTO"] ?? colIdx["NACIMIENTO "] ?? -1;
  const edadCol = colIdx["EDAD"] ?? -1;
  const primMedCol = colIdx["PRIMERA MEDICION"] ?? colIdx["PRIMERA MEDICIÓN"] ?? -1;
  const diasActivosCol = colIdx["DIAS ACTIVOS"] ?? -1;

  const dataRows = allRows.slice(1);
  const mappedRows: (string | number | null)[][] = [];

  for (const row of dataRows) {
    const usuario = getStr(row, usuarioCol);
    if (!usuario) continue;
    const codigoEmpleado = getVal(row, codEmpCol);
    const diasActivos = getVal(row, diasActivosCol);
    const anio = getVal(row, anioCol);
    const edad = getVal(row, edadCol);
    mappedRows.push([
      codigoEmpleado > 0 ? codigoEmpleado : 0,
      getStr(row, nombreCol), getStr(row, jornadaCol), usuario,
      getStr(row, perfilCol), getStr(row, sectorCol), getStr(row, activoCol),
      parseDate(getStr(row, fechaAltaCol)), parseDate(getStr(row, fechaBajaCol)),
      getStr(row, motivoBajaCol),
      diasActivos > 0 ? diasActivos : 0,
      anio > 0 ? anio : 0,
      parseDate(getStr(row, nacCol)),
      edad > 0 ? Math.round(edad) : 0,
      parseDate(getStr(row, primMedCol)),
    ]);
  }

  console.log("Mapped rows:", mappedRows.length);
  console.log("Sample:", JSON.stringify(mappedRows[0]));

  // Step 1: Delete all
  console.log("\nStep 1: DELETE all");
  const t1 = Date.now();
  await pool.query("DELETE FROM nomina_eventuales");
  console.log("  Deleted in", Date.now() - t1, "ms");

  // Step 2: Insert in chunks of 50
  console.log("\nStep 2: INSERT in chunks of 50");
  const CHUNK = 50;
  const totalChunks = Math.ceil(mappedRows.length / CHUNK);
  let totalInserted = 0;

  for (let c = 0; c < totalChunks; c++) {
    const start = c * CHUNK;
    const end = Math.min(start + CHUNK, mappedRows.length);
    const batch = mappedRows.slice(start, end);

    const { sql: ph, params: flat } = buildBatchInsert(NUM_COLS, batch as (string | number | null)[][]);
    const t = Date.now();
    await pool.query(UPSERT_SQL.replace("@PH", ph), flat);
    console.log(`  Chunk ${c + 1}/${totalChunks}: ${end - start} rows in ${Date.now() - t}ms`);
    totalInserted += batch.length;
  }

  console.log("\nTotal inserted:", totalInserted);

  // Step 3: Verify
  const count = await pool.query("SELECT COUNT(*) as cnt FROM nomina_eventuales");
  console.log("DB count:", count.rows[0].cnt);

  // Step 4: Show some data
  const sample = await pool.query("SELECT usuario, nombre, jornada, perfil, activo, dias_activos FROM nomina_eventuales LIMIT 5");
  console.log("\nSample rows:");
  sample.rows.forEach((r: any) => console.log(" ", r.usuario, r.nombre, r.jornada, r.perfil, r.activo, r.dias_activos));

  await pool.end();
}

main().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
