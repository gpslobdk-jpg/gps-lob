import Link from "next/link";
import { BrainCircuit, MapPin, PenTool, Sparkles } from "lucide-react";
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
    <main
      className={`relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-300 via-emerald-50 to-emerald-200 px-6 py-12 text-white md:px-10 lg:bg-none lg:bg-transparent ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 hidden h-full w-full object-cover -z-20 lg:block"
        src="/opret-bg.mp4"
      />
      <div className="fixed inset-0 hidden bg-gradient-to-b from-sky-900/10 to-emerald-900/50 backdrop-blur-[2px] -z-10 lg:block" />

      <section className="relative z-10 mx-auto w-full max-w-6xl">
        <p className="mb-3 text-xs font-bold tracking-[0.2em] text-white/90 drop-shadow-md uppercase">
          Kontroltårnet
        </p>
        <h1 className={`text-4xl font-black tracking-tight text-white drop-shadow-md md:text-5xl ${rubik.className}`}>
          Hvordan vil du bygge dit løb? 🏁
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white drop-shadow-md md:text-base">
          Vælg det spor, der passer til din stil. Du kan enten bygge manuelt med fuld kontrol
          eller lade AI&apos;en skabe et komplet løb på få sekunder.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Link href="/dashboard/opret/valg" data-tour="opret-build-from-scratch" className="group block">
            <article className="relative h-full rounded-[2.5rem] border border-white/50 bg-white/80 p-7 shadow-xl backdrop-blur-md transition-all duration-300 group-hover:scale-105 group-hover:bg-white/95 group-hover:shadow-2xl">
              <div className="mb-6 flex h-16 w-16 items-center justify-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 shadow-inner">
                <MapPin className="h-6 w-6 text-emerald-600" />
                <PenTool className="h-5 w-5 text-emerald-600" />
              </div>
              <h2 className={`text-2xl font-black tracking-wide text-emerald-950 ${rubik.className}`}>
                Byg fra bunden
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-emerald-800">
                Vælg først, om du vil bygge et klassisk quiz-løb eller en AI foto-mission, og
                finpuds derefter poster og lokationer manuelt.
              </p>
              <p className="mt-6 text-xs font-bold tracking-[0.18em] text-emerald-700 uppercase">
                Vælg løbstype
              </p>
            </article>
          </Link>

          <Link href="/dashboard/opret/magi" className="group block">
            <article className="relative h-full rounded-[2.5rem] border border-white/50 bg-white/80 p-7 shadow-xl backdrop-blur-md transition-all duration-300 group-hover:scale-105 group-hover:bg-white/95 group-hover:shadow-2xl">
              <div className="mb-6 flex h-16 w-16 items-center justify-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 shadow-inner">
                <BrainCircuit className="h-6 w-6 text-emerald-600" />
                <Sparkles className="h-5 w-5 text-emerald-600" />
              </div>
              <h2 className={`text-2xl font-black tracking-wide text-emerald-950 ${rubik.className}`}>
                Lyn-Oprettelse
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-emerald-800">
                Lad teknologien gøre arbejdet. Beskriv dit tema, og få et komplet klassisk
                quiz-løb med spørgsmål på få sekunder.
              </p>
              <p className="mt-6 text-xs font-bold tracking-[0.18em] text-emerald-700 uppercase">
                Generer med AI
              </p>
            </article>
          </Link>
        </div>
      </section>
    </main>
  );
}
