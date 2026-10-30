---
Task ID: 2
Agent: Main Agent
Task: Agregar pestaña de Franjas Horarias (10-14hs y 18-22hs) al dashboard H61

Work Log:
- Analizado el requerimiento: discriminar producción por operario en dos franjas horarias
- Creado API endpoint `/api/production/time-window-operators` que calcula producción por operario en horas 10-13 y 18-21
- Creado componente `TimeWindowTable` con: 4 KPI cards, ranking por franja (top 25 cada una), tabla comparativa completa con barras de intensidad
- Modificado `page.tsx` para integrar Tabs (General / Franjas 10-14 / 18-22) compartiendo filtros
- Verificado con Agent Browser: pestañas funcionan, datos correctos, navegación fluida

Stage Summary:
- API retorna: 200 operarios en franjas, 154,581 unidades (10-14), 123,933 unidades (18-22), 69 operarios compartidos
- Los filtros (fecha, turno, circuito, función) aplican a ambas pestañas
- Archivos creados: `src/app/api/production/time-window-operators/route.ts`, `src/components/dashboard/time-window-table.tsx`
- Archivos modificados: `src/app/page.tsx` (agregado Tabs + fetch de nueva API)

---
Task ID: 3
Agent: Main Agent
Task: Restaurar resumen desaparecido + corregir resumen mensual + agregar búsqueda por nombre en colaborador

Work Log:
- Diagnosticado el error: ensureTMTable() race condition en Promise.all — getTMByDate y getTMByDateOperario llamaban ensureTMTable simultáneamente en cold starts, causando double batch y potencial timeout
- Implementado promise lock en ensureTMTable() y ensureClarkTable() — si ya hay un ensure en progreso, la segunda llamada reutiliza el mismo promise en lugar de disparar otro batch
- Verificado que summary-tables/route.ts y summary-tab.tsx estaban correctamente integrados (monthlyData como prop, single API call)
- Creado componente OperarioCombobox con búsqueda por nombre y legajo usando Popover + input de búsqueda + ScrollArea (similar a CircuitoMultiSelect)
- Reemplazado el Select plano de colaborador por el nuevo OperarioCombobox searchable
- Build exitoso (next build sin errores nuevos)

Stage Summary:
- ensureTMTable/ensureClarkTable ahora usan promise lock: `_tmEnsurePromise` / `_clarkEnsurePromise` evitan double-fire en Promise.all
- Colaborador filter ahora permite buscar por nombre o número de legajo
- Archivos modificados: `src/lib/turso.ts` (promise locks), `src/components/dashboard/filters.tsx` (OperarioCombobox)
---
Task ID: 3
Agent: main
Task: Fix missing /api/admin/upload route — data not updating after upload

Work Log:
- User reported new data not updating after upload
- Investigation: header-actions.tsx sends production uploads to `/api/admin/upload` but that route was missing (deleted by external commit)
- Only `/api/admin/upload-clarkistas` and `/api/admin/upload-tm` existed
- Restored `/api/admin/upload/route.ts` from git history (commit 2e523c7)
- Rewrote with Turbopack-safe patterns (classic for loops, named functions)
- Route handles chunked upload: DELETE old dates + INSERT in 200-row chunks
- Also has GET health check endpoint
- Built and deployed to production

Stage Summary:
- Restored missing `/api/admin/upload` route for production data uploads
- Deployed to https://produccion-h61-dashboard.vercel.app

---
Task ID: 4
Agent: main
Task: Create new "Horas Extras" tab with monthly comparison

Work Log:
- Created `/api/admin/upload/route.ts` (was deleted by external commit, needed for data uploads)
- Updated `summary-tables/route.ts` with: calcHorasBrutas (midnight wrap-around fix), horas extras calculation per operator per day (>8hs = extras)
- Added to monthlyData: horasExtras, misionesConHE, cmpHE (per-day rate comparison, skip if <7 days)
- Created `horas-extras-tab.tsx` with: 4 KPI cards (total HE, HE/día promedio, misiones con HE, costo estimado), monthly comparison table with variation %
- Added "Hs. Extras" tab to page.tsx between Citación and Clarkistas
- Uses same filter bar as other Preparación tabs
- Built and deployed to production

