import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

type MobileInSchoolBannerProps = {
  variant?: "home" | "dashboard";
};

const bannerContent = {
  home: {
    eyebrow: "Skole & skærm i 2026",
    text: "📱 Bekymret for mobilforbud i 2026? Se hvorfor SkoleGPS er skolens sikre, lovlige og aktive valg.",
    cta: "Læs mere",
    wrapperClass:
      "border-indigo-400/35 bg-[linear-gradient(135deg,rgba(79,70,229,0.26),rgba(30,41,59,0.92)_42%,rgba(245,158,11,0.18))] shadow-[0_20px_55px_rgba(15,23,42,0.32)] hover:border-indigo-300/55 hover:shadow-[0_24px_70px_rgba(79,70,229,0.28)]",
    textClass: "text-base sm:text-lg",
  },
  dashboard: {
    eyebrow: "Skole & skærm",
    text: "Sådan kan I bruge telefoner aktivt og trygt i undervisningen.",
    cta: "Læs mere",
    wrapperClass:
      "border-sky-100 bg-white shadow-[0_14px_36px_rgba(7,26,58,0.08)] hover:border-sky-200 hover:shadow-[0_18px_44px_rgba(7,26,58,0.12)]",
    textClass: "text-sm sm:text-base",
  },
} as const;

export default function MobileInSchoolBanner({
  variant = "home",
}: MobileInSchoolBannerProps) {
  const content = bannerContent[variant];
  const isDashboard = variant === "dashboard";

  return (
    <Link
      href="/mobil-i-skolen"
      className={`group relative block overflow-hidden rounded-2xl border px-5 py-4 transition-all duration-200 sm:px-6 ${isDashboard ? "text-slate-950" : "text-white backdrop-blur-xl sm:py-5"} ${content.wrapperClass}`}
    >
      <div className="relative flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isDashboard ? "bg-sky-50 text-sky-700" : "border border-white/15 bg-white/10 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"}`}>
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-black uppercase ${isDashboard ? "tracking-[0.16em] text-sky-700" : "tracking-[0.24em] text-white/70"}`}>
            {content.eyebrow}
          </p>
          <p className={`font-semibold leading-6 ${isDashboard ? "mt-1 text-slate-700" : "mt-2 text-white/95"} ${content.textClass}`}>
            {content.text}
          </p>
        </div>

        <div className={`hidden shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition sm:inline-flex ${isDashboard ? "bg-sky-50 text-sky-800 group-hover:bg-sky-100" : "border border-white/15 bg-white/10 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] group-hover:border-white/25 group-hover:bg-white/14"}`}>
          {content.cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}
