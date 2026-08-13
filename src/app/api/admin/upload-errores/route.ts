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
  if (typeof d === "number") {
    // If it's an Excel serial number (< 60000), convert to YYYYMMDD
    if (d > 30000 && d < 60000) {
      const epoch = new Date(1899, 11, 30);
      const jsDate = new Date(epoch.getTime() + d * 86400000);
      return jsDate.getFullYear() * 10000 + (jsDate.getMonth() + 1) * 100 + jsDate.getDate();
    }
    // Already in YYYYMMDD format (e.g. 20240826)
    if (d > 20000101 && d < 21000000) return d;
    return d;
  }
  const s = String(d).trim();
  // Format: "2024-08-26 00:00:00" or "2024-08-26"
  const parts = s.split(/[\sT\-:]+/);
  if (parts.length >= 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const day = Number(parts[2]);
    if (y > 0 && m > 0 && day > 0) return y * 10000 + m * 100 + day;
  }
  // DD/MM/YYYY format
  if (parts.length >= 3 && day <= 31 && m <= 12) {
    const y = Number(parts[2]);
    if (y > 0) return y * 10000 + m * 100 + day;
  }
  return 0;
}

export async function POST(request: Request) {
  const t0 = Date.now();
  try {
    await ensureErroresTable();
    const body = await request.json();
    const action = body.action;

    if (action === "delete-all") {
      const client = getClient();
      const countBefore = await client.execute("SELECT COUNT(*) as cnt FROM errores_records");
      const before = Number(countBefore.rows[0]?.cnt ?? 0);
      await client.execute("DELETE FROM errores_records");
      return NextResponse.json({ message: before + " registros eliminados (todos)", elapsed: ((Date.now() - t0) / 1000).toFixed(1) + "s" });
    }

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

      // Find column indices — flexible matching
      const colIdx: Record<string, number> = {};
      for (let i = 0; i < header.length; i++) {
        colIdx[header[i]] = i;
      }

      function findCol(keys: string[]): number {
        for (let k = 0; k < keys.length; k++) {
          // Exact match
          if (colIdx[keys[k]] !== undefined) return colIdx[keys[k]];
          // Partial/contains match
          const hKeys = Object.keys(colIdx);
          for (let h = 0; h < hKeys.length; h++) {
            if (hKeys[h].indexOf(keys[k]) >= 0 || keys[k].indexOf(hKeys[h]) >= 0) return colIdx[hKeys[h]];
          }
        }
        return -1;
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

      // Map columns — flexible: exact first, then partial match, then positional fallback
      let cPrep = findCol(["PREPARACION", "PREPARACIÓN", "FECHA PREPARACION", "FECHA PREPARACIÓN", "FECHA PREP", "FECHA"]);
      let cCtrl = findCol(["CONTROL", "FECHA CONTROL", "FECHA CTRL", "CTRL"]);
      let cId = findCol(["ID", "ID OPERARIO", "OPERARIO"]);
      let cControlador = findCol(["TIPO DE CONTROL", "TIPO CONTROL"]);
      let cTipoCtrl = findCol(["CONTROLADOR"]);
      let cCodProd = findCol(["CODIGO PRODUCTO", "COD PRODUCTO", "CODIGO", "COD."]);
      let cProducto = findCol(["PRODUCTO", "DESCRIPCION", "DESCRIPCIÓN"]);
      let cErrores = findCol(["ERRORES", "ERROR", "CANTIDAD", "CANT"]);
      let cMotivo = findCol(["MOTIVO", "OBSERVACION", "OBSERVACIÓN", "OBS"]);

      // Positional fallback: if key columns not found, try by position
      if (cPrep < 0 && header.length >= 1) cPrep = 0;
      if (cCtrl < 0 && header.length >= 2) cCtrl = 1;
      if (cId < 0 && header.length >= 4) cId = 3;
      if (cControlador < 0 && header.length >= 6) cControlador = 4;
      if (cTipoCtrl < 0 && header.length >= 7) cTipoCtrl = 5;
      if (cCodProd < 0 && header.length >= 8) cCodProd = 6;
      if (cProducto < 0 && header.length >= 9) cProducto = 7;
      if (cErrores < 0 && header.length >= 10) cErrores = 8;
      if (cMotivo < 0 && header.length >= 11) cMotivo = 9;

      const allArgs: (string | number)[][] = [];
      let debugFirstRow = "";
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (i === 1) debugFirstRow = "row[0] type=" + typeof row[cPrep] + " val=" + JSON.stringify(row[cPrep]) + " dateToInt=" + dateToInt(row[cPrep]);
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

      if (allArgs.length === 0) throw new Error("No hay filas validas. Headers detectados: [" + header.join(" | ") + "], cPrep=" + cPrep + ", total filas=" + (rows.length - 1) + ", debug: " + debugFirstRow);

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
