/**
 * Neon PostgreSQL database layer for Producción H61 Dashboard
 * Replaces src/lib/turso.ts — same public API, PostgreSQL backend
 * 
 * Uses node-postgres (pg) for reliable connection pooling and query execution
 * on Vercel serverless functions.
 */

import pg from "pg";

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
  tipo?: string;
};

// ─── Singleton Pool ─────────────────────────────────────
let _pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("Missing DATABASE_URL env var");
    }
    _pool = new pg.Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
  }
  return _pool;
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

// ─── Query builder with optional filters (PostgreSQL) ───
function buildWhere(filters: FilterOptions): { sql: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  const addParam = (value: string | number): string => {
    params.push(value);
    return `$${paramIdx++}`;
  };

  if (filters.date) {
    conditions.push(`fecha = ${addParam(Number(filters.date))}`);
  } else {
    if (filters.dateFrom) {
      conditions.push(`fecha >= ${addParam(Number(filters.dateFrom))}`);
    }
    if (filters.dateTo) {
      conditions.push(`fecha <= ${addParam(Number(filters.dateTo))}`);
    }
  }
  if (filters.turno) {
    conditions.push(`turno = ${addParam(filters.turno)}`);
  }
  if (filters.circuito && filters.circuito.length > 0) {
    const placeholders = filters.circuito.map((c) => addParam(c));
    conditions.push(`circuito IN (${placeholders.join(", ")})`);
  }
  if (filters.actividad) {
    conditions.push(`actividad = ${addParam(Number(filters.actividad))}`);
  }
  if (filters.funcion) {
    conditions.push(`funcion = ${addParam(filters.funcion)}`);
  }
  if (filters.operario) {
    conditions.push(`operario = ${addParam(filters.operario)}`);
  }
  if (filters.tipo) {
    if (filters.tipo === "EFECTIVO") {
      conditions.push(`(CAST(SUBSTRING(operario FROM 2) AS INTEGER) < 10247 OR operario IN (SELECT operario FROM nomina_override))`);
    } else if (filters.tipo === "EVENTUAL") {
      conditions.push(`(CAST(SUBSTRING(operario FROM 2) AS INTEGER) >= 10247 AND operario NOT IN (SELECT operario FROM nomina_override))`);
    }
  }

  const sql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { sql, params };
}

// ─── No-op table ensure (tables pre-created via migration) ──

export async function ensureNominaOverrideTable() {
  // No-op: tables are pre-created in Neon via migration
}

// ─── Public API (drop-in replacement for turso.ts) ──────

export async function getAllRecords(filters?: FilterOptions, tableName = "production_records"): Promise<ProductionRecord[]> {
  const pool = getPool();
  const { sql: whereSql, params } = buildWhere(filters ?? {});

  const query = `SELECT * FROM ${tableName} ${whereSql}`;
  const result = await pool.query(query, params);

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
  const tipo = url.searchParams.get("tipo");
  if (tipo) filters.tipo = tipo;
  return filters;
}

// Keep applyFilters for compatibility
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

export async function getTMByDateOperario(
  filters?: FilterOptions
): Promise<Record<string, number>> {
  const pool = getPool();
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  const addParam = (value: string | number): string => {
    params.push(value);
    return `$${paramIdx++}`;
  };

  if (filters?.date) {
    conditions.push(`fecha = ${addParam(Number(filters.date))}`);
  } else {
    if (filters?.dateFrom) { conditions.push(`fecha >= ${addParam(Number(filters.dateFrom))}`); }
    if (filters?.dateTo) { conditions.push(`fecha <= ${addParam(Number(filters.dateTo))}`); }
  }
  if (filters?.operario) { conditions.push(`operario = ${addParam(filters.operario)}`); }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `SELECT fecha, operario, SUM(minutos) as total_minutos FROM tiempos_muertos ${where} GROUP BY fecha, operario`;
  const result = await pool.query(query, params);
  const map: Record<string, number> = {};
  for (const row of result.rows) {
    map[`${row.fecha}:${row.operario}`] = Number(row.total_minutos) || 0;
  }
  return map;
}

export async function getTMByDate(
  filters?: FilterOptions
): Promise<Record<number, number>> {
  const pool = getPool();
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  const addParam = (value: string | number): string => {
    params.push(value);
    return `$${paramIdx++}`;
  };

  if (filters?.date) {
    conditions.push(`fecha = ${addParam(Number(filters.date))}`);
  } else {
    if (filters?.dateFrom) { conditions.push(`fecha >= ${addParam(Number(filters.dateFrom))}`); }
    if (filters?.dateTo) { conditions.push(`fecha <= ${addParam(Number(filters.dateTo))}`); }
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const query = `SELECT fecha, SUM(minutos) as total_minutos FROM tiempos_muertos ${where} GROUP BY fecha`;
  const result = await pool.query(query, params);
  const map: Record<number, number> = {};
  for (const row of result.rows) {
    map[Number(row.fecha)] = Number(row.total_minutos) || 0;
  }
  return map;
}

// ─── Raw SQL access for routes that need it ─────────────

export interface NeonClient {
  execute: (query: string, params?: (string | number | null)[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
  batch: (queries: string[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }[]>;
}

export function getClient(): NeonClient {
  const pool = getPool();
  return {
    execute: async (query: string, params: (string | number | null)[] = []) => {
      const result = await pool.query(query, params);
      return { rows: result.rows as Record<string, unknown>[], rowCount: result.rowCount ?? 0 };
    },
    batch: async (queries: string[]) => {
      const results = [];
      const client = await pool.connect();
      try {
        for (const q of queries) {
          const result = await client.query(q);
          results.push({ rows: result.rows as Record<string, unknown>[], rowCount: result.rowCount ?? 0 });
        }
      } finally {
        client.release();
      }
      return results;
    },
  };
}
