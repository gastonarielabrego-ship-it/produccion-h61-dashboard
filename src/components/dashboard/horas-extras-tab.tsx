"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Filter, X, Trash2, Trophy, BarChart3, Clock, CalendarDays, Users, PieChart } from "lucide-react";
import { ExcelButton } from "./excel-button";
import { PrintButton } from "./print-button";

const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

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

function formatMonthLabel(monthKey: number): string {
  const m = monthKey % 100;
  const y = Math.floor(monthKey / 100);
  return (MONTH_NAMES[m] || "") + " " + y;
}

export function HorasExtrasTab() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Filters
  const [fMes, setFMes] = useState("");
  const [fDia, setFDia] = useState("");

  const fetchData = useCallback(() => {
    setError(false);
    const params = new URLSearchParams();
    if (fMes) {
      const mesNum = Number(fMes);
      const year = Math.floor(mesNum / 100);
      const month = mesNum % 100;
      const lastDay = new Date(year, month, 0).getDate();
      params.set("dateFrom", String(mesNum) + "01");
      params.set("dateTo", String(mesNum) + String(lastDay).padStart(2, "0"));
    }
    if (fDia) {
      params.set("dateFrom", fDia);
      params.set("dateTo", fDia);
    }
    fetch("/api/horas-extras?" + params.toString(), { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [fMes, fDia]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // All hooks before returns
  const ranking = data ? (data.ranking || []) : [];
  const distribution = data ? (data.distribution || []) : [];
  const daily = data ? (data.daily || []) : [];
  const monthly = data ? (data.monthly || []) : [];
  const totals = data ? (data.totals || { totalHE: 0, he50: 0, he100: 0, noct100: 0, totalMins: 0 }) : { totalHE: 0, he50: 0, he100: 0, noct100: 0, totalMins: 0 };
  const availDates = data ? (data.dates || []) : [];
  const availMonths = data ? (data.months || []) : [];

  const filteredDates = useMemo(() => {
    if (fMes) {
      return availDates.filter(function(d) { return Math.floor(d / 100) === Number(fMes); });
    }
    return availDates;
  }, [availDates, fMes]);

  const handleMesChange = useCallback(function(val: string) {
    setFMes(val);
    setFDia("");
  }, []);

  const handleDiaChange = useCallback(function(val: string) {
    setFDia(val);
    setFMes("");
  }, []);

  const dailyTotals = useMemo(function() {
    let tHE = 0, tRegs = 0;
    for (let i = 0; i < daily.length; i++) {
      tHE += daily[i].totalHE;
      tRegs += daily[i].registros;
    }
    return { he: tHE, registros: tRegs, dias: daily.length };
  }, [daily]);

  const maxDaily = useMemo(function() {
    let m = 1;
    for (let i = 0; i < daily.length; i++) {
      if (daily[i].totalHE > m) m = daily[i].totalHE;
    }
    return m;
  }, [daily]);

  if (error) return (
    <Card><CardContent className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Error al cargar datos de horas extras.</p>
      <button onClick={fetchData} className="mt-2 text-xs text-primary underline">Reintentar</button>
    </CardContent></Card>
  );
  if (!data) return (
    <div className="space-y-6">{[1, 2, 3].map(function(i) {
      return (
        <Card key={i}><CardContent className="p-4 h-[200px] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent></Card>
      );
    })}</div>
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("Procesando...");

    try {
      const XLSX = await import("xlsx");
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: (string | number | null | undefined | Date)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, dateNF: "yyyy-mm-dd" });

      if (rows.length < 2) { setUploadMsg("Error: archivo vacio"); setUploading(false); return; }

      // Collect dates to delete first
      const dates: number[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[4]) continue;
        const v = row[4];
        let d = 0;
        if (v instanceof Date) {
          d = v.getFullYear() * 10000 + (v.getMonth() + 1) * 100 + v.getDate();
        } else if (typeof v === "number") {
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
        await fetch("/api/admin/upload-horas-extras", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", dates }),
        });
      }

      const CHUNK = 500;
      let totalInserted = 0;
      for (let start = 1; start < rows.length; start += CHUNK) {
        const chunk = [rows[0], ...rows.slice(start, start + CHUNK)];
        const res = await fetch("/api/admin/upload-horas-extras", {
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
    if (!confirm("Eliminar TODOS los registros de horas extras?")) return;
    try {
      const res = await fetch("/api/admin/upload-horas-extras", {
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
              <span className="text-xs font-medium">Cargar Horas Extras</span>
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
              {(fMes || fDia) && (
                <button onClick={() => { setFMes(""); setFDia(""); }}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" /> Limpiar
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={fMes} onChange={(e) => handleMesChange(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-background max-w-[140px]">
                <option value="">Mes...</option>
                {availMonths.map(function(m) { return <option key={m} value={m}>{formatMonthLabel(m)}</option>; })}
              </select>
              <select value={fDia} onChange={(e) => handleDiaChange(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-background max-w-[140px]">
                <option value="">Dia...</option>
                {filteredDates.slice(0, 80).map(function(d) {
                  return <option key={d} value={String(d)}>{formatDate(d)} ({formatWeekday(d)})</option>;
                })}
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
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Total HE</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{totals.totalHE.toLocaleString("es-AR")}</p>
            <p className="text-[11px] text-muted-foreground">horas (redondeadas)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">HE 50%</span>
            </div>
            <p className="text-2xl font-bold">{totals.he50.toLocaleString("es-AR")}</p>
            <p className="text-[11px] text-muted-foreground">horas extras al 50%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">HE 100%</span>
            </div>
            <p className="text-2xl font-bold">{totals.he100.toLocaleString("es-AR")}</p>
            <p className="text-[11px] text-muted-foreground">horas extras al 100%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Nocturnas 100%</span>
            </div>
            <p className="text-2xl font-bold">{totals.noct100.toLocaleString("es-AR")}</p>
            <p className="text-[11px] text-muted-foreground">horas nocturnas al 100%</p>
          </CardContent>
        </Card>
      </div>

      {/* Ranking Personal */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Ranking de Personal con Mayor Cantidad de Horas Extras
            </CardTitle>
            <CardDescription>
              Redondeo: si los minutos son &ge;45 se cuenta como 1 hora completa, si son &lt;45 no se cuentan.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={ranking.map(function(r, i) {
                return {
                  "#": i + 1,
                  Personal: r.nombre,
                  Sector: r.sector,
                  "HE 50%": r.he50,
                  "HE 100%": r.he100,
                  "Noct. 100%": r.noct100,
                  "Total HE": r.totalHE,
                  Dias: r.dias,
                };
              })}
              filename="horas-extras-ranking"
              sheetName="Ranking HE"
              colWidths={[6, 30, 18, 8, 10, 10, 10, 8]}
            />
            <PrintButton title="Ranking Horas Extras" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b bg-card">
                <th className="text-xs font-semibold text-center p-2 w-[40px]">#</th>
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[200px]">Personal</th>
                <th className="text-xs font-semibold text-left p-2 min-w-[120px]">Sector</th>
                <th className="text-xs font-semibold text-center p-2">HE 50%</th>
                <th className="text-xs font-semibold text-center p-2">HE 100%</th>
                <th className="text-xs font-semibold text-center p-2">Noct. 100%</th>
                <th className="text-xs font-semibold text-center p-2 text-amber-600">Total HE</th>
                <th className="text-xs font-semibold text-center p-2">Dias</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map(function(row, idx) {
                return (
                  <tr key={row.nombre} className="border-b hover:bg-muted/50">
                    <td className="text-xs text-center p-2 text-muted-foreground">{idx + 1}</td>
                    <td className="text-xs font-medium p-2 sticky left-0 bg-card">{row.nombre}</td>
                    <td className="text-xs text-left p-2 text-muted-foreground">{row.sector}</td>
                    <td className="text-xs text-center p-2">{row.he50}</td>
                    <td className="text-xs text-center p-2">{row.he100}</td>
                    <td className="text-xs text-center p-2">{row.noct100}</td>
                    <td className="text-xs text-center p-2 font-medium text-amber-600">{row.totalHE}</td>
                    <td className="text-xs text-center p-2">{row.dias}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Distribution by day type */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <PieChart className="h-4 w-4" />
              Distribucion por Dia de la Semana
            </CardTitle>
            <CardDescription>Lunes a Viernes, Sabado y Domingo</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={distribution.map(function(r) {
                return {
                  Tipo: r.tipo,
                  "HE 50%": r.he50,
                  "HE 100%": r.he100,
                  "Noct. 100%": r.noct100,
                  "Total HE": r.totalHE,
                  Registros: r.registros,
                  Personal: r.personal,
                };
              })}
              filename="horas-extras-distribucion-dia"
              sheetName="Distribucion"
              colWidths={[18, 10, 10, 10, 10, 12, 10]}
            />
            <PrintButton title="Distribucion por Dia" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[140px]">Tipo de dia</th>
                <th className="text-xs font-semibold text-center p-2">HE 50%</th>
                <th className="text-xs font-semibold text-center p-2">HE 100%</th>
                <th className="text-xs font-semibold text-center p-2">Noct. 100%</th>
                <th className="text-xs font-semibold text-center p-2 text-amber-600">Total HE</th>
                <th className="text-xs font-semibold text-center p-2">Registros</th>
                <th className="text-xs font-semibold text-center p-2">Personal</th>
              </tr>
            </thead>
            <tbody>
              {distribution.map(function(row) {
                return (
                  <tr key={row.tipo} className="border-b hover:bg-muted/50">
                    <td className="text-xs font-medium p-2 sticky left-0 bg-card">{row.tipo}</td>
                    <td className="text-xs text-center p-2">{row.he50}</td>
                    <td className="text-xs text-center p-2">{row.he100}</td>
                    <td className="text-xs text-center p-2">{row.noct100}</td>
                    <td className="text-xs text-center p-2 font-medium text-amber-600">{row.totalHE}</td>
                    <td className="text-xs text-center p-2">{row.registros.toLocaleString("es-AR")}</td>
                    <td className="text-xs text-center p-2">{row.personal}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 font-bold bg-muted/30">
                <td className="text-xs font-bold p-2 sticky left-0 bg-muted/30">TOTAL</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.he50}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.he100}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.noct100}</td>
                <td className="text-xs text-center font-bold p-2 text-amber-600 bg-muted/30">{totals.totalHE}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">—</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">—</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Daily chart */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Horas Extras por Dia
            </CardTitle>
            <CardDescription>Horas extras diarias (con redondeo)</CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={daily.map(function(r) {
                return {
                  Fecha: formatDate(r.date),
                  Dia: formatWeekday(r.date),
                  "Total HE": r.totalHE,
                  Registros: r.registros,
                  Personal: r.personal,
                };
              })}
              filename="horas-extras-diario"
              sheetName="HE Diario"
              colWidths={[12, 8, 10, 10, 10]}
            />
            <PrintButton title="HE por Dia" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-[2px] h-[200px] w-full overflow-x-auto pb-1">
            {daily.map(function(d) {
              const h = Math.max(2, (d.totalHE / maxDaily) * 180);
              return (
                <div key={d.date} className="flex flex-col items-center shrink-0 group" style={{ minWidth: "6px" }}>
                  <div
                    className="w-[4px] rounded-t bg-amber-400 hover:bg-amber-600 transition-colors cursor-pointer"
                    style={{ height: h + "px" }}
                    title={formatDate(d.date) + " (" + formatWeekday(d.date) + "): " + d.totalHE + " HE"}
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

      {/* Monthly table */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Horas Extras — Resumen Mensual
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={monthly.map(function(r) {
                return {
                  Mes: r.label,
                  "HE 50%": r.he50,
                  "HE 100%": r.he100,
                  "Noct. 100%": r.noct100,
                  "Total HE": r.totalHE,
                  Registros: r.registros,
                  Personal: r.personal,
                  Dias: r.dias,
                };
              })}
              filename="horas-extras-mensual"
              sheetName="HE Mensual"
              colWidths={[14, 10, 10, 10, 10, 12, 10, 8]}
            />
            <PrintButton title="HE Mensual" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[120px]">Mes</th>
                <th className="text-xs font-semibold text-center p-2">HE 50%</th>
                <th className="text-xs font-semibold text-center p-2">HE 100%</th>
                <th className="text-xs font-semibold text-center p-2">Noct. 100%</th>
                <th className="text-xs font-semibold text-center p-2 text-amber-600">Total HE</th>
                <th className="text-xs font-semibold text-center p-2">Registros</th>
                <th className="text-xs font-semibold text-center p-2">Personal</th>
                <th className="text-xs font-semibold text-center p-2">Dias</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map(function(row) {
                return (
                  <tr key={row.month} className="border-b hover:bg-muted/50">
                    <td className="text-xs font-medium p-2 sticky left-0 bg-card">{row.label}</td>
                    <td className="text-xs text-center p-2">{row.he50}</td>
                    <td className="text-xs text-center p-2">{row.he100}</td>
                    <td className="text-xs text-center p-2">{row.noct100}</td>
                    <td className="text-xs text-center p-2 font-medium text-amber-600">{row.totalHE}</td>
                    <td className="text-xs text-center p-2">{row.registros.toLocaleString("es-AR")}</td>
                    <td className="text-xs text-center p-2">{row.personal}</td>
                    <td className="text-xs text-center p-2">{row.dias}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 font-bold bg-muted/30">
                <td className="text-xs font-bold p-2 sticky left-0 bg-muted/30">TOTAL</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.he50}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.he100}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.noct100}</td>
                <td className="text-xs text-center font-bold p-2 text-amber-600 bg-muted/30">{totals.totalHE}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">—</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">—</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">—</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
