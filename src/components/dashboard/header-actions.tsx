"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, CheckCircle2, AlertCircle, Loader2, Timer } from "lucide-react";
import * as XLSX from "xlsx";

interface HeaderActionsProps {
  onRefresh?: () => void;
  onRefreshClarkistas?: () => void;
}

type UploadingLabel = "prep" | "clark" | "tm";

/** Configuration per upload type */
const CHUNK_SIZE = 400; // rows per chunk — each INSERT stays well under 10s

export function HeaderActions({ onRefresh, onRefreshClarkistas }: HeaderActionsProps) {
  const [uploading, setUploading] = useState<UploadingLabel | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 }); // blocks
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clarkInputRef = useRef<HTMLInputElement>(null);
  const tmInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    setElapsedSec(0);
    timerRef.current = setInterval(() => setElapsedSec((s) => s + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 10000);
  };

  /** Send one API request with auto-retry */
  const apiCall = async (endpoint: string, body: Record<string, unknown>): Promise<Response> => {
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        return res;
      } catch (err: any) {
        if (attempt < 2) await new Promise((r) => setTimeout(r, 2000));
        else throw err;
      }
    }
    throw new Error("Error de conexión");
  };

  /** Extract unique dates from data rows using column index */
  const extractDates = (dataRows: (string | number | null | undefined)[][], fechaIdx: number): number[] => {
    const dateSet = new Set<number>();
    for (const row of dataRows) {
      const v = row[fechaIdx];
      const fecha = v === null || v === undefined ? 0 : Number(v) || 0;
      if (fecha > 0) dateSet.add(fecha);
    }
    return [...dateSet];
  };

  /**
   * CHUNKED UPLOAD STRATEGY:
   * 1. Parse Excel client-side
   * 2. Extract all unique dates → send DELETE request (fast)
   * 3. Split rows into chunks of 400 → send each as INSERT request
   * 4. Each request stays under 10s → no Vercel Hobby timeout
   */
  const handleChunkedUpload = async (
    file: File, endpoint: string, label: UploadingLabel, refreshFn?: () => void
  ) => {
    setUploading(label);
    startTimer();
    try {
      // Step 1: Parse Excel in browser
      setUploadStatus(`Leyendo Excel... (${(file.size / 1024).toFixed(0)} KB)`);
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const allRows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (allRows.length < 2) {
        showToast("error", "El archivo tiene datos insuficientes");
        return;
      }

      const header = allRows[0];
      const dataRows = allRows.slice(1);
      const totalRows = dataRows.length;

      // Find FECHA column index
      const headerUpper = header.map((c) => String(c ?? "").toUpperCase().trim());
      const fechaIdx = headerUpper.indexOf("FECHA");
      if (fechaIdx < 0) {
        showToast("error", 'No se encontró columna "FECHA" en el archivo');
        return;
      }

      // Step 2: DELETE old records
      const allDates = extractDates(dataRows, fechaIdx);
      setUploadStatus(`Eliminando datos previos (${allDates.length} fechas)...`);

      const delRes = await apiCall(endpoint, { action: "delete", dates: allDates });
      const delData = await delRes.json();
      if (!delRes.ok) {
        showToast("error", delData.error || "Error al eliminar datos previos");
        return;
      }

      // Step 3: INSERT in chunks
      const totalChunks = Math.ceil(totalRows / CHUNK_SIZE);
      setProgress({ current: 0, total: totalChunks });

      let totalInserted = 0;
      for (let c = 0; c < totalChunks; c++) {
        const start = c * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalRows);
        const chunkRows = [header, ...dataRows.slice(start, end)];

        setUploadStatus(`Insertando bloque ${c + 1}/${totalChunks} (${start + 1}-${end} de ${totalRows} filas)...`);
        setProgress({ current: c + 1, total: totalChunks });

        const insRes = await apiCall(endpoint, { action: "insert", rows: chunkRows });
        const insData = await insRes.json();

        if (!insRes.ok) {
          showToast("error", `Error en bloque ${c + 1}: ${insData.error}`);
          return;
        }

        totalInserted += insData.inserted || 0;
      }

      // Done!
      showToast("success", `${totalInserted.toLocaleString("es-AR")} registros cargados (${totalChunks} bloques) — ${allDates.length} fechas`);
      setTimeout(() => refreshFn?.(), 1500);

    } catch (err: any) {
      if (err.name === "AbortError") showToast("error", "Tiempo agotado.");
      else showToast("error", `Error: ${err.message || "conexión fallida"}`);
    } finally {
      stopTimer();
      setUploading(null);
      setUploadStatus("");
      setProgress({ current: 0, total: 0 });
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const response = await fetch("/api/admin/download");
      if (!response.ok) { const t = await response.text(); let e: any; try { e = JSON.parse(t); } catch { e = {}; } showToast("error", e.error || "Error al descargar"); return; }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url;
      const cd = response.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="(.+)"/);
      a.download = m ? m[1] : "informe_produccion_h61.xlsx";
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { showToast("error", "Error al descargar"); } finally { setIsDownloading(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleChunkedUpload(file, "/api/admin/upload", "prep", onRefresh);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const handleClarkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleChunkedUpload(file, "/api/admin/upload-clarkistas", "clark", onRefreshClarkistas);
    if (clarkInputRef.current) clarkInputRef.current.value = "";
  };
  const handleTMFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleChunkedUpload(file, "/api/admin/upload-tm", "tm", onRefresh);
    if (tmInputRef.current) tmInputRef.current.value = "";
  };

  const formatTime = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} className="hidden" />
      <input ref={clarkInputRef} type="file" accept=".xlsx,.xls" onChange={handleClarkFileChange} className="hidden" />
      <input ref={tmInputRef} type="file" accept=".xlsx,.xls" onChange={handleTMFileChange} className="hidden" />
      <Button variant="outline" size="sm" onClick={() => !uploading && fileInputRef.current?.click()} disabled={!!uploading} className="gap-1.5 text-xs h-8">
        {uploading === "prep" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploading === "prep" ? "Cargando..." : "Preparación"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => !uploading && clarkInputRef.current?.click()} disabled={!!uploading} className="gap-1.5 text-xs h-8">
        {uploading === "clark" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {uploading === "clark" ? "Cargando..." : "Clarkistas"}
      </Button>
      <Button variant="outline" size="sm" onClick={() => !uploading && tmInputRef.current?.click()} disabled={!!uploading} className="gap-1.5 text-xs h-8 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
        {uploading === "tm" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Timer className="h-3.5 w-3.5" />}
        {uploading === "tm" ? "Cargando..." : "T. Muertos"}
      </Button>
      <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading} className="gap-1.5 text-xs h-8">
        {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
        {isDownloading ? "Generando..." : "Informe"}
      </Button>
      {uploading && uploadStatus && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-background border rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-3 min-w-[280px]">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm text-foreground block truncate">{uploadStatus}</span>
            {progress.total > 0 && (
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">{progressPct}%</span>
              </div>
            )}
          </div>
          {elapsedSec > 0 && (
            <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">
              {formatTime(elapsedSec)}
            </span>
          )}
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-auto flex items-center gap-2.5 rounded-lg px-5 py-3.5 text-sm shadow-xl transition-all animate-in slide-in-from-bottom-4 fade-in duration-300 ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </>
  );
}
