import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { Poppins, Rubik } from "next/font/google";

export const metadata: Metadata = {
  title: "Podcast-Detektiven & Ophavsret | GPSLØB",
  description:
    "Podcast-Detektiven i GPSLØB er 100% lovlig at bruge i undervisningen. Vi arbejder inden for citatretten og bruger kun offentligt tilgængeligt indhold.",
};

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function OphavsretPodcastPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#04110f_0%,#071d1a_35%,#0d1f2e_100%)] p-10 text-white md:p-20 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(147,51,234,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_30%),radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.05),transparent_24%)]" />

      <div className="relative mx-auto max-w-5xl">
        <div className="flex justify-start">
          <Link
            href="/dashboard/opret/podcast"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til Podcast-Detektiven
          </Link>
        </div>

        <section className="mt-10 rounded-[2.5rem] border border-white/10 bg-white/6 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-md md:p-12">
          <article className="mx-auto max-w-3xl space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/10 shadow-[0_0_24px_rgba(147,51,234,0.18)]">
                  <Scale className="h-7 w-7 text-purple-300" />
                </div>
                <h1 className={`text-3xl font-black tracking-tight text-white md:text-5xl ${rubik.className}`}>
                  Podcast-Detektiven og Ophavsret ⚖️
                </h1>
              </div>
              <p className="text-lg font-semibold text-purple-200">
                100% lovligt at bruge i undervisningen
              </p>
              <p className="leading-relaxed text-slate-200 md:text-lg">
                Når du bruger Podcast-Detektiven til at bygge GPS-løb, kan du have fuldstændig ro i
                maven. Værktøjet er bygget med dyb respekt for skabernes ophavsret og er 100% lovligt
                at bruge i undervisningen.
              </p>
            </div>

            <section className="space-y-4">
              <h2 className={`text-xl font-bold text-white ${rubik.className}`}>
                Sådan fungerer det i praksis
              </h2>

              <div className="rounded-[1.9rem] border border-purple-400/20 bg-purple-400/8 p-6 shadow-[0_20px_50px_rgba(147,51,234,0.08)]">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-purple-300">
                  Regel 1
                </p>
                <h3 className={`mt-3 text-xl font-bold text-white ${rubik.className}`}>
                  Ingen lagring af lyd
                </h3>
                <p className="mt-3 leading-relaxed text-slate-200 md:text-base">
                  Vi downloader, kopierer eller gemmer aldrig selve lyd- eller videofilerne på vores
                  servere. Din skole betaler ikke for noget, du ikke burde have.
                </p>
              </div>

              <div className="rounded-[1.9rem] border border-sky-400/20 bg-sky-400/8 p-6 shadow-[0_20px_50px_rgba(56,189,248,0.08)]">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-300">
                  Regel 2
                </p>
                <h3 className={`mt-3 text-xl font-bold text-white ${rubik.className}`}>
                  Støt skaberne – lyt via originalkilden
                </h3>
                <p className="mt-3 leading-relaxed text-slate-200 md:text-base">
                  Når dine elever skal lytte til udsendelsen under løbet, bliver de dirigeret direkte
                  til originalkilden (f.eks. DR Lyd, Apple Podcasts eller YouTube). Det betyder, at
                  skaberne bag podcasten stadig får deres lyttertal og anerkendelse.
                </p>
              </div>

              <div className="rounded-[1.9rem] border border-emerald-400/20 bg-emerald-400/8 p-6 shadow-[0_20px_50px_rgba(16,185,129,0.08)]">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300">
                  Regel 3
                </p>
                <h3 className={`mt-3 text-xl font-bold text-white ${rubik.className}`}>
                  Læsning af offentlig data
                </h3>
                <p className="mt-3 leading-relaxed text-slate-200 md:text-base">
                  For at bygge spørgsmålene læser vores system udelukkende de offentligt tilgængelige
                  tekster (som &ldquo;show notes&rdquo;, resuméer og åbne undertekster), der allerede ligger
                  frit fremme på nettet. Vi bygger blot et fagligt lag ovenpå.
                </p>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
              <p className="leading-relaxed text-slate-100 md:text-lg">
                Du kan derfor trygt bruge funktionen til at bringe fantastiske lydfortællinger ud på
                stierne – uden at bekymre dig om{" "}
                <span className="font-semibold text-white">Copydan</span> eller brud på{" "}
                <span className="font-semibold text-white">åndsværksloven</span>.
              </p>
            </section>

            <div className="flex justify-center pt-2">
              <Link
                href="/dashboard/opret/podcast"
                className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-500/10 px-6 py-3 text-sm font-semibold text-purple-200 shadow-[0_0_20px_rgba(147,51,234,0.14)] transition hover:bg-purple-500/20"
              >
                <ArrowLeft className="h-4 w-4" />
                Tilbage til Podcast-Detektiven
              </Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
