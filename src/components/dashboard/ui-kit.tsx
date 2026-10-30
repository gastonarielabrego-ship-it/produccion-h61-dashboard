"use client";

/**
 * ui-kit — primitivos de diseño compartidos por todas las pestañas.
 * Objetivo: consistencia visual profesional (encabezados, KPIs, estados
 * de carga/error y tablas) sin repetir estilos en cada componente.
 */

import { type ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, type LucideIcon } from "lucide-react";

// ─── Paleta de acentos para KPIs e íconos ───
export type Tone = "emerald" | "sky" | "amber" | "red" | "violet" | "slate";

const TONE_CHIP: Record<Tone, string> = {
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
  red: "bg-red-50 text-red-500 dark:bg-red-950/50 dark:text-red-400",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400",
  slate: "bg-muted text-muted-foreground",
};

// ─── KpiCard: tarjeta de indicador ───
export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  tone = "slate",
  valueClass = "",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  valueClass?: string;
}) {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <span className="text-[10px] sm:text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
            {label}
          </span>
          <div className={`p-1.5 rounded-lg shrink-0 ${TONE_CHIP[tone]}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <p className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums leading-none ${valueClass}`}>
          {value}
        </p>
        {sub ? <p className="text-[11px] text-muted-foreground mt-1.5">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

// ─── SectionCard: tarjeta con encabezado estándar (ícono + título + acciones) ───
export function SectionCard({
  icon: Icon,
  title,
  description,
  actions,
  children,
  contentClassName = "",
  tone = "slate",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  tone?: Tone;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${TONE_CHIP[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm sm:text-base font-semibold leading-tight">{title}</CardTitle>
            {description ? <CardDescription className="text-xs mt-0.5">{description}</CardDescription> : null}
          </div>
        </div>
        {actions ? <div className="flex items-center gap-1 shrink-0">{actions}</div> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

// ─── Estados de carga y error uniformes ───
export function TabSkeleton({ rows = 3, height = "h-44" }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} className="shadow-sm">
          <CardContent className={`p-5 ${height} flex flex-col justify-center gap-3`}>
            <div className="h-3 w-40 bg-muted rounded animate-pulse" />
            <div className="h-3 w-full bg-muted rounded animate-pulse" />
            <div className="h-3 w-2/3 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function InlineSpinner({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground" aria-busy="true">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ message = "Error al cargar los datos.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardContent className="p-8 text-center">
        <div className="mx-auto w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
        {onRetry ? (
          <button
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Loader2 className="h-3 w-3" /> Reintentar
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Clases de tabla compartidas ───
export const TH = "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-center p-2 whitespace-nowrap";
export const TH_LEFT = `${TH} text-left`;
export const TD = "text-xs text-center p-2 whitespace-nowrap";
export const TD_LEFT = `${TD} text-left`;
export const TD_NUM = `${TD} tabular-nums`;
export const TR_FOOT = "border-t-2 font-bold bg-muted/40";
