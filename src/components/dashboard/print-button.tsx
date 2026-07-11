"use client";

import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface PrintButtonProps {
  title?: string;
}

/**
 * Print a card's content by:
 * 1. Cloning the parent <Card> DOM
 * 2. For Recharts SVGs: fixing ResponsiveContainer sizing (inline width/height)
 * 3. For ScrollArea: removing overflow clipping so all rows print
 * 4. For bg-card / text-* / border-*: resolving CSS variables inline
 * 5. Stripping interactive elements
 * 6. Writing everything into a new window with embedded styles
 */
export function PrintButton({ title }: PrintButtonProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const resolveColor = useCallback((computed: string, fallback: string): string => {
    const v = computed.trim();
    if (v && v !== "rgba(0, 0, 0, 0)") return v;
    return fallback;
  }, []);

  const handlePrint = useCallback(() => {
    if (!cardRef.current?.parentElement) return;
    const el = cardRef.current.parentElement;
    const cs = getComputedStyle(document.documentElement);

    // Resolve key CSS variables from the current theme
    const bgCard = resolveColor(cs.getPropertyValue("--card").trim(), "#ffffff");
    const borderColor = resolveColor(
      cs.getPropertyValue("--border").trim(),
      "#e5e7eb"
    );
    const textPrimary = resolveColor(
      cs.getPropertyValue("--foreground").trim(),
      "#171717"
    );
    const textMuted = resolveColor(
      cs.getPropertyValue("--muted-foreground").trim(),
      "#737373"
    );
    const bgMuted = resolveColor(cs.getPropertyValue("--muted").trim(), "#f5f5f5");
    const bgBg = resolveColor(cs.getPropertyValue("--background").trim(), "#ffffff");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Clone the entire card
    const clone = el.cloneNode(true) as HTMLElement;

    // --- Fix Recharts ResponsiveContainer sizing ---
    // ResponsiveContainer renders a <div style="width:100%;height:100%"> inside a
    // sized wrapper. When cloned to a new window, the wrapper has 0 dimensions.
    // We find the actual SVG, grab its computed size, and hardcode it.
    clone.querySelectorAll(".recharts-wrapper").forEach((wrapper) => {
      const origSvg = el.querySelector(
        `:scope .recharts-wrapper svg`
      ) as SVGSVGElement | null;
      const w = origSvg?.getAttribute("width") || "800";
      const h = origSvg?.getAttribute("height") || "400";

      // Fix the wrapper
      (wrapper as HTMLElement).style.width = w + "px";
      (wrapper as HTMLElement).style.height = h + "px";
      (wrapper as HTMLElement).style.minWidth = w + "px";

      // Fix the ResponsiveContainer inner div
      const inner = wrapper.firstElementChild as HTMLElement | null;
      if (inner) {
        inner.style.width = w + "px";
        inner.style.height = h + "px";
        inner.style.minWidth = w + "px";
      }
    });

    // Also make sure the SVG itself has explicit width/height
    clone.querySelectorAll("svg.recharts-surface").forEach((svg) => {
      if (!svg.getAttribute("width")) svg.setAttribute("width", "800");
      if (!svg.getAttribute("height")) svg.setAttribute("height", "400");
      svg.style.width = svg.getAttribute("width") + "px";
      svg.style.height = svg.getAttribute("height") + "px";
      svg.style.overflow = "visible";
    });

    // --- Fix ScrollArea overflow clipping ---
    clone.querySelectorAll("[data-radix-scroll-area-viewport]").forEach((sa) => {
      const el_ = sa as HTMLElement;
      el_.style.overflow = "visible";
      el_.style.maxHeight = "none";
      el_.style.height = "auto";
      el_.style.width = "auto";
    });
    // Also fix Radix ScrollArea root
    clone.querySelectorAll("[data-radix-scroll-area-root]").forEach((sa) => {
      const el_ = sa as HTMLElement;
      el_.style.overflow = "visible";
      el_.style.maxHeight = "none";
      el_.style.height = "auto";
    });

    // Fix any overflow-auto / overflow-hidden containers so content doesn't clip
    clone.querySelectorAll("[class*='overflow-auto'], [class*='overflow-hidden']").forEach(
      (el_) => {
        (el_ as HTMLElement).style.overflow = "visible";
        (el_ as HTMLElement).style.maxHeight = "none";
        (el_ as HTMLElement).style.height = "auto";
      }
    );

    // --- Resolve CSS variable-dependent colors inline ---
    clone.querySelectorAll("[class*='bg-card']").forEach((el_) => {
      (el_ as HTMLElement).style.backgroundColor = bgCard;
    });
    clone.querySelectorAll("[class*='bg-background']").forEach((el_) => {
      (el_ as HTMLElement).style.backgroundColor = bgBg;
    });
    clone.querySelectorAll("[class*='bg-muted']").forEach((el_) => {
      const ht = el_ as HTMLElement;
      // Don't override explicit colored backgrounds like bg-emerald-50 etc.
      if (
        !ht.className.includes("bg-emerald") &&
        !ht.className.includes("bg-amber") &&
        !ht.className.includes("bg-rose") &&
        !ht.className.includes("bg-indigo") &&
        !ht.className.includes("bg-sky") &&
        !ht.className.includes("bg-orange") &&
        !ht.className.includes("bg-red") &&
        !ht.className.includes("bg-green") &&
        !ht.className.includes("bg-lime") &&
        !ht.className.includes("bg-yellow") &&
        !ht.className.includes("bg-gray")
      ) {
        ht.style.backgroundColor = bgMuted;
      }
    });
    clone.querySelectorAll("[class*='text-muted-foreground']").forEach((el_) => {
      (el_ as HTMLElement).style.color = textMuted;
    });
    clone.querySelectorAll("[class*='border-border']").forEach((el_) => {
      (el_ as HTMLElement).style.borderColor = borderColor;
    });
    clone.querySelectorAll("[class*='border-b'], [class*='border-t'], [class*='border-l'], [class*='border-r']").forEach(
      (el_) => {
        const ht = el_ as HTMLElement;
        // Only set if no explicit color class is present
        if (
          !ht.className.includes("border-amber") &&
          !ht.className.includes("border-rose") &&
          !ht.className.includes("border-indigo") &&
          !ht.className.includes("border-emerald") &&
          !ht.className.includes("border-sky")
        ) {
          ht.style.borderColor = borderColor;
        }
      }
    );
    // Stroke for grid lines (Recharts CartesianGrid)
    clone.querySelectorAll(".recharts-cartesian-grid line, .recharts-cartesian-grid path").forEach(
      (el_) => {
        (el_ as HTMLElement).style.stroke = borderColor;
      }
    );
    // Axis ticks/labels
    clone.querySelectorAll(".recharts-text").forEach((el_) => {
      (el_ as HTMLElement).style.fill = textPrimary;
    });

    // --- Remove interactive elements ---
    clone
      .querySelectorAll(
        "button, input, select, [role=button], [role='button'], [data-radix-scroll-area-scrollbar]"
      )
      .forEach((btn) => {
        btn.remove();
      });

    // --- Also remove the print button container itself ---
    // The print button wrapper div has our ref, find its clone and remove
    clone.querySelectorAll(".print-hide, .no-print").forEach((el_) => {
      (el_ as HTMLElement).style.display = "none";
    });

    // Build inline styles for the print document
    const printStyles = `
      @page {
        margin: 10mm;
        size: landscape;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 16px;
        color: ${textPrimary};
        background: white;
      }
      /* Ensure Recharts SVGs render at full size */
      .recharts-wrapper {
        position: relative;
      }
      .recharts-surface {
        overflow: visible !important;
      }
      /* Table styles */
      table {
        border-collapse: collapse;
        width: 100%;
      }
      th, td {
        border-bottom: 1px solid ${borderColor};
        padding: 4px 8px;
        text-align: left;
        font-size: 11px;
      }
      th {
        font-weight: 600;
        font-size: 10px;
      }
      tr {
        page-break-inside: avoid;
      }
      /* Card border */
      [class*="rounded"] {
        border: 1px solid ${borderColor};
      }
      /* Sticky columns should just be normal in print */
      [class*="sticky"] {
        position: static !important;
      }
      /* Badge styling */
      [class*="badge"], [class*="Badge"] {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        border: 1px solid ${borderColor};
      }
      /* Heatmap colors */
      .bg-green-600 { background-color: #16a34a !important; color: white !important; }
      .bg-green-400 { background-color: #4ade80 !important; color: #14532d !important; }
      .bg-lime-400 { background-color: #a3e635 !important; color: #365314 !important; }
      .bg-yellow-300 { background-color: #fde047 !important; color: #713f12 !important; }
      .bg-amber-400 { background-color: #fbbf24 !important; color: #78350f !important; }
      .bg-amber-50 { background-color: #fffbeb !important; }
      .bg-orange-400 { background-color: #fb923c !important; color: white !important; }
      .bg-red-500 { background-color: #ef4444 !important; color: white !important; }
      /* Text colors */
      .text-emerald-600 { color: #059669 !important; }
      .text-sky-600 { color: #0284c7 !important; }
      .text-amber-600 { color: #d97706 !important; }
      .text-rose-600 { color: #e11d48 !important; }
      .text-indigo-600 { color: #4f46e5 !important; }
      .text-red-400 { color: #f87171 !important; }
      /* Bar chart colors */
      .bg-emerald-500 { background-color: #10b981 !important; }
      .bg-rose-400 { background-color: #fb7185 !important; }
      .bg-amber-400 { background-color: #fbbf24 !important; }
      .bg-indigo-400 { background-color: #818cf8 !important; }
      /* Badge backgrounds */
      .bg-amber-100 { background-color: #fef3c7 !important; }
      .text-amber-700 { color: #b45309 !important; }
      .bg-gray-100 { background-color: #f3f4f6 !important; }
      .text-gray-600 { color: #4b5563 !important; }
      .bg-orange-100 { background-color: #ffedd5 !important; }
      .text-orange-700 { color: #c2410c !important; }
      /* Progress bars / rounded bg */
      .bg-muted, .bg-muted\\/30 { background-color: #f5f5f5 !important; }
      .rounded-full { border-radius: 9999px; }
      .rounded-lg { border-radius: 8px; }
      .rounded-md { border-radius: 6px; }
      .rounded-r-lg { border-radius: 0 8px 8px 0; }
      /* Font */
      .font-semibold { font-weight: 600; }
      .font-bold { font-weight: 700; }
      .font-medium { font-weight: 500; }
      .text-sm { font-size: 14px; }
      .text-xs { font-size: 12px; }
      .text-base { font-size: 16px; }
      .text-2xl { font-size: 24px; }
      .text-\[10px\] { font-size: 10px; }
      .text-\[11px\] { font-size: 11px; }
      .tracking-tight { letter-spacing: -0.025em; }
      .uppercase { text-transform: uppercase; }
      .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .text-left { text-align: left; }
      /* Flex */
      .flex { display: flex; }
      .flex-col { flex-direction: column; }
      .flex-row { flex-direction: row; }
      .flex-1 { flex: 1; }
      .flex-shrink-0 { flex-shrink: 0; }
      .items-center { align-items: center; }
      .justify-between { justify-content: space-between; }
      .justify-center { justify-content: center; }
      .gap-1, .gap-1\\.5, .gap-2, .gap-3, .gap-4, .gap-5, .gap-6 {
        gap: 0.5rem;
      }
      /* Grid */
      .grid { display: grid; }
      .grid-cols-1 { grid-template-columns: 1fr; }
      .grid-cols-2 { grid-template-columns: 1fr 1fr; }
      .grid-cols-3 { grid-template-columns: 1fr 1fr 1fr; }
      /* Spacing */
      .p-0 { padding: 0; }
      .p-1, .p-1\\.5, .p-2, .p-3, .p-4, .p-8 { padding: 8px; }
      .px-3, .px-4 { padding-left: 8px; padding-right: 8px; }
      .pb-1, .pb-2, .pb-3, .pb-4 { padding-bottom: 8px; }
      .pt-0 { padding-top: 0; }
      .pt-2, .pt-3 { padding-top: 8px; }
      .py-1, .py-2, .py-8 { padding-top: 4px; padding-bottom: 4px; }
      .space-y-0 > * + * { margin-top: 0; }
      .space-y-4 > * + * { margin-top: 16px; }
      .space-y-5 > * + * { margin-top: 20px; }
      .space-y-6 > * + * { margin-top: 24px; }
      .mb-1, .mb-1\\.5 { margin-bottom: 4px; }
      .mt-1, .mt-2 { margin-top: 4px; }
      .ml-1 { margin-left: 4px; }
      .mr-1 { margin-right: 4px; }
      /* Sizing */
      .w-2, .w-2\\.5, .w-3, .w-3\\.5, .w-4, .w-6, .w-7, .w-8, .w-14, .w-16, .w-24 {
        width: auto;
      }
      .h-2, .h-3, .h-3\\.5, .h-4, .h-6, .h-7, .h-8, .h-16 {
        height: auto;
      }
      .h-\[600px\], .h-\[480px\], .h-\[450px\], .h-\[400px\], .h-\[320px\] {
        height: auto !important;
        max-height: none !important;
      }
      .min-w-\[70px\], .min-w-\[80px\], .min-w-\[90px\], .min-w-\[100px\], .min-w-\[140px\],
      .min-w-\[38px\], .min-w-\[55px\], .min-w-\[160px\], .min-w-\[250px\] {
        min-width: 0;
      }
      .max-w-\[140px\], .max-w-\[250px\] {
        max-width: none;
      }
      .max-w-1600px {
        max-width: 1600px;
      }
      .shadow-md, .shadow-sm {
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .border-t-2 {
        border-top: 2px solid ${borderColor} !important;
      }
      .border-l-4 {
        border-left: 4px solid ${borderColor};
      }
      .border-l-amber-400 { border-left-color: #fbbf24 !important; }
      .border-l-rose-400 { border-left-color: #fb7185 !important; }
      .border-l-indigo-400 { border-left-color: #818cf8 !important; }
      /* Transition */
      .transition-all, .transition-colors {
        transition: none;
      }
      /* Hidden items */
      .print-hide, .no-print {
        display: none !important;
      }
      /* Inline block */
      .inline-block { display: inline-block; }
      /* Icon containers */
      .p-1\\.5 { padding: 6px; }
      /* Wider grid for summary cards inside franja */
      .sm\\:grid-cols-3 {
        grid-template-columns: 1fr 1fr 1fr;
      }
      /* Card content */
      [class*="Card"] {
        border: 1px solid ${borderColor};
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 8px;
        background: white;
      }
      /* Table row hover - make static */
      [class*="hover:"] {
        /* no-op in print */
      }
      /* Animations off */
      * {
        animation: none !important;
      }
      @media print {
        body { padding: 0; }
        .no-print { display: none !important; }
        .print-hide { display: none !important; }
      }
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title || "Dashboard H61"}</title>
          <style>${printStyles}</style>
        </head>
        <body>
          <div style="max-width: 1600px; margin: 0 auto;">
            ${clone.outerHTML}
          </div>
          <script>
            window.onload = function() {
              // Small delay to let SVGs render
              setTimeout(function() {
                window.print();
              }, 300);
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [resolveColor]);

  return (
    <div ref={cardRef}>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 print-hide no-print"
        onClick={handlePrint}
        title="Imprimir"
      >
        <Printer className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}