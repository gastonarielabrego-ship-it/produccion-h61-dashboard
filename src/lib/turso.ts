import { createClient, type Client } from "@libsql/client";

// ─── Types ──────────────────────────────────────────────
export interface HourlyDataPoint {
  hour: number;
  quantity: number;
}

export interface ProductionRecord {
  funcion: string;
  funcionDesc: string;
  date: number;
  turno: string;
  turnoDesc: string;
  operario: string;
  nombre: string;
  actividad: number;
  circuito: string;
  tiempoMue: number;
  total: number;
  hourlyData: HourlyDataPoint[];
}

export type FilterOptions = {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  turno?: string;
  circuito?: string[];
  actividad?: string;
  funcion?: string;
  operario?: string;
};

// ─── Singleton Client ───────────────────────────────────
let _client: Client | null = null;

function getClient(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error("Missing TURSO_DATABASE_URL env var");
    }

    _client = createClient({
      url,
      authToken: token,
    });
  }
  return _client;
}

// ─── Row parser ─────────────────────────────────────────
function rowToRecord(row: Record<string, unknown>): ProductionRecord {
  const hourlyData: HourlyDataPoint[] = [];
  for (let h = 0; h <= 23; h++) {
    const col = `hora_${String(h).padStart(2, "0")}`;
    hourlyData.push({
      hour: h,
      quantity: Number(row[col]) || 0,
    });
  }

  return {
    funcion: String(row.funcion ?? ""),
    funcionDesc: String(row.funcion_desc ?? ""),
    date: Number(row.fecha) || 0,
    turno: String(row.turno ?? ""),
    turnoDesc: String(row.turno_desc ?? ""),
    operario: String(row.operario ?? ""),
    nombre: String(row.nombre ?? ""),
    actividad: Number(row.actividad) || 0,
    circuito: String(row.circuito ?? ""),
    tiempoMue: Number(row.tiempo_mue) || 0,
    total: Number(row.total) || 0,
    hourlyData,
  };
}

// ─── Query builder with optional filters ────────────────
function buildWhere(filters: FilterOptions): { sql: string; params: Record<string, string | number> } {
  const conditions: string[] = [];
  const params: Record<string, string | number> = {};

  if (filters.date) {
    conditions.push("fecha = $date");
    params.date = Number(filters.date);
  } else {
    if (filters.dateFrom) {
      conditions.push("fecha >= $dateFrom");
      params.dateFrom = Number(filters.dateFrom);
    }
    if (filters.dateTo) {
      conditions.push("fecha <= $dateTo");
      params.dateTo = Number(filters.dateTo);
    }
  }
  if (filters.turno) {
    conditions.push("turno = $turno");
    params.turno = filters.turno;
  }
  if (filters.circuito && filters.circuito.length > 0) {
    const placeholders = filters.circuito.map((c, i) => `$circuito_${i}`);
    conditions.push(`circuito IN (${placeholders.join(", ")})`);
    filters.circuito.forEach((c, i) => { params[`circuito_${i}`] = c; });
  }
  if (filters.actividad) {
    conditions.push("actividad = $actividad");
    params.actividad = Number(filters.actividad);
  }
  if (filters.funcion) {
    conditions.push("funcion = $funcion");
    params.funcion = filters.funcion;
  }
  if (filters.operario) {
    conditions.push("operario = $operario");
    params.operario = filters.operario;
  }

  const sql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { sql, params };
}

// ─── Auto-create clarkistas table if missing ────────────
let _clarkTableEnsured = false;

