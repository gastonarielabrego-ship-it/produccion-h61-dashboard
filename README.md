# Producción H61 — Dashboard de Producción por Hora

Dashboard interactivo de producción industrial con visualización por hora, turno, circuito y operario. Los datos se leen en tiempo real desde un **Google Sheet**.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black?logo=vercel)
![Google Sheets](https://img.shields.io/badge/Google%20Sheets-Database-green?logo=google-sheets)

## Características

- **Producción por Hora**: Gráfico de barras con línea de promedio
- **Por Turno**: Líneas comparativas Mañana / Tarde / Noche
- **Por Circuito**: Barras apiladas por los 8 circuitos principales
- **Franjas Horarias**: Pestaña que discrimina operarios que ingresan 10-14hs y 18-22hs (excluye quienes ya venían de antes)
- **Top 20 Operarios**: Ranking con barras de progreso
- **Filtros interactivos**: Fecha, Turno, Circuito, Función

## Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts
- **Base de datos**: Google Sheets API v4 (almacenamiento ilimitado)
- **Deploy**: Vercel

## Setup

### 1. Preparar el Google Sheet

1. Crear una copia de tu archivo Excel en Google Sheets
2. Asegurarse de que la hoja se llame **"Datos"**
3. La primera fila debe tener los encabezados: `FUNCION, FUNCION_DESC, FECHA, TURNO, TURNO_DESC, TAREA, OPERARIO, NOMBRE, ACTIVIDAD, CIRCUITO, TIEMPO_MUE, HORA_00 ... HORA_23, TOTAL`
4. Copiar el **ID del spreadsheet** de la URL: `https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit`

### 2. Crear Cuenta de Servicio en Google Cloud

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear un nuevo proyecto (o usar uno existente)
3. Ir a **APIs & Services → Library** → Buscar y habilitar **Google Sheets API**
4. Ir a **APIs & Services → Credentials** → **Create Credentials → Service Account**
5. Darle un nombre (ej: `h61-dashboard`)
6. Click en la cuenta creada → **Keys** → **Add Key → Create new key → JSON**
7. Descargar el archivo JSON (no compartirlo)

Del archivo JSON descargado necesitas:
- `client_email` → Es tu `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` → Es tu `GOOGLE_PRIVATE_KEY`

### 3. Compartir el Google Sheet

En tu Google Sheet, ir a **Compartir** y agregar el email de la cuenta de servicio con permiso de **Editor**.

### 4. Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```bash
cp .env.example .env.local
```

```env
GOOGLE_SHEETS_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
GOOGLE_SERVICE_ACCOUNT_EMAIL=h61-dashboard@tu-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----\n"
```

### 5. Ejecutar localmente

```bash
bun install
bun run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

## Deploy en Vercel

### Vía GitHub

1. Hacer push del repo a GitHub
2. Ir a [vercel.com](https://vercel.com) → **Add New Project** → Importar el repo
3. En **Environment Variables**, agregar las 3 variables de Google
4. Deploy

### Vía CLI

```bash
npx vercel
```

Luego configurar las environment variables en el dashboard de Vercel.

## Agregar datos

Simplemente editá el Google Sheet. El dashboard lee los datos en tiempo real (con cache de 5 minutos).

- Para agregar más días: agregar filas al final
- Para corregir datos: editar las celdas directamente
- El dashboard se actualiza automáticamente

## Estructura del proyecto

```
src/
├── app/
│   ├── api/production/
│   │   ├── dates/route.ts           # Filtros disponibles
│   │   ├── hourly/route.ts          # Producción por hora
│   │   ├── summary/route.ts         # Resumen general
│   │   ├── by-circuit/route.ts      # Por circuito y hora
│   │   ├── by-shift/route.ts        # Por turno y hora
│   │   ├── operators/route.ts       # Top 20 operarios
│   │   └── time-window-operators/   # Franjas 10-14 y 18-22
│   ├── layout.tsx
│   └── page.tsx                     # Dashboard principal con tabs
├── components/
│   ├── dashboard/
│   │   ├── filters.tsx              # Barra de filtros
│   │   ├── summary-cards.tsx        # KPI cards
│   │   ├── hourly-chart.tsx         # Gráfico principal por hora
│   │   ├── by-circuit-chart.tsx     # Gráfico por circuito
│   │   ├── by-shift-chart.tsx       # Gráfico por turno
│   │   ├── summary-breakdown.tsx    # Breakdown circuito + fecha
│   │   ├── operators-table.tsx      # Top 20 operarios
│   │   └── time-window-table.tsx    # Tabla de franjas horarias
│   └── ui/                          # Componentes shadcn/ui
└── lib/
    ├── google-sheets.ts             # Servicio de lectura de Google Sheets
    └── utils.ts
```