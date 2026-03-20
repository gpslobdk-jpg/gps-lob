"use client";

import { Lightbulb, Smartphone } from "lucide-react";

type PwaInstallTipProps = {
  variant?: "default" | "highlight";
  className?: string;
};

export default function PwaInstallTip({
  variant = "default",
  className = "",
}: PwaInstallTipProps) {
  const isHighlight = variant === "highlight";

  return (
    <aside
      className={`relative overflow-hidden rounded-3xl border px-5 py-4 text-left shadow-[0_20px_60px_rgba(2,6,23,0.28)] backdrop-blur-xl ${
        isHighlight
          ? "border-emerald-300/30 bg-slate-950/88 ring-1 ring-emerald-300/20 md:px-6 md:py-5"
          : "border-emerald-400/20 bg-slate-950/75"
      } ${className}`.trim()}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl ${
          isHighlight ? "bg-emerald-300/20" : "bg-emerald-400/16"
        }`}
      />

      <div className="relative flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${
            isHighlight
              ? "bg-emerald-300/18 text-emerald-200 ring-emerald-200/30"
              : "bg-emerald-400/15 text-emerald-300 ring-emerald-300/20"
          }`}
        >
          {isHighlight ? <Smartphone className="h-5 w-5" /> : <Lightbulb className="h-5 w-5" />}
        </div>

        <div className="min-w-0 space-y-3">
          <h3 className="text-sm font-black tracking-[0.16em] text-white uppercase md:text-base">
            PRO-TIP: FÅ DEN ÆGTE APP-OPLEVELSE
          </h3>
          <p className="text-sm leading-relaxed text-slate-200 md:text-[15px]">
            Bed eleverne gemme siden som en app, så browser-kanterne forsvinder:
          </p>
          <ul className="space-y-2.5 text-sm leading-relaxed text-slate-200 md:text-[15px]">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 text-base leading-none">🍎</span>
              <span>
                <span className="font-semibold text-white">iPhone (Safari):</span> Tryk på Del-ikonet
                (firkant med pil op) i bunden og vælg{" "}
                <span className="font-semibold text-emerald-200">'Føj til hjemmeskærm'</span>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 text-base leading-none">🤖</span>
              <span>
                <span className="font-semibold text-white">Android (Chrome):</span> Tryk på Menu-ikonet
                (tre prikker) i toppen og vælg{" "}
                <span className="font-semibold text-emerald-200">'Føj til startskærm'</span>.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
}
