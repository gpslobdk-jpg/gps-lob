"use client";

import { useId } from "react";
import { Smartphone } from "lucide-react";

type FocusModeSettingProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  status?: "ready" | "loading" | "unavailable";
};

export default function FocusModeSetting({ enabled, onChange, disabled = false, compact = false, status = "ready" }: FocusModeSettingProps) {
  const helpId = useId();
  const stateLabel = status === "loading" ? "Henter…" : status === "unavailable" ? "Ukendt" : enabled ? "Til" : "Fra";

  return (
    <div className="my-4 rounded-2xl border border-white/15 bg-slate-950/35 p-3 text-slate-100" data-testid="focus-mode-setting">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold"><Smartphone aria-hidden="true" className="h-4 w-4 shrink-0" />Fokusmode{compact ? `: ${stateLabel}` : ""}</p>
          {!compact && <p className="mt-1 text-xs leading-5 text-slate-300">Registrér hvis elever forlader SkoleGPS under løbet.</p>}
        </div>
        <button
          type="button"
          role={status === "ready" ? "switch" : undefined}
          aria-label="Fokusmode"
          aria-checked={status === "ready" ? enabled : undefined}
          aria-describedby={helpId}
          disabled={disabled || status !== "ready"}
          onClick={() => onChange(!enabled)}
          className={`min-h-11 min-w-16 shrink-0 rounded-xl border px-3 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 ${enabled && status === "ready" ? "border-cyan-200/60 bg-cyan-200 text-slate-950" : "border-white/20 bg-white/5 text-slate-200"}`}
        >
          {stateLabel}
        </button>
      </div>
      {status === "unavailable" && <p role="status" className="mt-2 text-xs leading-5 text-slate-300">Fokusstatus kan ikke hentes lige nu. Kontrollér i livevisningen.</p>}
      <details className="mt-2 text-xs leading-5 text-slate-300">
        <summary className="w-fit cursor-pointer rounded py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">Om Fokusmode</summary>
        <div id={helpId} className="mt-1 space-y-2">
          <p>SkoleGPS registrerer, hvis eleven forlader spilskærmen. Vi kan ikke se, hvad eleven åbner eller besøger.</p>
          <p>Bed eleverne om kun at have én telefon med under løbet. Fokusmode kan kun registrere, om SkoleGPS forlades på den telefon, hvor løbet kører.</p>
        </div>
      </details>
    </div>
  );
}
