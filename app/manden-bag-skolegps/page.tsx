import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, Download, FileText, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import Mascot from "@/components/brand/Mascot";
import { poppins, rubik } from "@/lib/fonts";

const CV_PDF = "/dokumenter/Jeppe_Laursen_CV_med_anbefaling_rettet.pdf";

export const metadata: Metadata = {
  title: "Manden bag SkoleGPS | Jeppe Laursen",
  description:
    "Mød Jeppe Laursen, læreren bag SkoleGPS, og læs hans CV og anbefaling.",
};

export default function MandenBagSkoleGPSPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f6fbff_0%,#edf8f5_52%,#ffffff_100%)] px-5 py-5 text-slate-900 sm:px-6 sm:py-6 lg:px-8 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(14,165,233,0.16),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(34,164,71,0.11),transparent_27%),radial-gradient(circle_at_50%_100%,rgba(255,255,255,0.92),transparent_42%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col">
        <header className="flex items-center justify-between gap-4 py-2 sm:py-3">
          <Link
            href="/"
            aria-label="SkoleGPS forside"
            className="inline-flex rounded-full bg-white/82 px-4 py-2 shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800"
          >
            <Image
              src="/skolegps-logo.svg"
              alt="SkoleGPS"
              width={256}
              height={72}
              priority
              className="h-auto w-40 sm:w-48"
            />
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-100 bg-white/82 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Til forsiden
          </Link>
        </header>

        <article className="mt-5 rounded-[2rem] border border-white/80 bg-white/84 p-6 shadow-[0_22px_60px_rgba(7,26,58,0.08)] backdrop-blur sm:mt-7 sm:p-10 lg:p-12">
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_13rem] lg:items-start">
            <div className="max-w-3xl">
              <p className="text-xs font-black tracking-[0.18em] text-sky-800 uppercase">Bag SkoleGPS</p>
              <h1
                className={`mt-4 text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-5xl lg:text-6xl ${rubik.className}`}
              >
                Manden bag SkoleGPS
              </h1>
              <p className={`mt-5 text-2xl font-black text-sky-800 sm:text-3xl ${rubik.className}`}>
                Jeppe Laursen
              </p>
              <p className="mt-2 text-lg font-bold text-slate-700 sm:text-xl">
                Undervisning med hoved, hænder og bevægelse.
              </p>
              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-700 sm:text-lg">
                Jeg er uddannet lærer fra Odense i 2010 og har omkring 20 års erfaring med børn og
                unge – først fra pædagogisk arbejde under studiet og siden som lærer. Jeg kombinerer
                undervisning og specialpædagogisk erfaring med digitale idéer, praktisk håndværk,
                musik og idræt.
              </p>
            </div>

            <div className="hidden justify-self-end rounded-3xl border border-sky-100 bg-sky-50/72 p-4 sm:block">
              <Mascot variant="guide" size="sm" className="mx-auto" />
            </div>
          </section>

          <section className="mt-10 max-w-4xl rounded-2xl border border-emerald-100 bg-emerald-50/68 p-5 sm:p-6">
            <h2 className={`text-2xl font-black text-emerald-950 ${rubik.className}`}>SkoleGPS i praksis</h2>
            <p className="mt-3 text-base leading-7 text-emerald-950/80 sm:text-lg">
              Med SkoleGPS omsætter jeg min lærerfaglighed og interesse for teknologi til et enkelt
              undervisningsværktøj. Min ambition er at gøre det let at skabe undervisning med
              bevægelse, samarbejde og læring uden for klasselokalet.
            </p>
          </section>

          <section className="mt-8 border-l-4 border-sky-600 bg-sky-50/80 px-5 py-6 sm:px-7" aria-labelledby="recommendation-heading">
            <p id="recommendation-heading" className="text-xs font-black tracking-[0.18em] text-sky-800 uppercase">
              Fra anbefalingen
            </p>
            <blockquote className={`mt-3 max-w-4xl text-xl leading-8 text-[var(--skolegps-deep-navy)] sm:text-2xl ${rubik.className}`}>
              “Han har en særlig evne for at kombinere undervisningens teoretiske side og praktiske
              anvendelighed”
            </blockquote>
            <p className="mt-4 text-sm font-bold text-slate-700">
              Brian Skau Juhl · anbefaling fra Spjellerup Friskole
            </p>
          </section>

          <section className="mt-8 grid gap-6 rounded-2xl border border-slate-200 bg-slate-50/82 p-5 sm:p-7 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center" aria-labelledby="cv-heading">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-sky-700 shadow-sm">
              <FileText className="h-8 w-8" aria-hidden="true" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 id="cv-heading" className={`text-2xl font-black text-[var(--skolegps-deep-navy)] ${rubik.className}`}>
                  Mit CV og min anbefaling
                </h2>
                <span className="text-sm font-bold text-slate-500">PDF · 3 sider</span>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Læs om min baggrund, erfaring og kompetencer – og se anbefalingen fra Spjellerup
                Friskole.
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={CV_PDF}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-5 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(3,119,216,0.2)] transition hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800"
                >
                  Læs CV og anbefaling
                  <span className="sr-only"> (åbner PDF i ny fane)</span>
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={CV_PDF}
                  download
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-sky-200 bg-white px-5 py-3 text-sm font-black text-sky-800 transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Hent PDF
                </a>
              </div>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-sky-100 bg-white p-5 sm:p-7" aria-labelledby="contact-heading">
            <div className="flex items-center gap-3 text-sky-800">
              <Mail className="h-5 w-5" aria-hidden="true" />
              <p className="text-xs font-black tracking-[0.18em] uppercase">Kontakt</p>
            </div>
            <h2 id="contact-heading" className={`mt-3 text-2xl font-black text-[var(--skolegps-deep-navy)] ${rubik.className}`}>
              Skriv til mig
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <a
                href="mailto:skolegpsdk@gmail.com"
                className="rounded-xl border border-sky-100 bg-sky-50/65 p-4 text-sm transition hover:border-sky-200 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800"
              >
                <span className="block font-black text-slate-800">SkoleGPS</span>
                <span className="mt-1 block font-bold text-sky-800">skolegpsdk@gmail.com</span>
              </a>
              <a
                href="mailto:jeppelaursen83@gmail.com"
                className="rounded-xl border border-sky-100 bg-sky-50/65 p-4 text-sm transition hover:border-sky-200 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800"
              >
                <span className="block font-black text-slate-800">Personlig kontakt</span>
                <span className="mt-1 block font-bold text-sky-800">jeppelaursen83@gmail.com</span>
              </a>
            </div>
          </section>
        </article>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-3 py-8 text-xs font-semibold text-slate-600">
          <Link href="/hjaelp" className="transition hover:text-sky-800">GPS-hjælp</Link>
          <Link href="/gdpr" className="transition hover:text-sky-800">Databehandling</Link>
          <Link href="/privacy" className="transition hover:text-sky-800">Privatlivspolitik</Link>
          <Link href="/it-afdelinger" className="transition hover:text-sky-800">Til IT og databeskyttelse</Link>
          <Link href="/ophavsret" className="transition hover:text-sky-800">Ophavsret</Link>
          <span className="basis-full text-slate-500">© 2026 SkoleGPS · Gratis undervisningsværktøj</span>
        </footer>
      </div>
    </main>
  );
}
