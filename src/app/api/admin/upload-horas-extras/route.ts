import { getClient } from "@/lib/turso";
import { NextResponse } from "next/server";

export const maxDuration = 60;

function ensureTable() {
  const client = getClient();
  return client.batch([
    { sql: `CREATE TABLE IF NOT EXISTS horas_extras_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cod_empleado INTEGER NOT NULL DEFAULT 0,
      empresa TEXT NOT NULL DEFAULT '',
      nombre TEXT NOT NULL DEFAULT '',
      sector TEXT NOT NULL DEFAULT '',
      fecha INTEGER NOT NULL DEFAULT 0,
      dia TEXT NOT NULL DEFAULT '',
      hs_trabajadas INTEGER NOT NULL DEFAULT 0,
      hs_extras_50 INTEGER NOT NULL DEFAULT 0,
      hs_extras_100 INTEGER NOT NULL DEFAULT 0,
      hs_noct_100 INTEGER NOT NULL DEFAULT 0,
      hs_noc_trab INTEGER NOT NULL DEFAULT 0,
      jornada TEXT NOT NULL DEFAULT ''
    )` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_he_fecha ON horas_extras_records (fecha)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_he_nombre ON horas_extras_records (nombre)` },
    { sql: `CREATE INDEX IF NOT EXISTS idx_he_dia ON horas_extras_records (dia)` },
  ]);
}

/** Parse time string "H:MM" or "HH:MM" to total minutes */
function timeToMinutes(t: string | number | null | undefined): number {
  if (t === null || t === undefined) return 0;
  if (typeof t === "number") return Math.round(t);
  const s = String(t).trim();
  if (!s || s === "0:00") return 0;
  const parts = s.split(":");
  if (parts.length === 2) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  }
  // Maybe already a number as string
  const n = parseInt(s, 10);
  if (!isNaN(n)) return n;
  return 0;
}

/** Convert date to YYYYMMDD integer */
function dateToInt(d: string | number | null | undefined): number {
  if (!d) return 0;
  if (typeof d === "number") {
    // Excel serial number
    if (d > 30000 && d < 60000) {
      const epoch = new Date(1899, 11, 30);
      const jsDate = new Date(epoch.getTime() + d * 86400000);
      return jsDate.getFullYear() * 10000 + (jsDate.getMonth() + 1) * 100 + jsDate.getDate();
    }
    if (d > 20000101 && d < 21000000) return d;
    return 0;
  }
  if (d instanceof Date) {
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  const s = String(d).trim();
  const parts = s.split(/[\sT\-:]+/);
  if (parts.length >= 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const day = Number(parts[2]);
    if (y > 0 && m > 0 && day > 0) return y * 10000 + m * 100 + day;
  }
  return 0;
}

/** Get day of week type from the "Dia" column: Lu-Ma-Mi-Ju-Vi = "LV", Sa = "S", Do = "D" */
function dayType(dia: string | null | undefined): string {
  const d = String(dia || "").trim().toLowerCase();
  if (d === "sa" || d === "sab" || d === "sábado") return "S";
  if (d === "do" || d === "dom" || d === "domingo") return "D";
  // Lu, Ma, Mi, Ju, Vi = weekday
  return "LV";
}

const PH = "(?,?,?,?,?,?,?,?,?,?,?,?)";

export async function POST(request: Request) {
  const t0 = Date.now();
  try {
    await ensureTable();
    const body = await request.json();
    const action = body.action;

    if (action === "delete-all") {
      const client = getClient();
      const countBefore = await client.execute("SELECT COUNT(*) as cnt FROM horas_extras_records");
      const before = Number(countBefore.rows[0]?.cnt ?? 0);
      await client.execute("DELETE FROM horas_extras_records");
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
        sql: "DELETE FROM horas_extras_records WHERE fecha IN (" + ph.join(",") + ")",
        args: dp,
      });
      return NextResponse.json({ message: (result.rowsAffected ?? "?") + " registros eliminados", deletedDates: dates, elapsed: ((Date.now() - t0) / 1000).toFixed(1) + "s" });
    }

    if (action === "insert") {
      const rows: (string | number | null | undefined | Date)[][] = body.rows;
      if (!rows || rows.length < 2) throw new Error("Datos insuficientes");

      // Expected columns:
      // 0: Código de empleado
      // 1: Código de empresa
      // 2: Apellidos, Nombre
      // 3: Sector
      // 4: Fecha
      // 5: Día
      // 6: Movimientos
      // 7: Anomalía
      // 8: HS TRABAJADAS (Minutos)  -> H:MM format
      // 9: HS EXTRAS 50% (Minutos)  -> H:MM format
      // 10: HS EXTRAS 100% (Minutos) -> H:MM format
      // 11: HS NOCT 100% (Minutos)  -> H:MM format
      // 12: HS NOC TRABAJADAS (Minutos) -> H:MM format
      // 13: Jornada efectiva

      const allArgs: (string | number)[][] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const fecha = dateToInt(row[4]);
        if (fecha <= 0) continue;

        const nombre = String(row[2] ?? "").trim().replace(/\xa0/g, " ").replace(/\s+/g, " ");
        if (!nombre) continue;

        allArgs.push([
          Number(row[0]) || 0,                                           // cod_empleado
          String(row[1] ?? "").trim(),                                     // empresa
          nombre,                                                          // nombre
          String(row[3] ?? "").trim(),                                     // sector
          fecha,                                                          // fecha
          String(row[5] ?? "").trim(),                                     // dia (Lu, Ma, etc.)
          timeToMinutes(row[8]),                                           // hs_trabajadas (in minutes)
          timeToMinutes(row[9]),                                           // hs_extras_50 (in minutes)
          timeToMinutes(row[10]),                                          // hs_extras_100 (in minutes)
          timeToMinutes(row[11]),                                          // hs_noct_100 (in minutes)
          timeToMinutes(row[12]),                                          // hs_noc_trab (in minutes)
          String(row[13] ?? "").trim(),                                    // jornada
        ]);
      }

      if (allArgs.length === 0) throw new Error("No hay filas validas para insertar");

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
        await client.execute({
          sql: "INSERT INTO horas_extras_records (cod_empleado, empresa, nombre, sector, fecha, dia, hs_trabajadas, hs_extras_50, hs_extras_100, hs_noct_100, hs_noc_trab, jornada) VALUES " + phArr.join(", "),
          args: flat,
        });
        totalInserted += chunk.length;
      }

      return NextResponse.json({ inserted: totalInserted, elapsed: ((Date.now() - t0) / 1000).toFixed(1) + "s" });
    }

    return NextResponse.json({ error: "Accion invalida: delete | delete-all | insert" }, { status: 400 });
  } catch (error: any) {
    console.error("Upload horas extras error:", error);
    return NextResponse.json({ error: error.message || "Error al procesar", elapsed: ((Date.now() - t0) / 1000).toFixed(1) + "s" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await ensureTable();
    const client = getClient();
    const result = await client.execute("SELECT COUNT(*) as cnt FROM horas_extras_records");
    return NextResponse.json({ ok: true, count: Number(result.rows[0]?.cnt ?? 0) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
