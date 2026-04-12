"use client";

import { useEffect } from "react";

import { ErrorFallback } from "@/components/shared/ErrorBoundary";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Next global error boundary caught a crash:", error);
  }, [error]);

  return (
    <html lang="da">
      <body className="min-h-screen bg-slate-950">
        <ErrorFallback error={error} onReload={() => window.location.reload()} onReset={reset} />
      </body>
    </html>
  );
}