import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Poppins, Rubik } from "next/font/google";

const rubik = Rubik({ subsets: ["latin"], weight: ["700", "800", "900"] });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const DPA_PDF = "/dokumenter/SkoleGPS_standarddatabehandleraftale.pdf";
const DPA_DOCX = "/dokumenter/SkoleGPS_standarddatabehandleraftale.docx";

export const metadata: Metadata = {
  title: "Til kommunens IT- og databeskyttelsesfunktion | SkoleGPS",
  description:
    "Teknisk og databeskyttelsesretlig information samt standarddatabehandleraftale for SkoleGPS.",
  robots: { index: false, follow: false },
};

const reviewSteps = [
  {
    title: "Hent standardskabelonen",
    text: "Aftalen følger Datatilsynets standardbestemmelser og indeholder SkoleGPS' behandlingsbeskrivelse og bilag.",
  },
  {
    title: "Udfyld kommunens felter",
    text: "Tilføj juridisk navn, CVR, adresse, kontaktperson, behandlingsgrundlag og underskriver.",
  },
  {
    title: "Foretag kommunens vurdering",
    text: "Lad IT, informationssikkerhed og DPO vurdere den konkrete brug, eventuel DPIA og lokale slettefrister.",
  },
];

const facts = [
  {
    icon: Users,
    title: "Elever uden konto",
    text: "Elever deltager med løbskode eller QR. De behøver hverken elevkonto eller e-mailadresse.",
  },
  {
    icon: MapPin,
    title: "GPS skjules efter 15 minutter",
    text: "Afstanden beregnes på elevens enhed. Positionen skjules efter 15 minutters inaktivitet og nulstilles fysisk ved næste femminutters oprydning.",
  },
  {
    icon: ShieldCheck,
    title: "Private elevfotos",
    text: "Fotoobjekter er private. Kun løbets ejer kan se dem gennem en beskyttet SkoleGPS-fotoproxy uden at få Storage-stien udleveret.",
  },
  {
    icon: Clock3,
    title: "Faste slettefrister",
    text: "Fotos: 30 dage. Almindelige elevsvar, deltagere og afsluttede sessioner: 90 dage. Læreren kan altid slette tidligere.",
  },
];