Stage Summary:
- New "Hs. Extras" tab deployed with monthly overtime comparison
- Restored /api/admin/upload route for data uploads
- All previous fixes preserved (midnight wrap-around, TM calculation)

---
Task ID: 1
Agent: main
Task: Add Comparativo tab to dashboard with ranking, top/avg/below 10, and collaborator evolution chart

Work Log:
- Explored codebase: page.tsx, rendimientos-tab.tsx, rendimientos API, schema, chart patterns
- Created /api/comparativo/route.ts — full API with ranking, top10, average10, below10, globalAvg, stdDev, evolution data
- Created /components/dashboard/comparativo-tab.tsx — full UI with filters, KPI cards, horizontal bar chart (recharts), 3 ranking cards, evolution line chart with daily detail table, full ranking table, Excel download
- Added Comparativo tab to page.tsx with GitCompare icon
- Fixed accidental deletion of /api/admin/upload/route.ts during deploy
- Build verified successfully
- Deployed to Vercel via git push

Stage Summary:
- New Comparativo tab live at https://produccion-h61-dashboard.vercel.app
- API: /api/comparativo returns ranking with category classification (top/average/below)
- Categories based on globalAvg ± 0.5*stdDev thresholds
- Evolution chart shows daily B/H Neta and B/H Bruta trend for selected collaborator
- Clicking any row in ranking tables selects that collaborador for evolution view
- Restored upload route that was accidentally deleted

---
Task ID: 2
Agent: main
Task: Change Comparativo tab from daily to monthly comparison

Work Log:
- Rewrote /api/comparativo/route.ts to aggregate data by month (YYYYMM)
- Added monthly aggregation: groups daily data per (month, person), calculates monthly B/H Neta
- Added monthlyAvg: average B/H Neta per month across all collaborators
- Added monthlyChartData: per-person monthly columns for grouped bar chart
- Added monthLabels: list of month labels for chart legend
- Added 'meses' count per person in ranking
- Evolution now returns monthly data instead of daily
- Rewrote comparativo-tab.tsx for monthly view
- Added grouped ComposedChart showing all months as separate bars per person
- Evolution chart shows month-by-month B/H Neta, B/H Bruta, and monthly average line
- Detail table shows Mes, Bultos, Dias, Produccion, B/H Bruta, B/H Neta, Prom. Mes, vs Prom. Gral.
- Ranking tables show Meses count instead of Dias
- KPI card shows month count
- Build and deploy successful

Stage Summary:
- Comparativo now compares by months as requested
- New monthly grouped chart shows all collaborators with bars per month
- Evolution chart shows month-by-month trend with monthly average reference line
- Deployed to Vercel

---
Task ID: 3
Agent: main
Task: Redesign Comparativo tab - remove cluttered bar charts, add distribution histogram + multi-collaborator comparison

Work Log:
- Analyzed screenshots with VLM: confirmed charts were unintelligible (185 bars, spaghetti effect)
- Removed the two problematic bar charts (horizontal bar + monthly grouped)
- Added distribution histogram: stacked bars showing how many people fall in each B/H Neta range, colored by category (top/average/below)
- Redesigned evolution section as a multi-collaborator comparator:
  - Can select up to 5 collaborators via "+" buttons on tables or search
  - Line chart shows all selected persons' monthly B/H Neta trends together
  - Monthly average reference line
  - Per-person detail table with diff vs global avg
  - Colored chips for selected persons with remove button
- Modified API to support multiple operarios (operario param now repeats)
- Added distribution histogram data to API response
- Build and deploy successful

