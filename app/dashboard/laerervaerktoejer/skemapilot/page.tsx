import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BrainCircuit,
  Building2,
  CalendarClock,
  Check,
  Clock3,
  FileOutput,
  ListChecks,
  MessageSquareText,
  School,
  ShieldCheck,
  WandSparkles,
} from "lucide-react";
import { Poppins, Rubik } from "next/font/google";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "SkemaPilot – GPSLØB",
  description: "Prototype på et kommende skemaværktøj til små skoler, friskoler og privatskoler.",
};

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const flowSteps = [
  "Skolens rammer",
  "Klasser",
  "Fag og lokalt timetal",
  "Lærere",
  "Lokaler og faste blokke",
  "Byg skema",
  "Forbedr skemaet",
  "Print / eksportér",
] as const;

const futureCapabilities = [
  "Konflikttjek",
  "Timetalstjek",
  "Lærerskemaer",
  "Klasseskemaer",
  "Lokaler",
  "Bløde pædagogiske ønsker",
  "AI-forslag til forbedringer",
] as const;

const hardRules = [
  "Lærer må ikke være to steder samtidig",
  "Klasse må ikke dobbeltbookes",
  "Lokale må ikke dobbeltbookes",
  "Faste blokke skal respekteres",
  "Fag skal have det valgte timetal",
] as const;

const softWishes = [
  "Dansk/matematik helst tidligt på dagen",
  "Idræt gerne som dobbeltlektion",
  "Kreative fag gerne som længere blokke",
  "Ikke for mange skift på én dag",
  "Lærere skal helst ikke have mange huller",
  "Yngre elever skal helst ikke have tunge fag sent",
  "Udskoling kan bedre tåle senere fag",
] as const;

const aiDialogExamples = [
  "Kan du gøre 3. klasses skema mere roligt?",
  "Hvorfor kan Jeppe ikke få fri fredag efter 12?",
  "Kan idræt lægges som dobbeltlektion?",
  "Hvilke ændringer giver størst pædagogisk forbedring?",
] as const;

const previewRows = [
  {
    time: "08.15",
    monday: "Dansk",
    tuesday: "Matematik",
    wednesday: "Dansk",
  },
  {
    time: "09.15",
    monday: "Dansk",
    tuesday: "Natur/teknologi",
    wednesday: "Matematik",
  },
  {
    time: "10.30",
    monday: "Idræt",
    tuesday: "Engelsk",
    wednesday: "Kreativt fag",
  },
] as const;

