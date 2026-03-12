import { Rubik } from "next/font/google";

const rubik = Rubik({ subsets: ["latin"], weight: ["700", "800", "900"] });

export default function BetaBanner() {
  return (
    <div className="sticky top-0 z-50 border-b border-white/20 bg-emerald-600/90 py-3 shadow-lg backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-3 px-4 text-center">
        {/* En mere markant hvid puls-indikator */}
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white"></span>
        </span>

        <p className={`${rubik.className} text-[11px] sm:text-xs font-black tracking-[0.18em] text-white uppercase`}>
          Beta-perioden udløber d. 12/04 – Få fuld adgang gratis nu!
        </p>
      </div>
    </div>
  );
}
