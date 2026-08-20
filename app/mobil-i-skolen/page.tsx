import type { Metadata } from "next";

import { ArrowLeft, Compass, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { poppins, rubik } from "@/lib/fonts";

const futureProofPoints = [
  {
    title: "Aktiv skærmtid",
    body:
      "Børnene sidder ikke og stener. Telefonen er forvandlet til et værktøj (en radar og et interaktivt kort), der får dem op af stolene, ud i naturen og giver sved på panden.",
    icon: Compass,
  },
  {
    title: "Lærerstyret",
    body:
      'Det er altid læreren, der sætter rammen. Via "Gude-overblikket" og nødbremsen har læreren 100 % kontrol over aktiviteten.',
    icon: ShieldCheck,
  },
  {
    title: "Bygger fællesskab",
    body:
      "Spillet kræver fysisk interaktion, holdarbejde, kommunikation og taktik i den virkelige verden. Det er teknologi, der bringer eleverne sammen, i stedet for at isolere dem.",
    icon: Users,
  },
] as const;

export const metadata: Metadata = {
  title: "Mobilforbud i skolen | SkoleGPS",
  description:
    "Læs hvorfor SkoleGPS og Live Stratego er et aktivt, lærerstyret og fremtidssikret valg i en tid med skærmanbefalinger og debat om mobilforbud i skolen.",
};

export default function MobilISkolenPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#06111f_0%,#0d1b2b_38%,#071712_100%)] px-4 py-8 text-white sm:px-6 md:px-10 md:py-12 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.18),transparent_32%),radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.05),transparent_24%)]" />

      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Til forsiden
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15"
          >
            Til Udsigtsposten
          </Link>
        </div>

        <section className="mt-6 overflow-hidden rounded-[2.5rem] border border-indigo-400/35 bg-[linear-gradient(135deg,rgba(99,102,241,0.18),rgba(15,23,42,0.92)_42%,rgba(5,150,105,0.22))] shadow-[0_28px_80px_rgba(2,6,23,0.48)] backdrop-blur-xl">
          <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:px-10 lg:py-12">
            <div>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/14 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-white/88">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Aktiv undervisning i praksis
              </div>

              <h1 className={`mt-5 max-w-4xl text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl ${rubik.className}`}>
                Mobilforbud i skolen? Derfor er SkoleGPS det sikre valg.
              </h1>

              <div className="mt-5 max-w-3xl space-y-4 text-sm leading-7 text-white/86 sm:text-base md:text-lg">
                <p>
                  Debatten om skærmtid og mobilfrie skoler raser, og med udsigten til
                  strammere regler for mobiltelefoner i skoletiden i 2026, er det vigtigt at
                  kende forskel på passiv og aktiv skærmtid.
                </p>
                <p>
                  Ministeriets anbefalinger er klare: Skærme skal væk, når de forstyrrer, men
                  de må meget gerne bruges, når det er voksenstyret og didaktisk hensigtsmæssigt.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-[1.75rem] border border-white/14 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
                <p className="text-xs font-semibold tracking-[0.22em] text-indigo-100/80 uppercase">
                  Bevægelse
                </p>
                <p className="mt-3 text-sm leading-6 text-white/88">
                  Telefonen bliver et redskab, der sender eleverne ud i skolegården og skoven
                  i stedet for ned i stolen.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-white/14 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
                <p className="text-xs font-semibold tracking-[0.22em] text-emerald-100/80 uppercase">
                  Kontrol
                </p>
                <p className="mt-3 text-sm leading-6 text-white/88">
                  Læreren sætter rammen, holder overblikket og kan bremse aktiviteten med det
                  samme, hvis det bliver nødvendigt.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-white/14 bg-white/10 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-sm">
                <p className="text-xs font-semibold tracking-[0.22em] text-amber-100/80 uppercase">
                  Fællesskab
                </p>
                <p className="mt-3 text-sm leading-6 text-white/88">
                  Teknologien bruges til samarbejde, taktik og fælles oplevelser i den virkelige
                  verden, ikke til isolation.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <article className="rounded-[2rem] border border-white/10 bg-slate-950/45 p-6 shadow-[0_22px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl sm:p-8">
            <div className="prose prose-invert max-w-none prose-headings:font-black prose-headings:tracking-tight prose-p:text-white/84 prose-p:leading-8 prose-strong:text-white prose-li:text-white/84 prose-li:marker:text-emerald-300">
              <h2 className={rubik.className}>Hvorfor SkoleGPS og Live Stratego er fremtidssikret:</h2>
              <ul>
                {futureProofPoints.map((point) => (
                  <li key={point.title}>
                    <strong>{point.title}:</strong> {point.body}
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <aside className="space-y-4">
            {futureProofPoints.map((point) => {
              const Icon = point.icon;

              return (
                <section
                  key={point.title}
                  className="rounded-[1.85rem] border border-white/10 bg-white/8 p-5 shadow-[0_18px_48px_rgba(2,6,23,0.22)] backdrop-blur-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-emerald-100">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className={`text-xl font-black tracking-tight text-white ${rubik.className}`}>
                        {point.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-white/82">{point.body}</p>
                    </div>
                  </div>
                </section>
              );
            })}
          </aside>
        </section>

        <section className="mt-8 rounded-[2rem] border border-emerald-400/22 bg-[linear-gradient(135deg,rgba(16,185,129,0.14),rgba(15,23,42,0.72))] p-6 shadow-[0_18px_50px_rgba(5,150,105,0.14)] backdrop-blur-xl sm:p-8">
          <p className="text-xs font-semibold tracking-[0.24em] text-emerald-100/78 uppercase">
            Tryg undervisningsbrug
          </p>
          <p className="mt-4 max-w-4xl text-base leading-8 text-white/90 sm:text-lg">
            Giv trygt eleverne telefonen i hånden til undervisningsbrug. Med SkoleGPS bliver
            skærmtid til kvalitetstid i skolegården og skoven.
          </p>
        </section>
      </div>
    </main>
  );
}
