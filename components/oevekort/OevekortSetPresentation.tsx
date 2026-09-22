"use client";

import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Maximize2,
  Minimize2,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { isOevekortUuid, OEVEKORT_OWNER_PATH } from "@/lib/oevekort";

import {
  getOevekortError,
  isOevekortSet,
  readOevekortResponse,
  type OevekortSet,
} from "./types";

type SetResponse = { set: OevekortSet };

type OevekortSetPresentationProps = {
  mode: "board" | "print";
  setId?: string;
};

type PrintMode = "cards" | "list" | "pupil" | "answers";

const printModes: Array<{
  description: string;
  id: PrintMode;
  label: string;
}> = [
  {
    id: "cards",
    label: "Kort",
    description: "Et kort med forside og bagside til klip eller fælles brug.",
  },
  {
    id: "list",
    label: "Ordliste",
    description: "Et samlet overblik over alle ord og forklaringer.",
  },
  {
    id: "pupil",
    label: "Elevark",
    description: "Forsider med plads til elevernes egne svar.",
  },
  {
    id: "answers",
    label: "Facit",
    description: "Et særskilt svarark til læreren.",
  },
];

function isSetResponse(value: unknown): value is SetResponse {
  if (!value || typeof value !== "object") return false;
  const set = (value as { set?: unknown }).set;
  return isOevekortSet(set);
}

function malformedSetMessage(value: unknown) {
  if (!value || typeof value !== "object") {
    return "Sættet kunne ikke læses sikkert. Prøv at åbne det igen fra Øvekort.";
  }

  const set = (value as { set?: unknown }).set;
  if (
    set &&
    typeof set === "object" &&
    Array.isArray((set as { cards?: unknown }).cards) &&
    (set as { cards: unknown[] }).cards.length === 0
  ) {
    return "Sættet har ingen kort endnu. Gå tilbage til Øvekort og redigér sættet.";
  }

  return "Sættet kunne ikke læses sikkert. Prøv at åbne det igen fra Øvekort.";
}

const printableTextClassName =
  "whitespace-pre-wrap break-words [overflow-wrap:anywhere]";

