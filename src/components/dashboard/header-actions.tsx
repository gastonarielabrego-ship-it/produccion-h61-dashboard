"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, CheckCircle2, AlertCircle, Loader2, Timer } from "lucide-react";

interface HeaderActionsProps {
  onRefresh?: () => void;
  onRefreshClarkistas?: () => void;
}

type UploadingLabel = "prep" | "clark" | "tm";

export function HeaderActions({ onRefresh, onRefreshClarkistas }: HeaderActionsProps) {
  const [uploading, setUploading] = useState<UploadingLabel | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const clarkInputRef = useRef<HTMLInputElement>(null);
  const tmInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 5000);
  };

  const handleUpload = useCallback(
    async (file: File, endpoint: string, label: UploadingLabel, refreshFn?: () => void) => {
      setUploading(label);
      setUploadStatus(`Enviando...`);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120000);
        const response = await fetch(endpoint, { method: "POST", body: formData, signal: controller.signal });
        clearTimeout(timeout);
        const text = await response.text();
        let data: any;
        try { data = JSON.parse(text); } catch { showToast("error", "Error del servidor."); return; }
        if (response.ok) { showToast("success", data.message); setTimeout(() => refreshFn?.(), 600); }
        else { showToast("error", data.error || "Error al cargar"); }
      } catch (err: any) {
        if (err.name === "AbortError") showToast("error", "Tiempo agotado.");
        else showToast("error", `Error: ${err.message || "conexión fallida"}`);
      } finally { setUploading(null); setUploadStatus(""); }
    }, []
  );

  const handleDownload = useCallback(async () => {
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
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, "/api/admin/upload", "prep", onRefresh);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const handleClarkFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, "/api/admin/upload-clarkistas", "clark", onRefreshClarkistas);
    if (clarkInputRef.current) clarkInputRef.current.value = "";
  };
  const handleTMFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file, "/api/admin/upload-tm", "tm", onRefresh);
    if (tmInputRef.current) tmInputRef.current.value = "";
  };

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
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] bg-background border rounded-lg px-4 py-2.5 shadow-lg flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600 shrink-0" />
          <span className="text-sm text-foreground">{uploadStatus}</span>
        </div>
      )}
      {toast && (
        <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] max-w-md w-auto flex items-center gap-2.5 rounded-lg px-5 py-3.5 text-sm shadow-xl transition-all animate-in slide-in-from-bottom-4 fade-in duration-300 ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </>
  );
}