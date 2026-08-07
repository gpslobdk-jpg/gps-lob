import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Mail,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Poppins, Rubik } from "next/font/google";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const DPA_PDF =
  "/dokumenter/SkoleGPS_databehandleraftale_foersteudkast_2026-08-07.pdf";
const DPA_DOCX =
  "/dokumenter/SkoleGPS_databehandleraftale_foersteudkast_2026-08-07.docx";

export const metadata: Metadata = {
  title: "Til kommunens IT-afdeling | SkoleGPS",
  description:
    "Dokumentation og første udkast til databehandleraftale for kommuner og skoler, der vil vurdere SkoleGPS.",
  robots: {
    index: false,
    follow: false,
  },
};

const reviewSteps = [
  {
    title: "Gennemgå aftalen",
    text: "Udfyld kommunen eller skoleejeren som dataansvarlig, og gennemgå især bilag B, C og D.",
  },
  {
    title: "Afklar de markerede punkter",
    text: "Hosting, underdatabehandlere, opbevaring og den tekniske fotoløsning skal verificeres før underskrift.",
  },
  {
    title: "Få kommunens godkendelse",
    text: "Lad kommunens DPO, jurist eller informationssikkerhedsfunktion vurdere aftalen og den konkrete anvendelse.",
  },
];

export default function ItAfdelingerPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#04110f_0%,#071d1a_42%,#0d1f2e_100%)] px-5 py-8 text-white sm:px-8 md:py-14 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_32%)]" />

      <div className="relative mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          &larr; Til forsiden
        </Link>

        <section className="mt-7 rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.3)] backdrop-blur-md sm:p-9 md:p-12">
          <div className="mx-auto max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold tracking-[0.16em] text-emerald-200 uppercase">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              Kommuner og skoler
            </div>

            <h1
              className={`mt-5 max-w-3xl break-words text-4xl leading-[1.05] font-black tracking-tight [overflow-wrap:anywhere] md:text-6xl ${rubik.className}`}
            >
              Til kommunens IT-afdeling
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-200 sm:text-lg">
              Her finder I et grundigt første udkast til databehandleraftalen for SkoleGPS og de vigtigste
              oplysninger til kommunens indledende vurdering. SkoleGPS er gratis i skoleåret 2026/27.
            </p>

            <div className="mt-8 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-5">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
                <div>
                  <h2 className="font-bold text-amber-100">Første udkast – ikke klar til underskrift endnu</h2>
                  <p className="mt-1 text-sm leading-relaxed text-amber-50/80">
                    Udkastet bygger på Datatilsynets standardvilkår. Åbne kontrolpunkter er markeret i
                    dokumentet og skal afklares sammen med kommunen, før aftalen underskrives.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <a
                href={DPA_DOCX}
                download
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-center text-sm font-bold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                Hent redigerbart Word-udkast
              </a>
              <a
                href={DPA_PDF}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/7 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                Åbn PDF-udkast
              </a>
            </div>

            <section className="mt-12" aria-labelledby="review-heading">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                <h2 id="review-heading" className={`text-2xl font-bold md:text-3xl ${rubik.className}`}>
                  Sådan kommer I videre
                </h2>
              </div>

              <ol className="mt-6 grid gap-4 md:grid-cols-3">
                {reviewSteps.map((step, index) => (
                  <li key={step.title} className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-300 text-sm font-black text-slate-950">
                      {index + 1}
                    </span>
                    <h3 className="mt-4 font-bold text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.text}</p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-sky-300/20 bg-sky-300/8 p-6">
                <h2 className={`text-xl font-bold text-sky-100 ${rubik.className}`}>Vigtigt om foto</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-200">
                  SkoleGPS anbefaler, at elever og andre genkendelige personer ikke fotograferes. Brug kun
                  fotos af steder, genstande eller elevarbejde uden personoplysninger. Personfotos bør ikke
                  aktiveres, før kommunens vurdering og de markerede tekniske kontrolpunkter er afsluttet.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-6">
                <h2 className={`text-xl font-bold ${rubik.className}`}>Kort om leverandøren</h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                    Jeppe Laursen, privatperson uden CVR
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                    Underretning om sikkerhedsbrud inden for 24 timer
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                    Aftaleudkast og bilag er samlet i én fil
                  </li>
                </ul>
              </div>
            </section>

            <section className="mt-10 rounded-2xl border border-emerald-300/20 bg-emerald-300/8 p-6 text-center">
              <Mail className="mx-auto h-7 w-7 text-emerald-300" aria-hidden="true" />
              <h2 className={`mt-3 text-xl font-bold ${rubik.className}`}>Spørgsmål eller rettelser?</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                Kommunens IT-, sikkerheds- eller databeskyttelsesfunktion er velkommen til at sende
                kommentarer og ønskede præciseringer.
              </p>
              <a
                href="mailto:skolegpsdk@gmail.com"
                className="mt-4 inline-flex items-center justify-center rounded-full border border-emerald-300/30 bg-slate-950/40 px-5 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-slate-950/65"
              >
                skolegpsdk@gmail.com
              </a>
            </section>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-xs text-slate-400">
              <Link href="/gdpr" className="transition hover:text-emerald-200">
                Databehandling
              </Link>
              <Link href="/privacy" className="transition hover:text-emerald-200">
                Privatlivspolitik
              </Link>
              <a
                href="https://www.datatilsynet.dk/regler-og-vejledning/blanketter-og-skabeloner"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition hover:text-emerald-200"
              >
                Datatilsynets skabeloner
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
