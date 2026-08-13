"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Upload, Filter, X, Search } from "lucide-react";
import { ExcelButton } from "./excel-button";
import { PrintButton } from "./print-button";

function formatDate(dateNum: number): string {
  const day = dateNum % 100;
  const monthNum = Math.floor(dateNum / 100) % 100;
  const year = Math.floor(dateNum / 10000);
  return String(day).padStart(2, "0") + "/" + String(monthNum).padStart(2, "0") + "/" + year;
}

function formatMonth(dateNum: number): string {
  const monthNum = dateNum % 100;
  const year = Math.floor(dateNum / 100);
  const MONTH_NAMES = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return (MONTH_NAMES[monthNum] || "") + " " + year;
}

export function ErroresTab() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Filters
  const [fMotivo, setFMotivo] = useState("");
  const [fControlador, setFControlador] = useState("");
  const [searchCtrl, setSearchCtrl] = useState("");

  const fetchData = useCallback(() => {
    setError(false);
    const params = new URLSearchParams();
    if (fMotivo) params.set("motivo", fMotivo);
    if (fControlador) params.set("controlador", fControlador);
    fetch("/api/errores?" + params.toString(), { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [fMotivo, fControlador]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // All hooks before returns
  const records = data ? (data.records || []) : [];
  const monthly = data ? (data.monthly || []) : [];
  const byMotivo = data ? (data.byMotivo || []) : [];
  const byControlador = data ? (data.byControlador || []) : [];

  const motivos = useMemo(() => {
    const s: Record<string, boolean> = {};
    for (let i = 0; i < byMotivo.length; i++) s[byMotivo[i].motivo] = true;
    return Object.keys(s);
  }, [byMotivo]);

  const filteredCtrls = useMemo(() => {
    if (!searchCtrl) return byControlador.slice(0, 20);
    const q = searchCtrl.toLowerCase();
    return byControlador.filter((c: any) => c.controlador.toLowerCase().includes(q)).slice(0, 20);
  }, [byControlador, searchCtrl]);

  const totals = useMemo(() => {
    let t = 0, s = 0;
    for (let i = 0; i < records.length; i++) { t++; s += records[i].errores; }
    return { total: t, suma: s };
  }, [records]);

  if (error) return (
    <Card><CardContent className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Error al cargar datos de errores.</p>
      <button onClick={fetchData} className="mt-2 text-xs text-primary underline">Reintentar</button>
    </CardContent></Card>
  );
  if (!data) return (
    <div className="space-y-6">{[1, 2].map((i) => (
      <Card key={i}><CardContent className="p-4 h-[200px] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </CardContent></Card>
    ))}</div>
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("Procesando...");

    try {
      const XLSX = await import("xlsx");
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, dateNF: "yyyy-mm-dd" });

      if (rows.length < 2) { setUploadMsg("Error: archivo vacio"); setUploading(false); return; }

      // Collect dates to delete first — handle Excel serial numbers too
      const dates: number[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        const v = row[0];
        let d = 0;
        if (typeof v === "number") {
          if (v > 30000 && v < 60000) {
            // Excel serial number
            const epoch = new Date(1899, 11, 30);
            const jsDate = new Date(epoch.getTime() + v * 86400000);
            d = jsDate.getFullYear() * 10000 + (jsDate.getMonth() + 1) * 100 + jsDate.getDate();
          } else if (v > 20000101) {
            d = v;
          }
        } else {
          const s = String(v).trim();
          const parts = s.split(/[\sT\-:]+/);
          if (parts.length >= 3) {
            const y = Number(parts[0]);
            const m = Number(parts[1]);
            const day = Number(parts[2]);
            if (y > 0 && m > 0 && day > 0) d = y * 10000 + m * 100 + day;
          }
        }
        if (d > 0 && dates.indexOf(d) === -1) dates.push(d);
      }

      // Delete existing dates
      if (dates.length > 0) {
        await fetch("/api/admin/upload-errores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", dates }),
        });
      }

      // Insert in chunks
      const CHUNK = 500;
      let totalInserted = 0;
      for (let start = 1; start < rows.length; start += CHUNK) {
        const chunk = [rows[0], ...rows.slice(start, start + CHUNK)];
        const res = await fetch("/api/admin/upload-errores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "insert", rows: chunk }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        totalInserted += json.inserted || 0;
      }

      setUploadMsg("OK: " + totalInserted + " registros cargados");
      fetchData();
    } catch (err: any) {
      setUploadMsg("Error: " + (err.message || err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const hasFilters = fMotivo || fControlador;

  return (
    <div className="space-y-6">
      {/* Upload + Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Upload className="h-4 w-4" />
              <span className="text-xs font-medium">Cargar Errores de Preparacion</span>
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Procesando..." : "Seleccionar archivo"}
              </button>
              {uploadMsg && <span className={`text-xs ${uploadMsg.startsWith("OK") ? "text-emerald-600" : "text-red-500"}`}>{uploadMsg}</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Filter className="h-4 w-4" />
              <span className="text-xs font-medium">Filtros</span>
              {hasFilters && (
                <button onClick={() => { setFMotivo(""); setFControlador(""); setSearchCtrl(""); }}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" /> Limpiar
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={fMotivo} onChange={(e) => setFMotivo(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-background max-w-[120px]">
                <option value="">Motivo...</option>
                {motivos.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input value={searchCtrl} onChange={(e) => setSearchCtrl(e.target.value)} placeholder="Controlador..."
                  className="text-xs border rounded pl-7 pr-2 py-1 bg-background w-[140px]" />
                {searchCtrl && filteredCtrls.length > 0 && (
                  <div className="absolute top-full left-0 z-50 mt-1 bg-card border rounded shadow-lg max-h-[160px] overflow-y-auto w-[220px]">
                    {filteredCtrls.map((c: any) => (
                      <button key={c.controlador} onClick={() => { setFControlador(c.controlador); setSearchCtrl(""); }}
                        className="block w-full text-left text-xs px-3 py-1.5 hover:bg-muted truncate">
                        {c.controlador} ({c.total})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {fControlador && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded flex items-center gap-1">
                  {fControlador} <X className="h-3 w-3 cursor-pointer" onClick={() => setFControlador("")} />
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Total registros</span>
            </div>
            <p className="text-2xl font-bold">{totals.total.toLocaleString("es-AR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Total errores</span>
            </div>
            <p className="text-2xl font-bold">{totals.suma.toLocaleString("es-AR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Controladores</span>
            </div>
            <p className="text-2xl font-bold">{byControlador.length.toLocaleString("es-AR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Meses</span>
            </div>
            <p className="text-2xl font-bold">{monthly.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly trend */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Errores por Mes
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={monthly.map((r: any) => ({
                Mes: r.label,
                Registros: r.total,
                Controladores: r.controladores,
                Dias: r.dias,
                "Suma errores": r.sumaErrores,
              }))}
              filename="errores-mensual"
              sheetName="Errores Mensual"
              colWidths={[14, 12, 14, 8, 14]}
            />
            <PrintButton title="Errores Mensual" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card">Mes</th>
                <th className="text-xs font-semibold text-center p-2">Registros</th>
                <th className="text-xs font-semibold text-center p-2">Controladores</th>
                <th className="text-xs font-semibold text-center p-2">Dias</th>
                <th className="text-xs font-semibold text-center p-2">Suma errores</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row: any) => (
                <tr key={row.month} className="border-b hover:bg-muted/50">
                  <td className="text-xs font-medium p-2 sticky left-0 bg-card">{row.label}</td>
                  <td className="text-xs text-center p-2">{row.total.toLocaleString("es-AR")}</td>
                  <td className="text-xs text-center p-2">{row.controladores}</td>
                  <td className="text-xs text-center p-2">{row.dias}</td>
                  <td className="text-xs text-center p-2 font-medium text-red-500">{row.sumaErrores.toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* By Motivo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Errores por Motivo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card">Motivo</th>
                <th className="text-xs font-semibold text-center p-2">Registros</th>
                <th className="text-xs font-semibold text-center p-2">Suma errores</th>
              </tr>
            </thead>
            <tbody>
              {byMotivo.map((row: any) => (
                <tr key={row.motivo} className="border-b hover:bg-muted/50">
                  <td className="text-xs font-medium p-2 sticky left-0 bg-card">{row.motivo || "(sin motivo)"}</td>
                  <td className="text-xs text-center p-2">{row.total.toLocaleString("es-AR")}</td>
                  <td className="text-xs text-center p-2 font-medium text-red-500">{row.suma.toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Top Controladores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Top 50 Controladores con mas errores
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card">Controlador</th>
                <th className="text-xs font-semibold text-center p-2">Registros</th>
                <th className="text-xs font-semibold text-center p-2">Suma errores</th>
              </tr>
            </thead>
            <tbody>
              {byControlador.map((row: any) => (
                <tr key={row.controlador} className="border-b hover:bg-muted/50">
                  <td className="text-xs font-medium p-2 sticky left-0 bg-card">{row.controlador}</td>
                  <td className="text-xs text-center p-2">{row.total.toLocaleString("es-AR")}</td>
                  <td className="text-xs text-center p-2 font-medium text-red-500">{row.suma.toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Detail table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Detalle de Errores
            </CardTitle>
            <CardDescription>{records.length} registros</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={records.slice(0, 5000).map((r: any) => ({
                "Fecha Prep.": formatDate(r.fechaPrep),
                "Fecha Ctrl.": formatDate(r.fechaCtrl),
                "ID": r.idOperario,
                "Tipo Control": r.tipoControl,
                Controlador: r.controlador,
                "Cod. Producto": r.codigoProducto,
                Producto: r.producto,
                Errores: r.errores,
                Motivo: r.motivo,
              }))}
              filename="errores-detalle"
              sheetName="Errores"
              colWidths={[12, 12, 10, 14, 24, 16, 30, 8, 8]}
            />
            <PrintButton title="Errores Detalle" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-card">
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[90px]">Fecha Prep.</th>
                <th className="text-xs font-semibold text-left p-2 min-w-[90px]">Fecha Ctrl.</th>
                <th className="text-xs font-semibold text-left p-2 min-w-[80px]">ID</th>
                <th className="text-xs font-semibold text-left p-2 min-w-[80px]">Tipo</th>
                <th className="text-xs font-semibold text-left p-2 min-w-[140px]">Controlador</th>
                <th className="text-xs font-semibold text-left p-2 min-w-[120px]">Cod. Producto</th>
                <th className="text-xs font-semibold text-left p-2 min-w-[160px]">Producto</th>
                <th className="text-xs font-semibold text-center p-2 min-w-[50px] text-red-500">Err.</th>
                <th className="text-xs font-semibold text-center p-2 min-w-[50px]">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 2000).map((row: any, idx: number) => (
                <tr key={idx} className="border-b hover:bg-muted/50">
                  <td className="text-xs p-2 sticky left-0 bg-card">{formatDate(row.fechaPrep)}</td>
                  <td className="text-xs p-2">{formatDate(row.fechaCtrl)}</td>
                  <td className="text-xs p-2">{row.idOperario}</td>
                  <td className="text-xs p-2">{row.tipoControl}</td>
                  <td className="text-xs p-2">{row.controlador}</td>
                  <td className="text-xs p-2">{row.codigoProducto}</td>
                  <td className="text-xs p-2">{row.producto}</td>
                  <td className="text-xs text-center p-2 font-medium text-red-500">{row.errores}</td>
                  <td className="text-xs text-center p-2">{row.motivo}</td>
                </tr>
              ))}
              {records.length > 2000 && (
                <tr><td colSpan={9} className="text-xs text-center p-3 text-muted-foreground">
                  Mostrando 2000 de {records.length.toLocaleString("es-AR")} registros. Exporta a Excel para ver todos.
                </td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
