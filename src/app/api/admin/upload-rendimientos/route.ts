import { getClient } from "@/lib/neon";
import { NextResponse } from "next/server";

// Tables pre-created via Neon migration

function parseDia(diaStr: string): number {
  const s = String(diaStr).trim();
  const parts = s.split("/");
  if (parts.length === 2) {
    const day = Number(parts[0]);
    const month = Number(parts[1]);
    if (day > 0 && month > 0) return 20260000 + month * 100 + day;
  }
  return 0;
}

// Helper: build PostgreSQL positional placeholders for batch insert
function buildBatchInsert(cols: number, batch: any[][]): { sql: string; params: any[] } {
  const pgPhArr: string[] = [];
  const pgFlat: any[] = [];
  for (let j = 0; j < batch.length; j++) {
    const rowPh = batch[j].map((_, k) => `$${j * cols + k + 1}`).join(",");
    pgPhArr.push(`(${rowPh})`);
    for (let k = 0; k < batch[j].length; k++) pgFlat.push(batch[j][k]);
  }
  return { sql: pgPhArr.join(", "), params: pgFlat };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action;
    const client = getClient();

    if (action === "delete-all") {
      await client.execute("DELETE FROM rendimientos_records");
      return NextResponse.json({ message: "Todos los registros de rendimientos eliminados" });
    }

    if (action === "delete" && body.dates) {
      const dates: number[] = body.dates;
      const placeholders = dates.map((_, i) => `$${i + 1}`).join(",");
      await client.execute("DELETE FROM rendimientos_records WHERE fecha IN (" + placeholders + ")", dates);
      return NextResponse.json({ message: "Eliminados por fecha" });
    }

    if (action === "insert" && body.rows) {
      const rows: any[][] = body.rows;
      const header = rows[0];
      let inserted = 0;

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

      if (colNombre === -1) colNombre = 1;
      if (colDia === -1) colDia = 0;

      let currentNombre = "";
      const CHUNK = 200;
      let batch: any[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const firstVal = String(row[colDia] ?? "").trim();
        if (firstVal.toLowerCase() === "dia") {
          if (colNombre < row.length) currentNombre = String(row[colNombre] ?? "").trim();
          continue;
        }
        if (firstVal.toLowerCase() === "total") continue;
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
          const { sql: ph, params: flat } = buildBatchInsert(10, batch);
          await client.execute("INSERT INTO rendimientos_record (nombre, dia, fecha, bultos, hs_brutas, tm_hs, hs_netas, produccion, bh_bruta, bh_neta) VALUES " + ph, flat);
          inserted += batch.length;
          batch = [];
        }
      }

      if (batch.length > 0) {
        const { sql: ph, params: flat } = buildBatchInsert(10, batch);
        await client.execute("INSERT INTO rendimientos_record (nombre, dia, fecha, bultos, hs_brutas, tm_hs, hs_netas, produccion, bh_bruta, bh_neta) VALUES " + ph, flat);
        inserted += batch.length;
      }

      return NextResponse.json({ inserted });
    }

    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
