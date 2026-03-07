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

export default function OmPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-200 via-emerald-50 to-emerald-100 px-6 py-12 text-emerald-950 lg:bg-transparent ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        className="fixed top-0 left-0 hidden h-full w-full object-cover -z-20 lg:block"
        src="/promo.mp4"
      />
      <div className="fixed inset-0 hidden -z-10 bg-gradient-to-b from-sky-900/10 to-emerald-900/40 backdrop-blur-[2px] lg:block" />

      <section className="mx-auto w-full max-w-3xl rounded-[2.5rem] border border-white/55 bg-white/80 p-8 shadow-2xl backdrop-blur-md md:p-12">
        <p className="text-xs font-semibold tracking-[0.28em] text-emerald-700/80 uppercase">
          Om udvikleren
        </p>
        <h1 className={`mt-4 text-4xl font-black tracking-tight text-emerald-950 md:text-5xl ${rubik.className}`}>
          GPSløb er bygget med hænder, hjerte og høj faglighed.
        </h1>
        <p className="mt-6 text-base leading-relaxed text-emerald-900/80">
          Platformen er skabt for at gøre læring, bevægelse og natur til en samlet oplevelse.
          Målet er ikke bare at levere endnu et værktøj, men at bygge noget, der føles
          menneskeligt, gennemtænkt og brugbart i virkeligheden.
        </p>
        <p className="mt-4 text-base leading-relaxed text-emerald-900/80">
          AI bruges som et kreativt og praktisk hjælpemiddel, men retningen, oplevelsen og
          produktarkitekturen er håndholdt. Derfor er GPSløb designet til at føles som et
          rigtigt værktøj for rigtige mennesker, ikke som en generisk maskine.
        </p>

        <div className="mt-10">
          <Link
            href="/dashboard"
            className="inline-flex rounded-full border border-emerald-300/70 bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Tilbage til Udsigtsposten
          </Link>
        </div>
      </section>
    </main>
  );
}
