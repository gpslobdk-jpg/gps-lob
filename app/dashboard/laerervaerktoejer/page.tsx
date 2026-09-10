import type { Metadata } from "next";
import { ArrowLeft, BookOpen, Calendar, ChessKnight, Compass, FileText, Presentation, School, UsersRound } from "lucide-react";
import Link from "next/link";

import HeroBanner from "@/components/brand/HeroBanner";
import QuickActionCard from "@/components/brand/QuickActionCard";
import { poppins } from "@/lib/fonts";
import { getDagensTavleSsoOrigin, getFamilySsoOrigin } from "@/lib/familySso/config";

export const metadata: Metadata = {
  title: "Lærerværktøjer – SkoleGPS",
  description: "Vælg et lærerredskab ud fra det, du vil lave nu.",
};

const dagensTavleOrigin = getDagensTavleSsoOrigin() ?? "https://dagenstavle.dk";
const printMitOrigin = getFamilySsoOrigin("printmitarbejdsark") ?? "https://printmitarbejdsark.dk";

const groups = {
  planlaeg: {
    title: "Planlæg & forbered",
    description: "Gør klar til dagen, ugen og dine materialer.",
    icon: Calendar,
    tools: [
      { title: "DagensTavle", description: "Fra skema til tavle – klar til undervisning.", href: `${dagensTavleOrigin}/auth/family-sso/start?next=%2Ftavle&source=skolegps`, icon: Presentation, cta: "Åbn DagensTavle", tone: "green" as const },
      { title: "Årsplan", description: "Lav og tilpas en årsplan – klar som PDF.", href: "/dashboard/laerervaerktoejer/aarsplan-generator", icon: Calendar, cta: "Lav årsplan", tone: "yellow" as const },
      { title: "SkemaPilot", description: "Byg en skemakladde med fag, lærere og lokaler.", href: "https://www.skemapilot.dk/app", icon: School, cta: "Åbn SkemaPilot", tone: "blue" as const },
      { title: "PrintMitArbejdsark", description: "Lav arbejdsark klar til print på få minutter.", href: `${printMitOrigin}/auth/family-sso/start?next=%2Flav&source=skolegps`, icon: FileText, cta: "Åbn arbejdsark", tone: "navy" as const },
      { title: "KildeGPS", description: "Find udvalgte kilder til elevernes research.", href: "https://www.kildegps.dk", icon: Compass, cta: "Åbn KildeGPS", tone: "blue" as const },
    ],
  },
  aktiver: {
    title: "Aktivér klassen",
    description: "Sæt en fælles aktivitet i gang her og nu.",
    icon: UsersRound,
    tools: [
      { title: "Skak", description: "Lær, vis og spil fysisk skak i klassen.", href: "/dashboard/laerervaerktoejer/skak", icon: ChessKnight, cta: "Åbn Skak", tone: "yellow" as const },
    ],
  },
  ud: {
    title: "Kom ud & bevæg jer",
    description: "Brug en enkel aktivitet, når undervisningen skal udenfor.",
    icon: Compass,
    tools: [
      { title: "Fysisk Stjerneløb", description: "Lav et analogt løb til print med poster i terrænet.", href: "/dashboard/opret/stjerneloeb", icon: Compass, cta: "Lav stjerneløb", tone: "green" as const },
    ],
  },
} as const;

type GroupKey = keyof typeof groups;

function isGroupKey(value: string | undefined): value is GroupKey {
  return Boolean(value && value in groups);
}

export default async function LaerervaerktoejerPage({ searchParams }: { searchParams: Promise<{ omraade?: string }> }) {
  const { omraade } = await searchParams;
  const selectedKey = isGroupKey(omraade) ? omraade : null;
  const selectedGroup = selectedKey ? groups[selectedKey] : null;

  return (
    <main className={`relative min-h-screen overflow-x-hidden bg-[var(--skolegps-muted-bg)] text-slate-950 ${poppins.className}`}>
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_14%_8%,rgba(14,165,233,0.15),transparent_30%),radial-gradient(circle_at_86%_10%,rgba(247,183,51,0.13),transparent_28%),linear-gradient(180deg,#f4fbff_0%,#eef9ef_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-6 sm:py-8 lg:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-100 bg-white/82 px-4 py-2 text-sm font-bold text-[var(--skolegps-deep-navy)] shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"><ArrowLeft className="h-4 w-4" />Tilbage</Link>
          <span className="hidden min-h-11 items-center gap-2 rounded-full border border-sky-100 bg-white/82 px-4 py-2 text-sm font-bold text-sky-800 shadow-sm backdrop-blur sm:inline-flex"><BookOpen className="h-4 w-4" />SkoleGPS</span>
        </header>
        <section className="py-6 sm:py-8"><HeroBanner compact eyebrow="Lærerhub" icon={Compass} mascot="point" title="Hvad vil du lave?" subtitle="Vælg ét område, så viser vi kun det, der er relevant." />
          {selectedGroup && selectedKey ? <section className="mt-7"><Link href="/dashboard/laerervaerktoejer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-900 hover:bg-sky-50"><ArrowLeft className="h-4 w-4" />Alle områder</Link><div className="mt-5"><p className="text-xs font-black tracking-[0.18em] text-sky-700 uppercase">Lærerværktøjer</p><h2 className="mt-2 text-3xl font-black text-[var(--skolegps-deep-navy)]">{selectedGroup.title}</h2><p className="mt-2 font-semibold leading-6 text-slate-700">{selectedGroup.description}</p></div><div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">{selectedGroup.tools.map((tool) => { const Icon = tool.icon; const external = tool.href.startsWith("http"); return <Link key={tool.title} href={tool.href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className="block rounded-2xl focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sky-500"><QuickActionCard className="min-h-56" cta={tool.cta} description={tool.description} eyebrow={external ? "SkoleGPS-familien" : "I SkoleGPS"} icon={Icon} title={tool.title} tone={tool.tone} /></Link>; })}</div></section> : <section className="mt-7 grid gap-5 md:grid-cols-3" aria-label="Områder i lærerværktøjer">{(Object.entries(groups) as [GroupKey, (typeof groups)[GroupKey]][]).map(([key, group]) => { const Icon = group.icon; return <Link key={key} href={`/dashboard/laerervaerktoejer?omraade=${key}`} className="group rounded-[1.5rem] border border-sky-100 bg-white p-6 shadow-[0_16px_40px_rgba(7,26,58,0.1)] transition hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_24px_54px_rgba(7,26,58,0.16)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-500"><span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-[0_10px_20px_rgba(3,119,216,0.24)]"><Icon className="h-6 w-6" /></span><h2 className="mt-5 text-2xl font-black text-[var(--skolegps-deep-navy)]">{group.title}</h2><p className="mt-2 min-h-12 font-semibold leading-6 text-slate-600">{group.description}</p><span className="mt-5 inline-flex rounded-full bg-sky-50 px-4 py-2 text-sm font-black text-sky-800 group-hover:bg-sky-100">Se værktøjer</span></Link>; })}</section>}
        </section>
      </div>
    </main>
  );
}
