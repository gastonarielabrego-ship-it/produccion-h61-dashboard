"use client";

import { useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface PrintButtonProps {
  title?: string;
}

/**
 * Finds the closest ancestor <div> that has the shadcn Card structure
 * (contains both a CardHeader and CardContent, or has rounded/border/card classes).
 * Falls back to the closest element with data-slot="card" (shadcn pattern).
 */
function findCardEl(from: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = from;
  while (el && el !== document.body) {
    // shadcn/ui Card renders with data-slot="card" in newer versions
    if (el.getAttribute("data-slot") === "card") return el;
    // Fallback: look for the Card by checking class pattern
    if (
      el.tagName === "DIV" &&
      el.className &&
      typeof el.className === "string" &&
      (el.className.includes("rounded") || el.className.includes("border")) &&
      el.querySelector("[class*='CardHeader'], [class*='card-header']") &&
      el.querySelector("[class*='CardContent'], [class*='card-content']")
    ) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

export function PrintButton({ title }: PrintButtonProps) {
  const btnRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    const btnEl = btnRef.current;
    if (!btnEl) return;

    // Find the Card ancestor (not just the immediate parent CardHeader)
    const card = findCardEl(btnEl);
    if (!card) return;

    // Collect the target + all ancestors up to body
    const path: HTMLElement[] = [];
    let el: HTMLElement | null = card;
    while (el && el !== document.body) {
      path.push(el);
      el = el.parentElement;
    }

    // Mark everything
    document.body.classList.add("is-printing");
    card.setAttribute("data-printing", "true");
    for (let i = 0; i < path.length - 1; i++) {
      path[i].setAttribute("data-print-ancestor", "true");
    }

    const cleanup = () => {
      document.body.classList.remove("is-printing");
      card.removeAttribute("data-printing");
      path.forEach((a) => a.removeAttribute("data-print-ancestor"));
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