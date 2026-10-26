import { getClient } from "@/lib/neon";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// ─── Optimized chunked upload for nomina_eventuales (Neon PostgreSQL) ───
// Supports TWO insert modes:
//   action: "insert-parsed"  →  pre-mapped rows (browser already parsed columns)
//   action: "insert"         →  legacy raw rows (backward compat)

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

const UPSERT_SQL = `INSERT INTO nomina_eventuales (${COLS}) VALUES ` +
  `@PH ON CONFLICT (usuario) DO UPDATE SET nombre=EXCLUDED.nombre, jornada=EXCLUDED.jornada, perfil=EXCLUDED.perfil, sector=EXCLUDED.sector, activo=EXCLUDED.activo, fecha_alta=EXCLUDED.fecha_alta, fecha_baja=EXCLUDED.fecha_baja, motivo_baja=EXCLUDED.motivo_baja, dias_activos=EXCLUDED.dias_activos, anio=EXCLUDED.anio, nacimiento=EXCLUDED.nacimiento, edad=EXCLUDED.edad, primera_medicion=EXCLUDED.primera_medicion, codigo_empleado=EXCLUDED.codigo_empleado`;

async function handleDelete(): Promise<{ message: string }> {
  const client = getClient();
  const result = await client.execute("DELETE FROM nomina_eventuales");
  return { message: `${result.rowCount ?? "?"} registros previos eliminados` };
}

/**
 * FAST INSERT: pre-parsed rows from browser.
 * Each row is already a 15-element array matching the DB column order.
 * No header parsing needed — just build SQL and execute.
 */
async function handleInsertParsed(rows: (string | number | null)[][]): Promise<{ inserted: number; elapsed: string }> {
  const t0 = Date.now();
  if (!rows || rows.length === 0) throw new Error("No hay filas para insertar");

  const client = getClient();
  let inserted = 0;

  // Process in sub-batches of 100 to stay well under Vercel timeout
  const BATCH = 100;
  for (let start = 0; start < rows.length; start += BATCH) {
    const batch = rows.slice(start, start + BATCH);
    const { sql: ph, params: flat } = buildBatchInsert(NUM_COLS, batch as (string | number | null)[][]);
    await client.execute(UPSERT_SQL.replace("@PH", ph), flat);
    inserted += batch.length;
  }

  return { inserted, elapsed: `${((Date.now() - t0) / 1000).toFixed(1)}s` };
}

/**
 * LEGACY INSERT: raw Excel rows with header — kept for backward compat.
 * Browser sends [header, ...dataRows] and server maps columns.
 */
function getVal(row: (string | number | null | undefined)[], ci: number): number {
  if (ci < 0 || ci >= row.length) return 0;
  const v = row[ci];
  return v === null || v === undefined ? 0 : Number(v) || 0;
}

function getStr(row: (string | number | null | undefined)[], ci: number): string {
  if (ci < 0 || ci >= row.length) return "";
  const v = row[ci];
  return v === null || v === undefined ? "" : String(v).trim();
}

function parseDate(val: string): string {
  if (!val || val === "*") return "";
  const parts = val.split("/");
  if (parts.length !== 3) return val;
  return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
}

