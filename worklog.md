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
