import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

// GET: debug — check Turso connection and row count
export async function GET() {
  try {
    const client = getClient();
    const result = await client.execute("SELECT COUNT(*) as cnt FROM production_records");
    const count = Number(result.rows[0]?.cnt ?? 0);
    const sample = await client.execute("SELECT * FROM production_records LIMIT 1");
    const hasData = sample.rows.length > 0;
    const sampleRow = hasData
      ? Object.fromEntries(Object.entries(sample.rows[0]).map(([k, v]) => [k, String(v).slice(0, 30)]))
      : null;
    return NextResponse.json({ ok: true, count, hasData, sampleRow });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let step = "init";
  try {
    step = "parsing body";
    const body = await request.json();
    const { data: base64, name } = body;
    const base64Len = base64?.length ?? 0;

    if (!base64 || !name) {
      return NextResponse.json({ error: "Archivo no proporcionado" }, { status: 400 });
    }

    // Decode base64
    step = `decoding base64 (len=${base64Len})`;
    const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Parse xlsx
    step = "parsing xlsx";
    const wb = XLSX.read(raw, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    if (rows.length < 2) {
      return NextResponse.json(
        { error: `El archivo tiene solo ${rows.length} filas (con header)` },
        { status: 400 }
      );
    }

    // Validate header
    step = "validating header";
    const header = rows[0].map((c) => String(c ?? "").toUpperCase().trim());
    const required = [
      "FUNCION", "FUNCION_DESC", "FECHA", "TURNO", "TURNO_DESC",
      "OPERARIO", "NOMBRE", "ACTIVIDAD", "CIRCUITO", "TIEMPO_MUE", "TOTAL",
    ];
    const missing = required.filter((r) => !header.includes(r));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Faltan columnas: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Map header to column indices
    const colIdx: Record<string, number> = {};
    header.forEach((h, i) => { colIdx[h] = i; });

    // Build hour column indices
    const hourCols: number[] = [];
    for (let h = 0; h <= 23; h++) {
      const colName = `HORA_${String(h).padStart(2, "0")}`;
      hourCols.push(colIdx[colName] ?? -1);
    }

    const dataRows = rows.slice(1);

    // Helpers
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

    // Collect unique dates
    step = "collecting dates";
    const fileDates = new Set<number>();
    for (const row of dataRows) {
      const v = getVal(row, colIdx["FECHA"]);
      if (v) fileDates.add(v);
    }
    const dateList = [...fileDates];

    const client = getClient();

    // Delete existing records for those dates
    step = `deleting old records for ${dateList.length} dates`;
    if (dateList.length > 0) {
      const placeholders = dateList.map((_, i) => `$d${i}`).join(", ");
      const deleteParams: Record<string, number> = {};
      dateList.forEach((d, i) => { deleteParams[`d${i}`] = d; });
      await client.execute({
        sql: `DELETE FROM production_records WHERE fecha IN (${placeholders})`,
        args: deleteParams,
      });
    }

    // Build all INSERT statements
    step = "building statements";
    const insertSql = `INSERT INTO production_records
      (funcion, funcion_desc, fecha, turno, turno_desc, operario, nombre, actividad, circuito, tiempo_mue, total,
       hora_00, hora_01, hora_02, hora_03, hora_04, hora_05, hora_06, hora_07, hora_08, hora_09,
       hora_10, hora_11, hora_12, hora_13, hora_14, hora_15, hora_16, hora_17, hora_18, hora_19,
       hora_20, hora_21, hora_22, hora_23)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?)`;

    const statements: { sql: string; args: (string | number)[] }[] = [];

    for (const row of dataRows) {
      const args: (string | number)[] = [
        getStr(row, colIdx["FUNCION"]),
        getStr(row, colIdx["FUNCION_DESC"]),
        getVal(row, colIdx["FECHA"]),
        getStr(row, colIdx["TURNO"]),
        getStr(row, colIdx["TURNO_DESC"]),
        getStr(row, colIdx["OPERARIO"]),
        getStr(row, colIdx["NOMBRE"]),
        getVal(row, colIdx["ACTIVIDAD"]),
        getStr(row, colIdx["CIRCUITO"]),
        getVal(row, colIdx["TIEMPO_MUE"]),
        getVal(row, colIdx["TOTAL"]),
      ];
      for (let h = 0; h <= 23; h++) {
        args.push(getVal(row, hourCols[h]));
      }
      statements.push({ sql: insertSql, args });
    }

    // Execute in batches of 20
    step = `inserting ${statements.length} records in batches`;
    const BATCH_SIZE = 20;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < statements.length; i += BATCH_SIZE) {
      const batch = statements.slice(i, i + BATCH_SIZE);
      try {
        await client.batch(batch as any, { mode: "sequential" });
        inserted += batch.length;
      } catch (err: any) {
        console.error(`Batch error at row ${i}:`, err.message);
        // Fallback: one by one
        for (const stmt of batch) {
          try {
            await client.execute({ sql: stmt.sql, args: stmt.args as any });
            inserted++;
          } catch (e: any) {
            console.error(`Single insert error:`, e.message);
            errors++;
          }
        }
      }
    }

    return NextResponse.json({
      message: `${inserted.toLocaleString("es-AR")} registros cargados (${errors > 0 ? `${errors} errores` : "sin errores"})`,
      inserted,
      errors,
      total: dataRows.length,
    });
  } catch (error: any) {
    console.error("Upload error at step [" + step + "]:", error);
    return NextResponse.json(
      { error: `${error.message} (paso: ${step})` },
      { status: 500 }
    );
  }
}