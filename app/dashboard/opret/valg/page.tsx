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
  shapeClass: string;
  accentClass: string;
};

const cards: HubCard[] = [
  {
    title: "Klassisk Quiz-løb",
    shortText: "Multiple-choice spørgsmål med AI-assistent.",
    detail:
      "Skab en traditionel rute, hvor viden er i fokus. Hver post indeholder et spørgsmål med 4 svarmuligheder. Ideelt til faglige gentagelser eller sjove skattejagter. Brug vores pædagogiske AI til at generere spørgsmål, der passer præcis til dit emne og niveau.",
    href: "/dashboard/opret/manuel",
    badge: "Klar nu",
    cta: "Åbn quiz-bygger",
    icon: BrainCircuit,
    shapeClass: "[border-radius:34%_66%_59%_41%/42%_39%_61%_58%]",
    accentClass: "from-emerald-300/20 via-white/5 to-sky-300/10",
  },
  {
    title: "AI Foto-mission",
    shortText: "Gør naturen til en interaktiv opgave.",
    detail:
      "Her skal eleverne bruge øjnene! I stedet for at svare på spørgsmål, skal de finde og fotografere specifikke motiver i naturen. Vores AI analyserer billedet med det samme og tjekker, om de har fundet det rigtige. Perfekt til undersøgelser i skoven, mønstergenkendelse eller kreative opgaver.",
    href: "/dashboard/opret/foto",
    badge: "Klar nu",
    cta: "Åbn foto-mission",
    icon: Camera,
    shapeClass: "[border-radius:59%_41%_36%_64%/39%_58%_42%_61%]",
    accentClass: "from-sky-300/20 via-white/5 to-emerald-300/10",
  },
  {
    title: "Nye eventyr på vej...",
    shortText: "Vi udvikler løbende nye måder at lære og lege på i det fri.",
    badge: "Kommer snart",
    cta: "Mere på vej",
    icon: Compass,
    shapeClass: "[border-radius:41%_59%_63%_37%/46%_38%_62%_54%]",
    accentClass: "from-white/10 via-white/[0.02] to-white/[0.04]",
  },
  {
    title: "Nye eventyr på vej...",
    shortText: "Vi udvikler løbende nye måder at lære og lege på i det fri.",
    badge: "Kommer snart",
    cta: "Mere på vej",
    icon: Sparkles,
    shapeClass: "[border-radius:61%_39%_46%_54%/35%_57%_43%_65%]",
    accentClass: "from-white/10 via-white/[0.02] to-white/[0.04]",
  },
];

