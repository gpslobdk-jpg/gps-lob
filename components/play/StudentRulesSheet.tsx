"use client";

import { BookOpen, Shield, Swords, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export type StudentRulesGameType = "zone-krig" | "stratego";

type StudentRulesSheetProps = {
  open: boolean;
  onClose: () => void;
  gameType: StudentRulesGameType;
};

type RulesSection =
  | {
      kind: "card";
      text: string;
    }
  | {
      kind: "combat";
      heading: string;
      summary: string;
      lines: string[];
    };

const RULES_CONTENT: Record<
  StudentRulesGameType,
  {
    title: string;
    subtitle: string;
    accentClassName: string;
    glowClassName: string;
    sections: RulesSection[];
  }
> = {
  "zone-krig": {
    title: "Zone-Krigen",
    subtitle: "Ultra-kort version til spilleren",
    accentClassName:
      "border-cyan-300/28 bg-cyan-400/12 text-cyan-100 shadow-[0_0_28px_rgba(34,211,238,0.14)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.14),transparent_30%)]",
    sections: [
      {
        kind: "card",
        text: "🎯 Formål: Erobr zoner og hold dem! Det er antal zoner ved slutfløjtet, der tæller – point er kun til pynt.",
      },
      {
        kind: "card",
        text: "🏃 Erobring: Løb hen til en zone. Svar rigtigt for at overtage den.",
      },
      {
        kind: "card",
        text: "🛡️ Skjold (3 min): Når I overtager en zone, får den et 3-minutters skjold mod fjender.",
      },
      {
        kind: "card",
        text: "🔄 Fornyelse: Svarer I rigtigt på jeres egen zone, får I ikke nye point, men I fornyer jeres eget skjold!",
      },
    ],
  },
  stratego: {
    title: "Live Stratego",
    subtitle: "Ultra-kort version til spilleren",
    accentClassName:
      "border-white/16 bg-white/8 text-white shadow-[0_0_28px_rgba(255,255,255,0.08)]",
    glowClassName:
      "bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.2),transparent_30%)]",
    sections: [
      {
        kind: "combat",
        heading: "⚔️ HVEM SLÅR HVEM?",
        summary: "* Højeste rang vinder normalt.",
        lines: [
          "Fane: Taber til alle. (Bliver fanen fanget, taber holdet!).",
          "Bombe: Slår alt, undtagen Minøren.",
          "Minør: Er den eneste, der slår Bomben.",
          "Spion: Slår Feltmarskal (men kun hvis Spionen angriber).",
          "Uafgjort: Har I samme rang, dør I begge to.",
        ],
      },
      {
        kind: "card",
        text: "📡 Radaren: Fjender vises som runde zoner, ikke som prikker. Du skal selv finde dem i virkeligheden!",
      },
      {
        kind: "card",
        text: "🛡️ Fred & Genoplivning: Jeres base er en fredszone. Dør du, skal du tilbage til basen for at genopstå (10 sek. spawn-skjold bagefter).",
      },
      {
        kind: "card",
        text: "⏱️ Cooldown: Efter et angreb er der 5 sekunders pause, før du kan angribe igen.",
      },
    ],
  },
};

export default function StudentRulesSheet({ open, onClose, gameType }: StudentRulesSheetProps) {
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
  }, [onClose, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const content = RULES_CONTENT[gameType];
  const AccentIcon = gameType === "zone-krig" ? Swords : Shield;

  return createPortal(
    <div className="fixed inset-0 z-[2150]">
      <button
        type="button"
        aria-label="Luk regler"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/72 backdrop-blur-sm animate-[student-rules-overlay-in_220ms_ease-out]"
      />

      <div className="absolute inset-x-0 bottom-0 flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-label={`Spilregler for ${content.title}`}
          className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/90 shadow-[0_-24px_90px_rgba(2,6,23,0.62)] backdrop-blur-2xl animate-[student-rules-sheet-in_280ms_cubic-bezier(0.22,1,0.36,1)]"
          style={{ maxHeight: "80svh" }}
        >
          <div className={`pointer-events-none absolute inset-0 ${content.glowClassName}`} />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_22%,transparent_42%)]" />

          <div className="relative border-b border-white/10 px-4 pb-4 pt-3 sm:px-5">
            <div className="mx-auto h-1.5 w-14 rounded-full bg-white/18" />

            <div className="mt-4 flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${content.accentClassName}`}
              >
                <AccentIcon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/45">
                  Spilregler
                </p>
                <h2 className="mt-2 text-xl font-black tracking-tight text-white">{content.title}</h2>
                <p className="mt-1 text-sm text-white/62">{content.subtitle}</p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl">
              <div className="flex items-center gap-2 text-white/70">
                <BookOpen className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-[0.22em]">
                  Hurtigt opslagskort
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
              {content.sections.map((section, index) =>
                section.kind === "combat" ? (
                  <div
                    key={`${section.heading}-${index}`}
                    className="rounded-[1.5rem] border border-rose-300/18 bg-[linear-gradient(145deg,rgba(56,189,248,0.08),rgba(244,63,94,0.12),rgba(2,6,23,0.84))] px-4 py-4 shadow-[0_18px_45px_rgba(2,6,23,0.24)] backdrop-blur-xl"
                  >
                    <p className="text-base font-black tracking-tight text-white">{section.heading}</p>
                    <p className="mt-2 text-sm font-semibold text-white/76">{section.summary}</p>
                    <div className="mt-4 space-y-2">
                      {section.lines.map((line) => (
                        <div
                          key={line}
                          className="rounded-[1.15rem] border border-white/10 bg-white/[0.045] px-3 py-3 text-sm leading-6 text-white/84"
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    key={`${section.text}-${index}`}
                    className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] px-4 py-4 text-sm leading-6 text-white/84 shadow-[0_18px_45px_rgba(2,6,23,0.22)] backdrop-blur-xl"
                  >
                    {section.text}
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        @keyframes student-rules-overlay-in {
          from {
            opacity: 0;
          }

          to {
            opacity: 1;
          }
        }

        @keyframes student-rules-sheet-in {
          from {
            opacity: 0;
            transform: translateY(3rem);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}
