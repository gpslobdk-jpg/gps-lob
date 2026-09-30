"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Compass,
  FileText,
  MapPin,
  Menu,
  MessageCircle,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import AIChatButton from "@/components/AIChatButton";
import MobileInSchoolBanner from "@/components/MobileInSchoolBanner";
import PisaNotice from "@/components/home/PisaNotice";
import ProjectWorkshopAnnouncement from "@/components/home/ProjectWorkshopAnnouncement";

const PILEN_WELCOME_STORAGE_KEY = "skolegps.home.pilen-welcome.v1";
const PILEN_WELCOME_VIDEO_SRC = "/brand/mascot/skolegps-pilen-welcome.mp4";

const PISA_LINKS = {
  classroom: "https://dagenstavle.dk/auth/family-sso/start?next=%2Ftavle&source=skolegps",
  worksheets: "https://printmitarbejdsark.dk/auth/family-sso/start?next=%2Flav&source=skolegps",
  gps: "/login?next=%2Fdashboard%2Fopret%2Fvalg",
} as const;

const FACEBOOK_PAGE_URL = "https://www.facebook.com/profile.php?id=61594705569977";
const FACEBOOK_GROUP_URL = "https://www.facebook.com/groups/1649785632764130";

type ProductPreviewProps = {
  accent: string;
  icon: typeof Compass;
  label: string;
  title: string;
};

function ProductPreview({ accent, icon: Icon, label, title }: ProductPreviewProps) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/80 bg-white/92 p-3 shadow-[0_12px_26px_rgba(7,26,58,0.12)] backdrop-blur">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${accent} text-white`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-black tracking-[0.14em] text-slate-500 uppercase">
            Eksempel
          </span>
          <span className="block truncate text-xs font-black text-[var(--skolegps-deep-navy)]">{title}</span>
        </span>
      </div>
      <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-600">{label}</p>
    </div>
  );
}

function PilenIllustration({
  className,
  priority = false,
  sizes,
}: {
  className: string;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <div aria-hidden="true" className={`relative shrink-0 ${className}`}>
      <Image
        src="/brand/mascot/skolegps-pin.webp"
        alt=""
        fill
        priority={priority}
        sizes={sizes}
        className="object-contain drop-shadow-[0_22px_42px_rgba(7,26,58,0.24)]"
      />
    </div>
  );
}

