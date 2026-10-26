"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, CheckCircle2, AlertCircle, Loader2, Timer, Users } from "lucide-react";
import * as XLSX from "xlsx";

interface HeaderActionsProps {
  onRefresh?: () => void;
  onRefreshClarkistas?: () => void;
}

type UploadingLabel = "prep" | "clark" | "tm" | "nom";

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
  const nomInputRef = useRef<HTMLInputElement>(null);
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

  /** Send one POST API request with configurable timeout (default 25s) */
  const apiPost = async (endpoint: string, body: Record<string, unknown>, timeoutMs = 25000): Promise<{ ok: boolean; data: any }> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
      if (err.name === "AbortError") return { ok: false, data: { error: `Timeout ${(timeoutMs/1000).toFixed(0)}s — Vercel cortó la petición` } };
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
  const handleNomFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (nomInputRef.current) nomInputRef.current.value = "";
    if (!file) return;

    setUploading("nom");
    startTimer();
    const endpoint = "/api/admin/upload-nomina";

    // ── Browser-side helpers ──
    const getVal = (row: (string | number | null | undefined)[], ci: number): number => {
      if (ci < 0 || ci >= row.length) return 0;
      const v = row[ci];
      return v === null || v === undefined ? 0 : Number(v) || 0;
    };
    const getStr = (row: (string | number | null | undefined)[], ci: number): string => {
      if (ci < 0 || ci >= row.length) return "";
      const v = row[ci];
      return v === null || v === undefined ? "" : String(v).trim();
    };
    const parseDate = (val: string): string => {
      if (!val || val === "*") return "";
      const parts = val.split("/");
      if (parts.length !== 3) return val;
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    };

    try {
      // WARMUP + parse Excel in parallel
      setUploadStatus("Preparando servidor y leyendo Excel...");
      const bufferPromise = file.arrayBuffer();
      const [warmupOk] = await Promise.all([
        warmup(endpoint),
        bufferPromise,
      ]);

      const buffer = await bufferPromise;
      setUploadStatus(`Parseando Excel... (${(file.size / 1024).toFixed(0)} KB)`);
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const allRows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (allRows.length < 2) {
        showToast("error", "El archivo tiene datos insuficientes");
        return;
      }

      // ── Map header columns ONCE in the browser ──
      const header = allRows[0].map((c) => String(c ?? "").toUpperCase().trim());
      const colIdx: Record<string, number> = {};
      header.forEach((h, i) => { colIdx[h] = i; });

      const codEmpCol = colIdx["CODIGO DE EMPLEADO"] ?? colIdx["CODIGO_EMPLEADO"] ?? -1;
      const nombreCol = colIdx["APELLIDOS, NOMBRE"] ?? colIdx["NOMBRE"] ?? colIdx["APELLIDOS NOMBRE"] ?? -1;
      const jornadaCol = colIdx["JORNADA"] ?? -1;
      const usuarioCol = colIdx["USUARIO"] ?? -1;
      const perfilCol = colIdx["PERFIL"] ?? -1;
      const sectorCol = colIdx["SECTOR"] ?? -1;
      const activoCol = colIdx["ACTIVO"] ?? -1;
      const fechaAltaCol = colIdx["DIAS"] ?? -1;
      const hoyCol = colIdx["HOY"] ?? -1;
      const fechaBajaCol = colIdx["FECHA DE BAJA"] ?? hoyCol ?? -1;
      const motivoBajaCol = colIdx["MOTIVO DE BAJA"] ?? -1;
      const anioCol = colIdx["AÑO"] ?? colIdx["ANIO"] ?? -1;
      const nacCol = colIdx["NACIMIENTO"] ?? -1;
      const edadCol = colIdx["EDAD"] ?? -1;
      const primMedCol = colIdx["PRIMERA MEDICION"] ?? colIdx["PRIMERA MEDICIÓN"] ?? -1;
      const diasActivosCol = colIdx["DIAS ACTIVOS"] ?? -1;

      if (usuarioCol < 0) {
        showToast("error", `Falta columna USUARIO. Encontradas: ${header.filter(Boolean).join(", ")}`);
        return;
      }

      // ── Pre-map ALL rows to DB column format in the browser ──
      // Each row becomes a 15-element array matching the DB schema
      setUploadStatus("Mapeando columnas...");
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

      if (mappedRows.length === 0) {
        showToast("error", "No se encontraron filas válidas con USUARIO");
        return;
      }

      // Delete ALL previous records (no date filter for nomina)
      setUploadStatus("Paso 1/2: Eliminando nómina previa...");
      const delResult = await apiPost(endpoint, { action: "delete" });
      if (!delResult.ok) {
        showToast("error", `Error al eliminar: ${delResult.data.error}`);
        return;
      }

      // ── INSERT pre-parsed rows in smaller chunks (50 rows) ──
      // Smaller chunks = faster per request = less chance of Vercel timeout
      const NOM_CHUNK = 50;
      const totalChunks = Math.ceil(mappedRows.length / NOM_CHUNK);
      setProgress({ current: 0, total: totalChunks });

      let totalInserted = 0;
      for (let c = 0; c < totalChunks; c++) {
        const start = c * NOM_CHUNK;
        const end = Math.min(start + NOM_CHUNK, mappedRows.length);
        const chunk = mappedRows.slice(start, end);

        setUploadStatus(`Paso 2/2: Bloque ${c + 1}/${totalChunks} (filas ${start + 1}-${end} de ${mappedRows.length})...`);
        setProgress({ current: c + 1, total: totalChunks });

        // Use "insert-parsed" action — server skips header mapping entirely
        const insResult = await apiPost(endpoint, { action: "insert-parsed", rows: chunk });

        if (!insResult.ok) {
          // Retry once on failure
          setUploadStatus(`Reintentando bloque ${c + 1}...`);
          const retryResult = await apiPost(endpoint, { action: "insert-parsed", rows: chunk });
          if (!retryResult.ok) {
            showToast("error", `Bloque ${c + 1} falló: ${insResult.data.error}. Se insertaron ${totalInserted.toLocaleString("es-AR")} filas antes del error.`);
            return;
          }
          totalInserted += retryResult.data.inserted || 0;
        } else {
          totalInserted += insResult.data.inserted || 0;
        }
      }

      showToast("success", `${totalInserted.toLocaleString("es-AR")} registros de nómina cargados en ${totalChunks} bloques`);
      setTimeout(() => onRefresh?.(), 2000);
    } catch (err: any) {
      showToast("error", `Error: ${err.message || "inesperado"}`);
    } finally {
      stopTimer();
      setUploading(null);
      setUploadStatus("");
      setProgress({ current: 0, total: 0 });
    }
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
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.docx,.doc" onChange={handleFileChange} className="hidden" />
      <input ref={clarkInputRef} type="file" accept=".xlsx,.xls,.docx,.doc" onChange={handleClarkFileChange} className="hidden" />
      <input ref={tmInputRef} type="file" accept=".xlsx,.xls,.docx,.doc" onChange={handleTMFileChange} className="hidden" />
      <input ref={nomInputRef} type="file" accept=".xlsx,.xls,.docx,.doc" onChange={handleNomFileChange} className="hidden" />
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
      <Button variant="outline" size="sm" onClick={() => !uploading && nomInputRef.current?.click()} disabled={!!uploading} className="gap-1.5 text-xs h-8 text-violet-600 border-violet-200 hover:bg-violet-50 hover:text-violet-700">
        {uploading === "nom" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
        {uploading === "nom" ? "Cargando..." : "Nómina"}
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
