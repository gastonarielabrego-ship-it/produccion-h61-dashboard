"use client";

import { useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

let printCounter = 0;

interface PrintButtonProps {
  title?: string;
}

export function PrintButton({ title }: PrintButtonProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const targetId = useRef(`print-target-${++printCounter}`);

  const handlePrint = useCallback(() => {
    const card = cardRef.current?.parentElement;
    if (!card) return;

    // Walk up to find the top-level content wrapper
    // The DOM is: body > div.min-h-screen > main > TabsContent > ... > Card
    // We need to mark the Card and all ancestors up to body
    const ancestors: HTMLElement[] = [];
    let el: HTMLElement | null = card;
    while (el && el !== document.body) {
      ancestors.push(el);
      el = el.parentElement;
    }

    // Mark body
    document.body.classList.add("is-printing");
    // Mark the target card
    card.setAttribute("data-printing", "true");
    // Mark all ancestors so they stay visible
    ancestors.forEach((a) => a.setAttribute("data-print-ancestor", "true"));

    const cleanup = () => {
      document.body.classList.remove("is-printing");
      card.removeAttribute("data-printing");
      ancestors.forEach((a) => a.removeAttribute("data-print-ancestor"));
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);

    window.print();
  }, []);

  useEffect(() => {
    if (cardRef.current?.parentElement) {
      cardRef.current.parentElement.setAttribute("data-printable", targetId.current);
    }
  }, []);

  return (
    <div ref={cardRef} className="print-hide">
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