export default function SkemaPilotPage() {
  return (
    <main
      className={`min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.2),transparent_34%),linear-gradient(135deg,#0f172a_0%,#12332d_44%,#1f2937_100%)] text-slate-950 ${poppins.className}`}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-8 md:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard/laerervaerktoejer"
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-slate-950/55 px-4 py-2 text-sm font-bold text-white shadow-sm backdrop-blur transition hover:border-emerald-300/60 hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/20"
          >
            <ArrowLeft className="h-4 w-4" />
            Lærerværktøjer
          </Link>
          <div className="hidden min-h-11 items-center gap-2 rounded-lg border border-amber-200/35 bg-amber-200/10 px-4 py-2 text-sm font-bold text-amber-50 shadow-sm backdrop-blur sm:inline-flex">
            <CalendarClock className="h-4 w-4" />
            Prototype
          </div>
        </header>

        <section className="grid items-center gap-10 pt-10 text-white lg:grid-cols-[1.02fr_0.98fr] lg:pt-14">
          <div className="max-w-3xl">
            <p className="inline-flex rounded-lg border border-amber-200/35 bg-amber-200/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-amber-50 shadow-sm backdrop-blur">
              Kommer snart
            </p>
            <h1 className={`mt-6 text-5xl font-black tracking-tight md:text-7xl ${rubik.className}`}>
              SkemaPilot
            </h1>
            <p className="mt-5 max-w-2xl text-xl font-semibold leading-8 text-slate-100">
              SkemaPilot hjælper små skoler med at lave skemaer, der både går op og giver pædagogisk
              mening.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              Første fase er en intro-prototype til små skoler, friskoler og privatskoler. Værktøjet er
              især tænkt til et-sporede skoler, hvor få lærere, få lokaler og lokale prioriteringer hurtigt
              skal passe sammen.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                disabled
                className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-emerald-300/25 bg-emerald-400/70 px-5 py-3 text-sm font-black text-slate-950 opacity-70 shadow-sm sm:w-fit"
              >
                <WandSparkles className="h-4 w-4" />
                Start SkemaPilot
              </button>
              <p className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-slate-100 backdrop-blur">
                Ikke aktiv endnu. Ingen skemaoprettelse i denne prototype.
              </p>
            </div>
          </div>

          <aside className="rounded-lg border border-white/15 bg-slate-950/60 p-5 text-white shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-md md:p-6">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
                <School className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  Prototype-status
                </p>
                <h2 className={`mt-2 text-3xl font-black tracking-tight text-white ${rubik.className}`}>
                  Først overblik, senere værktøj
                </h2>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-300">
                  Denne side beskriver retningen. Der er ikke bygget solver, AI-dialog, database eller
                  oprettelsesflow endnu.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3">
              {futureCapabilities.map((capability) => (
                <div
                  key={capability}
                  className="flex min-h-11 items-center gap-3 border-t border-white/10 pt-3 text-sm font-bold text-slate-100 first:border-t-0 first:pt-0"
                >
                  <Check className="h-4 w-4 shrink-0 text-emerald-200" />
                  {capability}
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="mt-12" aria-labelledby="skemapilot-flow-heading">
          <SectionHeader
            eyebrow="Arbejdsgang"
            title="Et enkelt flow til skolens skema"
            description="Fase 1 viser den tænkte rækkefølge. Hvert trin bliver senere et konkret område i værktøjet."
            titleId="skemapilot-flow-heading"
          />

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {flowSteps.map((step, index) => (
              <article
                key={step}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-black text-white">
                  {index + 1}
                </span>
                <h3 className={`mt-5 text-xl font-black tracking-tight text-slate-950 ${rubik.className}`}>
                  {step}
                </h3>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-5 lg:grid-cols-2">
          <RulePanel
            description="Regler, skemaet altid skal overholde, før det kan betragtes som muligt."
            icon={<ShieldCheck className="h-6 w-6" />}
            items={hardRules}
            label="Teknisk muligt"
            title="Hårde regler"
          />
          <RulePanel
            description="Prioriteter, der kan gøre skemaet mere roligt, men som nogle gange må afvejes mod hinanden."
            icon={<BrainCircuit className="h-6 w-6" />}
            items={softWishes}
            label="Pædagogisk kvalitet"
            title="Bløde ønsker"
          />
        </section>

        <section className="mt-12 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-7">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <ListChecks className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">
                  Senere tjek
                </p>
                <h2 className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubik.className}`}>
                  Skemaet skal kunne forklares
                </h2>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                  Ideen er, at SkemaPilot både viser, om skemaet går teknisk op, og hvorfor en løsning er
                  pædagogisk stærk eller svag.
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-3">
              <InfoRow icon={<Clock3 className="h-5 w-5" />} label="Tidsrammer" text="Dage, lektioner og faste blokke." />
              <InfoRow icon={<Building2 className="h-5 w-5" />} label="Ressourcer" text="Lærere, klasser og lokaler." />
              <InfoRow icon={<FileOutput className="h-5 w-5" />} label="Output" text="Printbare klasse- og lærerskemaer." />
            </div>
          </article>

          <article className="rounded-lg border border-white/15 bg-slate-950/70 p-6 text-white shadow-sm backdrop-blur md:p-7">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
                <MessageSquareText className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                  AI-dialog senere
                </p>
                <h2 className={`mt-2 text-3xl font-black tracking-tight text-white ${rubik.className}`}>
                  Eksempler på spørgsmål
                </h2>
                <p className="mt-3 text-sm font-semibold leading-7 text-slate-300">
                  Teksterne her er kun eksempler på en fremtidig dialog. Der kaldes ikke AI fra denne side.
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-3">
              {aiDialogExamples.map((example) => (
                <p
                  key={example}
                  className="rounded-lg border border-white/10 bg-white/10 px-4 py-3 text-sm font-bold leading-6 text-slate-100"
                >
                  “{example}”
                </p>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-12 pb-10" aria-labelledby="skemapilot-preview-heading">
          <SectionHeader
            eyebrow="Visuel retning"
            title="Roligt overblik frem for tungt regneark"
            description="Prototype-siden peger mod et værktøj, hvor skemaet kan læses hurtigt, men stadig bærer de vigtige forklaringer."
            titleId="skemapilot-preview-heading"
          />

          <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-[#fffdf8] shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
            <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-100 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
              <div className="px-4 py-3">Tid</div>
              <div className="px-4 py-3">Mandag</div>
              <div className="px-4 py-3">Tirsdag</div>
              <div className="px-4 py-3">Onsdag</div>
            </div>
            {previewRows.map((row) => (
              <div
                key={row.time}
                className="grid min-h-16 grid-cols-4 border-b border-slate-200 text-sm font-bold text-slate-800 last:border-b-0"
              >
                <div className="bg-slate-50 px-4 py-4 text-slate-500">{row.time}</div>
                <div className="px-4 py-4">{row.monday}</div>
                <div className="bg-emerald-50/60 px-4 py-4">{row.tuesday}</div>
                <div className="px-4 py-4">{row.wednesday}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({
  description,
  eyebrow,
  title,
  titleId,
}: {
  description: string;
  eyebrow: string;
  title: string;
  titleId: string;
}) {
  return (
    <div className="max-w-3xl text-white">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-100">{eyebrow}</p>
      <h2 id={titleId} className={`mt-3 text-3xl font-black tracking-tight md:text-5xl ${rubik.className}`}>
        {title}
      </h2>
      <p className="mt-4 text-sm font-semibold leading-7 text-slate-300 md:text-base">{description}</p>
    </div>
  );
}

function RulePanel({
  description,
  icon,
  items,
  label,
  title,
}: {
  description: string;
  icon: ReactNode;
  items: readonly string[];
  label: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm md:p-7">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
          {icon}
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
          <h2 className={`mt-2 text-3xl font-black tracking-tight text-slate-950 ${rubik.className}`}>{title}</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">{description}</p>
        </div>
      </div>
      <ul className="mt-6 grid gap-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 border-t border-slate-100 pt-3 text-sm font-bold leading-6 text-slate-700 first:border-t-0 first:pt-0"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function InfoRow({ icon, label, text }: { icon: ReactNode; label: string; text: string }) {
  return (
    <div className="flex items-start gap-3 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
      <span className="mt-0.5 text-emerald-700">{icon}</span>
      <p className="text-sm leading-6 text-slate-600">
        <span className="font-black text-slate-950">{label}:</span> <span className="font-semibold">{text}</span>
      </p>
    </div>
  );
}