Stage Summary:
- No more cluttered bar charts
- Distribution histogram gives a clear visual of how performance is distributed
- Multi-collaborator comparison is the main interactive feature
- "+" buttons on all ranking tables and full ranking table to add people to compare
- Deployed to Vercel

---
Task ID: 4
Agent: main
Task: Add accordion to ranking rows with monthly evolution + replace distribution chart with month-by-month category chart

Work Log:
- Modified /api/comparativo/route.ts to add two new data structures:
  - monthlyCategoryCounts: per-month count of people in each category (top/average/below) based on monthly B/H Neta
  - personMonthly: per-person monthly evolution data (operario → sorted monthly rows)
- Replaced the static distribution histogram with "Evolución Mensual por Categoría" stacked bar chart:
  - X axis = months, stacked bars show Mejores (green), En Promedio (yellow), Por Debajo (red)
  - Added summary table below the chart with per-month counts
  - Custom MonthlyCatTooltip showing totals
- Added accordion/dropdown to every row in the Ranking Completo table:
  - Click any row to expand/collapse with chevron icon
  - Expanded view shows: mini AreaChart of monthly B/H Neta trend with global avg reference line
  - Monthly detail table with: Mes, Bultos, Dias, B/H Bruta, B/H Neta, vs Prom., vs Mes Ant.
  - Color-coded diffs (green=positive, red=negative, amber=neutral)
- Added "Tendencia" column to ranking table showing trend indicator:
  - TrendingUp (green) if last month improved by >0.5 vs previous month
  - TrendingDown (red) if declined by >0.5
  - Minus (amber) if change within ±0.5
- Added EvolutionTooltip component for the accordion area chart
- Added Fragment import for multiple <tr> per ranking row
- Build verified successfully

Stage Summary:
- Distribution chart replaced by month-by-month category count stacked bar chart
- Each ranking row is now expandable with monthly evolution detail
- Trend indicators show if collaborators are improving or declining
- API now returns monthlyCategoryCounts and personMonthly data
---
Task ID: 1
Agent: main
Task: Fix upload routes and allow Word document uploads

Work Log:
- Diagnosed missing /api/admin/upload route (main production upload)
- Fixed upload-clarkistas: converted SQLite syntax ({ sql, args }) to PostgreSQL ($1, $2 positional params)
- Fixed upload-tm: converted SQLite syntax to PostgreSQL
- Fixed upload-horas-extras: removed undefined ensureTable() calls
- Created /api/admin/upload/route.ts with proper Neon PostgreSQL syntax
- Added .docx/.doc file type support to all upload inputs
- Built and verified: all routes compile and work
- Pushed to GitHub → Vercel auto-deployed

Stage Summary:
- /api/admin/upload now works (6054 production records)
- upload-horas-extras fixed (31,096 records)
- upload-clarkistas fixed (3,159 records) 
- upload-tm fixed (1,418 records)
- All file inputs now accept .xlsx, .xls, .csv, .docx, .doc
---
Task ID: 2
Agent: main
Task: Fix Rendimientos tab - EVENTUAL filter crash, Excel format, number consistency

Work Log:
- Diagnosed EVENTUAL filter crash: CAST(SUBSTRING(operario FROM 2) AS INTEGER) fails for VX-prefixed operarios
- Fixed with safe CASE expression: only cast when substring is all digits, else 99999
- Applied fix to: /api/rendimientos, /api/comparativo, and /lib/neon.ts
- Added empty separator rows between collaborators in Excel export
- Verified number consistency: Bultos match exactly (2,587,735)
- TM difference explained: Summary includes all operarios, Rendimientos only those with production

Stage Summary:
- EVENTUAL filter now works (143 eventuales in Sep)
- EFECTIVO filter works (123 efectivos in Sep)  
- Combined filters work (turno + tipo)
- Excel export now has blank rows between collaborators
- Bultos totals match between Rendimientos and Summary

---
Task ID: 1
Agent: main
Task: Fix rendimientos tab - eventuales crash, Excel numbers, gaps/events by horario

