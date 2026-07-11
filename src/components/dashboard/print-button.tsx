"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface PrintButtonProps {
  title?: string;
}

export function PrintButton({ title }: PrintButtonProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!cardRef.current?.parentElement) return;
    const el = cardRef.current.parentElement;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Collect stylesheets from current page
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join("\n");
        } catch {
          return "";
        }
      })
      .join("\n");

    // Clone the element and its siblings (the full card)
    const clone = el.cloneNode(true) as HTMLElement;

    // Remove any interactive elements from the clone
    clone.querySelectorAll("button, input, select, [role=button]").forEach((btn) => {
      btn.remove();
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title || "Dashboard H61"}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #171717; background: white; }
            ${styles}
            .print-hide { display: none !important; }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div style="max-width: 1600px; margin: 0 auto;">
            ${clone.outerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

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