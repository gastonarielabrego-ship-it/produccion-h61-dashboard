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

/** Rows per chunk — each INSERT = 1 SQL statement, must finish under Vercel 10s */
const CHUNK_SIZE = 200;

export function HeaderActions({ onRefresh, onRefreshClarkistas }: HeaderActionsProps) {
  const [uploading, setUploading] = useState<UploadingLabel | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
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
    setTimeout(() => setToast(null), 15000);
  };

  /**
   * WARMUP: Send a lightweight GET to the endpoint FIRST.
   * This "wakes up" the Vercel serverless function so the subsequent
   * POST requests don't suffer cold start (~3-5s saved).
   */
  const warmup = async (endpoint: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(endpoint, { method: "GET", signal: controller.signal });
      clearTimeout(timeout);
      return res.ok;
    } catch {
      return false; // warmup failed, but we continue anyway
    }
  };

  /** Send one POST API request — NO retry, fail fast to show real error */
  const apiPost = async (endpoint: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: any }> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) }; }

      return { ok: res.ok, data };
    } catch (err: any) {
      if (err.name === "AbortError") return { ok: false, data: { error: "Timeout 20s — Vercel cortó la petición" } };
      return { ok: false, data: { error: err.message || "Error de red" } };
    }
  };

  /** Extract unique dates from data rows */
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
   * 0. WARMUP — GET request to wake the serverless function
   * 1. Parse Excel in browser
   * 2. DELETE old records for the dates in the file
   * 3. INSERT rows in chunks of 200 — each is a separate HTTP request
   * Each individual request stays under 10s → bypass Vercel Hobby limit
   */
  const handleChunkedUpload = async (
    file: File, endpoint: string, label: UploadingLabel, refreshFn?: () => void
  ) => {
    setUploading(label);
    startTimer();
    try {
      // Step 0: WARMUP — wake the serverless function
      setUploadStatus("Preparando servidor...");
      await warmup(endpoint);

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

      // Step 2: DELETE old records for dates in file
      const allDates = extractDates(dataRows, fechaIdx);
      setUploadStatus(`Paso 1/2: Eliminando datos previos (${allDates.length} fechas)...`);

      const delResult = await apiPost(endpoint, { action: "delete", dates: allDates });
      if (!delResult.ok) {
        showToast("error", `Error al eliminar: ${delResult.data.error}`);
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

        setUploadStatus(`Paso 2/2: Bloque ${c + 1}/${totalChunks} (filas ${start + 1}-${end} de ${totalRows})...`);
        setProgress({ current: c + 1, total: totalChunks });

        const insResult = await apiPost(endpoint, { action: "insert", rows: chunkRows });

        if (!insResult.ok) {
          showToast("error", `Bloque ${c + 1} falló: ${insResult.data.error}. Se insertaron ${totalInserted.toLocaleString("es-AR")} filas antes del error.`);
          return;
        }

        totalInserted += insResult.data.inserted || 0;
      }

      // Success!
      showToast("success", `${totalInserted.toLocaleString("es-AR")} registros cargados en ${totalChunks} bloques — ${allDates.length} fechas actualizadas`);
      setTimeout(() => refreshFn?.(), 2000);

    } catch (err: any) {
      showToast("error", `Error: ${err.message || "inesperado"}`);
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
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-background border rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-3 min-w-[300px]">
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
