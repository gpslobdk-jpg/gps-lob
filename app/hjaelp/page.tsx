import type { Metadata } from "next";
import { ArrowLeft, MapPin } from "lucide-react";
import Link from "next/link";

import { poppins, rubik } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "GPS-hjælp til lærere | SkoleGPS",
  description:
    "En kort vejledning til læreren, når en elevs placering ikke kan findes i et SkoleGPS-løb.",
};

const steps = [
  "Åbn løbet i telefonens almindelige Safari eller Chrome, hvis det blev åbnet inde fra en anden app.",
  "Tjek, at telefonen, browseren og SkoleGPS må bruge placering. Slå præcis placering til, hvor enheden understøtter det.",
  "Gå udenfor og lad løbet stå åbent et øjeblik, mens telefonen finder en position.",
  "Bed eleven vælge “Prøv igen”. Hold og fremdrift bliver bevaret.",
] as const;

export default function HjaelpPage() {
  return (
    <main
      className={`min-h-screen bg-[linear-gradient(180deg,#f4f9ff_0%,#e2efff_46%,#ffffff_100%)] px-5 py-6 text-slate-900 sm:px-8 sm:py-10 ${poppins.className}`}
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-100 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Til forsiden
        </Link>

        <article className="mt-7 rounded-[2rem] border border-sky-200 bg-white p-6 shadow-[0_18px_45px_rgba(7,26,58,0.08)] sm:p-10">
          <div className="flex items-center gap-3 text-sky-800">
            <MapPin className="h-5 w-5" aria-hidden="true" />
            <p className="text-xs font-black tracking-[0.18em] uppercase">Til læreren</p>
          </div>
          <h1 className={`mt-4 text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-5xl ${rubik.className}`}>
            GPS-hjælp, når placeringen mangler
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
            Brug denne korte vejledning sammen med eleven. Den ændrer ikke løbet eller opretter et nyt hold.
          </p>

          <ol className="mt-8 space-y-4">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-sm font-semibold leading-6 text-slate-700">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-700 text-xs font-black text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <p className="mt-7 text-sm leading-6 text-slate-600">
            Bed ikke eleven rydde browserdata eller tilmelde holdet igen. Hvis skolens enhed blokerer
            placering, skal skolens egne indstillinger afklares først.
          </p>
        </article>
      </div>
    </main>
  );
}
