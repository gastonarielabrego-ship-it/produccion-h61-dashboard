"use client";

import { useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface PrintButtonProps {
  title?: string;
}

let styleEl: HTMLStyleElement | null = null;

function findCard(from: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = from;
  while (el && el !== document.body) {
    if (el.getAttribute("data-slot") === "card") return el;
    el = el.parentElement;
  }
  return null;
}

function injectPrintCSS(targetCard: HTMLElement) {
  if (styleEl) return; // already injected

  styleEl = document.createElement("style");
  styleEl.id = "dynamic-print-styles";
  styleEl.textContent = `
    @media print {
      /* Hide EVERYTHING first */
      body > *:not([data-print-root]) {
        display: none !important;
      }

      /* Hide the print-root's children EXCEPT the target card */
      [data-print-root] > *:not([data-print-keep]) {
        display: none !important;
      }

      /* Hide deeper non-keep siblings */
      [data-print-keep] > *:not([data-print-keep]):not([data-print-target]) {
        display: none !important;
      }
      [data-print-target] > * {
        display: revert !important;
      }
      [data-print-target] > * > * {
        display: revert !important;
      }

      /* But hide buttons/inputs/selects inside the target */
      [data-print-target] button,
      [data-print-target] input,
      [data-print-target] select {
        display: none !important;
      }

      /* Force light mode */
      html, body {
        background: white !important;
        color: #171717 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* Card bg white */
      [data-print-target],
      [data-print-target] * {
        background: transparent !important;
      }
      [data-print-target],
      [data-print-target] [data-slot="card"],
      [data-print-target] [data-slot="card-content"],
      [data-print-target] [data-slot="card-header"] {
        background: white !important;
        color: #171717 !important;
      }

      /* Unlock scroll areas */
      [data-print-target] [data-radix-scroll-area-viewport],
      [data-print-target] [data-radix-scroll-area-root],
      [data-print-target] .overflow-auto,
      [data-print-target] .overflow-hidden {
        overflow: visible !important;
        max-height: none !important;
        height: auto !important;
      }

      /* Remove fixed heights on chart containers */
      [data-print-target] .h-\\[600px\\],
      [data-print-target] .h-\\[480px\\],
      [data-print-target] .h-\\[450px\\],
      [data-print-target] .h-\\[400px\\],
      [data-print-target] .h-\\[320px\\] {
        height: auto !important;
        max-height: none !important;
      }

      /* Sticky → static */
      [data-print-target] .sticky {
        position: static !important;
        background: white !important;
      }

      /* Recharts */
      [data-print-target] .recharts-surface,
      [data-print-target] .recharts-wrapper {
        overflow: visible !important;
      }

      /* Page */
      @page {
        margin: 8mm;
        size: landscape;
      }

      /* No page breaks in rows */
      [data-print-target] tr {
        page-break-inside: avoid;
      }

      /* No animations */
      * {
        animation: none !important;
        transition: none !important;
      }

      /* Print colors for heatmaps */
      [data-print-target] .bg-green-600 { background-color: #16a34a !important; color: white !important; }
      [data-print-target] .bg-green-400 { background-color: #4ade80 !important; color: #14532d !important; }
      [data-print-target] .bg-lime-400 { background-color: #a3e635 !important; color: #365314 !important; }
      [data-print-target] .bg-yellow-300 { background-color: #fde047 !important; color: #713f12 !important; }
      [data-print-target] .bg-amber-400 { background-color: #fbbf24 !important; color: #78350f !important; }
      [data-print-target] .bg-amber-50 { background-color: #fffbeb !important; }
      [data-print-target] .bg-orange-400 { background-color: #fb923c !important; color: white !important; }
      [data-print-target] .bg-red-500 { background-color: #ef4444 !important; color: white !important; }
      [data-print-target] .bg-emerald-50 { background-color: #ecfdf5 !important; }
      [data-print-target] .bg-rose-50 { background-color: #fff1f2 !important; }
      [data-print-target] .bg-indigo-50 { background-color: #eef2ff !important; }
      [data-print-target] .bg-sky-50 { background-color: #f0f9ff !important; }
      [data-print-target] .bg-gray-100 { background-color: #f3f4f6 !important; }
      [data-print-target] .bg-orange-100 { background-color: #ffedd5 !important; }
      [data-print-target] .bg-amber-100 { background-color: #fef3c7 !important; }

      /* Progress bars */
      [data-print-target] .bg-emerald-500 { background-color: #10b981 !important; }
      [data-print-target] .bg-rose-400 { background-color: #fb7185 !important; }
      [data-print-target] .bg-indigo-400 { background-color: #818cf8 !important; }
      [data-print-target] .bg-muted { background-color: #f5f5f5 !important; }
      [data-print-target] .bg-muted\\/30 { background-color: rgba(245,245,245,0.3) !important; }

      /* Badge colors */
      [data-print-target] .bg-amber-100 { background-color: #fef3c7 !important; }
      [data-print-target] .text-amber-700 { color: #b45309 !important; }
      [data-print-target] .bg-gray-100 { background-color: #f3f4f6 !important; }
      [data-print-target] .text-gray-600 { color: #4b5563 !important; }
      [data-print-target] .bg-orange-100 { background-color: #ffedd5 !important; }
      [data-print-target] .text-orange-700 { color: #c2410c !important; }

      /* Text colors */
      [data-print-target] .text-emerald-600 { color: #059669 !important; }
      [data-print-target] .text-sky-600 { color: #0284c7 !important; }
      [data-print-target] .text-amber-600 { color: #d97706 !important; }
      [data-print-target] .text-rose-600 { color: #e11d48 !important; }
      [data-print-target] .text-indigo-600 { color: #4f46e5 !important; }
      [data-print-target] .text-red-400 { color: #f87171 !important; }
      [data-print-target] .text-muted-foreground { color: #737373 !important; }

      /* Border colors */
      [data-print-target] .border-amber-400 { border-color: #fbbf24 !important; }
      [data-print-target] .border-rose-400 { border-color: #fb7185 !important; }
      [data-print-target] .border-indigo-400 { border-color: #818cf8 !important; }

      /* Muted text */
      [data-print-target] .text-muted-foreground { color: #737373 !important; }

      /* Ensure grid children are visible */
      [data-print-target] .grid > * {
        display: block !important;
      }

      /* Border for table */
      [data-print-target] table {
        border-collapse: collapse;
      }
      [data-print-target] th,
      [data-print-target] td {
        border-bottom: 1px solid #e5e7eb;
      }

      /* Make sure text is visible */
      [data-print-target] * {
        color: inherit;
      }
      [data-print-target],
      [data-print-target] [data-slot="card"],
      [data-print-target] [data-slot="card-header"],
      [data-print-target] [data-slot="card-content"],
      [data-print-target] [data-slot="card-title"],
      [data-print-target] [data-slot="card-description"] {
        color: #171717 !important;
      }
      [data-print-target] .text-emerald-600 { color: #059669 !important; }
      [data-print-target] .text-sky-600 { color: #0284c7 !important; }

      /* Muted */
      [data-print-target] .text-muted-foreground { color: #737373 !important; }
      [data-print-target] .text-\[10px\] { font-size: 10px !important; }
      [data-print-target] .text-\[11px\] { font-size: 11px !important; }

      /* Border left colors for franjas */
      [data-print-target].border-l-amber-400 { border-left: 4px solid #fbbf24 !important; }
      [data-print-target].border-l-rose-400 { border-left: 4px solid #fb7185 !important; }
      [data-print-target].border-l-indigo-400 { border-left: 4px solid #818cf8 !important; }
      [data-print-target].border-l-4 { border-left: 4px solid #e5e7eb !important; }
      [data-print-target] .border-t-2 { border-top: 2px solid #e5e7eb !important; }

      /* Print-hide inside target */
      [data-print-target] .print-hide {
        display: none !important;
      }
    }
  `;
  document.head.appendChild(styleEl);
}

function removePrintCSS() {
  if (styleEl) {
    styleEl.remove();
    styleEl = null;
  }
}

export function PrintButton({ title }: PrintButtonProps) {
  const btnRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    const btnEl = btnRef.current;
    if (!btnEl) return;

    const card = findCard(btnEl);
    if (!card) return;

    // Walk up and mark the path
    const path: HTMLElement[] = [];
    let el: HTMLElement | null = card;
    while (el && el !== document.body) {
      path.push(el);
      el = el.parentElement;
    }

    // Mark the root (direct child of body)
    const root = path[path.length - 1];
    root.setAttribute("data-print-root", "true");

    // Mark all intermediate ancestors as "keep"
    for (let i = 1; i < path.length - 1; i++) {
      path[i].setAttribute("data-print-keep", "true");
    }

    // Mark the card as "target"
    card.setAttribute("data-print-target", "true");

    // Inject dynamic print CSS
    injectPrintCSS(card);

    const cleanup = () => {
      removePrintCSS();
      root.removeAttribute("data-print-root");
      for (let i = 1; i < path.length - 1; i++) {
        path[i].removeAttribute("data-print-keep");
      }
      card.removeAttribute("data-print-target");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    window.print();
  }, []);

  return (
    <div ref={btnRef} className="print-hide">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handlePrint}
        title="Imprimir"
      >
        <Printer className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}