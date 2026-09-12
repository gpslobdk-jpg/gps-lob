import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  ChessKnight,
  Compass,
  FileText,
  Presentation,
  School,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { poppins, rubik } from "@/lib/fonts";
import { getDagensTavleSsoOrigin, getFamilySsoOrigin } from "@/lib/familySso/config";

export const metadata = {
  title: "Lærerværktøjer – SkoleGPS",
  description: "Vælg et lærerredskab ud fra det, du vil lave nu.",
};

const dagensTavleOrigin = getDagensTavleSsoOrigin() ?? "https://dagenstavle.dk";
const printMitOrigin = getFamilySsoOrigin("printmitarbejdsark") ?? "https://printmitarbejdsark.dk";

type Tool = {
  cta: string;
  description: string;
  href: string;
  icon: LucideIcon;
  title: string;
};

const groups = {
  planlaeg: {
    title: "Planlæg & forbered",
    description: "Gør klar til dagen, ugen og dine materialer.",
    icon: Calendar,
    tools: [
      { title: "DagensTavle", description: "Fra skema til tavle – klar til undervisning.", href: `${dagensTavleOrigin}/auth/family-sso/start?next=%2Ftavle&source=skolegps`, icon: Presentation, cta: "Åbn DagensTavle" },
      { title: "Årsplan", description: "Lav og tilpas en årsplan – klar som PDF.", href: "/dashboard/laerervaerktoejer/aarsplan-generator", icon: Calendar, cta: "Lav årsplan" },
      { title: "SkemaPilot", description: "Byg en skemakladde med fag, lærere og lokaler.", href: "https://www.skemapilot.dk/app", icon: School, cta: "Åbn SkemaPilot" },
      { title: "PrintMitArbejdsark", description: "Lav arbejdsark klar til print på få minutter.", href: `${printMitOrigin}/auth/family-sso/start?next=%2Flav&source=skolegps`, icon: FileText, cta: "Åbn arbejdsark" },
      { title: "KildeGPS", description: "Find udvalgte kilder til elevernes research.", href: "https://www.kildegps.dk", icon: Compass, cta: "Åbn KildeGPS" },
    ],
  },
  aktiver: {
    title: "Aktivér klassen",
    description: "Sæt en fælles aktivitet i gang her og nu.",
    icon: UsersRound,
    tools: [
      { title: "Skak", description: "Lær, vis og spil fysisk skak i klassen.", href: "/dashboard/laerervaerktoejer/skak", icon: ChessKnight, cta: "Åbn Skak" },
    ],
  },
  ud: {
    title: "Kom ud & bevæg jer",
    description: "Brug en enkel aktivitet, når undervisningen skal udenfor.",
    icon: Compass,
    tools: [
      { title: "Fysisk Stjerneløb", description: "Lav et analogt løb til print med poster i terrænet.", href: "/dashboard/opret/stjerneloeb", icon: Compass, cta: "Lav stjerneløb" },
    ],
  },
} satisfies Record<string, { description: string; icon: LucideIcon; title: string; tools: Tool[] }>;

type GroupKey = keyof typeof groups;

function isGroupKey(value: string | undefined): value is GroupKey {
  return Boolean(value && value in groups);
}

function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;
  const className = "group flex min-h-48 flex-col rounded-2xl border border-sky-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-[0_18px_38px_rgba(7,26,58,0.11)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-500";
  const content = (
    <>
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-xl font-black text-[var(--skolegps-deep-navy)]">{tool.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{tool.description}</p>
      <span className="mt-5 inline-flex items-center gap-1 text-sm font-black text-sky-800">
        {tool.cta}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </>
  );

  return tool.href.startsWith("http") ? (
    <a href={tool.href} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <Link href={tool.href} className={className}>
      {content}
    </Link>
  );
}

export default async function LaerervaerktoejerPage({ searchParams }: { searchParams: Promise<{ omraade?: string }> }) {
  const { omraade } = await searchParams;
  const selectedKey = isGroupKey(omraade) ? omraade : null;
  const selectedGroup = selectedKey ? groups[selectedKey] : null;

  return (
    <main className={`skolegps-teacher-page min-h-screen px-5 py-6 text-slate-950 sm:px-6 sm:py-8 lg:px-8 ${poppins.className}`}>
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="skolegps-teacher-secondary-action inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Tilbage
          </Link>
          <span className="hidden items-center gap-2 text-sm font-bold text-sky-800 sm:inline-flex">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            SkoleGPS
          </span>
        </header>

        <section className="pt-10 sm:pt-14">
          <p className="text-xs font-black tracking-[0.18em] text-sky-800 uppercase">Lærerværktøjer</p>
          <h1 className={`mt-3 text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-5xl ${rubik.className}`}>
            {selectedGroup ? selectedGroup.title : "Vælg det, du skal bruge."}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            {selectedGroup ? selectedGroup.description : "Start med ét område. Du kan altid gå tilbage og vælge noget andet."}
          </p>
        </section>

        {selectedGroup ? (
          <section className="mt-8">
            <Link href="/dashboard/laerervaerktoejer" className="skolegps-teacher-secondary-action inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Alle områder
            </Link>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {selectedGroup.tools.map((tool) => <ToolCard key={tool.title} tool={tool} />)}
            </div>
          </section>
        ) : (
          <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Områder i lærerværktøjer">
            {(Object.entries(groups) as [GroupKey, (typeof groups)[GroupKey]][]).map(([key, group]) => {
              const Icon = group.icon;
              return (
                <Link
                  key={key}
                  href={`/dashboard/laerervaerktoejer?omraade=${key}`}
                  className="skolegps-teacher-surface group rounded-3xl p-6 transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-[0_20px_44px_rgba(7,26,58,0.12)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-500"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h2 className={`mt-6 text-2xl font-black text-[var(--skolegps-deep-navy)] ${rubik.className}`}>{group.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{group.description}</p>
                  <span className="mt-6 inline-flex items-center gap-1 text-sm font-black text-sky-800">
                    Se værktøjer
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
