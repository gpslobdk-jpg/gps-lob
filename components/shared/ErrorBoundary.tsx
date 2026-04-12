"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorFallbackProps = {
  error?: Error | null;
  onReload?: () => void;
  onReset?: () => void;
};

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export function ErrorFallback({ error, onReload, onReset }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-10 text-slate-100">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/85 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300/80">
          Fejlhåndtering
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
          Hov, noget gik galt
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-base">
          Siden ramte en uventet fejl. Genindlæs siden for at hente en frisk version.
        </p>

        {error?.message ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
            {error.message}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Prøv igen
            </button>
          ) : null}

          <button
            type="button"
            onClick={onReload}
            className="rounded-2xl border border-emerald-300/35 bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300"
          >
            Genindlæs siden
          </button>
        </div>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React ErrorBoundary caught a crash:", error, errorInfo);
  }

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReload={this.handleReload} />;
    }

    return this.props.children;
  }
}