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
    eyebrow: "Skærmanbefalinger 2026",
    text: "Læs hvordan SkoleGPS støtter op om ministeriets nye skærmanbefalinger for 2026.",
    cta: "Se siden",
    wrapperClass:
      "border-amber-300/45 bg-[linear-gradient(135deg,rgba(245,158,11,0.22),rgba(15,23,42,0.94)_36%,rgba(79,70,229,0.14))] shadow-[0_18px_46px_rgba(15,23,42,0.22)] hover:border-amber-200/65 hover:shadow-[0_22px_60px_rgba(245,158,11,0.18)]",
    textClass: "text-sm sm:text-base",
  },
} as const;

export default function MobileInSchoolBanner({
  variant = "home",
}: MobileInSchoolBannerProps) {
  const content = bannerContent[variant];

  return (
    <Link
      href="/mobil-i-skolen"
      className={`group relative block overflow-hidden rounded-[1.75rem] border px-5 py-4 text-white backdrop-blur-xl transition-all duration-300 sm:px-6 sm:py-5 ${content.wrapperClass}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.10),transparent_34%)]" />

      <div className="relative flex items-start gap-4">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.24em] text-white/70 uppercase">
            {content.eyebrow}
          </p>
          <p className={`mt-2 font-semibold leading-6 text-white/95 ${content.textClass}`}>
            {content.text}
          </p>
        </div>

        <div className="hidden shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] transition group-hover:border-white/25 group-hover:bg-white/14 sm:inline-flex">
          {content.cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}
