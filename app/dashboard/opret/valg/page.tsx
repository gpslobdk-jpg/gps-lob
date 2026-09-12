"use client";

import { ArrowLeft, ChevronDown, MapPin, Printer, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { poppins, rubik } from "@/lib/fonts";
import {
  canCreatePremiumRun,
  hasPremiumAccess,
  type AccessProfile,
} from "@/utils/accessControl";
import { createClient } from "@/utils/supabase/client";

const IS_PAYWALL_ENABLED = process.env.NEXT_PUBLIC_PAYWALL_ENABLED === "true";

type ProfileAccessRow = AccessProfile;
type PremiumAccessState = "loading" | "premium" | "trial" | "locked";

type FormatCard = {
  title: string;
  description: string;
  href: string;
  testId: string;
  badge?: string;
};

const MORE_FORMATS: FormatCard[] = [
  {
    title: "Engelsk",
    description: "Lav opgaver til engelsk.",
    href: "/dashboard/opret/engelsk",
    testId: "engelsk",
  },
  {
    title: "Matematik",
    description: "Lav opgaver med tal og regning.",
    href: "/dashboard/opret/matematik",
    testId: "matematik",
  },
  {
    title: "Dansk",
    description: "Lav opgaver til dansk.",
    href: "/dashboard/opret/dansk",
    testId: "dansk",
  },
  {
    title: "Musikquiz",
    description: "Lav spørgsmål med musikklip.",
    href: "/dashboard/opret/musikquiz",
    testId: "musikquiz",
  },
  {
    title: "Foto mission",
    description: "Lav fotoopgaver på ruten.",
    href: "/dashboard/opret/foto",
    testId: "foto",
  },
  {
    title: "Fra tekst eller bog",
    description: "Start ud fra tekst eller billeder.",
    href: "/dashboard/opret/scanner",
    testId: "scanner",
  },
  {
    title: "Podcast-Detektiven",
    description: "Lav et nyt udkast fra en podcast.",
    href: "/dashboard/opret/podcast",
    testId: "podcast",
  },
];

function FormatCardLink({ card }: { card: FormatCard }) {
  return (
    <Link
      href={card.href}
      data-testid={"create-card-" + card.testId}
      className="skolegps-teacher-surface group flex min-h-32 flex-col justify-between rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_18px_38px_rgba(3,119,216,0.12)]"
    >
      <div>
        {card.badge ? (
          <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[0.65rem] font-black tracking-[0.12em] text-sky-800 uppercase">
            {card.badge}
          </span>
        ) : null}
        <h2 className={rubik.className + " mt-3 text-xl font-black tracking-tight text-[var(--skolegps-deep-navy)]"}>
          {card.title}
        </h2>
        <p className="mt-2 text-sm leading-5 text-slate-600">{card.description}</p>
      </div>
      <span className="mt-4 text-sm font-bold text-sky-800">Åbn →</span>
    </Link>
  );
}
export default function ValgHubPage() {
  const [premiumAccessState, setPremiumAccessState] = useState<PremiumAccessState>(() =>
    IS_PAYWALL_ENABLED ? "loading" : "premium"
  );

  useEffect(() => {
    if (!IS_PAYWALL_ENABLED) {
      return;
    }

    let isMounted = true;

    const loadPremiumAccess = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (userError || !user) {
          setPremiumAccessState("locked");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("plan_type,access_expires_at,has_used_free_trial")
          .eq("id", user.id)
          .maybeSingle<ProfileAccessRow>();

        if (!isMounted) return;

        if (profileError) {
          console.error("Kunne ikke hente adgangsprofil til Zone-Krigen:", profileError);
          setPremiumAccessState("locked");
          return;
        }

        if (hasPremiumAccess(profile)) {
          setPremiumAccessState("premium");
          return;
        }

        setPremiumAccessState(canCreatePremiumRun(profile) ? "trial" : "locked");
      } catch (error) {
        console.error("Kunne ikke afgøre adgang til Zone-Krigen:", error);
        if (isMounted) setPremiumAccessState("locked");
      }
    };

    void loadPremiumAccess();

    return () => {
      isMounted = false;
    };
  }, []);

  const zoneHref =
    IS_PAYWALL_ENABLED && premiumAccessState === "locked"
      ? "/priser"
      : IS_PAYWALL_ENABLED && premiumAccessState === "loading"
        ? undefined
        : "/dashboard/opret/zone-krig";
  const zoneStatus =
    IS_PAYWALL_ENABLED && premiumAccessState === "locked"
      ? "Kræver adgang"
      : IS_PAYWALL_ENABLED && premiumAccessState === "trial"
        ? "Prøveløb"
        : IS_PAYWALL_ENABLED && premiumAccessState === "loading"
          ? "Tjekker adgang"
          : "Spil";

  const zoneCard = (
    <article
      aria-busy={IS_PAYWALL_ENABLED && premiumAccessState === "loading"}
      className="skolegps-teacher-surface flex min-h-32 flex-col justify-between rounded-2xl p-5 text-left"
    >
      <div>
        <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[0.65rem] font-black tracking-[0.12em] text-sky-800 uppercase">
          {zoneStatus}
        </span>
        <h2 className={rubik.className + " mt-3 text-xl font-black tracking-tight text-[var(--skolegps-deep-navy)]"}>
          Zone-Krigen
        </h2>
        <p className="mt-2 text-sm leading-5 text-slate-600">Lav et holdspil med zoner og spørgsmål.</p>
      </div>
      <span className="mt-4 text-sm font-bold text-sky-800">
        {zoneHref === "/priser" ? "Se adgang →" : zoneHref ? "Åbn →" : "Vent et øjeblik"}
      </span>
    </article>
  );

  return (
    <main className={poppins.className + " skolegps-teacher-page relative min-h-screen px-5 pb-10 sm:px-6 md:px-8"}>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between py-4 sm:py-6">
        <Image
          src="/skolegps-logo.svg"
          width={230}
          height={65}
          alt="SkoleGPS logo"
          priority
          className="h-auto w-44 sm:w-52"
        />
        <Link href="/dashboard" className="skolegps-teacher-secondary-action inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Dashboard
        </Link>
      </header>

      <section className="mx-auto w-full max-w-5xl pb-6 pt-3 sm:pt-6">
        <p className="text-sm font-black tracking-[0.16em] text-sky-800 uppercase">Opret løb</p>
        <h1 className={rubik.className + " mt-2 text-3xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-4xl"}>
          Vælg, hvordan du vil starte.
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Start med et udkast, eller skriv selv spørgsmålene.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2" aria-label="Start et nyt løb">
        <Link
          href="/dashboard/opret/lynbygger"
          data-tour="valg-lynbygger"
          data-testid="create-card-lynbygger"
          className="skolegps-teacher-primary-action group rounded-3xl p-6 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(3,119,216,0.24)] sm:p-7"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/18">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className={rubik.className + " mt-5 text-2xl font-black tracking-tight"}>Lynbygger</h2>
          <p className="mt-2 text-sm leading-6 text-white/88">Få et udkast.</p>
          <span className="mt-6 inline-flex text-sm font-black">Åbn Lynbyggeren →</span>
        </Link>

        <Link
          href="/dashboard/opret/manuel"
          data-tour="valg-classic-quiz"
          data-testid="create-card-manuel"
          className="skolegps-teacher-surface group rounded-3xl p-6 text-left transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_18px_38px_rgba(3,119,216,0.12)] sm:p-7"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-800">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className={rubik.className + " mt-5 text-2xl font-black tracking-tight text-[var(--skolegps-deep-navy)]"}>Lav selv</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Skriv dine egne spørgsmål.</p>
          <span className="mt-6 inline-flex text-sm font-black text-sky-800">Åbn editoren →</span>
        </Link>
      </section>

      <aside className="skolegps-teacher-surface-muted mx-auto mt-5 w-full max-w-5xl rounded-2xl px-5 py-4 lg:hidden">
        <p className="text-sm font-black text-[var(--skolegps-deep-navy)]">Bedst på computer</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Oprettelse og redigering fungerer bedst på en større skærm med plads til kort og spørgsmål.
        </p>
      </aside>

      <section className="mx-auto mt-6 w-full max-w-5xl">
        <details className="skolegps-teacher-surface group rounded-3xl">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 text-left marker:content-none">
            <span>
              <span className={rubik.className + " block text-xl font-black text-[var(--skolegps-deep-navy)]"}>Flere formater</span>
              <span className="mt-1 block text-sm text-slate-600">Vælg fag, foto, tekst, podcast, print eller spil.</span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-sky-800 transition group-open:rotate-180" aria-hidden="true" />
          </summary>

          <div className="border-t border-sky-100 px-5 py-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MORE_FORMATS.map((card) => (
                <FormatCardLink key={card.href} card={card} />
              ))}

              <Link
                href="/dashboard/opret/stjerneloeb"
                data-testid="create-card-stjerneloeb"
                className="skolegps-teacher-surface group flex min-h-32 flex-col justify-between rounded-2xl p-5 text-left transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_18px_38px_rgba(3,119,216,0.12)]"
              >
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-[0.65rem] font-black tracking-[0.12em] text-sky-800 uppercase">
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    Print
                  </span>
                  <h2 className={rubik.className + " mt-3 text-xl font-black tracking-tight text-[var(--skolegps-deep-navy)]"}>
                    Fysisk Stjerneløb
                  </h2>
                  <p className="mt-2 text-sm leading-5 text-slate-600">Lav et stjerneløb til print.</p>
                </div>
                <span className="mt-4 text-sm font-bold text-sky-800">Åbn →</span>
              </Link>

              {zoneHref ? (
                <Link href={zoneHref} data-testid="create-card-zone-krig" className="group rounded-2xl">
                  {zoneCard}
                </Link>
              ) : (
                <div data-testid="create-card-zone-krig">{zoneCard}</div>
              )}
            </div>
          </div>
        </details>
      </section>

      <footer className="mx-auto mt-8 flex w-full max-w-5xl flex-wrap justify-center gap-x-6 gap-y-3 pb-2 text-sm font-semibold text-slate-600">
        <Link href="/privacy" className="hover:text-sky-800">Privatliv</Link>
        <Link href="/teknologi" className="hover:text-sky-800">Teknologi</Link>
      </footer>
    </main>
  );
}
