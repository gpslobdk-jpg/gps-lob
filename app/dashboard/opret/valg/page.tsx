import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight, BrainCircuit, Camera, Compass, Sparkles } from "lucide-react";
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

type HubCard = {
  title: string;
  shortText: string;
  detail?: string;
  href?: string;
  badge: string;
  cta: string;
  icon: LucideIcon;
  surfaceClass: string;
  borderClass: string;
  titleClass: string;
  accentTextClass: string;
  accentMutedClass: string;
  iconSurfaceClass: string;
};

const cards: HubCard[] = [
  {
    title: "Klassisk Quiz-løb",
    shortText: "Multiple-choice spørgsmål med AI-assistent.",
    detail: "Skab en klassisk rute med spørgsmål og fire svarmuligheder.",
    href: "/dashboard/opret/manuel",
    badge: "Klar nu",
    cta: "Åbn quiz-bygger",
    icon: BrainCircuit,
    surfaceClass: "bg-emerald-50/90",
    borderClass: "border-emerald-200/50",
    titleClass: "text-emerald-950",
    accentTextClass: "text-emerald-700",
    accentMutedClass: "text-emerald-700/80",
    iconSurfaceClass: "border-emerald-200/50 bg-emerald-100/80",
  },
  {
    title: "AI Foto-mission",
    shortText: "Gør virkeligheden til en interaktiv opgave.",
    detail:
      "Deltagerne skal bruge øjnene! I stedet for at svare på spørgsmål, skal de finde og fotografere specifikke motiver i virkeligheden.",
    href: "/dashboard/opret/foto",
    badge: "Klar nu",
    cta: "Åbn foto-mission",
    icon: Camera,
    surfaceClass: "bg-sky-50/90",
    borderClass: "border-sky-200/50",
    titleClass: "text-sky-950",
    accentTextClass: "text-sky-700",
    accentMutedClass: "text-sky-700/80",
    iconSurfaceClass: "border-sky-200/50 bg-sky-100/80",
  },
  {
    title: "Escape Room i Naturen",
    shortText: "Knæk koden og løs logiske gåder.",
    detail:
      "Fokus på logik, matematik og samarbejde. Deltagerne skal løse gåder ved hver post for at samle tal eller bogstaver til en endelig master-kode. Perfekt til teambuilding og udendørs 'break-out' spil.",
    href: "/dashboard/opret/escape",
    badge: "Klar nu",
    cta: "Åbn escape room",
    icon: Compass,
    surfaceClass: "bg-amber-50/90",
    borderClass: "border-amber-200/50",
    titleClass: "text-amber-950",
    accentTextClass: "text-amber-700",
    accentMutedClass: "text-amber-700/80",
    iconSurfaceClass: "border-amber-200/50 bg-amber-100/70",
  },
  {
    title: "Tidsmaskinen",
    shortText: "Lad en historisk person styre løbet.",
    detail:
      "AI'en spiller en fiktiv eller historisk karakter. Deltagerne modtager dramatiske beskeder og skal svare for at drive historien frem.",
    href: "/dashboard/opret/rollespil",
    badge: "Klar nu",
    cta: "Åbn rollespil",
    icon: Sparkles,
    surfaceClass: "bg-stone-100/90",
    borderClass: "border-stone-200/50",
    titleClass: "text-stone-900",
    accentTextClass: "text-stone-700",
    accentMutedClass: "text-stone-700/80",
    iconSurfaceClass: "border-stone-200/50 bg-stone-50/70",
  },
];

const guideItems = [
  {
    icon: "🌲",
    title: "Quiz",
    text: "Klassiske poster med spørgsmål og fire svarmuligheder.",
  },
  {
    icon: "📸",
    title: "Foto",
    text: "Deltagerne finder motiver i virkeligheden og tager et billede.",
  },
  {
    icon: "🗝️",
    title: "Escape",
    text: "Logiske gåder giver kode-brikker, som samles til en finale.",
  },
  {
    icon: "🎭",
    title: "Tidsmaskine",
    text: "En karakter styrer historien med beskeder, svar og stemning.",
  },
] as const;

