import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";

export const maxDuration = 60;

function ensureErroresTable() {
  const client = getClient();
  return client.batch([
    { sql: `CREATE TABLE IF NOT EXISTS errores_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_prep INTEGER NOT NULL,
      fecha_ctrl INTEGER NOT NULL,
      id_operario TEXT NOT NULL DEFAULT '',
      tipo_control TEXT NOT NULL DEFAULT '',
      controlador TEXT NOT NULL DEFAULT '',
      codigo_producto TEXT NOT NULL DEFAULT '',
      producto TEXT NOT NULL DEFAULT '',
      errores INTEGER NOT NULL DEFAULT 1,
      motivo TEXT NOT NULL DEFAULT ''
    )` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_errores_fecha ON errores_records (fecha_prep)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_errores_controlador ON errores_records (controlador)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_errores_motivo ON errores_records (motivo)` },
  ]);
}

const PH = "(?,?,?,?,?,?,?,?,?)";

function dateToInt(d: string | number | null | undefined): number {
  if (!d) return 0;
  if (typeof d === "number") return d;
  const s = String(d).trim();
  // Format: "2024-08-26 00:00:00" or "2024-08-26"
  const parts = s.split(/[\sT\-:]+/);
  if (parts.length >= 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const day = Number(parts[2]);
    if (y > 0 && m > 0 && day > 0) return y * 10000 + m * 100 + day;
  }
  return 0;
}

export async function POST(request: Request) {
  const t0 = Date.now();
  try {
    await ensureErroresTable();
    const body = await request.json();
    const action = body.action;

    if (action === "delete") {
      const dates: number[] = body.dates || [];
      if (dates.length === 0) return NextResponse.json({ message: "Sin fechas", deletedDates: [] });
      const client = getClient();
      const ph: string[] = [];
      const dp: Record<string, number> = {};
      for (let i = 0; i < dates.length; i++) {
        ph.push("$d" + i);
        dp["d" + i] = dates[i];
      }
      const result = await client.execute({
        sql: "DELETE FROM errores_records WHERE fecha_prep IN (" + ph.join(",") + ")",
        args: dp,
      });
      return NextResponse.json({ message: (result.rowsAffected ?? "?") + " registros eliminados", deletedDates: dates, elapsed: ((Date.now() - t0) / 1000).toFixed(1) + "s" });
    }

    if (action === "insert") {
      const rows: (string | number | null | undefined)[][] = body.rows;
      if (!rows || rows.length < 2) throw new Error("Datos insuficientes");

      const header: string[] = [];
      for (let i = 0; i < rows[0].length; i++) {
        header.push(String(rows[0][i] ?? "").toUpperCase().trim().replace(/\xa0/g, " ").replace(/\s+/g, " "));
      }

      // Find column indices — header: Preparacion, Control, Tiempo Control, ID, Tipo de control, Controlador, codigo producto, producto, Errores, motivo
      // NOTE: In data, col 5 has controlador names and col 6 has tipo_control (swapped vs header)
      const colIdx: Record<string, number> = {};
      for (let i = 0; i < header.length; i++) {
        colIdx[header[i]] = i;
      }

      function getVal(row: (string | number | null | undefined)[], ci: number): number {
        if (ci < 0 || ci >= row.length) return 0;
        const v = row[ci];
        return v === null || v === undefined ? 0 : Number(v) || 0;
      }
      function getStr(row: (string | number | null | undefined)[], ci: number): string {
        if (ci < 0 || ci >= row.length) return "";
        const v = row[ci];
        return v === null || v === undefined ? "" : String(v).trim().replace(/\xa0/g, " ").replace(/\s+/g, " ");
      }

      // Map columns (handle both possible header layouts)
      const cPrep = colIdx["PREPARACION"] ?? colIdx["PREPARACION "] ?? -1;
      const cCtrl = colIdx["CONTROL"] ?? colIdx["CONTROL "] ?? -1;
      const cId = colIdx["ID"] ?? -1;
      // Col labeled "TIPO DE CONTROL" actually has controlador names in data
      const cControlador = colIdx["TIPO DE CONTROL"] ?? colIdx["TIPO DE CONTROL "] ?? -1;
      // Col labeled "CONTROLADOR" actually has tipo_control values in data
      const cTipoCtrl = colIdx["CONTROLADOR"] ?? colIdx["CONTROLADOR "] ?? -1;
      const cCodProd = colIdx["CODIGO PRODUCTO"] ?? colIdx["CODIGO PRODUCTO "] ?? -1;
      const cProducto = colIdx["PRODUCTO"] ?? colIdx["PRODUCTO "] ?? -1;
      const cErrores = colIdx["ERRORES"] ?? colIdx["ERRORES "] ?? -1;
      const cMotivo = colIdx["MOTIVO"] ?? colIdx["MOTIVO "] ?? -1;

      const allArgs: (string | number)[][] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const fechaPrep = dateToInt(row[cPrep]);
        if (fechaPrep <= 0) continue;

        allArgs.push([
          fechaPrep,
          dateToInt(row[cCtrl]),
          getStr(row, cId),
          getStr(row, cControlador), // This col has controlador name in data
          getStr(row, cTipoCtrl),   // This col has tipo_control in data
          getStr(row, cCodProd),
          getStr(row, cProducto),
          getVal(row, cErrores) || 1,
          getStr(row, cMotivo),
        ]);
      }

      if (allArgs.length === 0) throw new Error("No hay filas validas");

      const client = getClient();
      const CHUNK = 200;
      let totalInserted = 0;
      for (let start = 0; start < allArgs.length; start += CHUNK) {
        const chunk = allArgs.slice(start, start + CHUNK);
        const phArr: string[] = [];
        const flat: (string | number)[] = [];
        for (let j = 0; j < chunk.length; j++) {
          phArr.push(PH);
          for (let k = 0; k < chunk[j].length; k++) flat.push(chunk[j][k]);
        }
        await client.execute({ sql: "INSERT INTO errores_records (fecha_prep, fecha_ctrl, id_operario, tipo_control, controlador, codigo_producto, producto, errores, motivo) VALUES " + phArr.join(", "), args: flat });
        totalInserted += chunk.length;
      }

      return NextResponse.json({ inserted: totalInserted, elapsed: ((Date.now() - t0) / 1000).toFixed(1) + "s" });
    }

    return NextResponse.json({ error: "Accion invalida: delete | insert" }, { status: 400 });
  } catch (error: any) {
    console.error("Upload errores error:", error);
    return NextResponse.json({ error: error.message || "Error al procesar", elapsed: ((Date.now() - t0) / 1000).toFixed(1) + "s" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await ensureErroresTable();
    const client = getClient();
    const result = await client.execute("SELECT COUNT(*) as cnt FROM errores_records");
    return NextResponse.json({ ok: true, count: Number(result.rows[0]?.cnt ?? 0) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
