"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold">Error al cargar el dashboard</h2>
        <p className="text-sm text-muted-foreground">
          No se pudo conectar con la base de datos. Esto puede ser un problema temporal.
          {error.message && (
            <span className="block mt-2 text-xs font-mono bg-muted p-2 rounded">
              {error.message}
            </span>
          )}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