Work Log:
- Analyzed rendimientos-tab.tsx and /api/rendimientos/route.ts
- Found eventuales filter crash caused by SUBSTRING(operario FROM 2) on edge-case operarios (@, *DFT)
- Fixed by moving tipo filter to JS-side in rendimientos API route
- Added LENGTH(operario) >= 2 guard in neon.ts buildWhere for safer SQL
- Fixed Excel TOTAL Produccion: changed from bultos/dias (average) to total bultos (sum)
- Added gaps/events section with "Gaps / Eventos" toggle button
- Gaps/events sorted chronologically by horario (fecha, hora) not by magnitude
- Added tiempos muertos detail view sorted by fecha
- Added dedicated Excel exports for gaps/events and TM events
- Verified empty separator rows between collaborators in Excel download
- Deployed to Vercel production

Stage Summary:
- EVENTUAL filter no longer crashes (tested with 208 eventual operarios)
- EFECTIVO filter works correctly (181 efectivo operarios)
- Gaps/events properly sorted by horario (verified chronological order)
- Excel TOTAL Produccion now shows sum of bultos, consistent with daily rows
- TM events shown with motivo code, minutos, and observacion
- Deployed at https://produccion-h61-dashboard.vercel.app

---
Task ID: 5
Agent: main
Task: Add Turno Intermedio tab (pikeos from 9:00hs) + verify upload buttons still work

Work Log:
- Analyzed existing project structure: page.tsx (8 tabs), header-actions.tsx (4 upload buttons), filters.tsx, rendimientos-tab.tsx
- Found MISSING /api/admin/upload route (Preparación button was broken - 404)
- Created /src/components/dashboard/turno-intermedio-tab.tsx: new tab component with pre-filtered turno="I", own date/tipo filters, KPI cards, summary table, per-person daily breakdown, Excel/Print buttons, warning if turno not found in DB
- Updated /src/app/page.tsx: added Coffee icon import, TurnoIntermedioTab import, "turno-intermedio" TabsTrigger and TabsContent, hidden FilterBar for turno-intermedio tab
- Updated /src/components/dashboard/header-actions.tsx: added "ti" to UploadingLabel type, tiInputRef, handleTIFileChange handler, Coffee icon import, T. Intermedio button (amber colored)
- Created /src/app/api/admin/upload/route.ts: missing upload route for production_records (chunked upload with delete+insert pattern, GET warmup endpoint)
- Build verified: next build compiled successfully with no errors
- All 20 verification checks PASSED: each button has unique ref/handler, shared uploading state disables others, API routes exist, tab is properly integrated

Stage Summary:
- New "T. Intermedio" tab added (turno code "I") for monitoring workers with pikeos from 9:00hs
- New "T. Intermedio" upload button in header (amber colored, Coffee icon)
- Fixed MISSING /api/admin/upload route that was causing Preparación uploads to fail with 404
- All 5 upload buttons working: Preparación, Clarkistas, T. Muertos, T. Intermedio, Informe
- Tab uses /api/rendimientos with turno=I pre-applied filter

---
Task ID: 6
Agent: main
Task: Turno Intermedio as virtual filter (detected by first pikeo at 9:00hs) - deploy and verify

Work Log:
- Changed approach: Intermedio is NOT a DB turno code, it's a VIRTUAL filter detected by hourly data
- Modified neon.ts buildWhere(): when turno="I", uses SQL condition (hora_09 > 0 AND hora_00..hora_08 = 0) instead of turno='I'
- Modified neon.ts applyFilters(): same logic for in-memory filtering
- Modified /api/production/dates: auto-detects Intermedio records and adds {value:"I", label:"Intermedio"} to shifts array
- Modified /api/rendimientos: when turno=I, skips SQL turno filter and applies JS-side hourly filter after fetching
- Updated turno-intermedio-tab.tsx: simplified, uses same /api/rendimientos?turno=I endpoint
- Fixed missing closing parenthesis in rendimientos route
- Deployed to Vercel via git push
- Verified: API /api/production/dates shows I=Intermedio in shifts dropdown
- Verified: API /api/rendimientos?turno=I returns 202 personas, 277,269 bultos, B/H Neta=35.1
- Verified: All 6 upload API routes respond correctly (5 x 200, 1 x 405 expected)