function PilenWelcomeScene() {
  const shouldReduceMotion = useReducedMotion();
  const [shouldPlayWelcome, setShouldPlayWelcome] = useState(false);
  const [welcomeVideoFailed, setWelcomeVideoFailed] = useState(false);
  const [welcomeVideoComplete, setWelcomeVideoComplete] = useState(false);
  const isWelcomePlaying = shouldPlayWelcome && !welcomeVideoFailed && !welcomeVideoComplete;

  useEffect(() => {
    if (shouldReduceMotion || document.visibilityState !== "visible") return;

    try {
      if (window.sessionStorage.getItem(PILEN_WELCOME_STORAGE_KEY)) return;
    } catch {
      // Storage can be unavailable in a privacy-restricted browser. The local
      // component state still ensures that this mount only starts once.
    }

    const startId = window.setTimeout(() => {
      try {
        // Mark the animation only once its scheduled start survives React's
        // development-mode effect replay.
        window.sessionStorage.setItem(PILEN_WELCOME_STORAGE_KEY, "played");
      } catch {
        // A static fallback remains usable when browser storage is disabled.
      }
      setShouldPlayWelcome(true);
    }, 0);

    return () => window.clearTimeout(startId);
  }, [shouldReduceMotion]);

  const mascotAnimation = shouldPlayWelcome
    ? {
        y: [0, -9, 0],
        rotate: [0, -1.5, 0],
        scale: [1, 1.025, 1],
      }
    : undefined;

  return (
    <div
      data-testid="pilen-welcome-scene"
      data-welcome-state={isWelcomePlaying ? "playing" : "static"}
      className="relative mx-auto aspect-square w-full max-w-[30rem] overflow-hidden rounded-[2.25rem] border border-sky-100 bg-[radial-gradient(circle_at_67%_22%,rgba(255,255,255,0.98),transparent_20%),radial-gradient(circle_at_20%_70%,rgba(125,211,252,0.45),transparent_42%),linear-gradient(135deg,#e0f2fe_0%,#f8fcff_54%,#dbeafe_100%)] shadow-[0_24px_70px_rgba(3,119,216,0.14)]"
    >
      <div aria-hidden="true" className="absolute inset-0 opacity-55 [background-image:radial-gradient(rgba(3,119,216,0.19)_1px,transparent_1px)] [background-size:18px_18px]" />
      <div aria-hidden="true" className="absolute -right-14 -top-14 h-52 w-52 rounded-full border-[18px] border-white/65" />
      <div aria-hidden="true" className="absolute -bottom-24 -left-20 h-56 w-56 rounded-full border-[22px] border-sky-200/55" />
      <motion.svg
        aria-hidden="true"
        viewBox="0 0 400 400"
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        <motion.path
          d="M48 282C104 236 129 301 178 273C222 248 207 191 265 198C303 202 325 177 356 134"
          fill="none"
          stroke="#0377d8"
          strokeLinecap="round"
          strokeWidth="5"
          initial={{ opacity: shouldPlayWelcome ? 0 : 0.48, pathLength: shouldPlayWelcome ? 0 : 1 }}
          animate={{ opacity: shouldPlayWelcome ? [0, 0.64, 0.48] : 0.48, pathLength: 1 }}
          transition={{ duration: shouldPlayWelcome ? 0.9 : 0, ease: "easeOut", delay: shouldPlayWelcome ? 0.18 : 0 }}
        />
        {[{ cx: 48, cy: 282 }, { cx: 178, cy: 273 }, { cx: 265, cy: 198 }, { cx: 356, cy: 134 }].map((point, index) => (
          <motion.circle
            key={`${point.cx}-${point.cy}`}
            {...point}
            r="7"
            fill="#0377d8"
            initial={{ opacity: shouldPlayWelcome ? 0 : 0.92, scale: shouldPlayWelcome ? 0.4 : 1 }}
            animate={{ opacity: 0.92, scale: 1 }}
            transition={{ duration: 0.26, delay: shouldPlayWelcome ? 0.28 + index * 0.12 : 0 }}
          />
        ))}
      </motion.svg>

      <motion.div
        className="absolute left-1/2 top-[8%] z-10 -translate-x-1/2"
        animate={mascotAnimation}
        transition={{ duration: 1.12, ease: [0.22, 1, 0.36, 1] }}
      >
        <PilenIllustration
          priority
          className="h-52 w-40 sm:h-62 sm:w-50 lg:h-70 lg:w-55"
          sizes="(max-width: 640px) 160px, (max-width: 1024px) 200px, 220px"
        />
      </motion.div>

      {isWelcomePlaying ? (
        <video
          data-testid="pilen-welcome-video"
          aria-hidden="true"
          autoPlay
          muted
          playsInline
          preload="metadata"
          onError={() => setWelcomeVideoFailed(true)}
          onEnded={() => setWelcomeVideoComplete(true)}
          className="pointer-events-none absolute left-1/2 top-[3%] z-15 h-[79%] max-w-[82%] -translate-x-1/2 object-contain"
        >
          <source src={PILEN_WELCOME_VIDEO_SRC} type="video/mp4" />
        </video>
      ) : null}

      <div className="absolute inset-x-3 bottom-3 z-20 grid grid-cols-3 gap-2 sm:inset-x-5 sm:bottom-5 sm:gap-3">
        <ProductPreview accent="bg-sky-700" icon={Compass} title="GPS-løb" label="Ud at lære" />
        <ProductPreview accent="bg-amber-700" icon={FileText} title="Arbejdsark" label="Papir på bordet" />
        <ProductPreview accent="bg-indigo-700" icon={BookOpen} title="Skoledagen" label="Planlæg i ro" />
      </div>
    </div>
  );
}

