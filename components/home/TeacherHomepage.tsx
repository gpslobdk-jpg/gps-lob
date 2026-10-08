import {
  ArrowRight,
  Compass,
  FileText,
  MapPin,
  Presentation,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import AIChatButton from "@/components/AIChatButton";
import MobileInSchoolBanner from "@/components/MobileInSchoolBanner";
import AutumnHeroDecorations from "@/components/home/AutumnHeroDecorations";
import PisaNotice from "@/components/home/PisaNotice";
import ProjectWorkshopAnnouncement from "@/components/home/ProjectWorkshopAnnouncement";
import TeacherHomepageClientGuard from "@/components/home/TeacherHomepageClientGuard";
import TeacherSoundControl from "@/components/teacher-sound/TeacherSoundControl";
import { getTeacherTool, type ActiveTeacherTool, type TeacherToolId } from "@/lib/teacherTools/registry";

const FACEBOOK_PAGE_URL = "https://www.facebook.com/profile.php?id=61594705569977";
const FACEBOOK_GROUP_URL = "https://www.facebook.com/groups/1649785632764130";

type ToolVisual = "route" | "paper" | "board";

type ToolCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  icon: LucideIcon;
  tone: "blue" | "gold" | "green";
  visual: ToolVisual;
};

function requiredActiveTool(id: TeacherToolId): ActiveTeacherTool {
  const tool = getTeacherTool(id);

  if (!tool || tool.status !== "active") {
    throw new Error(`The public homepage requires the active ${id} tool entry.`);
  }

  return tool;
}

function ToolVisual({ visual, title }: Pick<ToolCardProps, "visual" | "title">) {
  if (visual === "route") {
    return (
      <div className="relative h-40 overflow-hidden rounded-2xl border border-sky-950/10 bg-[#e8f1df]" aria-hidden="true">
        <Image
          src="/brand/heroes/adventure-banner.webp"
          alt=""
          fill
          sizes="(max-width: 767px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className="object-cover object-center"
        />
        <span className="absolute bottom-3 left-3 rounded-full bg-[#0b213a]/88 px-3 py-1.5 text-[11px] font-black tracking-[0.12em] text-white uppercase">
          Rute og opgaver
        </span>
      </div>
    );
  }

  if (visual === "paper") {
    return (
      <div className="relative h-40 overflow-hidden rounded-2xl border border-amber-950/10 bg-[linear-gradient(135deg,#f8ecd3,#f5f0df_60%,#dcebd6)] p-5" aria-hidden="true">
        <div className="absolute -right-7 -top-8 h-32 w-32 rounded-full border-[18px] border-amber-500/20" />
        <div className="relative h-full max-w-[12rem] rotate-[-3deg] rounded-md bg-[#fffdf6] px-4 py-3 shadow-[0_13px_24px_rgba(79,52,16,0.18)]">
          <p className="text-[10px] font-black tracking-[0.17em] text-amber-800 uppercase">Arbejdsark</p>
          <div className="mt-3 space-y-2">
            <span className="block h-2 w-4/5 rounded-full bg-amber-900/18" />
            <span className="block h-2 w-full rounded-full bg-slate-900/12" />
            <span className="block h-2 w-3/4 rounded-full bg-slate-900/12" />
            <span className="block h-2 w-5/6 rounded-full bg-slate-900/12" />
          </div>
        </div>
        <span className="absolute bottom-3 right-3 rounded-full bg-amber-950/84 px-3 py-1.5 text-[11px] font-black tracking-[0.12em] text-white uppercase">
          Klar til print
        </span>
      </div>
    );
  }

  return (
    <div className="relative h-40 overflow-hidden rounded-2xl border border-emerald-950/10 bg-[linear-gradient(135deg,#dceee5,#f7efd7)] p-4" aria-label={`${title}: tekstbaseret produktkort, ikke et skærmbillede`}>
      <div className="absolute -left-7 -bottom-10 h-32 w-32 rounded-full border-[17px] border-emerald-700/12" aria-hidden="true" />
      <div className="relative rounded-xl bg-[#fffdf7] p-3 shadow-[0_13px_24px_rgba(27,70,50,0.16)]">
        <p className="text-[10px] font-black tracking-[0.15em] text-emerald-800 uppercase">Dagens program</p>
        <div className="mt-2 space-y-1.5 text-xs font-bold text-[#173c31]">
          <p className="rounded-md bg-amber-100 px-2 py-1">Start sammen</p>
          <p className="rounded-md bg-emerald-100 px-2 py-1">Dagens opgave</p>
          <p className="rounded-md bg-sky-100 px-2 py-1">Opsamling</p>
        </div>
      </div>
      <span className="absolute bottom-3 right-3 rounded-full bg-emerald-950/84 px-3 py-1.5 text-[10px] font-black tracking-[0.1em] text-white uppercase">
        Teksteksempel
      </span>
    </div>
  );
}