Stage Summary:
- Intermedio is now a FILTER option in the Turno dropdown, available on ALL tabs
- Auto-detected: records where hora_09 is the first active hour (hours 0-8 are zero)
- 202 workers classified as Intermedio across 137 days
- T. Intermedio tab still exists as a monitoring shortcut with pre-applied turno=I filter
- All upload buttons verified working on production

---
Task ID: 7
Agent: main
Task: RRHH tab loads extremely slow (stuck loading) - performance fix

Work Log:
- User reported: RRHH tab stays loading a very long time when opening reports
- Diagnosed /api/rrhh: hourly breakdown loop was O(opKeys x 24 x prodRows) =
  10,656 person-days x 24 hours x 67,353 rows = ~17.2 BILLION iterations (~60-90s CPU)
  Each person-day re-scanned ALL production rows 24 times to build the hourly array
- Measured on production Neon DB: 494 nomina users -> 67,353 raw production rows,
  old projected pipeline ~74-86s; also 3 sequential DB queries and 25MB payload
- FIX 1: production query now aggregates in SQL: GROUP BY fecha, operario with
  SUM(hora_XX) + SUM(CASE WHEN hora_XX > 0 THEN 1 ELSE 0 END) AS act_hora_XX
  (act_ flags preserve exact "hour active in any raw row" semantics) -> 67K rows -> 10.6K
- FIX 2: hourly array accumulated in single JS pass (no nested re-scan)
- FIX 3: production + tiempos_muertos queries run in parallel (Promise.all)
- FIX 4: NeonClient.execute widened to accept string[] params (operario = ANY($1))
- Correctness: benchmarked old vs new logic against production data:
  10,656 person-days compared, 0 mismatches (bultos, hs_brutas, hourly all identical)
- Payload fetched from DB: 25MB -> 9.2MB
- Deployed to Vercel via git push (commit f05c002)
- Verified production: /api/rrhh full report 200 OK in 1.6-2.0s (was 80-90s+),
  filtered query 0.7s, hourly sums match bultos exactly

Stage Summary:
- RRHH tab now loads in ~2s with FULL history and no filters (previously minutes/timeout)
- Response shape unchanged - frontend needed no changes
- Hourly drill-down per person-day still shows exact same numbers

---
Task ID: 8
Agent: main
Task: Full-project performance optimization (SQL aggregation + parallel queries + indexes)

Work Log:
- Audited all 15+ API endpoints, benchmarked each on production (worst case, no filters)
- Added getAggRecords() helper to lib/neon.ts: SQL GROUP BY (fecha, operario) with
  SUM(hora_XX) + per-hour active flags (SUM(CASE WHEN hora_XX>0 ...)), exported getPool/buildWhere
- Rewrote with SQL-side aggregation + parallel queries:
  * production/summary: 3.0s -> 0.5s (5 grouped queries in parallel)
  * production/hourly-combined: 3.0s -> 0.6s (3 queries)
  * production/daily-combined: -> 0.4s (1 grouped query)
  * production/by-shift: 2.6s -> 0.5s (2 queries)
  * production/time-window-operators: 3.0s -> 1.3s (getAggRecords)
  * production/citacion: 4.2s/6.0MB -> 2.3s/2.15MB (zero-days omitted + TM parallel)
  * production/summary-tables: 3.7s -> 2.2s (agg + exact turno attribution query)
  * production/dates: was fetching ALL rows for dropdowns -> 7 tiny parallel queries
  * rendimientos: aggregated, MIN(nombre) replicates old first-alphabetical naming
  * comparativo: aggregated + TM parallel
  * monthly-summary: FIXED always-500 TDZ bug (monthlyData referenced inside own .map)
