"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Upload, Filter, X, Trash2, Trophy, BarChart3 } from "lucide-react";
import { ExcelButton } from "./excel-button";
import { PrintButton } from "./print-button";

function formatDate(dateNum: number): string {
  const day = dateNum % 100;
  const monthNum = Math.floor(dateNum / 100) % 100;
  const year = Math.floor(dateNum / 10000);
  return String(day).padStart(2, "0") + "/" + String(monthNum).padStart(2, "0") + "/" + year;
}

function formatWeekday(dateNum: number): string {
  const day = dateNum % 100;
  const monthNum = Math.floor(dateNum / 100) % 100;
  const year = Math.floor(dateNum / 10000);
  const days = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const d = new Date(year, monthNum - 1, day);
  return days[d.getDay()];
}

const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function formatMonthLabel(monthKey: number): string {
  const m = monthKey % 100;
  const y = Math.floor(monthKey / 100);
  return (MONTH_NAMES[m] || "") + " " + y;
}

export function ErroresTab() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Filters
  const [fMotivo, setFMotivo] = useState("");
  const [fMes, setFMes] = useState("");
  const [fDia, setFDia] = useState("");
  const [availDates, setAvailDates] = useState<number[]>([]);
  const [availMonths, setAvailMonths] = useState<number[]>([]);

  // Load available dates/months
  useEffect(() => {
    fetch("/api/errores/dates", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.dates) setAvailDates(d.dates);
        if (d.months) setAvailMonths(d.months);
      })
      .catch(() => {});
  }, [data]);

  const fetchData = useCallback(() => {
    setError(false);
    const params = new URLSearchParams();
    if (fMotivo) params.set("motivo", fMotivo);
    if (fMes) {
      const mesNum = Number(fMes);
      const year = Math.floor(mesNum / 100);
      const month = mesNum % 100;
      const lastDay = new Date(year, month, 0).getDate();
      params.set("dateFrom", `${mesNum}01`);
      params.set("dateTo", `${mesNum}${String(lastDay).padStart(2, "0")}`);
    }
    if (fDia) {
      params.set("dateFrom", fDia);
      params.set("dateTo", fDia);
    }
    fetch("/api/errores?" + params.toString(), { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [fMotivo, fMes, fDia]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // All hooks before returns
  const monthly = data ? (data.monthly || []) : [];
  const byMotivo = data ? (data.byMotivo || []) : [];
  const ranking = data ? (data.ranking || []) : [];
  const daily = data ? (data.daily || []) : [];

  // When month changes, clear day filter
  const handleMesChange = useCallback((val: string) => {
    setFMes(val);
    setFDia("");
  }, []);

  // When day changes, clear month filter
  const handleDiaChange = useCallback((val: string) => {
    setFDia(val);
    setFMes("");
  }, []);

  // Filtered dates based on selected month
  const filteredDates = useMemo(() => {
    if (fMes) {
      return availDates.filter((d) => Math.floor(d / 100) === Number(fMes));
    }
    return availDates;
  }, [availDates, fMes]);

  const motivos = useMemo(() => {
    const s: Record<string, boolean> = {};
    for (let i = 0; i < byMotivo.length; i++) s[byMotivo[i].motivo] = true;
    return Object.keys(s);
  }, [byMotivo]);

  const totals = useMemo(() => {
    let t = 0, s = 0, fal = 0, sob = 0;
    for (let i = 0; i < monthly.length; i++) {
      t += monthly[i].total;
      s += monthly[i].sumaErrores;
      fal += monthly[i].fal;
      sob += monthly[i].sob;
    }
    return { total: t, suma: s, fal, sob };
  }, [monthly]);

  const maxDaily = useMemo(() => {
    let m = 1;
    for (let i = 0; i < daily.length; i++) {
      if (daily[i].suma > m) m = daily[i].suma;
    }
    return m;
  }, [daily]);

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

      // Collect dates to delete first
      const dates: number[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        const v = row[0];
        let d = 0;
        if (typeof v === "number") {
          if (v > 30000 && v < 60000) {
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

      if (dates.length > 0) {
        await fetch("/api/admin/upload-errores", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", dates }),
        });
      }

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

  const handleDeleteAll = async () => {
    if (!confirm("Eliminar TODOS los registros de errores?")) return;
    try {
      const res = await fetch("/api/admin/upload-errores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-all" }),
      });
      const json = await res.json();
      setUploadMsg("OK: " + (json.message || "Registros eliminados"));
      fetchData();
    } catch (err: any) {
      setUploadMsg("Error: " + (err.message || err));
    }
  };

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
              <button onClick={handleDeleteAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700">
                <Trash2 className="h-3.5 w-3.5" />
                Vaciar todo
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
              {(fMotivo || fMes || fDia) && (
                <button onClick={() => { setFMotivo(""); setFMes(""); setFDia(""); }}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" /> Limpiar
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={fMes} onChange={(e) => handleMesChange(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-background max-w-[130px]">
                <option value="">Mes...</option>
                {availMonths.map((m) => <option key={m} value={m}>{formatMonthLabel(m)}</option>)}
              </select>
              <select value={fDia} onChange={(e) => handleDiaChange(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-background max-w-[130px]">
                <option value="">Dia...</option>
                {filteredDates.slice(0, 60).map((d) => (
                  <option key={d} value={d}>{formatDate(d)}</option>
                ))}
              </select>
              <select value={fMotivo} onChange={(e) => setFMotivo(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-background max-w-[120px]">
                <option value="">Motivo...</option>
                {motivos.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
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
            <p className="text-2xl font-bold text-red-500">{totals.suma.toLocaleString("es-AR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Faltantes</span>
            </div>
            <p className="text-2xl font-bold text-orange-500">{totals.fal.toLocaleString("es-AR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Sobrantes</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">{totals.sob.toLocaleString("es-AR")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily chart */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Errores por Dia
            </CardTitle>
            <CardDescription>Comparativo diario de errores registrados</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={daily.map((r: any) => ({
                Fecha: formatDate(r.date),
                Dia: formatWeekday(r.date),
                Registros: r.total,
                Errores: r.suma,
              }))}
              filename="errores-diario"
              sheetName="Errores Diario"
              colWidths={[12, 8, 10, 10]}
            />
            <PrintButton title="Errores por Dia" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-[2px] h-[200px] w-full overflow-x-auto pb-1">
            {daily.map((d: any) => {
              const h = Math.max(2, (d.suma / maxDaily) * 180);
              return (
                <div key={d.date} className="flex flex-col items-center shrink-0 group" style={{ minWidth: "6px" }}>
                  <div
                    className="w-[4px] rounded-t bg-red-400 hover:bg-red-600 transition-colors cursor-pointer"
                    style={{ height: h + "px" }}
                    title={formatDate(d.date) + ": " + d.suma + " errores"}
                  />
                </div>
              );
            })}
          </div>
          {daily.length > 0 && (
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{formatDate(daily[0].date)}</span>
              <span>{daily.length} dias</span>
              <span>{formatDate(daily[daily.length - 1].date)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* FAL/SOB by Month */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Faltantes y Sobrantes por Mes
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={monthly.map((r: any) => ({
                Mes: r.label,
                Registros: r.total,
                Dias: r.dias,
                "Total errores": r.sumaErrores,
                Faltantes: r.fal,
                Sobrantes: r.sob,
              }))}
              filename="errores-fal-sob-mensual"
              sheetName="FAL/SOB Mensual"
              colWidths={[14, 10, 8, 14, 12, 12]}
            />
            <PrintButton title="FAL/SOB por Mes" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[120px]">Mes</th>
                <th className="text-xs font-semibold text-center p-2">Registros</th>
                <th className="text-xs font-semibold text-center p-2">Dias</th>
                <th className="text-xs font-semibold text-center p-2 text-red-500">Total errores</th>
                <th className="text-xs font-semibold text-center p-2 text-orange-500">Faltantes</th>
                <th className="text-xs font-semibold text-center p-2 text-blue-500">Sobrantes</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row: any) => (
                <tr key={row.month} className="border-b hover:bg-muted/50">
                  <td className="text-xs font-medium p-2 sticky left-0 bg-card">{row.label}</td>
                  <td className="text-xs text-center p-2">{row.total.toLocaleString("es-AR")}</td>
                  <td className="text-xs text-center p-2">{row.dias}</td>
                  <td className="text-xs text-center p-2 font-medium text-red-500">{row.sumaErrores.toLocaleString("es-AR")}</td>
                  <td className="text-xs text-center p-2 font-medium text-orange-500">{row.fal.toLocaleString("es-AR")}</td>
                  <td className="text-xs text-center p-2 font-medium text-blue-500">{row.sob.toLocaleString("es-AR")}</td>
                </tr>
              ))}
              <tr className="border-t-2 font-bold bg-muted/30">
                <td className="text-xs font-bold p-2 sticky left-0 bg-muted/30">TOTAL</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.total.toLocaleString("es-AR")}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">—</td>
                <td className="text-xs text-center font-bold p-2 text-red-500 bg-muted/30">{totals.suma.toLocaleString("es-AR")}</td>
                <td className="text-xs text-center font-bold p-2 text-orange-500 bg-muted/30">{totals.fal.toLocaleString("es-AR")}</td>
                <td className="text-xs text-center font-bold p-2 text-blue-500 bg-muted/30">{totals.sob.toLocaleString("es-AR")}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Ranking Personal */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Ranking de Personal con Mayor Cantidad de Errores
            </CardTitle>
            <CardDescription>Top 30 por suma de errores</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={ranking.map((r: any, i: number) => ({
                "#": i + 1,
                Personal: r.nombre,
                Registros: r.total,
                "Suma errores": r.suma,
                Faltantes: r.fal,
                Sobrantes: r.sob,
              }))}
              filename="errores-ranking-personal"
              sheetName="Ranking"
              colWidths={[6, 30, 12, 14, 12, 12]}
            />
            <PrintButton title="Ranking Personal" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-center p-2 w-[40px]">#</th>
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[200px]">Personal</th>
                <th className="text-xs font-semibold text-center p-2">Registros</th>
                <th className="text-xs font-semibold text-center p-2 text-red-500">Suma errores</th>
                <th className="text-xs font-semibold text-center p-2 text-orange-500">Faltantes</th>
                <th className="text-xs font-semibold text-center p-2 text-blue-500">Sobrantes</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((row: any, idx: number) => (
                <tr key={row.nombre} className="border-b hover:bg-muted/50">
                  <td className="text-xs text-center p-2 text-muted-foreground">{idx + 1}</td>
                  <td className="text-xs font-medium p-2 sticky left-0 bg-card">{row.nombre}</td>
                  <td className="text-xs text-center p-2">{row.total.toLocaleString("es-AR")}</td>
                  <td className="text-xs text-center p-2 font-medium text-red-500">{row.suma.toLocaleString("es-AR")}</td>
                  <td className="text-xs text-center p-2 font-medium text-orange-500">{row.fal.toLocaleString("es-AR")}</td>
                  <td className="text-xs text-center p-2 font-medium text-blue-500">{row.sob.toLocaleString("es-AR")}</td>
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
    </div>
  );
}
