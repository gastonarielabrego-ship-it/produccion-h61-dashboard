import { google } from "googleapis";

// Types matching the original Prisma schema
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

// In-memory cache
let cachedRecords: ProductionRecord[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY env vars"
    );
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

function getSpreadsheetId() {
  const id = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!id) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID env var");
  }
  return id;
}

function parseRow(row: any[]): ProductionRecord | null {
  if (!row || row.length < 12 || !row[0]) return null;

  const hourlyData: HourlyDataPoint[] = [];
  for (let h = 0; h <= 23; h++) {
    const colIdx = 11 + h; // HORA_00 is at index 11
    hourlyData.push({
      hour: h,
      quantity: Number(row[colIdx]) || 0,
    });
  }

  return {
    funcion: String(row[0] ?? ""),
    funcionDesc: String(row[1] ?? ""),
    date: Number(row[2]) || 0,
    turno: String(row[3] ?? ""),
    turnoDesc: String(row[4] ?? ""),
    operario: String(row[6] ?? ""),
    nombre: String(row[7] ?? ""),
    actividad: Number(row[8]) || 0,
    circuito: String(row[9] ?? ""),
    tiempoMue: Number(row[10]) || 0,
    total: Number(row[35]) || 0,
    hourlyData,
  };
}

export async function getAllRecords(): Promise<ProductionRecord[]> {
  const now = Date.now();
  if (cachedRecords && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRecords;
  }

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Datos!A2:AJ", // Skip header row
  });

  const rows = response.data.values || [];
  const records: ProductionRecord[] = [];

  for (const row of rows) {
    const record = parseRow(row);
    if (record) {
      records.push(record);
    }
  }

  cachedRecords = records;
  cacheTimestamp = now;
  return records;
}

export function clearCache() {
  cachedRecords = null;
  cacheTimestamp = 0;
}

// Filter helper (same logic as Prisma routes)
export type FilterOptions = {
  date?: string;
  turno?: string;
  circuito?: string;
  funcion?: string;
};

export function applyFilters(
  records: ProductionRecord[],
  filters: FilterOptions
): ProductionRecord[] {
  return records.filter((r) => {
    if (filters.date && r.date !== Number(filters.date)) return false;
    if (filters.turno && r.turno !== filters.turno) return false;
    if (filters.circuito && r.circuito !== filters.circuito) return false;
    if (filters.funcion && r.funcion !== filters.funcion) return false;
    return true;
  });
}

export function parseFilters(request: Request): FilterOptions {
  const url = new URL(request.url);
  const filters: FilterOptions = {};
  const date = url.searchParams.get("date");
  const turno = url.searchParams.get("turno");
  const circuito = url.searchParams.get("circuito");
  const funcion = url.searchParams.get("funcion");
  if (date) filters.date = date;
  if (turno) filters.turno = turno;
  if (circuito) filters.circuito = circuito;
  if (funcion) filters.funcion = funcion;
  return filters;
}