"use client";

import { useId } from "react";
import { Smartphone } from "lucide-react";

import { Switch } from "@/components/ui/switch";

type FocusModeSettingProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
  status?: "ready" | "loading" | "unavailable";
};

export default function FocusModeSetting({ enabled, onChange, disabled = false, compact = false, status = "ready" }: FocusModeSettingProps) {
  const helpId = useId();
  const statusId = useId();
  const stateLabel = status === "loading" ? "Henter…" : status === "unavailable" ? "Ukendt" : enabled ? "Til" : "Fra";

  return (
    <div className="my-4 rounded-2xl border border-white/15 bg-slate-950/35 p-3 text-slate-100" data-testid="focus-mode-setting">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold"><Smartphone aria-hidden="true" className="h-4 w-4 shrink-0" />Fokusmode</p>
          {!compact && <p className="mt-1 text-xs leading-5 text-slate-300">Registrér hvis elever forlader SkoleGPS under løbet.</p>}
          <p id={statusId} role="status" aria-live="polite" aria-atomic="true" className="mt-2 text-xs font-bold text-cyan-100">
            Status: {stateLabel}
          </p>
        </div>
        {status === "ready" ? (
          <Switch
            checked={enabled}
            onCheckedChange={onChange}
            disabled={disabled}
            ariaLabel="Fokusmode"
            ariaDescribedBy={`${statusId} ${helpId}`}
            size="touch"
            className="focus-visible:ring-cyan-200"
          />
        ) : (
          <span aria-hidden="true" className="relative inline-flex h-11 w-[4.75rem] shrink-0 items-center rounded-full border border-white/20 bg-slate-950/50 opacity-55">
            <span className="inline-block h-9 w-9 translate-x-1 rounded-full bg-white shadow-lg" />
          </span>
        )}
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
