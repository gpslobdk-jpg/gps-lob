import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, Compass, MapPin, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";

import { poppins, rubik } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Mobilfri skole og aktiv undervisning | SkoleGPS",
  description:
    "Læs SkoleGPS' korte, kildebaserede perspektiv på mobilfri skole og voksenstyret aktivitet uden for klasselokalet.",
};

const points = [
  {
    title: "Telefonen er et redskab på ruten",
    body: "Eleverne bruger den til kort, opgaver og korte beskeder, når det hører til aktiviteten. Det er ikke et ekstra feed eller et frikvarter på skærm.",
    icon: MapPin,
  },
  {
    title: "Læreren sætter rammen",
    body: "Læreren vælger forløb, tidspunkt og tempo. SkoleGPS er lavet til et planlagt undervisningsforløb, ikke til fri mobilbrug.",
    icon: ShieldCheck,
  },
  {
    title: "Opgaven foregår sammen",
    body: "Det væsentlige sker på stedet: Klassen går, undersøger, løser og taler sammen. Skærmen er kun én del af en fysisk aktivitet.",
    icon: Users,
  },
] as const;

export default function MobilISkolenPage() {
  return (
    <main
      className={`min-h-screen bg-[linear-gradient(180deg,#f6fbff_0%,#edf8f5_54%,#ffffff_100%)] px-5 py-6 text-slate-900 sm:px-8 sm:py-10 ${poppins.className}`}
    >
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-100 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-200 hover:text-sky-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Til forsiden
        </Link>

        <article className="mt-7 rounded-[2rem] border border-sky-100 bg-white/86 p-6 shadow-[0_22px_60px_rgba(7,26,58,0.08)] backdrop-blur sm:p-10">
          <p className="text-xs font-black tracking-[0.18em] text-sky-800 uppercase">Skole &amp; skærm</p>
          <h1 className={`mt-4 max-w-4xl text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-5xl ${rubik.className}`}>
            Mobilfri skole — med plads til en voksenstyret læringsaktivitet
          </h1>
          <div className="mt-6 max-w-3xl space-y-5 text-base leading-8 text-slate-700 sm:text-lg">
            <p>
              Debatten om mobiltelefoner i skolen handler med god grund om ro, fællesskab og
              koncentration. Undervisningsministeriets anbefalinger peger på mobilfri skole og
              på, at skærme kun bruges, når det er didaktisk og pædagogisk hensigtsmæssigt.
              SkoleGPS er tænkt ind i netop den samtale: som et kort, lærerplanlagt værktøj i en
              aktivitet, der foregår uden for klasselokalet.
            </p>
            <p>
              Det betyder ikke, at en app i sig selv afgør, hvad der er rigtigt på en skole.
              Skolens egne rammer, lærerens faglige vurdering og hensynet til den konkrete klasse
              kommer først. SkoleGPS kan bruges, når læreren vælger et forløb, sætter en tydelig
              opgave og lader eleverne bruge telefonen kort og målrettet på ruten.
            </p>
            <p>
              På Folketingets side står lovforslag L 130 fra samlingen 2025-26 som
              <strong> bortfaldet</strong> ved seneste kildekontrol. Det er derfor ikke rigtigt
              at beskrive én bestemt lovregel som en generel undtagelse for SkoleGPS. I stedet
              holder vi os til det, skolen konkret kan tage stilling til: om aktiviteten er
              lærerstyret, relevant for undervisningen og skaber mere bevægelse, samarbejde og
              opmærksomhed på stedet.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {points.map(({ title, body, icon: Icon }) => (
              <section key={title} className="rounded-2xl border border-sky-100 bg-sky-50/55 p-5">
                <Icon className="h-5 w-5 text-sky-700" aria-hidden="true" />
                <h2 className="mt-3 text-lg font-black text-[var(--skolegps-deep-navy)]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/72 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Compass className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
              <div>
                <h2 className="font-black text-emerald-950">Et konkret valg i undervisningen</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-900/80">
                  Før et forløb kan læreren afklare mobilreglerne med klassen og vælge, om
                  telefonen skal ligge væk mellem posterne. Det holder teknologien i den rolle,
                  den skal have: et redskab til opgaven, ikke opgaven i sig selv.
                </p>
              </div>
            </div>
          </section>

          <div className="mt-8">
            <Link
              href="/login?next=%2Fdashboard%2Fopret%2Fvalg"
              className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-5 py-3 text-sm font-black text-white shadow-[0_14px_28px_rgba(3,119,216,0.2)] transition hover:bg-sky-700"
            >
              Se et lærerforløb
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </article>

        <section className="mt-7 rounded-2xl border border-slate-200 bg-white/78 p-6 text-sm leading-6 text-slate-600 shadow-sm">
          <h2 className="font-black text-slate-800">Kilder og afgrænsning</h2>
          <p className="mt-2">
            Senest kildekontrolleret 10. september 2026. Siden er baggrund til skolens faglige
            samtale — ikke juridisk rådgivning eller en vurdering af en konkret skoles politik.
          </p>
          <ul className="mt-4 space-y-2">
            <li>
              <a className="font-bold text-sky-800 underline underline-offset-2" href="https://uvm.dk/grundskole/folkeskolen/laering-og-laeringsmiljoe/laeringsmiljoe/anbefalinger-om-skaermbrug-til-grundskoler-og-fritidstilbud/" rel="noreferrer" target="_blank">
                Undervisningsministeriet: Anbefalinger om skærmbrug
              </a>
              {" — grundlag for omtalen af mobilfri skole og pædagogisk begrundet brug."}
            </li>
            <li>
              <a className="font-bold text-sky-800 underline underline-offset-2" href="https://www.ft.dk/samling/20251/lovforslag/l130/index.htm" rel="noreferrer" target="_blank">
                Folketinget: L 130 (2025-26)
              </a>
              {" — grundlag for den angivne status som bortfaldet ved kildekontrollen."}
            </li>
            <li>
              <a className="font-bold text-sky-800 underline underline-offset-2" href="https://uvm.dk/aktuelt/nyheder/2025/september/250930-ny-aftale-om-mobilfrie-folkeskoler-og-fritidstilbud/" rel="noreferrer" target="_blank">
                Undervisningsministeriet: Aftale om mobilfrie folkeskoler og fritidstilbud
              </a>
              {" — baggrund for den politiske debat."}
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
