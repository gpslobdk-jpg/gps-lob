import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
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

const sectionClass =
  "rounded-[2rem] border border-emerald-100 bg-white/88 p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm md:p-10";

export default function OmPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f7fcfb_0%,#edf8f4_42%,#f8fbff_100%)] px-6 py-10 text-emerald-950 md:px-10 md:py-14 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.10),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_30%),radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.9),transparent_38%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col">
        <div className="flex justify-start">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/85 px-4 py-2 text-sm font-medium text-emerald-900 shadow-sm transition hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til Udsigtsposten
          </Link>
        </div>

        <section className="mt-8 rounded-[2.4rem] border border-emerald-100 bg-white/92 px-8 py-10 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-sm md:px-12 md:py-14">
          <p className="text-xs font-semibold tracking-[0.28em] text-emerald-700/75 uppercase">
            Bag platformen
          </p>
          <h1
            className={`mt-4 max-w-4xl text-4xl font-black tracking-tight text-emerald-950 md:text-6xl ${rubik.className}`}
          >
            Om GPSløb & Arkitekten bag 🌲
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-emerald-900/75 md:text-lg">
            GPSløb er bygget for at gøre teknologi mere menneskelig, mere bevægelig og langt
            mere brugbar i virkeligheden. Her er tankerne bag platformen og mennesket, der
            har tegnet arkitekturen.
          </p>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section className={sectionClass}>
              <p className="text-xs font-semibold tracking-[0.24em] text-emerald-700/70 uppercase">
                Visionen
              </p>
              <h2 className={`mt-3 text-3xl font-black tracking-tight text-emerald-950 ${rubik.className}`}>
                Teknologi der flytter os ud
              </h2>
              <p className="mt-5 text-base leading-8 text-emerald-900/80">
                Min filosofi er, at digital didaktik ikke skal låse os fast foran en skærm.
                Målet med GPSløb er at bruge teknologien som en katalysator til at få folk ud
                i naturen, op af stolene og i gang med at bevæge sig, mens de lærer og leger.
              </p>
            </section>

            <section className={sectionClass}>
              <p className="text-xs font-semibold tracking-[0.24em] text-emerald-700/70 uppercase">
                Arkitekturen
              </p>
              <h2 className={`mt-3 text-3xl font-black tracking-tight text-emerald-950 ${rubik.className}`}>
                Håndlavet – med et strejf af AI-magi
              </h2>
              <p className="mt-5 text-base leading-8 text-emerald-900/80">
                Dette site er 100% udtænkt og struktureret af mig. Jeg bruger AI som min
                &quot;super-assistent&quot; til kodningen, så jeg som enkeltperson kan bygge en
                professionel platform. Men det er min pædagogiske erfaring og arkitektur, der
                styrer slagets gang. Det sikrer, at teknologien tjener det menneskelige formål
                – aldrig omvendt.
              </p>
            </section>
          </div>

          <div className="space-y-6">
            <section className={sectionClass}>
              <p className="text-xs font-semibold tracking-[0.24em] text-emerald-700/70 uppercase">
                Biografi
              </p>
              <h2 className={`mt-3 text-3xl font-black tracking-tight text-emerald-950 ${rubik.className}`}>
                Hvem er Jeppe?
              </h2>
              <p className="mt-5 text-base leading-8 text-emerald-900/80">
                Jeg hedder Jeppe Laursen, bor i Vordingborg og er uddannet lærer. Jeg har
                brugt de sidste 16 år i den danske grundskole – senest på Spjellerup
                Friskole og tidligere på Glostrup Skole. Jeg har undervist i alt fra dansk og
                matematik i indskolingen til fysik/kemi i udskolingen. Jeg kender en travl
                hverdag i skolen indefra og ved, at digitale værktøjer kun giver mening, hvis
                de skaber reel værdi.
              </p>
            </section>

            <section className="rounded-[2rem] border border-emerald-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(240,253,250,0.92))] p-8 shadow-[0_18px_50px_rgba(16,185,129,0.08)] md:p-10">
              <p className="text-xs font-semibold tracking-[0.24em] text-emerald-700/70 uppercase">
                Kontakt
              </p>
              <h2 className={`mt-3 text-2xl font-black tracking-tight text-emerald-950 ${rubik.className}`}>
                Kontaktinfo
              </h2>

              <div className="mt-6 space-y-4 text-sm leading-7 text-emerald-900/80">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
                  <p>Jeppe Laursen, 4760 Vordingborg</p>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
                  <a
                    href="mailto:Gpslobdk@gmail.com"
                    className="transition hover:text-emerald-950"
                  >
                    Gpslobdk@gmail.com
                  </a>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
                  <a href="tel:+4540874538" className="transition hover:text-emerald-950">
                    40 87 45 38
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
