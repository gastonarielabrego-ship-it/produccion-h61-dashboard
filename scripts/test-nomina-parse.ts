import * as XLSX from 'xlsx';
import * as fs from 'fs';

// Parse the nomina file the same way the browser would
const buf = fs.readFileSync('upload/NOMINA EVENTUALES.xlsx');
const wb = XLSX.read(buf, { type: 'array' });
const ws = wb.Sheets[wb.SheetNames[0]];
const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

const header = allRows[0].map((c: any) => String(c ?? '').toUpperCase().trim());
const colIdx: Record<string, number> = {};
header.forEach((h: string, i: number) => { colIdx[h] = i; });

const getStr = (row: any[], ci: number): string => {
  if (ci < 0 || ci >= row.length) return '';
  const v = row[ci];
  return v === null || v === undefined ? '' : String(v).trim();
};
const getVal = (row: any[], ci: number): number => {
  if (ci < 0 || ci >= row.length) return 0;
  const v = row[ci];
  return v === null || v === undefined ? 0 : Number(v) || 0;
};
const parseDate = (val: string): string => {
  if (!val || val === '*') return '';
  const parts = val.split('/');
  if (parts.length !== 3) return val;
  return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
};

// Map columns - handle accents
const codEmpCol = colIdx["CÓDIGO DE EMPLEADO"] ?? colIdx["CODIGO DE EMPLEADO"] ?? colIdx["CODIGO_EMPLEADO"] ?? -1;
const nombreCol = colIdx["APELLIDOS, NOMBRE"] ?? colIdx["NOMBRE"] ?? -1;
const jornadaCol = colIdx["JORNADA"] ?? -1;
const usuarioCol = colIdx["USUARIO"] ?? -1;
const perfilCol = colIdx["PERFIL"] ?? -1;
const sectorCol = colIdx["SECTOR"] ?? -1;
const activoCol = colIdx["ACTIVO"] ?? -1;
const fechaAltaCol = colIdx["DÍAS"] ?? colIdx["DIAS"] ?? -1;
const hoyCol = colIdx["HOY"] ?? -1;
const fechaBajaCol = colIdx["FECHA DE BAJA"] ?? hoyCol ?? -1;
const motivoBajaCol = colIdx["MOTIVO DE BAJA"] ?? -1;
const anioCol = colIdx["AÑO"] ?? colIdx["ANIO"] ?? -1;
const nacCol = colIdx["NACIMIENTO"] ?? -1;
const edadCol = colIdx["EDAD"] ?? -1;
const primMedCol = colIdx["PRIMERA MEDICION"] ?? colIdx["PRIMERA MEDICIÓN"] ?? -1;
const diasActivosCol = colIdx["DIAS ACTIVOS"] ?? -1;

console.log("Column mappings:");
console.log("  codEmpCol:", codEmpCol, "-> sample:", allRows[1]?.[codEmpCol]);
console.log("  nombreCol:", nombreCol, "-> sample:", allRows[1]?.[nombreCol]);
console.log("  jornadaCol:", jornadaCol, "-> sample:", allRows[1]?.[jornadaCol]);
console.log("  usuarioCol:", usuarioCol, "-> sample:", allRows[1]?.[usuarioCol]);
console.log("  perfilCol:", perfilCol, "-> sample:", allRows[1]?.[perfilCol]);
console.log("  sectorCol:", sectorCol, "-> sample:", allRows[1]?.[sectorCol]);
console.log("  activoCol:", activoCol, "-> sample:", allRows[1]?.[activoCol]);
console.log("  fechaAltaCol (DÍAS):", fechaAltaCol, "-> sample:", allRows[1]?.[fechaAltaCol]);
console.log("  hoyCol:", hoyCol, "-> sample:", allRows[1]?.[hoyCol]);
console.log("  fechaBajaCol:", fechaBajaCol, "-> sample:", allRows[1]?.[fechaBajaCol]);
console.log("  diasActivosCol:", diasActivosCol, "-> sample:", allRows[1]?.[diasActivosCol]);
console.log("  anioCol:", anioCol, "-> sample:", allRows[1]?.[anioCol]);
console.log("  nacCol:", nacCol, "-> sample:", allRows[1]?.[nacCol]);
console.log("  edadCol:", edadCol, "-> sample:", allRows[1]?.[edadCol]);
console.log("  primMedCol:", primMedCol, "-> sample:", allRows[1]?.[primMedCol]);

// Pre-map ALL rows
const dataRows = allRows.slice(1);
const mappedRows: (string | number | null)[][] = [];

for (const row of dataRows) {
  const usuario = getStr(row, usuarioCol);
  if (!usuario) continue;

  const codigoEmpleado = getVal(row, codEmpCol);
  const diasActivos = getVal(row, diasActivosCol);
  const anio = getVal(row, anioCol);
  const edad = getVal(row, edadCol);

  mappedRows.push([
    codigoEmpleado > 0 ? codigoEmpleado : null,
    getStr(row, nombreCol),
    getStr(row, jornadaCol),
    usuario,
    getStr(row, perfilCol),
    getStr(row, sectorCol),
    getStr(row, activoCol),
    parseDate(getStr(row, fechaAltaCol)),
    parseDate(getStr(row, fechaBajaCol)),
    getStr(row, motivoBajaCol),
    diasActivos > 0 ? diasActivos : null,
    anio > 0 ? anio : null,
    parseDate(getStr(row, nacCol)),
    edad > 0 ? edad : null,
    parseDate(getStr(row, primMedCol)),
  ]);
}

console.log("\nTotal mapped rows:", mappedRows.length);
console.log("Sample mapped row:", JSON.stringify(mappedRows[0]));
console.log("Sample mapped row 2:", JSON.stringify(mappedRows[1]));

// Calculate payload size
const NOM_CHUNK = 50;
const totalChunks = Math.ceil(mappedRows.length / NOM_CHUNK);
const chunk0 = mappedRows.slice(0, NOM_CHUNK);
const payload0 = JSON.stringify({ action: "insert-parsed", rows: chunk0 });
console.log("\nChunk size:", NOM_CHUNK, "rows");
console.log("Total chunks:", totalChunks);
console.log("Payload size of chunk 0:", (payload0.length / 1024).toFixed(1), "KB");
