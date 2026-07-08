/**
 * Script para subir el archivo Excel a Google Sheets.
 *
 * USO:
 *   1. Configurar las variables de entorno en .env.local
 *   2. bun run scripts/upload-to-google-sheets.ts
 *
 * El script crea una nueva hoja "Datos" en el spreadsheet configurado
 * y sube todos los datos del Excel.
 */

import * as XLSX from "xlsx";
import { google } from "googleapis";
import * as path from "path";
import * as fs from "fs";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error(
      "Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY en .env.local"
    );
  }

  return new google.auth.JWT({
    email,
    key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
}

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Falta GOOGLE_SHEETS_SPREADSHEET_ID en .env.local");
  }

  console.log(" Leyendo archivo Excel...");
  const filePath = path.join(process.cwd(), "upload", "h61 ver.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`No se encontró: ${filePath}`);
  }

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets["Datos"];
  if (!sheet) {
    throw new Error('No se encontró la hoja "Datos" en el Excel');
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
  });

  console.log(` ${rows.length} filas leídas (incluye encabezado)`);

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  // Check if "Datos" sheet exists, delete it first
  console.log(" Verificando hojas existentes...");
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const existingSheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === "Datos"
  );

  if (existingSheet?.properties?.sheetId) {
    console.log(' Eliminando hoja "Datos" existente...');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteSheet: {
              sheetId: existingSheet.properties.sheetId,
            },
          },
        ],
      },
    });
  }

  // Add new "Datos" sheet
  console.log(' Creando hoja "Datos"...');
  const addResponse = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: "Datos" },
          },
        },
      ],
    },
  });

  const newSheetId =
    addResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;
  if (!newSheetId) {
    throw new Error("No se pudo crear la hoja");
  }

  // Upload data in batches of 1000 rows
  const BATCH_SIZE = 1000;
  const totalRows = rows.length;

  for (let i = 0; i < totalRows; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const startRow = i + 1; // 1-indexed in Sheets

    console.log(
      ` Subiendo filas ${i + 1}-${Math.min(i + BATCH_SIZE, totalRows)} de ${totalRows}...`
    );

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Datos!A${startRow}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: batch.map((row) =>
          row.map((cell) => (cell === null ? "" : cell))
        ),
      },
    });
  }

  // Freeze header row
  console.log(" Congelando fila de encabezado...");
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId: newSheetId,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
            fields: "gridProperties.frozenRowCount",
          },
        },
      ],
    },
  });

  console.log("\n Listo! Los datos están en tu Google Sheet.");
  console.log(
    ` Abrir: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
  );
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});