export default function OevekortSetPresentation({
  mode,
  setId,
}: OevekortSetPresentationProps) {
  const [set, setSet] = useState<OevekortSet | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [cardIndex, setCardIndex] = useState(0);
  const [isAnswerVisible, setIsAnswerVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState("");
  const [printMode, setPrintMode] = useState<PrintMode>("cards");
  const boardRef = useRef<HTMLElement>(null);

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
          if (active) {
            setError(
              response.ok
                ? malformedSetMessage(body)
                : getOevekortError(body, "Sættet kunne ikke hentes."),
            );
          }
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

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === boardRef.current);
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const goToCard = (nextIndex: number) => {
    if (!set) return;
    const wrapped = (nextIndex + set.cards.length) % set.cards.length;
    setCardIndex(wrapped);
    setIsAnswerVisible(false);
  };

  const toggleBoardFullscreen = async () => {
    const board = boardRef.current;
    if (!board) return;

    try {
      if (document.fullscreenElement === board) {
        await document.exitFullscreen();
        return;
      }

      if (document.fullscreenElement || !board.requestFullscreen) {
        setFullscreenError("Fuld skærm er ikke tilgængelig lige nu.");
        return;
      }

      setFullscreenError("");
      await board.requestFullscreen();
    } catch {
      setFullscreenError("Fuld skærm kunne ikke åbnes. Prøv igen i en almindelig browserfane.");
    }
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
    const selectedPrintMode = printModes.find((item) => item.id === printMode)!;

    return (
      <main className="skolegps-teacher-portal oevekort-print-shell min-h-screen px-4 py-5 text-slate-950 print:bg-white print:p-0 sm:px-6 sm:py-7 lg:px-8">
        <style>{`@media print { body:has(.oevekort-print-shell) .skolegps-teacher-portal-sidebar, body:has(.oevekort-print-shell) > header { display: none !important; } }`}</style>
        <div className="mx-auto w-full max-w-5xl print:max-w-none">
          <header className="oevekort-print-content-header flex flex-wrap items-start justify-between gap-4 print:block">
            <div>
              <p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase print:text-slate-600">Øvekort til print · {selectedPrintMode.label}</p>
              <h1 className={`mt-1 text-3xl font-black text-[var(--skolegps-deep-navy)] print:text-2xl ${printableTextClassName}`}>{set.title}</h1>
              <p className="mt-2 text-sm text-slate-600 print:hidden">{selectedPrintMode.description}</p>
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
          <section className="mt-6 rounded-2xl border border-sky-100 bg-white p-4 print:hidden" aria-labelledby="oevekort-print-mode-heading">
            <h2 id="oevekort-print-mode-heading" className="text-sm font-black text-[var(--skolegps-deep-navy)]">Vælg printformat</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label="Printformat">
              {printModes.map((item) => (
                <button
                  aria-pressed={printMode === item.id}
                  className={`rounded-xl border px-3 py-3 text-left transition ${printMode === item.id ? "border-sky-500 bg-sky-50" : "border-sky-100 hover:border-sky-300 hover:bg-sky-50/60"}`}
                  key={item.id}
                  onClick={() => setPrintMode(item.id)}
                  type="button"
                >
                  <span className="block text-sm font-black text-[var(--skolegps-deep-navy)]">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-600">{item.description}</span>
                </button>
              ))}
            </div>
          </section>

          {printMode === "cards" ? (
            <div className="mt-7 grid gap-4 sm:grid-cols-2 print:mt-4 print:grid-cols-2 print:gap-3">
              {set.cards.map((card, index) => (
                <article key={card.id} className="break-inside-avoid rounded-2xl border border-sky-200 bg-white p-5 shadow-sm print:rounded-none print:border-slate-300 print:p-4 print:shadow-none">
                  <p className="text-xs font-black tracking-[0.14em] text-sky-700 uppercase print:text-slate-500">Kort {index + 1}</p>
                  <div className="mt-3 border-b border-sky-100 pb-4 print:border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase">Forside</p>
                    <p className={`mt-1 text-lg font-black text-[var(--skolegps-deep-navy)] ${printableTextClassName}`}>{card.front}</p>
                  </div>
                  <div className="pt-4">
                    <p className="text-xs font-bold text-slate-500 uppercase">Bagside</p>
                    <p className={`mt-1 text-base font-semibold text-slate-800 ${printableTextClassName}`}>{card.back}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {printMode === "list" ? (
            <div className="mt-7 overflow-x-auto print:mt-4 print:overflow-visible">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-400 text-xs font-black tracking-[0.12em] text-slate-600 uppercase">
                    <th className="w-12 px-2 py-3">#</th>
                    <th className="px-2 py-3">Forside</th>
                    <th className="px-2 py-3">Bagside</th>
                  </tr>
                </thead>
                <tbody>
                  {set.cards.map((card, index) => (
                    <tr key={card.id} className="break-inside-avoid border-b border-slate-200 align-top">
                      <td className="px-2 py-3 font-black text-slate-500">{index + 1}</td>
                      <td className={`px-2 py-3 font-bold text-[var(--skolegps-deep-navy)] ${printableTextClassName}`}>{card.front}</td>
                      <td className={`px-2 py-3 text-slate-800 ${printableTextClassName}`}>{card.back}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {printMode === "pupil" ? (
            <section className="mt-7 print:mt-4" aria-label="Elevark">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-300 pb-3 text-sm text-slate-700">
                <span>Navn: ________________________________________</span>
                <span>Dato: __________________</span>
              </div>
              <ol className="grid gap-4">
                {set.cards.map((card, index) => (
                  <li key={card.id} className="break-inside-avoid rounded-2xl border border-sky-200 bg-white p-5 print:rounded-none print:border-slate-300">
                    <p className="text-xs font-black tracking-[0.14em] text-sky-700 uppercase print:text-slate-500">Opgave {index + 1}</p>
                    <p className={`mt-2 text-lg font-black text-[var(--skolegps-deep-navy)] ${printableTextClassName}`}>{card.front}</p>
                    <div className="mt-5 min-h-20 border-b border-dashed border-slate-400" aria-label="Plads til elevens svar" />
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {printMode === "answers" ? (
            <section className="mt-7 print:mt-4" aria-label="Svarark">
              <p className={`mb-4 text-sm font-bold text-slate-700 ${printableTextClassName}`}>Svarark til {set.title}</p>
              <ol className="grid gap-3">
                {set.cards.map((card, index) => (
                  <li key={card.id} className="break-inside-avoid rounded-xl border border-slate-300 bg-white p-4">
                    <p className="text-xs font-black tracking-[0.14em] text-slate-500 uppercase">Svar {index + 1}</p>
                    <p className={`mt-2 font-bold text-[var(--skolegps-deep-navy)] ${printableTextClassName}`}>{card.front}</p>
                    <p className={`mt-2 text-slate-800 ${printableTextClassName}`}><span className="font-black">Rigtigt svar:</span> {card.back}</p>
                    {card.acceptedAnswers.length ? <p className={`mt-1 text-sm text-slate-600 ${printableTextClassName}`}><span className="font-bold">Andre accepterede svar:</span> {card.acceptedAnswers.join(", ")}</p> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
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
            <h1 className={`mt-1 text-3xl font-black text-[var(--skolegps-deep-navy)] sm:text-4xl ${printableTextClassName}`}>{set.title}</h1>
            <p className="mt-2 text-sm text-slate-600">Kort {cardIndex + 1} af {set.cards.length}</p>
          </div>
          <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-bold text-sky-900" href={backHref}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Tilbage
          </Link>
        </header>

        <section
          ref={boardRef}
          className={`skolegps-teacher-surface mt-6 overflow-hidden rounded-[2rem] p-5 sm:p-9 ${isFullscreen ? "min-h-screen rounded-none bg-white p-4 sm:p-8" : ""}`}
          aria-live="polite"
        >
          <div className={`min-h-72 rounded-3xl border border-sky-100 bg-[linear-gradient(135deg,#f6fbff,#eaf7f1)] px-5 py-8 text-center sm:min-h-96 sm:px-12 sm:py-14 ${isFullscreen ? "flex min-h-[calc(100vh-11rem)] items-center justify-center" : ""}`}>
            <div>
            <p className="text-xs font-black tracking-[0.18em] text-sky-700 uppercase">{isAnswerVisible ? "Bagside" : "Forside"}</p>
              <p className={`mx-auto mt-6 max-w-3xl text-3xl font-black leading-tight text-[var(--skolegps-deep-navy)] sm:text-5xl ${printableTextClassName} ${isFullscreen ? "sm:text-6xl" : ""}`}>{isAnswerVisible ? card.back : card.front}</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-900 transition hover:bg-sky-50" onClick={() => goToCard(cardIndex - 1)} type="button">
              <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Forrige
            </button>
            <div className="flex flex-wrap justify-center gap-3">
              <button aria-pressed={isFullscreen} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-900 transition hover:bg-sky-50" onClick={() => void toggleBoardFullscreen()} type="button">
                {isFullscreen ? <Minimize2 aria-hidden="true" className="h-4 w-4" /> : <Maximize2 aria-hidden="true" className="h-4 w-4" />}
                {isFullscreen ? "Afslut fuld skærm" : "Fuld skærm"}
              </button>
              <button className="skolegps-teacher-primary-action inline-flex min-h-11 items-center gap-2 rounded-xl px-5 py-2 text-sm font-black" onClick={() => setIsAnswerVisible((visible) => !visible)} type="button">
                {isAnswerVisible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                {isAnswerVisible ? "Skjul svar" : "Vis svar"}
              </button>
            </div>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-bold text-sky-900 transition hover:bg-sky-50" onClick={() => goToCard(cardIndex + 1)} type="button">
              Næste <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
          {fullscreenError ? <p className="mt-4 text-center text-sm font-semibold text-rose-700" role="alert">{fullscreenError}</p> : null}
        </section>
      </div>
    </main>
  );
}
