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
