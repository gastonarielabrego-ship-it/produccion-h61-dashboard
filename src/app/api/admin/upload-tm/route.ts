import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const maxDuration = 60;

const TM_DDL = `
CREATE TABLE IF NOT EXISTS tiempos_muertos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha       INTEGER NOT NULL,
  turno       TEXT    NOT NULL,
  operario    TEXT    NOT NULL,
  nombre      TEXT    NOT NULL,
  estado      TEXT,
  motivo      INTEGER,
  minutos     INTEGER NOT NULL DEFAULT 0,
  observacion TEXT,
  usuario_alta TEXT
);
CREATE INDEX IF NOT EXISTS idx_tm_fecha ON tiempos_muertos(fecha);
CREATE INDEX IF NOT EXISTS idx_tm_operario ON tiempos_muertos(operario);
CREATE INDEX IF NOT EXISTS idx_tm_fecha_operario ON tiempos_muertos(fecha, operario);
`;

async function ensureTable() {
  const client = getClient();
  for (const stmt of TM_DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await client.execute(stmt);
  }
}

export async function GET() {
  try {
    await ensureTable();
    const client = getClient();
    const result = await client.execute("SELECT COUNT(*) as cnt FROM tiempos_muertos");
    const count = Number(result.rows[0]?.cnt ?? 0);
    return NextResponse.json({ ok: true, count });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureTable();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No se recibió el archivo" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const raw = new Uint8Array(buffer);

    const wb = XLSX.read(raw, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (rows.length < 2) {
      return NextResponse.json({ error: "El archivo está vacío" }, { status: 400 });
    }

    const header = rows[0].map((c) => String(c ?? "").toUpperCase().trim());
    const colIdx: Record<string, number> = {};
    header.forEach((h, i) => { colIdx[h] = i; });

    const required = ["FECHA", "TURNO", "OPERARIO", "NOMBRE", "MINUTOS"];
    const missing = required.filter((r) => !(r in colIdx));
    if (missing.length > 0) {
      return NextResponse.json({ error: `Faltan columnas: ${missing.join(", ")}` }, { status: 400 });
    }

    const getVal = (row: (string | number | null | undefined)[], ci: number): number => {
      if (ci < 0 || ci >= row.length) return 0;
      const v = row[ci];
      return v === null || v === undefined ? 0 : Number(v) || 0;
    };
    const getStr = (row: (string | number | null | undefined)[], ci: number): string => {
      if (ci < 0 || ci >= row.length) return "";
      const v = row[ci];
      return v === null || v === undefined ? "" : String(v).trim();
    };

    const dataRows = rows.slice(1);
    const fileDates = [...new Set(dataRows.map((r) => getVal(r, colIdx["FECHA"])))].filter(Boolean);

    const client = getClient();

    if (fileDates.length > 0) {
      const ph = fileDates.map((_, i) => `$d${i}`).join(",");
      const dp: Record<string, number> = {};
      fileDates.forEach((d, i) => { dp[`d${i}`] = d; });
      await client.execute({
        sql: `DELETE FROM tiempos_muertos WHERE fecha IN (${ph})`,
        args: dp,
      });
    }

    const cols = "fecha, turno, operario, nombre, estado, motivo, minutos, observacion, usuario_alta";
    const placeholders = "(?, ?, ?, ?, ?, ?, ?, ?, ?)";

    const buildRowArgs = (row: (string | number | null | undefined)[]): (string | number | null)[] => {
      const estadoRaw = getStr(row, colIdx["ESTADO"]);
      const motivoRaw = getVal(row, colIdx["MOTIVO"]);
      return [
        getVal(row, colIdx["FECHA"]),
        getStr(row, colIdx["TURNO"]),
        getStr(row, colIdx["OPERARIO"]),
        getStr(row, colIdx["NOMBRE"]),
        estadoRaw || null,
        motivoRaw || null,
        getVal(row, colIdx["MINUTOS"]),
        getStr(row, colIdx["OBSERVACION"]) || null,
        getStr(row, colIdx["USUARIO_ALTA"]) || null,
      ];
    };

    const validRows = dataRows.filter((r) => getVal(r, colIdx["MINUTOS"]) > 0);

    const CHUNK = 200;
    let totalInserted = 0;

    for (let i = 0; i < validRows.length; i += CHUNK) {
      const chunk = validRows.slice(i, i + CHUNK);
      const valueGroups = chunk.map(() => placeholders).join(", ");
      const sql = `INSERT INTO tiempos_muertos (${cols}) VALUES ${valueGroups}`;
      const args = chunk.flatMap(buildRowArgs);
      await client.execute({ sql, args });
      totalInserted += chunk.length;
    }

    return NextResponse.json({
      message: `${totalInserted.toLocaleString("es-AR")} registros de tiempos muertos cargados correctamente`,
      inserted: totalInserted,
    });
  } catch (error: any) {
    console.error("Upload TM error:", error);
    return NextResponse.json(
      { error: error.message || "Error al procesar el archivo" },
      { status: 500 }
    );
  }
}