"use client";

import { useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Database,
  X,
} from "lucide-react";

interface AdminPanelProps {
  onRefresh?: () => void;
}

export function AdminPanel({ onRefresh }: AdminPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadProgress(10);
      setUploadResult(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        // Simulate progress while uploading
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + 5, 90));
        }, 300);

        const response = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        const data = await response.json();

        if (response.ok) {
          setUploadResult({
            success: true,
            message: data.message || `${data.inserted} registros cargados.`,
          });
          // Refresh dashboard data after successful upload
          setTimeout(() => {
            onRefresh?.();
          }, 500);
        } else {
          setUploadResult({
            success: false,
            message: data.error || "Error desconocido",
          });
        }
      } catch {
        setUploadProgress(100);
        setUploadResult({
          success: false,
          message: "Error de conexión. Verificá tu internet.",
        });
      } finally {
        setIsUploading(false);
      }
    },
    [onRefresh]
  );

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    try {
      const response = await fetch("/api/admin/download");
      if (!response.ok) {
        const err = await response.json();
        setUploadResult({
          success: false,
          message: err.error || "Error al descargar",
        });
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers
          .get("Content-Disposition")
          ?.split("filename=")[1]
          ?.replace(/"/g, "") || "produccion_h61.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setUploadResult({
        success: false,
        message: "Error al descargar el archivo.",
      });
    } finally {
      setIsDownloading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    // Reset input so same file can be re-uploaded
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-1.5 text-xs h-8"
      >
        <Database className="h-3.5 w-3.5" />
        Admin
      </Button>
    );
  }

  return (
    <Card className="border-emerald-200 dark:border-emerald-900 shadow-lg">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-semibold">Administración de Datos</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setIsOpen(false);
              setUploadResult(null);
            }}
            className="h-6 w-6 p-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Upload Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-colors duration-200
            ${
              isDragging
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                : "border-muted-foreground/25 hover:border-emerald-400 hover:bg-muted/50"
            }
            ${isUploading ? "pointer-events-none opacity-60" : ""}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />

          {isUploading ? (
            <div className="space-y-3">
              <Loader2 className="h-8 w-8 mx-auto text-emerald-600 animate-spin" />
              <p className="text-sm text-muted-foreground">
                Procesando archivo...
              </p>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">
                Arrastrá tu Excel acá o hacé clic
              </p>
              <p className="text-xs text-muted-foreground">
                Formato: .xlsx con hoja &quot;Datos&quot; · Reemplaza toda la base
              </p>
            </div>
          )}
        </div>

        {/* Result message */}
        {uploadResult && (
          <div
            className={`flex items-start gap-2 rounded-md p-3 text-sm ${
              uploadResult.success
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
            }`}
          >
            {uploadResult.success ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{uploadResult.message}</span>
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">o</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Download Button */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isDownloading ? "Descargando..." : "Descargar datos actuales (.xlsx)"}
        </Button>

        <p className="text-[11px] text-muted-foreground text-center">
          <FileSpreadsheet className="inline h-3 w-3 mr-1" />
          Descarga todos los registros de la base en formato Excel
        </p>
      </CardContent>
    </Card>
  );
}