async function handleInsertLegacy(rows: (string | number | null | undefined)[][]): Promise<{ inserted: number; elapsed: string }> {
  const t0 = Date.now();
  if (!rows || rows.length < 2) throw new Error("Datos insuficientes para insertar");

  const header = rows[0].map((c) => String(c ?? "").toUpperCase().trim());
  const colIdx: Record<string, number> = {};
  header.forEach((h, i) => { colIdx[h] = i; });

  const codEmpCol = colIdx["CODIGO DE EMPLEADO"] ?? colIdx["CODIGO_EMPLEADO"] ?? -1;
  const nombreCol = colIdx["APELLIDOS, NOMBRE"] ?? colIdx["NOMBRE"] ?? colIdx["APELLIDOS NOMBRE"] ?? -1;
  const jornadaCol = colIdx["JORNADA"] ?? -1;
  const usuarioCol = colIdx["USUARIO"] ?? -1;
  const perfilCol = colIdx["PERFIL"] ?? -1;
  const sectorCol = colIdx["SECTOR"] ?? -1;
  const activoCol = colIdx["ACTIVO"] ?? -1;
  const fechaAltaCol = colIdx["DIAS"] ?? -1;
  const hoyCol = colIdx["HOY"] ?? -1;
  const fechaBajaCol = colIdx["FECHA DE BAJA"] ?? hoyCol ?? -1;
  const motivoBajaCol = colIdx["MOTIVO DE BAJA"] ?? -1;
  const anioCol = colIdx["AÑO"] ?? colIdx["ANIO"] ?? -1;
  const nacCol = colIdx["NACIMIENTO"] ?? -1;
  const edadCol = colIdx["EDAD"] ?? -1;
  const primMedCol = colIdx["PRIMERA MEDICION"] ?? colIdx["PRIMERA MEDICIÓN"] ?? -1;
  const diasActivosCol = colIdx["DIAS ACTIVOS"] ?? -1;

  if (usuarioCol < 0) {
    throw new Error(`Falta columna USUARIO. Encontradas: ${header.filter(Boolean).join(", ")}`);
  }

  const allArgs: (string | number | null)[][] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const usuario = getStr(row, usuarioCol);
    if (!usuario) continue;

    allArgs.push([
      getVal(row, codEmpCol) > 0 ? getVal(row, codEmpCol) : null,
      getStr(row, nombreCol),
      getStr(row, jornadaCol),
      usuario,
      getStr(row, perfilCol),
      getStr(row, sectorCol),
      getStr(row, activoCol),
      parseDate(getStr(row, fechaAltaCol)),
      parseDate(getStr(row, fechaBajaCol)),
      getStr(row, motivoBajaCol),
      getVal(row, diasActivosCol) > 0 ? getVal(row, diasActivosCol) : null,
      getVal(row, anioCol) > 0 ? getVal(row, anioCol) : null,
      parseDate(getStr(row, nacCol)),
      getVal(row, edadCol) > 0 ? getVal(row, edadCol) : null,
      parseDate(getStr(row, primMedCol)),
    ]);
  }

  if (allArgs.length === 0) throw new Error("No hay filas válidas en este bloque");

  const client = getClient();
  const CHUNK = 100;
  let inserted = 0;

  for (let start = 0; start < allArgs.length; start += CHUNK) {
    const batch = allArgs.slice(start, start + CHUNK);
    const { sql: ph, params: flat } = buildBatchInsert(NUM_COLS, batch);
    await client.execute(UPSERT_SQL.replace("@PH", ph), flat);
    inserted += batch.length;
  }

  return { inserted, elapsed: `${((Date.now() - t0) / 1000).toFixed(1)}s` };
}

export async function POST(request: Request) {
  const t0 = Date.now();
  try {
    const body = await request.json();
    const action = body.action;

    if (action === "delete") {
      const result = await handleDelete();
      return NextResponse.json({ ...result, elapsed: `${((Date.now() - t0) / 1000).toFixed(1)}s` });
    }

    if (action === "insert-parsed") {
      const result = await handleInsertParsed(body.rows);
      return NextResponse.json(result);
    }

    if (action === "insert") {
      const result = await handleInsertLegacy(body.rows);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Acción inválida. Usar: delete | insert | insert-parsed" }, { status: 400 });
  } catch (error: any) {
    console.error("Upload nomina error:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar", elapsed: `${((Date.now() - t0) / 1000).toFixed(1)}s` },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const client = getClient();
    const result = await client.execute("SELECT COUNT(*) as cnt FROM nomina_eventuales");
    return NextResponse.json({ ok: true, count: Number(result.rows[0]?.cnt ?? 0) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
