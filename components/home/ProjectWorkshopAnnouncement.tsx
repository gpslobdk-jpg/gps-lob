import { ArrowRight, FileText } from "lucide-react";
import Link from "next/link";

import {
  PROJECT_WORKSHOP_NEWS_PATH,
  PROJECT_WORKSHOP_PATH,
} from "@/lib/projektvaerkstedet/links";

/** A compact desktop-home announcement for the public Projektværkstedet page. */
export default function ProjectWorkshopAnnouncement() {
  return (
    <section
      aria-labelledby="home-project-workshop-heading"
      className="overflow-hidden rounded-3xl border border-emerald-200 bg-[linear-gradient(120deg,#f5fffb,#edfff7_55%,#e8f6ff)] p-5 shadow-[0_14px_34px_rgba(7,86,58,0.08)] sm:p-6"
      data-testid="home-project-workshop"
    >
      <div className="flex flex-wrap items-start gap-4 sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm">
            <FileText aria-hidden="true" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-emerald-800 uppercase">Nyt i SkoleGPS</p>
            <h3 id="home-project-workshop-heading" className="mt-1 text-xl font-black tracking-tight text-[var(--skolegps-deep-navy)]">
              Projektværkstedet: papirnære matematikforløb
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-700">
              Find Rumfang og Renover klasselokalet — to forløb med materialer til print og et tydeligt næste skridt for læreren.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 sm:shrink-0">
          <Link
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-black text-white shadow-[0_10px_22px_rgba(4,120,87,0.2)] transition hover:bg-emerald-800"
            href={PROJECT_WORKSHOP_PATH}
          >
            Se Projektværkstedet
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full px-3 py-2 text-sm font-bold text-emerald-800 underline decoration-emerald-300 underline-offset-4 transition hover:text-emerald-950"
            href={PROJECT_WORKSHOP_NEWS_PATH}
          >
            Læs nyheden
          </Link>
        </div>
      </div>
    </section>
  );
}
