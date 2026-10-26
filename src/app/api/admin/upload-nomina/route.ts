import { getClient } from "@/lib/neon";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// ─── Chunked upload for nomina_eventuales (Neon PostgreSQL) ───

const COLS = "codigo_empleado, nombre, jornada, usuario, perfil, sector, activo, fecha_alta, fecha_baja, motivo_baja, dias_activos, anio, nacimiento, edad, primera_medicion";
const NUM_COLS = 15;

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

// Parse date like "2025/5/5" to "2025-05-05"
function parseDate(val: string): string {
  if (!val || val === "*") return "";
  const parts = val.split("/");
  if (parts.length !== 3) return val;
  return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
}

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

async function handleDelete(): Promise<{ message: string }> {
  const client = getClient();
  const result = await client.execute("DELETE FROM nomina_eventuales");
  return { message: `${result.rowCount ?? "?"} registros previos eliminados` };
}

async function handleInsert(rows: (string | number | null | undefined)[][]): Promise<{ inserted: number; elapsed: string }> {
  const t0 = Date.now();
  if (!rows || rows.length < 2) throw new Error("Datos insuficientes para insertar");

  const header = rows[0].map((c) => String(c ?? "").toUpperCase().trim());

  // Map header names to indices — handle various column name formats
  const colIdx: Record<string, number> = {};
  header.forEach((h, i) => { colIdx[h] = i; });

  // Known column name variations
  const codEmpCol = colIdx["CODIGO DE EMPLEADO"] ?? colIdx["CODIGO_EMPLEADO"] ?? -1;
  const nombreCol = colIdx["APELLIDOS, NOMBRE"] ?? colIdx["NOMBRE"] ?? colIdx["APELLIDOS NOMBRE"] ?? -1;
  const jornadaCol = colIdx["JORNADA"] ?? -1;
  const usuarioCol = colIdx["USUARIO"] ?? -1;
  const perfilCol = colIdx["PERFIL"] ?? -1;
  const sectorCol = colIdx["SECTOR"] ?? -1;
  const activoCol = colIdx["ACTIVO"] ?? -1;
  const diasCol = colIdx["DIAS"] ?? colIdx["DIAS ACTIVOS"] ?? -1;
  const fechaAltaCol = colIdx["DIAS"] ?? -1; // "Días" column is actually start date
  const hoyCol = colIdx["HOY"] ?? -1;  // HOY is actually the end/baja date
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

    const codigoEmpleado = getVal(row, codEmpCol);
    const nombre = getStr(row, nombreCol);
    const jornada = getStr(row, jornadaCol);
    const perfil = getStr(row, perfilCol);
    const sector = getStr(row, sectorCol);
    const activo = getStr(row, activoCol);
    const fechaAlta = parseDate(getStr(row, fechaAltaCol));
    const fechaBaja = parseDate(getStr(row, fechaBajaCol));
    const motivoBaja = getStr(row, motivoBajaCol);
    const diasActivos = getVal(row, diasActivosCol);
    const anio = getVal(row, anioCol);
    const nacimiento = parseDate(getStr(row, nacCol));
    const edad = getVal(row, edadCol);
    const primeraMedicion = parseDate(getStr(row, primMedCol));

    allArgs.push([
      codigoEmpleado > 0 ? codigoEmpleado : null,
      nombre,
      jornada,
      usuario,
      perfil,
      sector,
      activo,
      fechaAlta,
      fechaBaja,
      motivoBaja,
      diasActivos > 0 ? diasActivos : null,
      anio > 0 ? anio : null,
      nacimiento,
      edad > 0 ? edad : null,
      primeraMedicion,
    ]);
  }

  if (allArgs.length === 0) throw new Error("No hay filas válidas en este bloque");

  const client = getClient();
  const CHUNK = 200;
  let inserted = 0;

  for (let start = 0; start < allArgs.length; start += CHUNK) {
    const batch = allArgs.slice(start, start + CHUNK);
    const { sql: ph, params: flat } = buildBatchInsert(NUM_COLS, batch);
    await client.execute(
      `INSERT INTO nomina_eventuales (${COLS}) VALUES ${ph} ON CONFLICT (usuario) DO UPDATE SET nombre=EXCLUDED.nombre, jornada=EXCLUDED.jornada, perfil=EXCLUDED.perfil, sector=EXCLUDED.sector, activo=EXCLUDED.activo, fecha_alta=EXCLUDED.fecha_alta, fecha_baja=EXCLUDED.fecha_baja, motivo_baja=EXCLUDED.motivo_baja, dias_activos=EXCLUDED.dias_activos, anio=EXCLUDED.anio, nacimiento=EXCLUDED.nacimiento, edad=EXCLUDED.edad, primera_medicion=EXCLUDED.primera_medicion, codigo_empleado=EXCLUDED.codigo_empleado`,
      flat,
    );
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

    if (action === "insert") {
      const result = await handleInsert(body.rows);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Acción inválida. Usar: delete | insert" }, { status: 400 });
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
