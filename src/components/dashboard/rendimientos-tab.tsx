"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Filter, X, Trash2, TrendingUp, Download } from "lucide-react";
import { ExcelButton } from "./excel-button";
import { PrintButton } from "./print-button";

function formatFecha(fecha: number): string {
  const day = fecha % 100;
  const month = Math.floor(fecha / 100) % 100;
  return String(day).padStart(2, "0") + "/" + String(month).padStart(2, "0");
}

export function RendimientosTab() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Filters
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");

  const dateToInt = useCallback(function(dateStr: string): string {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length !== 3) return "";
    return String(Number(parts[0]) * 10000 + Number(parts[1]) * 100 + Number(parts[2]));
  }, []);

  const fetchData = useCallback(() => {
    setError(false);
    const params = new URLSearchParams();
    const fromNum = dateToInt(fDesde);
    if (fromNum) params.set("dateFrom", fromNum);
    const toNum = dateToInt(fHasta);
    if (toNum) params.set("dateTo", toNum);
    fetch("/api/rendimientos?" + params.toString(), { cache: "no-store" })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setData)
      .catch(() => setError(true));
  }, [fDesde, fHasta, dateToInt]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // All hooks before returns
  const summary = data ? (data.summary || []) : [];
  const daily = data ? (data.daily || []) : [];
  const totals = data ? (data.totals || {}) : {};

  const summaryRows = useMemo(function() {
    return summary.map(function(r: any) {
      const hsBrutas = Number(r.total_hs_brutas ?? 0);
      const hsNetas = Number(r.total_hs_netas ?? 0);
      const bultos = Number(r.total_bultos ?? 0);
      return {
        nombre: r.nombre,
        bultos: bultos,
        hsBrutas: hsBrutas,
        tmHs: Number(r.total_tm ?? 0),
        hsNetas: hsNetas,
        produccion: hsNetas > 0 ? bultos / hsNetas : 0,
        bhBruta: hsBrutas > 0 ? bultos / hsBrutas : 0,
        bhNeta: hsNetas > 0 ? bultos / hsNetas : 0,
        dias: Number(r.dias ?? 0),
      };
    });
  }, [summary]);

  // Group daily data by person
  const dailyByPerson = useMemo(function() {
    const map: Record<string, any[]> = {};
    for (let i = 0; i < daily.length; i++) {
      const r = daily[i];
      const n = String(r.nombre ?? "");
      if (!map[n]) map[n] = [];
      map[n].push(r);
    }
    return map;
  }, [daily]);

  // Excel download data — same format as reference Excel
  const excelRows = useMemo(function() {
    const rows: any[] = [];
    for (let i = 0; i < summaryRows.length; i++) {
      const s = summaryRows[i];
      const personDaily = dailyByPerson[s.nombre] || [];

      // Header row per person
      rows.push({
        Dia: "Dia",
        Personal: s.nombre,
        Bultos: "Bultos",
        "Hs. Brutas": "Hs. Brutas",
        "TM (hs)": "TM (hs)",
        "Hs. Netas": "Hs. Netas",
        Produccion: "Produccion",
        "B/H Bruta": "B/H Bruta",
        "B/H Neta": "B/H Neta",
      });

      // Daily rows
      for (let j = 0; j < personDaily.length; j++) {
        const d = personDaily[j];
        rows.push({
          Dia: String(d.dia ?? ""),
          Personal: s.nombre,
          Bultos: Number(d.bultos ?? 0),
          "Hs. Brutas": Number(d.hs_brutas ?? 0),
          "TM (hs)": Number(d.tm_hs ?? 0),
          "Hs. Netas": Number(d.hs_netas ?? 0),
          Produccion: Number(d.produccion ?? 0),
          "B/H Bruta": Math.round(Number(d.bh_bruta ?? 0) * 10) / 10,
          "B/H Neta": Math.round(Number(d.bh_neta ?? 0) * 10) / 10,
        });
      }

      // Total row
      rows.push({
        Dia: "TOTAL",
        Personal: s.nombre,
        Bultos: s.bultos,
        "Hs. Brutas": s.hsBrutas,
        "TM (hs)": Math.round(s.tmHs * 100) / 100,
        "Hs. Netas": s.hsNetas,
        Produccion: Math.round(s.produccion * 10) / 10,
        "B/H Bruta": Math.round(s.bhBruta * 10) / 10,
        "B/H Neta": Math.round(s.bhNeta * 10) / 10,
      });
    }
    return rows;
  }, [summaryRows, dailyByPerson]);

  if (error) return (
    <Card><CardContent className="p-8 text-center">
      <p className="text-sm text-muted-foreground">Error al cargar datos de rendimientos.</p>
      <button onClick={fetchData} className="mt-2 text-xs text-primary underline">Reintentar</button>
    </CardContent></Card>
  );
  if (!data) return (
    <div className="space-y-6">{[1, 2].map(function(i) {
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
      const wb = XLSX.read(ab, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: (string | number | null | undefined)[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

      if (rows.length < 2) { setUploadMsg("Error: archivo vacio"); setUploading(false); return; }

      // Collect all dates to delete first
      const dates: number[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        const v = String(row[0]).trim();
        if (v.toLowerCase() === "dia" || v.toLowerCase() === "total") continue;
        // Try parse DD/MM
        const parts = v.split("/");
        if (parts.length === 2) {
          const day = Number(parts[0]);
          const month = Number(parts[1]);
          if (day > 0 && month > 0) {
            const f = 20260000 + month * 100 + day;
            if (dates.indexOf(f) === -1) dates.push(f);
          }
        }
      }

      if (dates.length > 0) {
        await fetch("/api/admin/upload-rendimientos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", dates }),
        });
      }

      // Insert all rows
      const res = await fetch("/api/admin/upload-rendimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "insert", rows: rows }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setUploadMsg("OK: " + (json.inserted || 0) + " registros cargados");
      fetchData();
    } catch (err: any) {
      setUploadMsg("Error: " + (err.message || err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm("Eliminar TODOS los registros de rendimientos?")) return;
    try {
      const res = await fetch("/api/admin/upload-rendimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete-all" }),
      });
      const json = await res.json();
      setUploadMsg("OK: " + (json.message || "Eliminados"));
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
              <span className="text-xs font-medium">Cargar Rendimientos</span>
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
              {uploadMsg && <span className={"text-xs " + (uploadMsg.startsWith("OK") ? "text-emerald-600" : "text-red-500")}>{uploadMsg}</span>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-3">
              <Filter className="h-4 w-4" />
              <span className="text-xs font-medium">Filtros</span>
              {(fDesde || fHasta) && (
                <button onClick={() => { setFDesde(""); setFHasta(""); }}
                  className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" /> Limpiar
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-background" />
              <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-background" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Bultos Total</span>
            </div>
            <p className="text-2xl font-bold">{(totals.totalBultos ?? 0).toLocaleString("es-AR")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">B/H Bruta</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{Math.round((totals.bhBruta ?? 0) * 10) / 10}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">B/H Neta</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{Math.round((totals.bhNeta ?? 0) * 10) / 10}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Personal / Dias</span>
            </div>
            <p className="text-2xl font-bold">{totals.personal ?? 0} <span className="text-sm font-normal text-muted-foreground">/ {totals.dias ?? 0}</span></p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Table — same structure as Excel */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Resumen de Rendimientos por Personal
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <ExcelButton
              rows={excelRows}
              filename="Rendimientos"
              sheetName="Diarias"
              colWidths={[8, 30, 10, 10, 8, 10, 12, 10, 10]}
            />
            <PrintButton title="Rendimientos" />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-xs font-semibold text-left p-2 sticky left-0 bg-card min-w-[200px]">Personal</th>
                <th className="text-xs font-semibold text-center p-2">Bultos</th>
                <th className="text-xs font-semibold text-center p-2">Hs. Brutas</th>
                <th className="text-xs font-semibold text-center p-2">TM (hs)</th>
                <th className="text-xs font-semibold text-center p-2">Hs. Netas</th>
                <th className="text-xs font-semibold text-center p-2">Produccion</th>
                <th className="text-xs font-semibold text-center p-2 text-blue-600">B/H Bruta</th>
                <th className="text-xs font-semibold text-center p-2 text-emerald-600">B/H Neta</th>
                <th className="text-xs font-semibold text-center p-2">Dias</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map(function(row) {
                return (
                  <tr key={row.nombre} className="border-b hover:bg-muted/50">
                    <td className="text-xs font-medium p-2 sticky left-0 bg-card">{row.nombre}</td>
                    <td className="text-xs text-center p-2">{row.bultos.toLocaleString("es-AR")}</td>
                    <td className="text-xs text-center p-2">{row.hsBrutas}</td>
                    <td className="text-xs text-center p-2">{Math.round(row.tmHs * 100) / 100}</td>
                    <td className="text-xs text-center p-2">{row.hsNetas}</td>
                    <td className="text-xs text-center p-2">{Math.round(row.produccion * 10) / 10}</td>
                    <td className="text-xs text-center p-2 font-medium text-blue-600">{Math.round(row.bhBruta * 10) / 10}</td>
                    <td className="text-xs text-center p-2 font-medium text-emerald-600">{Math.round(row.bhNeta * 10) / 10}</td>
                    <td className="text-xs text-center p-2">{row.dias}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 font-bold bg-muted/30">
                <td className="text-xs font-bold p-2 sticky left-0 bg-muted/30">TOTAL</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{(totals.totalBultos ?? 0).toLocaleString("es-AR")}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.totalHsBrutas ?? 0}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{Math.round((totals.totalTm ?? 0) * 100) / 100}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.totalHsNetas ?? 0}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.totalHsNetas > 0 ? Math.round((totals.totalBultos / totals.totalHsNetas) * 10) / 10 : 0}</td>
                <td className="text-xs text-center font-bold p-2 text-blue-600 bg-muted/30">{Math.round((totals.bhBruta ?? 0) * 10) / 10}</td>
                <td className="text-xs text-center font-bold p-2 text-emerald-600 bg-muted/30">{Math.round((totals.bhNeta ?? 0) * 10) / 10}</td>
                <td className="text-xs text-center font-bold p-2 bg-muted/30">{totals.dias ?? 0}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Detailed daily breakdown per person */}
      {Object.keys(dailyByPerson).map(function(nombre) {
        const rows = dailyByPerson[nombre];
        const sData = summaryRows.find(function(s) { return s.nombre === nombre; });
        return (
          <Card key={nombre}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{nombre}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-xs font-semibold text-center p-2">Dia</th>
                    <th className="text-xs font-semibold text-center p-2">Bultos</th>
                    <th className="text-xs font-semibold text-center p-2">Hs. Brutas</th>
                    <th className="text-xs font-semibold text-center p-2">TM (hs)</th>
                    <th className="text-xs font-semibold text-center p-2">Hs. Netas</th>
                    <th className="text-xs font-semibold text-center p-2 text-blue-600">B/H Bruta</th>
                    <th className="text-xs font-semibold text-center p-2 text-emerald-600">B/H Neta</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(function(r: any, idx: number) {
                    return (
                      <tr key={idx} className="border-b hover:bg-muted/50">
                        <td className="text-xs text-center p-2">{String(r.dia ?? "")}</td>
                        <td className="text-xs text-center p-2">{Number(r.bultos ?? 0).toLocaleString("es-AR")}</td>
                        <td className="text-xs text-center p-2">{Number(r.hs_brutas ?? 0)}</td>
                        <td className="text-xs text-center p-2">{Number(r.tm_hs ?? 0)}</td>
                        <td className="text-xs text-center p-2">{Number(r.hs_netas ?? 0)}</td>
                        <td className="text-xs text-center p-2 text-blue-600">{Math.round(Number(r.bh_bruta ?? 0) * 10) / 10}</td>
                        <td className="text-xs text-center p-2 text-emerald-600">{Math.round(Number(r.bh_neta ?? 0) * 10) / 10}</td>
                      </tr>
                    );
                  })}
                  {sData && (
                    <tr className="border-t-2 font-bold bg-muted/30">
                      <td className="text-xs text-center font-bold p-2 bg-muted/30">TOTAL</td>
                      <td className="text-xs text-center font-bold p-2 bg-muted/30">{sData.bultos.toLocaleString("es-AR")}</td>
                      <td className="text-xs text-center font-bold p-2 bg-muted/30">{sData.hsBrutas}</td>
                      <td className="text-xs text-center font-bold p-2 bg-muted/30">{Math.round(sData.tmHs * 100) / 100}</td>
                      <td className="text-xs text-center font-bold p-2 bg-muted/30">{sData.hsNetas}</td>
                      <td className="text-xs text-center font-bold p-2 text-blue-600 bg-muted/30">{Math.round(sData.bhBruta * 10) / 10}</td>
                      <td className="text-xs text-center font-bold p-2 text-emerald-600 bg-muted/30">{Math.round(sData.bhNeta * 10) / 10}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