export default function ItAfdelingerPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#04110f_0%,#071d1a_42%,#0d1f2e_100%)] px-4 py-7 text-white sm:px-8 md:py-14 ${poppins.className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.14),transparent_32%)]" />

      <div className="relative mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          &larr; Til forsiden
        </Link>

        <section className="mt-7 rounded-[1.75rem] border border-white/10 bg-white/6 p-5 shadow-[0_30px_90px_rgba(0,0,0,0.3)] backdrop-blur-md sm:p-9 md:rounded-[2rem] md:p-12">
          <div className="mx-auto max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold tracking-[0.14em] text-emerald-200 uppercase">
              <Building2 className="h-4 w-4" aria-hidden="true" />
              Til kommunens IT og DPO
            </div>

            <h1
              className={`mt-5 max-w-4xl break-words text-3xl leading-[1.06] font-black tracking-tight [overflow-wrap:anywhere] sm:text-4xl md:text-6xl ${rubik.className}`}
            >
              Til IT og databeskyttelse
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-200 sm:text-lg">
              Her får I en samlet, konkret beskrivelse af SkoleGPS og en standarddatabehandleraftale til
              kommunens egen vurdering. SkoleGPS er gratis i skoleåret 2026/27.
            </p>

            <div className="mt-8 rounded-2xl border border-sky-300/25 bg-sky-300/10 p-5">
              <h2 className="font-bold text-sky-100">Ikke underskrevet standardskabelon</h2>
              <p className="mt-1 text-sm leading-relaxed text-sky-50/85">
                Word- og PDF-filen er version 1.2 fra 9. august 2026. Den konkrete kommune eller skoleejer
                skal udfylde egne felter, gennemgå aftalen og indgå den med SkoleGPS. Materialet er ikke en
                myndighedsgodkendelse eller juridisk rådgivning.
              </p>
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <a
                href={DPA_DOCX}
                download
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-center text-sm font-bold text-slate-950 transition hover:bg-emerald-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                Hent Word-skabelon
              </a>
              <a
                href={DPA_PDF}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/7 px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-white/12 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                Åbn PDF
              </a>
            </div>

            <section className="mt-12" aria-labelledby="facts-heading">
              <h2 id="facts-heading" className={`text-2xl font-bold md:text-3xl ${rubik.className}`}>
                Sådan behandler SkoleGPS elevdata
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {facts.map(({ icon: Icon, title, text }) => (
                  <article key={title} className="rounded-2xl border border-white/10 bg-slate-950/35 p-5">
                    <Icon className="h-6 w-6 text-emerald-300" aria-hidden="true" />
                    <h3 className="mt-4 font-bold text-white">{title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{text}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="mt-10 grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/35 p-6">
                <h2 className={`text-xl font-bold ${rubik.className}`}>Roller og ansvar</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  Kommunen eller skoleejeren er dataansvarlig for elevdata i undervisningsløbet. Jeppe
                  Laursen, som driver SkoleGPS som privatperson uden CVR, er databehandler og behandler kun
                  data efter den dokumenterede instruks. For lærerens egen konto, support og sikkerhedsdrift
                  er SkoleGPS selvstændig dataansvarlig som beskrevet i privatlivspolitikken.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/8 p-6">
                <h2 className={`text-xl font-bold text-amber-100 ${rubik.className}`}>Sletning i praksis</h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-200">
                  Læreren kan rydde fotos, svar, deltagere og sessionsdata fra resultatsiden. Den forberedte
                  model skjuler GPS efter 15 minutters inaktivitet og nulstiller den ved næste femminutters
                  oprydning. Fristerne er 30 dage for fotos og 90 dage fra afslutning eller inaktivitet for
                  almindelige elevdata.
                  Hosted cron oplyses først som aktiv, når migration, Edge-funktion, job og jobhistorik er
                  kontrolleret efter en senere deployment. Indtil da gælder manuel oprydning.
                </p>
              </div>
            </section>

            <section className="mt-12" aria-labelledby="review-heading">
              <h2 id="review-heading" className={`text-2xl font-bold md:text-3xl ${rubik.className}`}>
                Sådan kommer I videre
              </h2>
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

            <section className="mt-10 rounded-2xl border border-white/10 bg-slate-950/35 p-6">
              <h2 className={`text-xl font-bold ${rubik.className}`}>Leverandører og valgfrie funktioner</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Den centrale drift bruger Supabase, Vercel og Sentry. Lærerrettede AI-funktioner kan
                frivilligt bruge OpenAI og enkelte indholds-/billedtjenester; de må ikke modtage elevdata.
                Kortvisning bruger eksterne kort- og geokodningstjenester, som modtager tekniske
                forespørgselsdata. Den fulde behandlingsbeskrivelse står i aftalens bilag B–D.
              </p>
            </section>

            <section className="mt-10 rounded-2xl border border-emerald-300/20 bg-emerald-300/8 p-6 text-center">
              <Mail className="mx-auto h-7 w-7 text-emerald-300" aria-hidden="true" />
              <h2 className={`mt-3 text-xl font-bold ${rubik.className}`}>Sikkerheds- og GDPR-spørgsmål</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-300">
                Kommunens IT-, sikkerheds- eller databeskyttelsesfunktion kan kontakte den driftsansvarlige
                direkte. Sikkerhedsbrud meddeles uden unødig forsinkelse og om muligt inden 24 timer.
              </p>
              <a
                href="mailto:skolegpsdk@gmail.com"
                className="mt-4 inline-flex items-center justify-center rounded-full border border-emerald-300/30 bg-slate-950/40 px-5 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-slate-950/65"
              >
                skolegpsdk@gmail.com
              </a>
            </section>

            <nav aria-label="Juridisk dokumentation" className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-center text-xs text-slate-400">
              <Link href="/gdpr" className="transition hover:text-emerald-200">Databehandling</Link>
              <Link href="/privacy" className="transition hover:text-emerald-200">Privatlivspolitik</Link>
              <Link href="/ophavsret" className="transition hover:text-emerald-200">Ophavsret</Link>
              <a
                href="https://www.datatilsynet.dk/regler-og-vejledning/blanketter-og-skabeloner"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 transition hover:text-emerald-200"
              >
                Datatilsynets skabeloner
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </nav>
          </div>
        </section>
      </div>
    </main>
  );
}
