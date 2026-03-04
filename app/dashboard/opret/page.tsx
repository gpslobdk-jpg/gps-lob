import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export default function OpretSporPage() {
  return (
    <main className={`relative min-h-screen overflow-hidden bg-[#050816] px-6 py-12 text-white md:px-10 ${poppins.className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_85%_15%,rgba(251,191,36,0.14),transparent_34%),radial-gradient(circle_at_50%_85%,rgba(168,85,247,0.2),transparent_42%)]" />

      <section className="relative z-10 mx-auto w-full max-w-6xl">
        <p className="mb-3 text-xs font-bold tracking-[0.2em] text-cyan-200 uppercase">Kontroltårnet</p>
        <h1 className={`text-4xl font-black tracking-tight text-cyan-50 md:text-5xl ${rubik.className}`}>
          Hvordan vil du bygge dit løb? 🏁
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white/75 md:text-base">
          Vælg det spor, der passer til din stil. Du kan enten bygge manuelt med fuld kontrol eller lade AI&apos;en skabe et komplet løb på få sekunder.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Link href="/dashboard/opret/manuel" className="group block">
            <article className="relative h-full rounded-3xl border border-cyan-300/30 bg-[#0d1736]/80 p-7 shadow-[0_0_28px_rgba(34,211,238,0.18)] transition-all duration-200 group-hover:-translate-y-1 group-hover:border-cyan-200/60 group-hover:shadow-[0_0_38px_rgba(34,211,238,0.35)]">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/45 bg-cyan-400/15 text-2xl">
                🛠️
              </div>
              <h2 className={`text-2xl font-black tracking-wide text-cyan-100 ${rubik.className}`}>
                Byg fra bunden 🛠️
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/80">
                Design dit løb præcis som du vil have det. Tilføj poster, svarmuligheder og lokationer manuelt.
              </p>
              <p className="mt-6 text-xs font-bold tracking-[0.18em] text-cyan-200 uppercase">Start manuelt</p>
            </article>
          </Link>

          <Link href="/dashboard/opret/magi" className="group block">
            <article className="relative h-full rounded-3xl border border-amber-300/30 bg-[#2a1f0d]/70 p-7 shadow-[0_0_28px_rgba(251,191,36,0.16)] transition-all duration-200 group-hover:-translate-y-1 group-hover:border-amber-200/60 group-hover:shadow-[0_0_38px_rgba(251,191,36,0.32)]">
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-300/45 bg-amber-400/15 text-2xl">
                🪄
              </div>
              <h2 className={`text-2xl font-black tracking-wide text-amber-100 ${rubik.className}`}>
                Lyn-Oprettelse ⚡
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/80">
                Lad teknologien gøre arbejdet. Beskriv dit tema, og få et komplet løb med spørgsmål og fotomissioner på få sekunder.
              </p>
              <p className="mt-6 text-xs font-bold tracking-[0.18em] text-amber-200 uppercase">Generer med AI</p>
            </article>
          </Link>
        </div>
      </section>
    </main>
  );
}