function ToolCard({
  href,
  icon: Icon,
  title,
  description,
  cta,
  tone,
  external = false,
}: {
  href: string;
  icon: typeof Compass;
  title: string;
  description: string;
  cta: string;
  tone: string;
  external?: boolean;
}) {
  const card = (
    <>
      <span className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm ${tone}`}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-5 text-2xl font-black tracking-tight text-[var(--skolegps-deep-navy)]">{title}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{description}</p>
      <span className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-black text-sky-800 underline decoration-sky-300 underline-offset-4 transition group-hover:text-sky-950">
        {cta}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </>
  );

  const className = "group flex min-h-full flex-col rounded-3xl border border-sky-100 bg-white p-6 shadow-[0_14px_34px_rgba(7,26,58,0.07)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-[0_20px_44px_rgba(7,26,58,0.12)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sky-700";

  return external ? (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {card}
    </a>
  ) : (
    <Link href={href} className={className}>
      {card}
    </Link>
  );
}

export default function TeacherHomepage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f7fbff] text-slate-950">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[50rem] overflow-hidden bg-[radial-gradient(circle_at_9%_10%,rgba(125,211,252,0.55),transparent_27%),radial-gradient(circle_at_88%_8%,rgba(219,234,254,0.92),transparent_30%),linear-gradient(180deg,#f8fcff_0%,#eaf6ff_62%,#f7fbff_100%)]" />

      <header className="relative z-30 mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="SkoleGPS forside"
          className="inline-flex shrink-0 rounded-full bg-white/88 px-3 py-2 shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-800 sm:px-4"
        >
          <Image src="/skolegps-logo.svg" alt="SkoleGPS" width={256} height={72} priority className="h-auto w-37 sm:w-48" />
        </Link>

        <nav className="hidden items-center gap-5 lg:flex" aria-label="Hovedmenu">
          <Link href="#vaerktojer" className="text-sm font-bold text-slate-700 transition hover:text-sky-800">Værktøjer</Link>
          <Link href="#saadan-virker-det" className="text-sm font-bold text-slate-700 transition hover:text-sky-800">Sådan virker det</Link>
          <Link href="/manden-bag-skolegps" className="text-sm font-bold text-slate-700 transition hover:text-sky-800">Om SkoleGPS</Link>
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <Link
            href="/join"
            className="inline-flex min-h-11 items-center rounded-full border border-sky-200 bg-white/84 px-4 py-2 text-sm font-black text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700"
          >
            Elev? Deltag med kode
          </Link>
          <Link
            href="/login"
            data-tour="home-organizer-login"
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--skolegps-blue-strong)] px-5 py-2 text-sm font-black text-white shadow-[0_12px_24px_rgba(3,119,216,0.22)] transition hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700"
          >
            Log ind
          </Link>
        </div>

        <div className="relative sm:hidden">
          <button
            type="button"
            aria-expanded={isMobileMenuOpen}
            aria-controls="teacher-home-mobile-menu"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-4 py-2 text-sm font-black text-white shadow-[0_12px_24px_rgba(3,119,216,0.22)] transition hover:bg-sky-700"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            Menu
          </button>
          {isMobileMenuOpen ? (
            <div id="teacher-home-mobile-menu" className="absolute right-0 top-[calc(100%+0.6rem)] grid w-68 gap-1 rounded-2xl border border-sky-100 bg-white p-2 shadow-xl">
              <Link href="#vaerktojer" onClick={() => setIsMobileMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-bold text-slate-700 hover:bg-sky-50">Værktøjer</Link>
              <Link href="#saadan-virker-det" onClick={() => setIsMobileMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-bold text-slate-700 hover:bg-sky-50">Sådan virker det</Link>
              <Link href="/manden-bag-skolegps" onClick={() => setIsMobileMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-bold text-slate-700 hover:bg-sky-50">Om SkoleGPS</Link>
              <Link href="/join" onClick={() => setIsMobileMenuOpen(false)} className="rounded-xl px-3 py-3 text-sm font-black text-sky-800 hover:bg-sky-50">Elev? Deltag med kode</Link>
              <Link href="/login" data-tour="home-organizer-login" onClick={() => setIsMobileMenuOpen(false)} className="rounded-xl bg-[var(--skolegps-blue-strong)] px-3 py-3 text-sm font-black text-white hover:bg-sky-700">Log ind</Link>
            </div>
          ) : null}
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pb-16 pt-7 sm:px-6 sm:pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(23rem,0.85fr)] lg:gap-12 lg:px-8 lg:pb-28 lg:pt-12" aria-labelledby="teacher-home-title">
          <div className="max-w-2xl">
            <p className="inline-flex rounded-full border border-sky-200 bg-white/84 px-4 py-2 text-xs font-black tracking-[0.14em] text-sky-800 uppercase shadow-sm backdrop-blur">
              Digitale og analoge lærerværktøjer
            </p>
            <h1 id="teacher-home-title" className="mt-5 text-5xl font-black leading-[0.95] tracking-tight text-[var(--skolegps-deep-navy)] sm:text-6xl lg:text-7xl">
              Mere liv i undervisningen.
            </h1>
            <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-slate-700 sm:text-xl">
              GPS-løb, arbejdsark og værktøjer til skoledagen. Samlet ét sted. Skabt af en lærer.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="#vaerktojer" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-6 py-3 text-base font-black text-white shadow-[0_16px_32px_rgba(3,119,216,0.24)] transition hover:bg-sky-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
                Find dit værktøj
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link href="/join" className="inline-flex min-h-13 items-center justify-center rounded-full border border-sky-200 bg-white/88 px-6 py-3 text-base font-black text-[var(--skolegps-deep-navy)] shadow-sm transition hover:border-sky-300 hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-700">
                Elev? Deltag med kode
              </Link>
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-600">
              Lærer? <Link href="/login" className="text-sky-800 underline decoration-sky-300 underline-offset-4 transition hover:text-sky-950">Gå direkte til dit arbejdsområde</Link>.
            </p>
          </div>

          <PilenWelcomeScene />
        </section>

        <section id="vaerktojer" aria-labelledby="tools-heading" className="scroll-mt-6 border-y border-sky-100 bg-white/82 py-16 backdrop-blur sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-black tracking-[0.16em] text-sky-800 uppercase">Find den rigtige start</p>
              <h2 id="tools-heading" className="mt-3 text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-5xl">Hvad skal din klasse lave?</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-slate-600 sm:text-lg">Vælg efter den opgave, du står med nu. Hvert værktøj åbner sin egen kendte arbejdsgang.</p>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <ToolCard href="/login?next=%2Fdashboard%2Fopret%2Fvalg" icon={MapPin} title="Ud at lære" description="GPS-løb og aktive opgaver, der giver klassen noget konkret at undersøge." cta="Se GPS-løb" tone="bg-sky-700" />
              <ToolCard href={PISA_LINKS.worksheets} external icon={FileText} title="Papir på bordet" description="PrintMitArbejdsark og relevante, verificerede materialer til print." cta="Åbn PrintMitArbejdsark" tone="bg-amber-700" />
              <ToolCard href={PISA_LINKS.classroom} external icon={BookOpen} title="Styr på skoledagen" description="Dagens Tavle og lærerværktøjer, der gør det lettere at holde retningen." cta="Åbn Dagens Tavle" tone="bg-indigo-700" />
            </div>

            <Link href="/login?next=%2Fdashboard%2Flaerervaerktoejer" className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-black text-sky-800 underline decoration-sky-300 underline-offset-4 transition hover:text-sky-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700">
              Se alle værktøjer
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section id="saadan-virker-det" aria-labelledby="example-heading" className="scroll-mt-6 py-16 sm:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,0.75fr)] lg:items-center lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-black tracking-[0.16em] text-sky-800 uppercase">Et konkret eksempel</p>
              <h2 id="example-heading" className="mt-3 text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-5xl">Sådan kan et GPS-løb begynde.</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-slate-600 sm:text-lg">Dette eksempel gælder GPS-løb. Andre værktøjer har deres egne forløb og muligheder.</p>
              <Link href="/login?next=%2Fdashboard%2Fopret%2Fvalg" className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full border border-sky-200 bg-white px-5 py-3 text-sm font-black text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-700">
                Udforsk GPS-løb
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1" aria-label="Tre trin i et GPS-løb">
              {[
                ["1", "Vælg", "Vælg et forløb, der passer til klasse og sted.", Compass],
                ["2", "Tilpas", "Gør opgaverne relevante for din undervisning.", Sparkles],
                ["3", "Brug", "Send klassen ud, og brug det i den form, der passer jer.", UsersRound],
              ].map(([number, title, text, Icon]) => (
                <li key={number as string} className="rounded-2xl border border-sky-100 bg-white p-5 shadow-[0_12px_28px_rgba(7,26,58,0.06)]">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-700 text-sm font-black text-white">{number as string}</span>
                    <Icon className="h-5 w-5 text-sky-700" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-[var(--skolegps-deep-navy)]">{title as string}</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{text as string}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="nyheder" aria-labelledby="existing-heading" className="scroll-mt-6 bg-white py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-xs font-black tracking-[0.16em] text-sky-800 uppercase">Aktuelt</p>
              <h2 id="existing-heading" className="mt-3 text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-5xl">Det sker i SkoleGPS</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-slate-600 sm:text-lg">Eksisterende information, indgange og materialer – samlet uden at ændre deres funktion.</p>
            </div>

            <div className="mt-7">
              <MobileInSchoolBanner variant="home" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <ProjectWorkshopAnnouncement />
              <article aria-labelledby="home-printpakker-heading" className="flex flex-col rounded-3xl border border-amber-200 bg-[linear-gradient(120deg,#fffdf5,#fff8e7_58%,#eef8ff)] p-5 shadow-[0_14px_34px_rgba(120,82,7,0.08)] sm:p-6" data-testid="home-printpakker-news">
                <div className="flex min-w-0 items-start gap-4">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-600 text-white shadow-sm"><FileText aria-hidden="true" className="h-6 w-6" /></span>
                  <div>
                    <p className="text-xs font-black tracking-[0.16em] text-amber-800 uppercase">Nyt i SkoleGPS</p>
                    <h3 id="home-printpakker-heading" className="mt-1 text-xl font-black tracking-tight text-[var(--skolegps-deep-navy)]">Printpakker: klar til print</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-700">Færdige analoge undervisningspakker med elevark, lærervejledning og kontrolleret facit.</p>
                  </div>
                </div>
                <Link className="mt-5 inline-flex min-h-11 w-fit items-center justify-center rounded-full bg-amber-700 px-4 py-2 text-sm font-black text-white shadow-[0_10px_22px_rgba(146,94,11,0.2)] transition hover:bg-amber-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-800" href="/printpakker">Se Printpakker</Link>
              </article>
            </div>

            <div className="mt-6 hidden sm:block">
              <PisaNotice links={PISA_LINKS} />
            </div>
          </div>
        </section>

        <section data-testid="home-founder-entry" aria-labelledby="founder-heading" className="border-y border-sky-900/10 bg-[linear-gradient(135deg,#071a3a,#064b86_58%,#0377d8)] py-16 text-white sm:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-7 px-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8">
            <div className="max-w-3xl">
              <p className="text-xs font-black tracking-[0.16em] text-sky-200 uppercase">Manden bag SkoleGPS</p>
              <h2 id="founder-heading" className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Jeppe Laursen – lærer og udvikler.</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-sky-50 sm:text-lg">SkoleGPS bliver til i mødet mellem undervisning, idéer og det, der virker i en rigtig skoledag.</p>
            </div>
            <Link href="/manden-bag-skolegps" className="inline-flex min-h-12 w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-sky-900 shadow-[0_16px_32px_rgba(0,0,0,0.18)] transition hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
              Mød Jeppe
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative overflow-hidden bg-[#061b3d] text-sky-50">
        <div aria-hidden="true" className="absolute -right-20 -top-20 h-64 w-64 rounded-full border-[26px] border-sky-400/20" />
        <div className="relative mx-auto grid w-full max-w-7xl gap-8 px-5 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-8">
          <div className="max-w-2xl">
            <div className="flex items-center gap-4">
              <PilenIllustration className="h-18 w-15" sizes="60px" />
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-sky-200 uppercase">SkoleGPS-fællesskab</p>
                <p className="mt-2 text-2xl font-black leading-tight sm:text-3xl">Gode idéer bliver bedre, når vi deler dem.</p>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href={FACEBOOK_PAGE_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-sky-200/25 bg-white/8 px-4 py-3 text-sm font-black transition hover:bg-white/14 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Facebook-side
              </a>
              <a href={FACEBOOK_GROUP_URL} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-sky-200/25 bg-white/8 px-4 py-3 text-sm font-black transition hover:bg-white/14 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
                <UsersRound className="h-4 w-4" aria-hidden="true" />
                Facebook-gruppe
              </a>
            </div>
            <p className="mt-4 text-sm font-semibold text-sky-100/86">Følg nyheder og nye værktøjer på siden – eller spørg, del og få idéer i gruppen.</p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-sky-100/90 lg:max-w-sm lg:justify-end">
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
  );
}
