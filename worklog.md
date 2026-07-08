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