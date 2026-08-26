import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";

function ensureTable() {
  const client = getClient();
  return client.execute({
    sql: `CREATE TABLE IF NOT EXISTS rendimientos_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL DEFAULT '',
      dia TEXT NOT NULL DEFAULT '',
      fecha INTEGER NOT NULL DEFAULT 0,
      bultos INTEGER NOT NULL DEFAULT 0,
      hs_brutas REAL NOT NULL DEFAULT 0,
      tm_hs REAL NOT NULL DEFAULT 0,
      hs_netas REAL NOT NULL DEFAULT 0,
      produccion REAL NOT NULL DEFAULT 0,
      bh_bruta REAL NOT NULL DEFAULT 0,
      bh_neta REAL NOT NULL DEFAULT 0
    )`,
  });
}

function parseDia(diaStr: string): number {
  // Format: "DD/MM" — assume current year or from context
  const s = String(diaStr).trim();
  const parts = s.split("/");
  if (parts.length === 2) {
    const day = Number(parts[0]);
    const month = Number(parts[1]);
    if (day > 0 && month > 0) {
      // Use 2026 as default year (current period)
      return 20260000 + month * 100 + day;
    }
  }
  return 0;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;
    const client = getClient();
    await ensureTable();

    if (action === "delete-all") {
      await client.execute({ sql: "DELETE FROM rendimientos_records" });
      return NextResponse.json({ message: "Todos los registros de rendimientos eliminados" });
    }

    if (action === "delete" && body.dates) {
      const dates: number[] = body.dates;
      const placeholders = dates.map(function() { return "?"; }).join(",");
      await client.execute({
        sql: "DELETE FROM rendimientos_records WHERE fecha IN (" + placeholders + ")",
        args: dates,
      });
      return NextResponse.json({ message: "Eliminados por fecha" });
    }

    if (action === "insert" && body.rows) {
      const rows: any[][] = body.rows;
      const header = rows[0];
      let inserted = 0;

      // Find column indices
      let colDia = -1, colNombre = -1, colBultos = -1;
      let colHsBrutas = -1, colTm = -1, colHsNetas = -1;
      let colProduccion = -1, colBhBruta = -1, colBhNeta = -1;

      for (let c = 0; c < header.length; c++) {
        const h = String(header[c] ?? "").toLowerCase().trim();
        if (h === "dia") colDia = c;
        else if (h.includes("nombre") || h.includes("operario") || h.includes("personal")) colNombre = c;
        else if (h.includes("bultos")) colBultos = c;
        else if (h.includes("brutas")) colHsBrutas = c;
        else if (h.startsWith("tm")) colTm = c;
        else if (h.includes("netas")) colHsNetas = c;
        else if (h.includes("produccion")) colProduccion = c;
        else if (h.includes("bh") && h.includes("bruta")) colBhBruta = c;
        else if (h.includes("bh") && h.includes("neta")) colBhNeta = c;
      }

      // The nombre column is column B (index 1) by default in this format
      if (colNombre === -1) colNombre = 1;
      if (colDia === -1) colDia = 0;

      let currentNombre = "";
      const CHUNK = 200;
      let batch: any[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        // Check if this is a header row ("Dia" in first col)
        const firstVal = String(row[colDia] ?? "").trim();
        if (firstVal.toLowerCase() === "dia") {
          // Next col might have the person's name
          if (colNombre < row.length) {
            currentNombre = String(row[colNombre] ?? "").trim();
          }
          continue;
        }

        // Skip TOTAL rows
        if (firstVal.toLowerCase() === "total") continue;

        // Parse day
        const fecha = parseDia(firstVal);
        if (fecha === 0) continue;

        const nombre = currentNombre || String(row[colNombre] ?? "").trim();
        if (!nombre) continue;

        const bultos = colBultos >= 0 ? Number(row[colBultos] ?? 0) : 0;
        const hsBrutas = colHsBrutas >= 0 ? Number(row[colHsBrutas] ?? 0) : 0;
        const tmHs = colTm >= 0 ? Number(row[colTm] ?? 0) : 0;
        const hsNetas = colHsNetas >= 0 ? Number(row[colHsNetas] ?? 0) : 0;
        const produccion = colProduccion >= 0 ? Number(row[colProduccion] ?? 0) : 0;
        const bhBruta = colBhBruta >= 0 ? Number(row[colBhBruta] ?? 0) : 0;
        const bhNeta = colBhNeta >= 0 ? Number(row[colBhNeta] ?? 0) : 0;

        batch.push([nombre, firstVal, fecha, bultos, hsBrutas, tmHs, hsNetas, produccion, bhBruta, bhNeta]);

        if (batch.length >= CHUNK) {
          const placeholders = batch.map(function() { return "(?,?,?,?,?,?,?,?,?,?)"; }).join(",");
          const flat: any[] = [];
          for (let b = 0; b < batch.length; b++) {
            for (let c = 0; c < batch[b].length; c++) {
              flat.push(batch[b][c]);
            }
          }
          await client.execute({
            sql: "INSERT INTO rendimientos_records (nombre, dia, fecha, bultos, hs_brutas, tm_hs, hs_netas, produccion, bh_bruta, bh_neta) VALUES " + placeholders,
            args: flat,
          });
          inserted += batch.length;
          batch = [];
        }
      }

      // Insert remaining
      if (batch.length > 0) {
        const placeholders = batch.map(function() { return "(?,?,?,?,?,?,?,?,?,?)"; }).join(",");
        const flat: any[] = [];
        for (let b = 0; b < batch.length; b++) {
          for (let c = 0; c < batch[b].length; c++) {
            flat.push(batch[b][c]);
          }
        }
        await client.execute({
          sql: "INSERT INTO rendimientos_records (nombre, dia, fecha, bultos, hs_brutas, tm_hs, hs_netas, produccion, bh_bruta, bh_neta) VALUES " + placeholders,
          args: flat,
        });
        inserted += batch.length;
      }

      return NextResponse.json({ inserted });
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
