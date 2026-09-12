import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

type MobileInSchoolBannerProps = {
  variant?: "home" | "dashboard";
};

const bannerContent = {
  home: {
    eyebrow: "Regeringens mobiludmelding",
    text: "Hvad betyder den for SkoleGPS?",
    cta: "Læs vores svar",
    wrapperClass:
      "border-sky-200 bg-white shadow-[0_12px_28px_rgba(7,26,58,0.08)] hover:border-sky-300 hover:bg-sky-50/40",
    textClass: "text-sm sm:text-base",
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
  const isHome = variant === "home";

  return (
    <Link
      href="/mobil-i-skolen"
      className={`group relative block overflow-hidden rounded-2xl border focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-900 ${isHome ? "px-4 py-3 transition-colors sm:px-5" : "px-5 py-4 transition-all duration-200 sm:px-6"} text-slate-950 ${content.wrapperClass}`}
    >
      <div className="relative flex items-center gap-3">
        <div className={`flex shrink-0 items-center justify-center ${isHome ? "h-9 w-9 rounded-xl" : "h-10 w-10 rounded-2xl"} bg-sky-50 text-sky-700`}>
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-black uppercase ${isHome ? "tracking-[0.14em]" : "tracking-[0.16em]"} text-sky-700`}>
            {content.eyebrow}
          </p>
          <p className={`font-semibold leading-6 ${isHome ? "mt-0.5" : "mt-1"} text-slate-700 ${content.textClass}`}>
            {content.text}
          </p>
        </div>

        <div className={`hidden shrink-0 items-center gap-2 rounded-full text-sm font-bold transition sm:inline-flex ${isHome ? "px-3 py-1.5 text-sky-800 group-hover:text-sky-950" : "bg-sky-50 px-4 py-2 text-sky-800 group-hover:bg-sky-100"}`}>
          {content.cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </div>
      </div>
    </Link>
  );
}