export default function ValgHubPage() {
  return (
    <main
      className={`relative min-h-screen overflow-hidden px-6 py-8 text-white md:px-10 md:py-10 ${poppins.className}`}
    >
      <div className="fixed inset-0 -z-30">
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          src="/arkiv-bg.mp4"
        />
        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-md" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_35%),linear-gradient(180deg,rgba(2,6,23,0.25)_0%,rgba(2,6,23,0.8)_100%)]" />
      </div>

      <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden">
        <div className="absolute top-12 left-[8%] h-56 w-56 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="absolute right-[6%] bottom-20 h-72 w-72 rounded-full bg-sky-300/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-3xl" />
      </div>

      <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard/opret"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-xl transition-colors hover:border-white/20 hover:bg-black/30"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbage til opret
          </Link>
          <p className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-xs font-semibold tracking-[0.24em] text-white/70 uppercase backdrop-blur-xl">
            Valg-Hub
          </p>
        </div>

        <div className="mt-12 max-w-3xl">
          <p className="text-sm font-semibold tracking-[0.32em] text-emerald-100/80 uppercase">
            Vælg oplevelsen
          </p>
          <h1
            className={`mt-4 text-4xl font-black tracking-tight text-white md:text-6xl ${rubik.className}`}
          >
            Hvilket læringseventyr skal eleverne sendes ud på?
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/75 md:text-base">
            Vælg et format, der passer til dagens mål. De aktive kort folder sig ud med en
            grundig forklaring, så du hurtigt kan mærke forskellen mellem klassisk quiz og
            billeddrevet feltarbejde.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2 xl:gap-8">
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
                    className={`relative flex h-full min-h-[320px] flex-col overflow-hidden border border-white/10 bg-black/25 p-7 shadow-[0_24px_60px_rgba(2,6,23,0.42)] backdrop-blur-2xl transition-all duration-500 will-change-transform md:min-h-[360px] md:group-hover:-translate-y-2 md:group-hover:scale-[1.02] md:group-hover:border-white/20 md:group-focus-visible:-translate-y-2 md:group-focus-visible:scale-[1.02] md:group-focus-visible:border-white/20 ${card.shapeClass}`}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.accentClass}`} />
                    <div className="absolute inset-x-8 top-8 h-24 rounded-full bg-white/10 blur-3xl transition-opacity duration-500 md:opacity-40 md:group-hover:opacity-80 md:group-focus-visible:opacity-80" />

                    <div className="relative z-10 flex h-full flex-col">
                      <div className="flex items-start justify-between gap-4">
                        <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.24em] text-white/75 uppercase">
                          {card.badge}
                        </span>
                        <div className="flex h-14 w-14 items-center justify-center rounded-[1.75rem] border border-white/10 bg-black/20 text-emerald-100 backdrop-blur-xl">
                          <Icon className="h-6 w-6" />
                        </div>
                      </div>

                      <div className="mt-10">
                        <h2 className={`text-3xl font-black tracking-tight text-white ${rubik.className}`}>
                          {card.title}
                        </h2>
                        <p className="mt-4 max-w-lg text-base leading-relaxed text-white/[0.78]">
                          {card.shortText}
                        </p>
                        <p className="mt-5 text-sm leading-relaxed text-white/80 transition-all duration-500 md:max-h-0 md:-translate-y-3 md:overflow-hidden md:opacity-0 md:group-hover:max-h-72 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:group-focus-visible:max-h-72 md:group-focus-visible:translate-y-0 md:group-focus-visible:opacity-100">
                          {card.detail}
                        </p>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-4 pt-8">
                        <p className="text-xs font-semibold tracking-[0.22em] text-white/60 uppercase">
                          Hold musen over eller tryk for mere
                        </p>
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur-xl transition-all duration-500 md:group-hover:border-white/20 md:group-hover:bg-black/30 md:group-focus-visible:border-white/20 md:group-focus-visible:bg-black/30">
                          {card.cta}
                          <ArrowRight className="h-4 w-4 transition-transform duration-500 md:group-hover:translate-x-1 md:group-focus-visible:translate-x-1" />
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
                className={`relative flex min-h-[320px] flex-col overflow-hidden border border-white/10 bg-white/[0.05] p-7 opacity-75 shadow-[0_20px_50px_rgba(2,6,23,0.32)] backdrop-blur-2xl md:min-h-[360px] ${card.shapeClass}`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${card.accentClass}`} />
                <div className="relative z-10 flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[11px] font-semibold tracking-[0.24em] text-white/[0.65] uppercase">
                      {card.badge}
                    </span>
                    <div className="flex h-14 w-14 items-center justify-center rounded-[1.75rem] border border-white/10 bg-black/[0.15] text-white/75 backdrop-blur-xl">
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>

                  <div className="mt-10">
                    <h2 className={`text-3xl font-black tracking-tight text-white/90 ${rubik.className}`}>
                      {card.title}
                    </h2>
                    <p className="mt-4 max-w-lg text-base leading-relaxed text-white/[0.68]">
                      {card.shortText}
                    </p>
                  </div>

                  <div className="mt-auto pt-8">
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-black/[0.15] px-4 py-2 text-sm font-semibold text-white/[0.65] backdrop-blur-xl">
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
