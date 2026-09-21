"use client";

import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { isOevekortUuid, OEVEKORT_OWNER_PATH } from "@/lib/oevekort";

import {
  getOevekortError,
  readOevekortResponse,
  type OevekortSet,
} from "./types";

type SetResponse = { set: OevekortSet };

type OevekortSetPresentationProps = {
  mode: "board" | "print";
  setId?: string;
};

function isSetResponse(value: unknown): value is SetResponse {
  if (!value || typeof value !== "object") return false;
  const set = (value as { set?: unknown }).set;
  return Boolean(set && typeof set === "object" && typeof (set as { id?: unknown }).id === "string");
}

export default function OevekortSetPresentation({
  mode,
  setId,
}: OevekortSetPresentationProps) {
  const [set, setSet] = useState<OevekortSet | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [cardIndex, setCardIndex] = useState(0);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);

  useEffect(() => {
    let active = true;

    const loadSet = async () => {
      if (!setId || !isOevekortUuid(setId)) {
        if (active) {
          setError("Sættet blev ikke fundet.");
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      try {
        const { body, response } = await readOevekortResponse<SetResponse>(
          `/api/oevekort/sets/${setId}`,
        );
        if (!response.ok || !isSetResponse(body)) {
          if (active) setError(getOevekortError(body, "Sættet kunne ikke hentes."));
          return;
        }

        if (active) {
          setSet(body.set);
          setCardIndex(0);
          setIsAnswerVisible(false);
        }
      } catch {
        if (active) setError("Sættet kunne ikke hentes. Prøv igen.");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void loadSet();
    return () => {
      active = false;
    };
  }, [setId]);

  const goToCard = (nextIndex: number) => {
    if (!set) return;
    const wrapped = (nextIndex + set.cards.length) % set.cards.length;
    setCardIndex(wrapped);
    setIsAnswerVisible(false);
  };

  const backHref = OEVEKORT_OWNER_PATH;

  if (isLoading) {
    return (
      <main className="skolegps-teacher-portal flex min-h-screen items-center justify-center px-5 py-12 text-slate-950">
        <p className="flex items-center gap-3 text-sm font-bold text-slate-700" role="status">
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Henter Øvekort...
        </p>
      </main>
    );
  }

  if (error || !set) {
    return (
      <main className="skolegps-teacher-portal flex min-h-screen items-center justify-center px-5 py-12 text-slate-950">
        <section className="skolegps-teacher-surface w-full max-w-lg rounded-3xl p-7 text-center">
          <AlertCircle aria-hidden="true" className="mx-auto h-8 w-8 text-rose-700" />
          <h1 className="mt-4 text-2xl font-black text-[var(--skolegps-deep-navy)]">Vi kunne ikke åbne sættet</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{error || "Prøv igen fra dine Øvekort."}</p>
          <Link className="skolegps-teacher-primary-action mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-black" href={OEVEKORT_OWNER_PATH}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Tilbage til Øvekort
          </Link>
        </section>
      </main>
    );
  }

  if (mode === "print") {
    return (
      <main className="skolegps-teacher-portal oevekort-print-shell min-h-screen px-4 py-5 text-slate-950 print:bg-white print:p-0 sm:px-6 sm:py-7 lg:px-8">
        <style>{`@media print { body:has(.oevekort-print-shell) .skolegps-teacher-portal-sidebar, body:has(.oevekort-print-shell) > header { display: none !important; } }`}</style>
        <div className="mx-auto w-full max-w-5xl print:max-w-none">
          <header className="oevekort-print-content-header flex flex-wrap items-start justify-between gap-4 print:block">
            <div>
              <p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase print:text-slate-600">Øvekort til print</p>
              <h1 className="mt-1 text-3xl font-black text-[var(--skolegps-deep-navy)] print:text-2xl">{set.title}</h1>
              <p className="mt-2 text-sm text-slate-600 print:hidden">Klip kortene ud, eller brug arket som fælles facit.</p>
            </div>
            <div className="flex flex-wrap gap-3 print:hidden">
              <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-900" href={backHref}>
                <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Tilbage
              </Link>
              <button className="skolegps-teacher-primary-action inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-black" onClick={() => window.print()} type="button">
                <Printer aria-hidden="true" className="h-4 w-4" /> Print
              </button>
            </div>
          </header>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 print:mt-4 print:grid-cols-2 print:gap-3">
            {set.cards.map((card, index) => (
              <article key={card.id} className="break-inside-avoid rounded-2xl border border-sky-200 bg-white p-5 shadow-sm print:rounded-none print:border-slate-300 print:p-4 print:shadow-none">
                <p className="text-xs font-black tracking-[0.14em] text-sky-700 uppercase print:text-slate-500">Kort {index + 1}</p>
                <div className="mt-3 border-b border-sky-100 pb-4 print:border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase">Forside</p>
                  <p className="mt-1 whitespace-pre-wrap text-lg font-black text-[var(--skolegps-deep-navy)]">{card.front}</p>
                </div>
                <div className="pt-4">
                  <p className="text-xs font-bold text-slate-500 uppercase">Bagside</p>
                  <p className="mt-1 whitespace-pre-wrap text-base font-semibold text-slate-800">{card.back}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    );
  }

  const card = set.cards[cardIndex];
  return (
    <main className="skolegps-teacher-portal min-h-screen px-4 py-5 text-slate-950 sm:px-6 sm:py-7 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Tavlevisning</p>
            <h1 className="mt-1 text-3xl font-black text-[var(--skolegps-deep-navy)] sm:text-4xl">{set.title}</h1>
            <p className="mt-2 text-sm text-slate-600">Kort {cardIndex + 1} af {set.cards.length}</p>
          </div>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-900" href={backHref}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Tilbage
          </Link>
        </header>

        <section className="skolegps-teacher-surface mt-6 overflow-hidden rounded-[2rem] p-5 sm:p-9" aria-live="polite">
          <div className="min-h-72 rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,#f6fbff,#eaf7f1)] px-5 py-8 text-center sm:min-h-96 sm:px-12 sm:py-14">
            <p className="text-xs font-black tracking-[0.18em] text-sky-700 uppercase">{isAnswerVisible ? "Bagside" : "Forside"}</p>
            <p className="mx-auto mt-6 max-w-3xl whitespace-pre-wrap text-3xl font-black leading-tight text-[var(--skolegps-deep-navy)] sm:text-5xl">{isAnswerVisible ? card.back : card.front}</p>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-900 transition hover:bg-sky-50" onClick={() => goToCard(cardIndex - 1)} type="button">
              <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Forrige
            </button>
            <button className="skolegps-teacher-primary-action inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-2 text-sm font-black" onClick={() => setIsAnswerVisible((visible) => !visible)} type="button">
              {isAnswerVisible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
              {isAnswerVisible ? "Skjul svar" : "Vis svar"}
            </button>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-900 transition hover:bg-sky-50" onClick={() => goToCard(cardIndex + 1)} type="button">
              Næste <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