function ToolCard({ eyebrow, title, description, cta, href, icon: Icon, tone, visual }: ToolCardProps) {
  const toneClasses = {
    blue: "bg-sky-700 text-sky-950 ring-sky-900/10",
    gold: "bg-amber-600 text-amber-950 ring-amber-900/10",
    green: "bg-emerald-700 text-emerald-950 ring-emerald-900/10",
  }[tone];

  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[1.65rem] border border-[#d8e3d0] bg-[#fffdf6] p-4 shadow-[0_14px_30px_rgba(24,50,41,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_40px_rgba(24,50,41,0.13)] sm:p-5">
      <ToolVisual visual={visual} title={title} />
      <div className="pt-5">
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${toneClasses.split(" ")[0]}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-xs font-black tracking-[0.15em] text-[#496250] uppercase">{eyebrow}</p>
        </div>
        <h3 className="mt-4 text-2xl font-black tracking-tight text-[#0b213a]">{title}</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{description}</p>
        <a
          href={href}
          className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-black text-[#0b4f74] underline decoration-[#f4bb54] decoration-2 underline-offset-4 transition hover:text-[#062d45] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0b4f74]"
        >
          {cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </a>
      </div>
    </article>
  );
}

function Step({ number, title, children, icon: Icon }: { number: string; title: string; children: React.ReactNode; icon: LucideIcon }) {
  return (
    <li className="rounded-2xl border border-[#d9e5dc] bg-white p-5 shadow-[0_10px_24px_rgba(24,50,41,0.06)]">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b213a] text-sm font-black text-white">{number}</span>
        <Icon className="h-5 w-5 text-[#226a4d]" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-black text-[#0b213a]">{title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{children}</p>
    </li>
  );
}

export default function TeacherHomepage() {
  const gps = requiredActiveTool("gps-lob");
  const classroom = requiredActiveTool("dagens-tavle");
  const worksheets = requiredActiveTool("printmit-arbejdsark");

  return (
    <TeacherHomepageClientGuard>
    <div data-testid="home-teacher-root" className="min-h-screen overflow-x-hidden bg-[#f6f1e5] text-[#0b213a]">
      <section data-testid="home-hero-scene" className="skolegps-autumn-hero relative isolate min-h-[44rem] overflow-hidden border-b border-[#0b213a]/15 bg-[#0b213a] text-white">
        <picture className="absolute inset-0 -z-30">
          <source media="(max-width: 767px)" srcSet="/brand/heroes/autumn-hero-2026-mobile.webp" type="image/webp" />
          {/* Separate, pre-compressed WebP crops preserve the composition across viewports. */}
          <img src="/brand/heroes/autumn-hero-2026.webp" alt="" fetchPriority="high" className="h-full w-full object-cover object-[64%_center]" />
        </picture>
        <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(11,33,58,0.98)_0%,rgba(11,33,58,0.94)_34%,rgba(11,33,58,0.58)_58%,rgba(11,33,58,0.13)_84%,rgba(11,33,58,0.22)_100%)]" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-44 bg-[linear-gradient(0deg,rgba(7,25,45,0.82),transparent)]" />
        <AutumnHeroDecorations />

        <header className="relative z-20 mx-auto flex w-full max-w-7xl flex-wrap items-start justify-between gap-4 px-5 py-5 sm:px-6 lg:px-8">
          <div className="flex shrink-0 flex-col items-start gap-2">
            <Link
              href="/"
              aria-label="SkoleGPS forside"
              className="inline-flex rounded-full bg-[#fffdf7] px-3 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.2)] transition hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#f4bb54] sm:px-4"
            >
              <Image src="/skolegps-logo.svg" alt="SkoleGPS" width={256} height={72} priority className="h-auto w-36 sm:w-48" />
            </Link>
            <TeacherSoundControl variant="hero" />
          </div>

          <nav className="hidden items-center gap-5 lg:flex" aria-label="Hovedmenu">
            <a href="#vaerktojer" className="text-sm font-bold text-white/90 transition hover:text-[#f9d987] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f4bb54]">Værktøjer</a>
            <a href="#saadan-virker-det" className="text-sm font-bold text-white/90 transition hover:text-[#f9d987] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f4bb54]">Sådan virker det</a>
            <Link href="/manden-bag-skolegps" className="text-sm font-bold text-white/90 transition hover:text-[#f9d987] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f4bb54]">Om</Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/join"
              className="inline-flex min-h-11 items-center rounded-full border border-white/35 bg-white/12 px-3 py-2 text-xs font-black text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#f4bb54] sm:px-4 sm:text-sm"
            >
              Elev? Deltag med kode
            </Link>
            <Link
              href="/login"
              data-tour="home-organizer-login"
              className="inline-flex min-h-11 items-center rounded-full bg-[#f4bb54] px-3 py-2 text-xs font-black text-[#0b213a] shadow-[0_12px_26px_rgba(0,0,0,0.2)] transition hover:bg-[#ffcc68] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white sm:px-5 sm:text-sm"
            >
              Log ind
            </Link>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-8 px-5 pb-20 pt-12 sm:px-6 lg:min-h-[38rem] lg:grid-cols-[minmax(0,0.88fr)_minmax(20rem,0.75fr)] lg:items-center lg:px-8 lg:pb-24 lg:pt-14">
          <div className="skolegps-autumn-hero-copy max-w-2xl">
            <p className="inline-flex rounded-full border border-[#f4bb54]/50 bg-[#0b213a]/55 px-4 py-2 text-xs font-black tracking-[0.16em] text-[#f9d987] uppercase">
              Lærerværktøjer til inde og ude
            </p>
            <h1 className="mt-5 max-w-xl text-4xl font-black leading-[0.92] tracking-tight text-white sm:text-6xl lg:text-7xl">
              <span className="block">Mere liv i{" "}</span>
              <span className="skolegps-autumn-heading-gold">undervisningen.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-white/90 sm:text-xl">
              GPS-løb, arbejdsark og overblik på tavlen. Vælg det, din klasse har brug for — og kom i gang.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <a
                href="#vaerktojer"
                data-homepage-primary-cta
                className="skolegps-autumn-primary-action inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-[#f4bb54] px-6 py-3 text-base font-black text-[#0b213a] shadow-[0_16px_32px_rgba(0,0,0,0.22)] transition hover:bg-[#ffcc68] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Kom i gang – vælg værktøj
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </a>
              <Link
                href="/join"
                className="inline-flex min-h-13 items-center justify-center rounded-full border border-white/45 bg-white/12 px-6 py-3 text-base font-black text-white backdrop-blur transition hover:bg-white/20 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#f4bb54]"
              >
                Elev? Deltag med kode
              </Link>
            </div>
            <p className="mt-4 text-sm font-semibold text-white/80">
              Skabt af Jeppe Laursen, lærer og udvikler. {" "}
              <Link href="/login" className="font-black text-[#f9d987] underline decoration-[#f4bb54]/65 underline-offset-4 transition hover:text-white">Gå til mit arbejdsområde</Link>.
            </p>
          </div>

          <div className="skolegps-autumn-mascot-stage relative mx-auto hidden h-[31rem] w-full max-w-[29rem] lg:block" aria-hidden="true">
            <div className="absolute inset-x-[8%] bottom-[5%] h-32 rounded-[50%] bg-[#071a3a]/45 blur-2xl" />
            <Image
              src="/brand/mascot/skolegps-pin.webp"
              alt=""
              width={720}
              height={926}
              priority
              sizes="(max-width: 1280px) 330px, 420px"
              className="skolegps-autumn-hero-mascot absolute bottom-0 right-[6%] h-auto w-[78%] drop-shadow-[0_26px_32px_rgba(0,0,0,0.32)]"
              data-autumn-motion
            />
            <div className="absolute bottom-[6%] left-0 w-46 rounded-2xl border border-white/30 bg-[#0b213a]/76 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.24)] backdrop-blur">
              <p className="text-[10px] font-black tracking-[0.16em] text-[#f9d987] uppercase">På vej videre</p>
              <p className="mt-2 text-sm font-black leading-5 text-white">Vælg et værktøj. Bevar dit fokus.</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-7xl items-center gap-3 px-5 pb-7 text-sm font-semibold text-white/78 sm:px-6 lg:px-8">
          <span className="h-px w-12 bg-[#f4bb54]" aria-hidden="true" />
          <a href="#vaerktojer" className="transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f4bb54]">Tre veje ind — vælg det, du skal bruge nu</a>
        </div>
      </section>

      <main>
        <section id="vaerktojer" className="scroll-mt-6 bg-[#f6f1e5] py-16 sm:py-20" aria-labelledby="tool-heading">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-black tracking-[0.16em] text-[#226a4d] uppercase">Vælg det, der passer nu</p>
              <h2 id="tool-heading" className="mt-3 text-4xl font-black tracking-tight text-[#0b213a] sm:text-5xl">Én klar start for hver opgave.</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-slate-700 sm:text-lg">Værktøjerne åbner deres kendte arbejdsgange. Der er ingen ny onboarding eller loginmur foran oversigten.</p>
            </div>

            <div className="mt-9 grid gap-5 md:grid-cols-3">
              <ToolCard eyebrow="Ud at lære" title={gps.title} description="Opret et GPS-løb og læg faglige opgaver derud, hvor klassen undersøger verden." cta="Opret et GPS-løb" href={gps.link.href} icon={MapPin} tone="blue" visual="route" />
              <ToolCard eyebrow="Papir på bordet" title={worksheets.title} description="Find arbejdsark og materialer til en konkret opgave ved bordet." cta="Find arbejdsark" href={worksheets.link.href} icon={FileText} tone="gold" visual="paper" />
              <ToolCard eyebrow="Styr på skoledagen" title="Dagens Tavle" description="Saml dagens program og klasseaktiviteter på én fælles tavle." cta="Åbn Dagens Tavle" href={classroom.link.href} icon={Presentation} tone="green" visual="board" />
            </div>

            <Link href="/dashboard/laerervaerktoejer" className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-black text-[#0b4f74] underline decoration-[#f4bb54] decoration-2 underline-offset-4 transition hover:text-[#062d45] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0b4f74]">
              Se alle værktøjer
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section id="saadan-virker-det" className="scroll-mt-6 border-y border-[#0b213a]/10 bg-[#e7efe3] py-16 sm:py-20" aria-labelledby="how-heading">
          <div className="mx-auto grid w-full max-w-7xl gap-9 px-5 sm:px-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(20rem,0.72fr)] lg:items-center lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-black tracking-[0.16em] text-[#226a4d] uppercase">Et konkret eksempel</p>
              <h2 id="how-heading" className="mt-3 text-4xl font-black tracking-tight text-[#0b213a] sm:text-5xl">Sådan kan et GPS-løb begynde.</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-slate-700 sm:text-lg">Eksemplet gælder GPS-løb. Arbejdsark og Dagens Tavle har deres egne arbejdsgange.</p>
              <a href={gps.link.href} className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full border border-[#0b213a]/20 bg-[#fffdf6] px-5 py-3 text-sm font-black text-[#0b4f74] shadow-sm transition hover:border-[#0b4f74]/40 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[#0b4f74]">
                Udforsk GPS-løb
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>

            <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1" aria-label="Tre trin i et GPS-løb">
              <Step number="1" title="Vælg" icon={Compass}>Vælg et forløb, der passer til klasse og sted.</Step>
              <Step number="2" title="Tilpas" icon={Sparkles}>Gør opgaverne relevante for din undervisning.</Step>
              <Step number="3" title="Brug" icon={UsersRound}>Send klassen ud, når I er klar.</Step>
            </ol>
          </div>
        </section>

        <section id="nyheder" className="scroll-mt-6 bg-[#fffdf7] py-16 sm:py-20" aria-labelledby="current-heading">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-black tracking-[0.16em] text-[#226a4d] uppercase">Aktuelt</p>
              <h2 id="current-heading" className="mt-3 text-4xl font-black tracking-tight text-[#0b213a] sm:text-5xl">Indgange og perspektiv.</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-slate-700 sm:text-lg">Læs den aktuelle mobilmeddelelse og de kildebelagte PISA-forbehold uden at ændre værktøjernes adgangsforhold.</p>
            </div>

            <div className="mt-7">
              <MobileInSchoolBanner variant="home" />
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <ProjectWorkshopAnnouncement />
              <article
                aria-labelledby="home-printpakker-heading"
                className="flex flex-col rounded-3xl border border-amber-200 bg-[linear-gradient(120deg,#fffdf5,#fff8e7_58%,#eef8ff)] p-5 shadow-[0_14px_34px_rgba(120,82,7,0.08)] sm:p-6"
                data-testid="home-printpakker-news"
              >
                <div className="flex min-w-0 items-start gap-4">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-sm">
                    <FileText aria-hidden="true" className="h-6 w-6" />
                  </span>
                  <div>
                    <p className="text-xs font-black tracking-[0.16em] text-amber-800 uppercase">Nyt i SkoleGPS</p>
                    <h3 id="home-printpakker-heading" className="mt-1 text-xl font-black tracking-tight text-[#0b213a]">
                      Printklare postløb og arbejdsark
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-700">
                      Klar til print med elevmateriale, lærervejledning og facit til læreren.
                    </p>
                  </div>
                </div>
                <Link
                  className="mt-5 inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-amber-700 px-4 py-2 text-sm font-black text-white shadow-[0_10px_22px_rgba(146,94,11,0.2)] transition hover:bg-amber-800 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-amber-800"
                  href="/printpakker"
                >
                  Se postløb og arbejdsark
                </Link>
              </article>
            </div>
            <div className="mt-6 hidden sm:block">
              <PisaNotice links={{ classroom: classroom.link.href, worksheets: worksheets.link.href, gps: gps.link.href }} />
            </div>
          </div>
        </section>

        <section data-testid="home-founder-entry" className="border-y border-[#0b213a]/10 bg-[linear-gradient(135deg,#0b213a,#174d69_62%,#226a4d)] py-16 text-white sm:py-20" aria-labelledby="founder-heading">
          <div className="mx-auto grid w-full max-w-7xl gap-7 px-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-black tracking-[0.16em] text-[#f9d987] uppercase">Manden bag SkoleGPS</p>
              <h2 id="founder-heading" className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Jeppe Laursen – lærer og udvikler.</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-sky-50 sm:text-lg">SkoleGPS bliver til i mødet mellem undervisning, idéer og det, der virker i en rigtig skoledag.</p>
            </div>
            <Link href="/manden-bag-skolegps" className="inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-[#f4bb54] px-5 py-3 text-sm font-black text-[#0b213a] shadow-[0_16px_32px_rgba(0,0,0,0.18)] transition hover:bg-[#ffcc68] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-white">
              Mød Jeppe
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden bg-[#061b3d] text-sky-50">
        <div aria-hidden="true" className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[26px] border-[#f4bb54]/20" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-5 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-black tracking-[0.16em] text-[#f9d987] uppercase">SkoleGPS-fællesskab</p>
            <p className="mt-2 text-2xl font-black leading-tight sm:text-3xl">Gode idéer bliver bedre, når vi deler dem.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={FACEBOOK_PAGE_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center rounded-full border border-sky-200/25 bg-white/8 px-4 py-3 text-sm font-black transition hover:bg-white/14 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Facebook-side</a>
              <a href={FACEBOOK_GROUP_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center rounded-full border border-sky-200/25 bg-white/8 px-4 py-3 text-sm font-black transition hover:bg-white/14 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Facebook-gruppe</a>
            </div>
          </div>
          <div className="flex max-w-md flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-sky-100/90 lg:justify-end">
            <Link href="/hjaelp" className="transition hover:text-white">GPS-hjælp</Link>
            <Link href="/gdpr" className="transition hover:text-white">Databehandling</Link>
            <Link href="/privacy" className="transition hover:text-white">Privatlivspolitik</Link>
            <Link href="/it-afdelinger" className="transition hover:text-white">Til IT og databeskyttelse</Link>
            <Link href="/ophavsret" className="transition hover:text-white">Ophavsret</Link>
            <a href="mailto:skolegpsdk@gmail.com" className="transition hover:text-white">Kontakt</a>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-7xl border-t border-white/10 px-5 py-5 text-xs font-semibold text-sky-200/75 sm:px-6 lg:px-8">© 2026 SkoleGPS</div>
      </footer>

      <div className="relative hidden lg:block">
        <AIChatButton variant="homepage" />
      </div>
    </div>
    </TeacherHomepageClientGuard>
  );
}
