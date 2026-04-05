"use client";

import { BookOpen, Shield, Swords, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export type LiveRulesGameType = "zone-krig" | "stratego";

type LiveRulesSheetProps = {
  open: boolean;
  onClose: () => void;
  gameType: LiveRulesGameType;
};

const RULES_CONTENT: Record<
  LiveRulesGameType,
  {
    title: string;
    subtitle: string;
    accentClassName: string;
    iconClassName: string;
    panelGlowClassName: string;
    items: string[];
  }
> = {
  "zone-krig": {
    title: "Zone-Krigen",
    subtitle: "Hurtigt overblik til læreren",
    accentClassName:
      "border-cyan-300/25 bg-cyan-400/12 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.14)]",
    iconClassName: "text-cyan-200",
    panelGlowClassName:
      "bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.16),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.14),transparent_30%)]",
    items: [
      "Formål: Erobr og hold fast i flest zoner, når tiden løber ud. Point er kun til pynt – zoner afgør sejren.",
      "Erobring: Løb hen til en zone og svar rigtigt på opgaven for at overtage den.",
      "Skjold (3 minutter): Når en zone overtages, får den et 3-minutters skjold. Modstanderne kan ikke stjæle den.",
      "Fornyelse: Svarer I rigtigt på en af jeres egne zoner, fornyer I jeres eget skjold med 3 friske minutter.",
    ],
  },
  stratego: {
    title: "Live Stratego",
    subtitle: "Hurtigt overblik til læreren",
    accentClassName:
      "border-white/15 bg-white/8 text-white shadow-[0_0_28px_rgba(255,255,255,0.08)]",
    iconClassName: "text-white",
    panelGlowClassName:
      "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.18),transparent_30%)]",
    items: [
      "Formål: Find og fang modstanderholdets Fane for at vinde øjeblikkeligt.",
      "Radaren: Fjender vises som abstrakte radarzoner. Se afstanden, men find dem i virkeligheden.",
      "Fredszoner: Området omkring jeres base er fredet.",
      "Genoplivning: Gå tilbage til basen, hvis du dør. Du får 10 sekunders spawn-skjold efter genoplivning.",
      "Dueller (Cooldown: 5 sek.): Angrib inden for 20m. Efter et angreb er der 5 sekunders pause.",
      "Hvem slår hvem? Højeste rang vinder. Undtagelser: Fane taber til alle. Bombe slår alt (undtagen Minør). Minør slår Bombe. Spion slår Feltmarskal (men kun i angreb). Uafgjort = begge dør.",
    ],
  },
};

export default function LiveRulesSheet({ open, onClose, gameType }: LiveRulesSheetProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const content = RULES_CONTENT[gameType];
  const AccentIcon = gameType === "zone-krig" ? Swords : Shield;

  return createPortal(
    <div className="fixed inset-0 z-[2100]">
      <button
        type="button"
        aria-label="Luk spilregler"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/74 backdrop-blur-sm"
      />

      <div className="absolute inset-0 flex justify-end">
        <section
          role="dialog"
          aria-modal="true"
          aria-label={`Spilregler for ${content.title}`}
          className="relative flex h-full w-full max-w-[26rem] flex-col overflow-hidden border-l border-white/10 bg-slate-950/92 shadow-[-28px_0_80px_rgba(2,6,23,0.62)] backdrop-blur-2xl"
        >
          <div className={`pointer-events-none absolute inset-0 ${content.panelGlowClassName}`} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_18%,transparent_40%)]" />

          <div className="relative flex items-start gap-3 border-b border-white/10 px-5 py-5">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${content.accentClassName}`}
            >
              <AccentIcon className={`h-5 w-5 ${content.iconClassName}`} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/45">
                Spilregler
              </p>
              <h2 className="mt-2 text-xl font-black tracking-tight text-white">{content.title}</h2>
              <p className="mt-1 text-sm text-white/60">{content.subtitle}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="relative flex-1 overflow-y-auto px-5 py-5">
            <div className="rounded-[1.45rem] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
              <div className="flex items-center gap-2 text-white/70">
                <BookOpen className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-[0.22em]">Lærerens hurtige huskeliste</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {content.items.map((item) => (
                <div
                  key={item}
                  className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] px-4 py-4 text-sm leading-6 text-white/82 shadow-[0_18px_45px_rgba(2,6,23,0.22)] backdrop-blur-xl"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}