async function ensureClarkTable() {
  if (_clarkTableEnsured) return;
  const client = getClient();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS clarkistas_records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      funcion     TEXT    NOT NULL,
      funcion_desc TEXT   NOT NULL,
      fecha       INTEGER NOT NULL,
      turno       TEXT    NOT NULL,
      turno_desc  TEXT    NOT NULL,
      tarea       TEXT,
      operario    TEXT    NOT NULL,
      nombre      TEXT    NOT NULL,
      actividad   INTEGER NOT NULL DEFAULT 0,
      circuito    TEXT    NOT NULL,
      tiempo_mue  INTEGER NOT NULL DEFAULT 0,
      hora_00     INTEGER NOT NULL DEFAULT 0,
      hora_01     INTEGER NOT NULL DEFAULT 0,
      hora_02     INTEGER NOT NULL DEFAULT 0,
      hora_03     INTEGER NOT NULL DEFAULT 0,
      hora_04     INTEGER NOT NULL DEFAULT 0,
      hora_05     INTEGER NOT NULL DEFAULT 0,
      hora_06     INTEGER NOT NULL DEFAULT 0,
      hora_07     INTEGER NOT NULL DEFAULT 0,
      hora_08     INTEGER NOT NULL DEFAULT 0,
      hora_09     INTEGER NOT NULL DEFAULT 0,
      hora_10     INTEGER NOT NULL DEFAULT 0,
      hora_11     INTEGER NOT NULL DEFAULT 0,
      hora_12     INTEGER NOT NULL DEFAULT 0,
      hora_13     INTEGER NOT NULL DEFAULT 0,
      hora_14     INTEGER NOT NULL DEFAULT 0,
      hora_15     INTEGER NOT NULL DEFAULT 0,
      hora_16     INTEGER NOT NULL DEFAULT 0,
      hora_17     INTEGER NOT NULL DEFAULT 0,
      hora_18     INTEGER NOT NULL DEFAULT 0,
      hora_19     INTEGER NOT NULL DEFAULT 0,
      hora_20     INTEGER NOT NULL DEFAULT 0,
      hora_21     INTEGER NOT NULL DEFAULT 0,
      hora_22     INTEGER NOT NULL DEFAULT 0,
      hora_23     INTEGER NOT NULL DEFAULT 0,
      total       INTEGER NOT NULL DEFAULT 0
    )
  `);
  _clarkTableEnsured = true;
}

// ─── Public API (drop-in replacement for google-sheets.ts) ─

export async function getAllRecords(filters?: FilterOptions, tableName = "production_records"): Promise<ProductionRecord[]> {
  // Auto-create clarkistas table on first access
  if (tableName === "clarkistas_records") {
    await ensureClarkTable();
  }
  const client = getClient();
  const { sql, params } = buildWhere(filters ?? {});

  const result = await client.execute({
    sql: `SELECT * FROM ${tableName} ${sql}`,
    args: params,
  });

  return result.rows.map(rowToRecord);
}

export function getSourceTable(request: Request): string {
  const url = new URL(request.url);
  return url.searchParams.get("source") === "clarkistas" ? "clarkistas_records" : "production_records";
}

export function parseFilters(request: Request): FilterOptions {
  const url = new URL(request.url);
  const filters: FilterOptions = {};
  const date = url.searchParams.get("date");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const turno = url.searchParams.get("turno");
  const circuitoAll = url.searchParams.getAll("circuito");
  const actividad = url.searchParams.get("actividad");
  const funcion = url.searchParams.get("funcion");
  const operario = url.searchParams.get("operario");
  if (date) filters.date = date;
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;
  if (turno) filters.turno = turno;
  if (circuitoAll.length > 0) filters.circuito = circuitoAll;
  if (actividad) filters.actividad = actividad;
  if (funcion) filters.funcion = funcion;
  if (operario) filters.operario = operario;
  return filters;
}

// Keep applyFilters for compatibility (some routes use it)
// But with Turso it's more efficient to filter in the query
export function applyFilters(
  records: ProductionRecord[],
  filters: FilterOptions
): ProductionRecord[] {
  return records.filter((r) => {
    if (filters.date && r.date !== Number(filters.date)) return false;
    if (filters.dateFrom && r.date < Number(filters.dateFrom)) return false;
    if (filters.dateTo && r.date > Number(filters.dateTo)) return false;
    if (filters.turno && r.turno !== filters.turno) return false;
    if (filters.circuito && filters.circuito.length > 0 && !filters.circuito.includes(r.circuito)) return false;
    if (filters.actividad && String(r.actividad) !== filters.actividad) return false;
    if (filters.funcion && r.funcion !== filters.funcion) return false;
    if (filters.operario && r.operario !== filters.operario) return false;
    return true;
  });
}

// ─── Tiempos Muertos ────────────────────────────────────
let _tmTableEnsured = false;

async function ensureTMTable() {
  if (_tmTableEnsured) return;
  const client = getClient();
  await client.execute(`
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
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_tm_fecha ON tiempos_muertos(fecha)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_tm_fecha_operario ON tiempos_muertos(fecha, operario)`);
  _tmTableEnsured = true;
}

export async function getTMByDateOperario(
  filters?: FilterOptions
): Promise<Record<string, number>> {
  await ensureTMTable();
  const client = getClient();
  const conditions: string[] = [];
  const params: Record<string, string | number> = {};
  if (filters?.date) {
    conditions.push("fecha = $date");
    params.date = Number(filters.date);
  } else {
    if (filters?.dateFrom) { conditions.push("fecha >= $dateFrom"); params.dateFrom = Number(filters.dateFrom); }
    if (filters?.dateTo) { conditions.push("fecha <= $dateTo"); params.dateTo = Number(filters.dateTo); }
  }
  if (filters?.operario) { conditions.push("operario = $operario"); params.operario = filters.operario; }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT fecha, operario, SUM(minutos) as total_minutos FROM tiempos_muertos ${where} GROUP BY fecha, operario`;
  const result = await client.execute({ sql, args: params });
  const map: Record<string, number> = {};
  for (const row of result.rows) {
    map[`${row.fecha}:${row.operario}`] = Number(row.total_minutos) || 0;
  }
  return map;
}

export async function getTMByDate(
  filters?: FilterOptions
): Promise<Record<number, number>> {
  await ensureTMTable();
  const client = getClient();
  const conditions: string[] = [];
  const params: Record<string, string | number> = {};
  if (filters?.date) {
    conditions.push("fecha = $date");
    params.date = Number(filters.date);
  } else {
    if (filters?.dateFrom) { conditions.push("fecha >= $dateFrom"); params.dateFrom = Number(filters.dateFrom); }
    if (filters?.dateTo) { conditions.push("fecha <= $dateTo"); params.dateTo = Number(filters.dateTo); }
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT fecha, SUM(minutos) as total_minutos FROM tiempos_muertos ${where} GROUP BY fecha`;
  const result = await client.execute({ sql, args: params });
  const map: Record<number, number> = {};
  for (const row of result.rows) {
    map[Number(row.fecha)] = Number(row.total_minutos) || 0;
  }
  return map;
}

// ─── Raw client access for seed script ──────────────────
export { getClient };