- Frontend citacion-tab: Map-based day lookups replace O(ops x dates x days) .find() (~13M ops/render)
- New indexes on Neon: clarkistas_records(fecha, fecha_turno, operario, circuito), tiempos_muertos(operario)
- Correctness verified against production baselines captured BEFORE deploy:
  summary/hourly-combined/daily-combined/by-shift: IDENTICAL
  citacion (week + operario + full): MATCH (884 worked days, zero-days omitted by design)
  rendimientos: 26,400 daily rows + 407 summary buckets MATCH (filtered turno=I and tipo paths also verified)
  comparativo: 407 rankings MATCH; summary-tables: daily/monthly/heatmaps IDENTICAL
  production/dates: 100% identical (incl. 464 operator labels, shift order via ctid)
- Known micro-diff (documented): summary-tables heByTurno turno attribution for
  split-shift days (~0.1%): old relied on unstable heap row order; totals conserved exactly
  (197,095 hs brutas / 13,360 hs extras in both). New behavior deterministic (count majority,
  min-id tie-break). Empty-name daily row ordering now deterministic (operario tie-break).
- Deployed: commits 5f37243, 299ad96 via git push

Stage Summary:
- General tab: 4 parallel fetches each now 0.4-0.6s (was ~3s each) -> tab loads ~4-6x faster
- Citacion: payload 6.0MB -> 2.15MB, render O(1) lookups, server 1.8x faster
- monthly-summary endpoint fixed (was 500 since creation, broke Resumen monthly compare data path if used)
- All response shapes unchanged; frontend only touched where rendering complexity was the bottleneck

═══════════════════════════════════════════════════════════════════
Task ID 8 — Botones de carga muertos + guardián anti-pérdida de rutas
Fecha: 2026-10-29
═══════════════════════════════════════════════════════════════════
Reporte del usuario: "verificar los botones de carga que no responden y
que queden en un entorno donde no se vuelva a perder la ruta"

ROOT CAUSE (botón Preparación muerto):
- HeaderActions.handleFileChange y AdminPanel apuntaban a POST /api/admin/upload
- Esa ruta fue BORRADA accidentalmente en commit 50ee55c (que solo quería
  tocar el filtro RRHH solo-activos) — ya había pasado una vez antes y se
  restauró en a8d90e1 ("fix: restore /api/admin/upload route")
- Resultado: warmup GET → 404, delete/insert → 404 HTML → toast con
  basura/HTML parseado. Botón parecía "no responder".

FIXES:
1. Restaurada src/app/api/admin/upload/route.ts desde a8d90e1 (159 líneas,
   protocolo delete/insert por bloques, maxDuration 60, coincide con vercel.json)
2. GUARDIÁN: scripts/verify-routes.js — escanea todos los literales /api/...
   en src/ y resuelve cada uno contra el árbol src/app/api (soporta [x] y
   [...x]). Exit 1 señalando archivo:línea si falta una ruta.
   Integrado a npm run build → Vercel no puede deployar un botón roto.
   Test negativo verificado: rename de route.ts → exit 1 con ubicaciones.
3. Endurecido upload por bloques en errores-tab y horas-extras-tab:
   postJson() con AbortController 30s (antes: "Procesando..." podía colgarse
   para siempre), res.ok verificado (antes: DELETE fallado pasaba silencioso
   y luego re-insertaba duplicados), 404/500 en HTML ahora produce mensaje
   legible en vez de SyntaxError de JSON.

