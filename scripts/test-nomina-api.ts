import * as XLSX from 'xlsx';
import * as fs from 'fs';

async function main() {
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
      getStr(row, nombreCol), getStr(row, jornadaCol), usuario,
      getStr(row, perfilCol), getStr(row, sectorCol), getStr(row, activoCol),
      parseDate(getStr(row, fechaAltaCol)), parseDate(getStr(row, fechaBajaCol)),
      getStr(row, motivoBajaCol),
      diasActivos > 0 ? diasActivos : null,
      anio > 0 ? anio : null,
      parseDate(getStr(row, nacCol)),
      edad > 0 ? edad : null,
      parseDate(getStr(row, primMedCol)),
    ]);
  }

  console.log("Mapped rows:", mappedRows.length);

  const API = "http://localhost:3099/api/admin/upload-nomina";

  // Test warmup
  console.log("\n--- Test 1: GET warmup ---");
  const t0 = Date.now();
  const warmRes = await fetch(API);
  console.log("Warmup:", Date.now() - t0, "ms, status:", warmRes.status, await warmRes.text());

  // Test delete
  console.log("\n--- Test 2: DELETE ---");
  const t1 = Date.now();
  const delRes = await fetch(API, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "delete" }),
  });
  console.log("Delete:", Date.now() - t1, "ms, status:", delRes.status, await delRes.text());

  // Test first chunk of 50
  console.log("\n--- Test 3: INSERT chunk 0 (50 rows) ---");
  const chunk0 = mappedRows.slice(0, 50);
  const payload0 = JSON.stringify({ action: "insert-parsed", rows: chunk0 });
  console.log("Payload size:", (payload0.length / 1024).toFixed(1), "KB");
  const t2 = Date.now();
  const insRes = await fetch(API, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: payload0,
  });
  const insText = await insRes.text();
  console.log("Insert chunk 0:", Date.now() - t2, "ms, status:", insRes.status, insText);

  // Test ALL 499 rows in single request
  console.log("\n--- Test 4: INSERT ALL 499 rows in single request ---");
  const payloadAll = JSON.stringify({ action: "insert-parsed", rows: mappedRows });
  console.log("Payload size:", (payloadAll.length / 1024).toFixed(1), "KB");
  const t4 = Date.now();
  const insRes3 = await fetch(API, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: payloadAll,
  });
  const insText3 = await insRes3.text();
  console.log("Insert 499 rows:", Date.now() - t4, "ms, status:", insRes3.status, insText3);

  // Verify
  console.log("\n--- Verify count ---");
  const countRes = await fetch(API);
  const countData = await countRes.json();
  console.log("Count:", countData);
}

main().catch(console.error);
