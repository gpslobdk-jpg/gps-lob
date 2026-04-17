import type { Metadata } from "next";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";

export const metadata: Metadata = {
  title: "Ophavsret & AI-brug | GPSLØB",
  description:
    "Klare principper for ophavsret og ansvarlig brug af AI og tekster i GPSLØB. Din data bruges ikke til at træne offentlige AI-modeller.",
};

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function OphavsretPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#04110f_0%,#071d1a_35%,#0d1f2e_100%)] p-10 text-white md:p-20 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.05),transparent_24%)]" />

      <div className="relative mx-auto max-w-5xl">
        <div className="flex justify-start">
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-white/10"
          >
            Tilbage til forsiden
          </Link>
        </div>

        <section className="mt-10 rounded-[2.5rem] border border-white/10 bg-white/6 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-md md:p-12">
          <article className="mx-auto max-w-3xl space-y-8">
            <div className="space-y-4">
              <h1 className={`text-4xl font-black tracking-tight text-white md:text-6xl ${rubik.className}`}>
                Ophavsret og brug af AI i GPS L&oslash;b
              </h1>
              <p className="text-xl font-semibold text-emerald-100">
                Klare rammer for sikker databehandling og ansvarlig brug af tekster
              </p>
              <p className="text-slate-200 leading-relaxed md:text-lg">
                N&aring;r du bruger vores {"'"}Scan tekst{"'"}-funktion til at bygge stjernel&oslash;b (og vores
                &oslash;vrige kreative AI-v&aelig;rkt&oslash;jer), er det vigtigt, at vi passer p&aring; forfatternes
                rettigheder. Derfor har vi bygget GPS L&oslash;b med to klare principper:
              </p>
            </div>

            <section className="grid gap-5">
              <div className="rounded-[1.9rem] border border-emerald-400/20 bg-emerald-400/8 p-6 shadow-[0_20px_50px_rgba(16,185,129,0.08)]">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-200">
                  Punkt 1
                </p>
                <h2 className={`mt-3 text-2xl font-bold text-white ${rubik.className}`}>
                  Din data tr&aelig;ner ikke AI&apos;en
                </h2>
                <p className="mt-4 text-slate-200 leading-relaxed md:text-lg">
                  <span className="font-semibold text-white">(Sikker databehandling): </span>
                  N&aring;r du uploader et billede af en tekst, bruger vi en lukket API-forbindelse. Det
                  betyder, at teksten udelukkende l&aelig;ses af systemet i det sekund, det tager at
                  generere l&oslash;bet. Teksten bliver IKKE gemt, og den bliver IKKE brugt til at tr&aelig;ne
                  offentlige AI-modeller (som f.eks. den &aring;bne ChatGPT). Din data forbliver privat.
                </p>
              </div>

              <div className="rounded-[1.9rem] border border-sky-400/20 bg-sky-400/8 p-6 shadow-[0_20px_50px_rgba(56,189,248,0.08)]">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-200">
                  Punkt 2
                </p>
                <h2 className={`mt-3 text-2xl font-bold text-white ${rubik.className}`}>
                  L&aelig;rerens ansvar og Copydan
                </h2>
                <p className="mt-4 text-slate-200 leading-relaxed md:text-lg">
                  Ligesom n&aring;r du st&aring;r nede ved skolens fysiske kopimaskine, er det dit eget ansvar
                  som underviser at sikre, at du har ret til at bruge det materiale, du scanner ind.
                  Vi opfordrer til, at funktionen prim&aelig;rt bruges til dine egne noter, korte
                  tekstuddrag under citatretten, eller materiale din skole har en Copydan-aftale
                  til (f.eks. max 20% af et v&aelig;rk).
                </p>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
              <p className="text-slate-100 leading-relaxed md:text-xl">
                GPS L&oslash;b er designet til at hj&aelig;lpe dig med at forvandle viden til aktiv l&aelig;ring
                i skoleg&aring;rden &ndash; hurtigt, sjovt og sikkert.
              </p>
            </section>
          </article>
        </section>
      </div>
    </main>
  );
}
