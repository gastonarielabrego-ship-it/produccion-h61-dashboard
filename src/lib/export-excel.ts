import * as XLSX from "xlsx";

/**
 * Export an array of row objects to a formatted .xlsx file and trigger download.
 *
 * @param rows   – array of plain objects (each key = column header)
 * @param filename – .xlsx file name (without path)
 * @param sheetName – name of the Excel sheet tab
 * @param colWidths – optional array of widths (in characters) per column
 */
export function exportToExcel(
  rows: Record<string, any>[],
  filename: string,
  sheetName: string,
  colWidths?: number[],
) {
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  if (colWidths && colWidths.length) {
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  // Trigger download
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}