"use client";

import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { exportToExcel } from "@/lib/export-excel";

interface ExcelButtonProps {
  /** Rows to export — each object's keys become column headers */
  rows: Record<string, any>[];
  /** File name for the download (e.g. "produccion-por-hora") */
  filename: string;
  /** Excel sheet tab name */
  sheetName: string;
  /** Optional column widths in characters */
  colWidths?: number[];
  /** Optional tooltip */
  title?: string;
  /** Optional extra class for the wrapper */
  className?: string;
}

export function ExcelButton({
  rows,
  filename,
  sheetName,
  colWidths,
  title = "Descargar Excel",
  className,
}: ExcelButtonProps) {
  if (!rows || rows.length === 0) return null;

  const handleExport = () => {
    exportToExcel(rows, filename, sheetName, colWidths);
  };

  return (
    <div className={className}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleExport}
        title={title}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}