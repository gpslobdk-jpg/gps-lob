import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { poppins, rubik } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Opdateringer | SkoleGPS",
  description: "Nyt fra SkoleGPS og de værktøjer, der er på vej.",
};

const updates = [
  {
    title: "FondsGPS er på vej",
    body:
      "FondsGPS bliver et værktøj til skoler, der vil finde relevante puljer og gøre en ansøgning klar. Arbejdet samles fra idé og muligheder til ansøgning og bilag — med skolens egen godkendelse hele vejen.",
  },
  {
    title: "SkoleGPS Music Studio er på vej",
    body:
      "SkoleGPS Music Studio bliver et privat musikstudie, hvor Jeppe kan optage en idé, arbejde videre med den og bevare overblikket over sine egne optagelser. AI skal hjælpe i processen, men musikken begynder hos Jeppe.",
  },
] as const;

export default function OpdateringerPage() {
  return (
    <main
      className={`min-h-screen bg-[linear-gradient(180deg,#f4f9ff_0%,#e2efff_42%,#ffffff_100%)] px-5 py-6 text-slate-900 sm:px-8 sm:py-10 ${poppins.className}`}
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-300 hover:text-sky-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Til forsiden
        </Link>

        <article className="mt-7 rounded-[2rem] border border-sky-200 bg-white p-6 shadow-[0_18px_45px_rgba(7,26,58,0.08)] sm:p-10">
          <p className="text-xs font-black tracking-[0.18em] text-sky-800 uppercase">På vej</p>
          <h1
            className={`mt-4 text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-5xl ${rubik.className}`}
          >
            Opdateringer
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
            To nye værktøjer er undervejs. Her er kort, hvad de skal hjælpe med.
          </p>

          <div className="mt-8 space-y-4" data-testid="upcoming-tools-list">
            {updates.map((update) => (
              <section key={update.title} className="rounded-2xl border border-sky-100 bg-sky-50/55 p-5 sm:p-6">
                <h2 className={`text-xl font-black text-[var(--skolegps-deep-navy)] ${rubik.className}`}>
                  {update.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-700">{update.body}</p>
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  );
}