export default function ValgHubPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-300 via-emerald-50 to-emerald-200 px-6 py-12 text-emerald-950 md:px-10 lg:bg-none lg:bg-transparent ${poppins.className}`}
    >
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed top-0 left-0 -z-20 hidden h-full w-full object-cover lg:block"
        src="/opret-bg.mp4"
      />
      <div className="fixed inset-0 -z-10 hidden bg-gradient-to-b from-sky-900/10 to-emerald-900/50 backdrop-blur-[2px] lg:block" />

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/opret"
            className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-900 shadow-lg backdrop-blur-md transition-all duration-300 hover:bg-white/95 hover:shadow-xl"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til opret
          </Link>
          <p className="rounded-full border border-white/50 bg-white/75 px-4 py-2 text-xs font-semibold tracking-[0.24em] text-emerald-800/80 uppercase shadow-lg backdrop-blur-md">
            Løbstyper
          </p>
        </div>

        <div className="mt-12 max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.32em] text-white/90 drop-shadow-md uppercase">
            Vælg format
          </p>
          <h1
            className={`mt-4 text-4xl font-black tracking-tight text-white drop-shadow-md md:text-5xl ${rubik.className}`}
          >
            Hvilken type løb vil du bygge?
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-white drop-shadow-md md:text-base">
            Vælg det format, der passer bedst til dit arrangement. Uanset om det er
            teambuilding, en skattejagt eller undervisning, tilpasser systemet sig automatisk.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-[1.75rem] border border-white/15 bg-slate-900/40 p-4 text-white shadow-lg backdrop-blur-md sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold tracking-[0.28em] text-white/75 uppercase">
              Lærer-guide
            </p>
            <p className="text-xs text-white/65">
              Få hurtigt overblik over de fire måder at bygge et løb på.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {guideItems.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <p className="text-sm font-semibold text-white">
                  <span className="mr-2">{item.icon}</span>
                  {item.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-white/75 sm:text-sm">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {cards.map((card, index) => {
            const Icon = card.icon;

            if (card.href) {
              return (
                <Link
                  key={`${card.title}-${index}`}
                  href={card.href}
                  className="group block h-full focus:outline-none"
                >
                  <article
                    className={`relative flex h-full flex-col justify-between overflow-hidden rounded-[2rem] border p-7 shadow-lg backdrop-blur-md transition-all duration-300 group-hover:scale-[1.02] group-hover:shadow-xl group-focus-visible:scale-[1.02] group-focus-visible:shadow-xl ${card.surfaceClass} ${card.borderClass}`}
                  >
                    <div className="relative z-10 flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between gap-4">
                        <span
                          className={`rounded-full border bg-white/75 px-3 py-1 text-[11px] font-semibold tracking-[0.24em] uppercase ${card.borderClass} ${card.accentMutedClass}`}
                        >
                          {card.badge}
                        </span>
                        <div
                          className={`flex h-14 w-14 items-center justify-center rounded-full border shadow-inner ${card.iconSurfaceClass} ${card.accentTextClass}`}
                        >
                          <Icon className="h-6 w-6" />
                        </div>
                      </div>

                      <div className="mt-8 flex-1">
                        <h2 className={`text-2xl font-black tracking-wide ${card.titleClass} ${rubik.className}`}>
                          {card.title}
                        </h2>
                        <p className="mt-4 text-sm leading-relaxed text-slate-700">
                          {card.shortText}
                        </p>
                        {card.detail ? (
                          <p className="mt-4 text-sm leading-relaxed text-slate-700">
                            {card.detail}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-6 flex items-center justify-between gap-3">
                        <p className={`text-xs font-bold tracking-[0.18em] uppercase ${card.accentTextClass}`}>
                          Vælg løbstype
                        </p>
                        <span className={`inline-flex items-center gap-2 text-sm font-semibold ${card.accentTextClass}`}>
                          {card.cta}
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-focus-visible:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </article>
                </Link>
              );
            }

            return (
              <article
                key={`${card.title}-${index}`}
                className={`relative flex flex-col justify-between overflow-hidden rounded-[2rem] border p-7 shadow-lg backdrop-blur-md ${card.surfaceClass} ${card.borderClass}`}
              >
                <div className="relative z-10 flex h-full flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={`rounded-full border bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-[0.24em] uppercase ${card.borderClass} ${card.accentMutedClass}`}
                    >
                      {card.badge}
                    </span>
                    <div
                      className={`flex h-14 w-14 items-center justify-center rounded-full border bg-white/70 shadow-inner ${card.borderClass} ${card.accentTextClass}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="mt-8 flex-1">
                    <h2 className={`text-2xl font-black tracking-wide ${card.titleClass} ${rubik.className}`}>
                      {card.title}
                    </h2>
                    <p className="mt-4 text-sm leading-relaxed text-slate-700">
                      {card.shortText}
                    </p>
                  </div>

                  <div className="mt-6 pt-2">
                    <span className={`inline-flex items-center text-sm font-semibold ${card.accentMutedClass}`}>
                      {card.cta}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
