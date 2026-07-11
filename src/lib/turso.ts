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
  circuito?: string;
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
  if (filters.circuito) {
    conditions.push("circuito = $circuito");
    params.circuito = filters.circuito;
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

// ─── Public API (drop-in replacement for google-sheets.ts) ─

export async function getAllRecords(filters?: FilterOptions, tableName = "production_records"): Promise<ProductionRecord[]> {
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
  const circuito = url.searchParams.get("circuito");
  const funcion = url.searchParams.get("funcion");
  const operario = url.searchParams.get("operario");
  if (date) filters.date = date;
  if (dateFrom) filters.dateFrom = dateFrom;
  if (dateTo) filters.dateTo = dateTo;
  if (turno) filters.turno = turno;
  if (circuito) filters.circuito = circuito;
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
    if (filters.circuito && r.circuito !== filters.circuito) return false;
    if (filters.funcion && r.funcion !== filters.funcion) return false;
    if (filters.operario && r.operario !== filters.operario) return false;
    return true;
  });
}

// ─── Raw client access for seed script ──────────────────
export { getClient };