Auditoría completa de referencias: 20 rutas /api/* usadas por la UI, todas
existentes tras restaurar /api/admin/upload (verificador: 20/20 OK).
ExcelButton/PrintButton son locales (sin red) — siempre responden.

Build: exit 0; /api/admin/upload presente en .next/app-path-routes-manifest.json
tsc: 19 errores preexistentes en rutas admin ajenas (cubierto por
ignoreBuildErrors); CERO errores en archivos modificados.

═══════════════════════════════════════════════════════════════════
Task ID 9 — Mapa de Calor por Mes + rediseño profesional + nómina atómica
Fecha: 2026-10-29
═══════════════════════════════════════════════════════════════════
Pedido del usuario: mapa de calor por mes (como el diario), rediseño
profesional de todas las pestañas, verificar botones de carga, y que la
nómina "se vaya pisando" al cargar.

1) MAPA DE CALOR POR MES
- api/production/summary-tables: acumulador monthHourMap (mes:hora → bultos)
  en la MISMA pasada (cero queries extra) + monthHeatmap [{month,label,0..23}]
- summary-tab: HeatmapTable con modo isMonthly (label "Ene 2026", Excel
  mapa-calor-mes) insertado entre el mapa por Día y por Colaborador

2) REDISEÑO PROFESIONAL (todas las pestañas)
- NUEVO src/components/dashboard/ui-kit.tsx: KpiCard (chip de ícono + valor
  grande tabular-nums), SectionCard (encabezado estándar con ícono acentuado
  + acciones), ErrorState (con Reintentar), TabSkeleton (skeletons), clases
  TH/TD/TD_NUM/TR_FOOT para tablas uniformes
- page.tsx: canvas bg-muted/30, header sticky con sombra + badge de estado,
  TabsList blanca con scroll horizontal mobile, footer actualizado
- globals.css: scrollbar fino, selection esmeralda, font-smoothing
- Tabs reestilizados con primitivos: Resumen (Métricas Diarias, 3 mapas de
  calor, Resumen Mensual), RRHH/Nómina (KPIs + tabla), Rendimientos, Turno
  Intermedio, Errores (KPIs), Horas Extras (KPIs), Citación, Comparativo
  (estados), FilterBar (chip en encabezado)
- monthly-summary: migrado a SectionCard

3) NÓMINA ATÓMICA ("que se vaya pisando")
- api/admin/upload-nomina: NUEVA action "replace" — transacción PostgreSQL
  (BEGIN → DELETE all → upserts en batches de 100 → COMMIT; ROLLBACK total
  si cualquier bloque falla → la nómina anterior queda intacta)
- header-actions: si ≤1500 filas usa "replace" en UN request (55s timeout),
  mensaje "Pisando nómina anterior..."; >1500 filas → flujo por bloques previo
- Verificado estado producción: 494 filas, 0 duplicados (PK usuario), 402
  activo='' / 92 activo='1'

4) INCIDENTE: la ruta /api/admin/upload volvió a desaparecer del repo local
  (workspace reescrito entre sesiones; el commit local 9b130fa perdió el
  archivo). EL GUARDIÁN LO DETECTÓ: npm run build falló con exit 1 señalando
  admin-panel.tsx:49 y header-actions.tsx:205. Restaurada nuevamente desde
  a8d90e1; local realineado a origin/main (5703ae1) que SÍ la contiene y
  producción la sirve (200, 131,235 registros). Lección: el verify-routes en
  build es la red de seguridad que faltaba.

VERIFICACIÓN FINAL EN PRODUCCIÓN (deploy 1e148f6):
- monthHeatmap: 7 meses reales (Feb 2026: pico 154.586 bultos a las 10hs; Feb→Sep,
  hora pico 10-15hs según mes) — ✓ en /api/production/summary-tables
- upload-nomina anuncia "replace | delete | insert | insert-parsed" — ✓
- Barrido de rutas: 12/12 GET=200 · 7/7 POST=400-sonda (existen y validan) — ✓
- Browser real (headless): General, Resumen (3 mapas de calor visibles),
  RRHH (KPIs 494 nómina / 272 con producción), Rendimientos — renderizan sin
  errores de página; botones de carga Preparación/Clarkistas/T.Muertos/Nómina/
  Informe presentes en el header — ✓
