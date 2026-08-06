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