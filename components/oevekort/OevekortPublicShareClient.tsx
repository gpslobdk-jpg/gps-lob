"use client";

import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  PencilLine,
  Printer,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  compareOevekortAnswer,
  normalizeOevekortShareToken,
} from "@/lib/oevekort";

import { readOevekortResponse, type OevekortCard } from "./types";

type PublicSet = {
  cards: OevekortCard[];
  title: string;
};

type PublicResponse = { set: PublicSet };
type Activity = "flash" | "match" | "write" | "board";

type MatchTile = {
  cardId: string;
  id: string;
  label: string;
  side: "back" | "front";
};

function isPublicResponse(value: unknown): value is PublicResponse {
  if (!value || typeof value !== "object") return false;
  const set = (value as { set?: unknown }).set;
  return Boolean(
    set &&
      typeof set === "object" &&
      typeof (set as { title?: unknown }).title === "string" &&
      Array.isArray((set as { cards?: unknown }).cards),
  );
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function makeMatchTiles(cards: OevekortCard[]): MatchTile[] {
  return shuffle(
    cards.flatMap((card) => [
      { id: `front-${card.id}`, cardId: card.id, label: card.front, side: "front" as const },
      { id: `back-${card.id}`, cardId: card.id, label: card.back, side: "back" as const },
    ]),
  );
}

const activityLabels: Array<{
  activity: Activity;
  icon: typeof Layers3;
  label: string;
}> = [
  { activity: "flash", icon: Layers3, label: "Kort" },
  { activity: "match", icon: Sparkles, label: "Match" },
  { activity: "write", icon: PencilLine, label: "Skriv" },
  { activity: "board", icon: Eye, label: "Tavle" },
];

export default function OevekortPublicShareClient() {
  const [sharedSet, setSharedSet] = useState<PublicSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [activity, setActivity] = useState<Activity>("flash");
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [answerResult, setAnswerResult] = useState<"correct" | "incorrect" | null>(null);
  const [matchTiles, setMatchTiles] = useState<MatchTile[]>([]);
  const [selectedTile, setSelectedTile] = useState<MatchTile | null>(null);
  const [matchedCardIds, setMatchedCardIds] = useState<Set<string>>(new Set());
  const [matchMessage, setMatchMessage] = useState("");
  const [isResolvingMatch, setIsResolvingMatch] = useState(false);
  const shareLoadStarted = useRef(false);
  const matchTimer = useRef<number | null>(null);

  useEffect(() => {
    if (shareLoadStarted.current) return;
    shareLoadStarted.current = true;

    const fragment = window.location.hash.replace(/^#/, "");
    // Fragments are never sent to the server. Remove it before the request so it
    // is also absent from browser history and any later page interaction.
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );

    let token = normalizeOevekortShareToken(fragment);
    if (!token) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    const loadSharedSet = async () => {
      // Keep the bearer token out of React state, storage, links and logs. After
      // serializing the one request body, this component no longer retains it.
      const requestBody = JSON.stringify({ token });
      token = null;

      try {
        const { body, response } = await readOevekortResponse<PublicResponse>(
          "/api/oevekort/public",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
          },
        );

        if (!response.ok || !isPublicResponse(body)) {
          setHasError(true);
          return;
        }

        setSharedSet(body.set);
        setMatchTiles(makeMatchTiles(body.set.cards));
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };

    void loadSharedSet();
  }, []);

  useEffect(() => {
    return () => {
      if (matchTimer.current) window.clearTimeout(matchTimer.current);
    };
  }, []);

  const currentCard = sharedSet?.cards[cardIndex] ?? null;

  const resetCardActivity = () => {
    setIsFlipped(false);
    setWrittenAnswer("");
    setAnswerResult(null);
  };

  const goToCard = (nextIndex: number) => {
    if (!sharedSet) return;
    const wrapped = (nextIndex + sharedSet.cards.length) % sharedSet.cards.length;
    setCardIndex(wrapped);
    resetCardActivity();
  };

  const chooseActivity = (nextActivity: Activity) => {
    setActivity(nextActivity);
    resetCardActivity();
    if (nextActivity === "match" && sharedSet) {
      setMatchTiles(makeMatchTiles(sharedSet.cards));
      setSelectedTile(null);
      setMatchedCardIds(new Set());
      setMatchMessage("");
      setIsResolvingMatch(false);
    }
  };

  const checkWrittenAnswer = () => {
    if (!currentCard) return;
    const result = compareOevekortAnswer(writtenAnswer, currentCard);
    setAnswerResult(result.correct ? "correct" : "incorrect");
  };

  const selectMatchTile = (tile: MatchTile) => {
    if (isResolvingMatch || matchedCardIds.has(tile.cardId)) return;

    if (!selectedTile) {
      setSelectedTile(tile);
      setMatchMessage("Vælg kortet, der hører til.");
      return;
    }

    if (selectedTile.id === tile.id) {
      setSelectedTile(null);
      setMatchMessage("");
      return;
    }

    if (selectedTile.cardId === tile.cardId && selectedTile.side !== tile.side) {
      setMatchedCardIds((current) => new Set([...current, tile.cardId]));
      setSelectedTile(null);
      setMatchMessage("Det passer sammen.");
      return;
    }

    setSelectedTile(tile);
    setIsResolvingMatch(true);
    setMatchMessage("Prøv et andet kort.");
    if (matchTimer.current) window.clearTimeout(matchTimer.current);
    matchTimer.current = window.setTimeout(() => {
      setSelectedTile(null);
      setIsResolvingMatch(false);
    }, 650);
  };

  if (isLoading) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-10 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_38%)]" />
        <p className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-5 py-4 text-sm font-bold text-slate-100" role="status">
          <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Henter dine Øvekort sikkert...
        </p>
      </main>
    );
  }

  if (hasError || !sharedSet || !currentCard) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-5 py-10 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_38%)]" />
        <section className="relative w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-900/92 p-7 text-center shadow-[0_32px_90px_rgba(2,8,23,0.55)] sm:p-9">
          <X aria-hidden="true" className="mx-auto h-9 w-9 rounded-2xl bg-rose-400/15 p-2 text-rose-200" />
          <h1 className="mt-5 text-2xl font-black">Linket kan ikke bruges</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Bed din lærer om et nyt Øvekort-link.</p>
        </section>
      </main>
    );
  }

  const allMatched = matchedCardIds.size === sharedSet.cards.length;
  const canMatch = sharedSet.cards.length >= 3;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-white print:bg-white print:px-0 print:py-0 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.19),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(12,44,67,0.95))] px-5 py-7 shadow-[0_24px_72px_rgba(2,8,23,0.32)] print:hidden sm:px-8 sm:py-9">
          <p className="text-xs font-black tracking-[0.22em] text-cyan-200 uppercase">SkoleGPS Øvekort</p>
          <h1 className="mt-2 break-words text-3xl font-black tracking-tight sm:text-4xl">{sharedSet.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Vælg en øvelse. Dine svar og fremskridt bliver ikke gemt.</p>
          <div className="mt-6 flex flex-wrap gap-2" aria-label="Vælg øvelse">
            {activityLabels.map(({ activity: itemActivity, icon: Icon, label }) => (
              <button
                aria-pressed={activity === itemActivity}
                aria-describedby={itemActivity === "match" && !canMatch ? "oevekort-match-minimum" : undefined}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${activity === itemActivity ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-white/15 bg-white/7 text-slate-100 hover:bg-white/12"}`}
                disabled={itemActivity === "match" && !canMatch}
                key={itemActivity}
                onClick={() => chooseActivity(itemActivity)}
                type="button"
              >
                <Icon aria-hidden="true" className="h-4 w-4" /> {label}
              </button>
            ))}
            <button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/7 px-3 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/12" onClick={() => window.print()} type="button">
              <Printer aria-hidden="true" className="h-4 w-4" /> Print
            </button>
          </div>
          {!canMatch ? <p className="mt-3 text-xs font-medium leading-5 text-slate-300" id="oevekort-match-minimum">Match bliver klar, når sættet har mindst tre kort.</p> : null}
        </header>

        <section className="mt-5 rounded-[2rem] border border-white/10 bg-slate-900/92 p-4 shadow-[0_24px_72px_rgba(2,8,23,0.26)] print:hidden sm:p-7" aria-live="polite">
          {activity === "flash" ? (
            <div>
              <div className="flex items-center justify-between gap-3 text-xs font-black tracking-[0.16em] text-cyan-200 uppercase"><span>Kort</span><span>{cardIndex + 1} / {sharedSet.cards.length}</span></div>
              <button aria-pressed={isFlipped} className="mt-4 flex min-h-80 w-full items-center justify-center rounded-3xl border border-cyan-200/18 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_45%),linear-gradient(145deg,#10253d,#0d1e32)] px-6 py-10 text-center transition hover:border-cyan-200/40" onClick={() => setIsFlipped((visible) => !visible)} type="button">
                <span>
                  <span className="block text-xs font-black tracking-[0.2em] text-cyan-200 uppercase">{isFlipped ? "Bagside" : "Forside"}</span>
                  <span className="mt-5 block whitespace-pre-wrap text-3xl font-black leading-tight sm:text-5xl">{isFlipped ? currentCard.back : currentCard.front}</span>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-cyan-100">{isFlipped ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />} Tryk for at vende kortet</span>
                </span>
              </button>
              <CardNavigation onNext={() => goToCard(cardIndex + 1)} onPrevious={() => goToCard(cardIndex - 1)} />
            </div>
          ) : null}

          {activity === "write" ? (
            <div>
              <div className="flex items-center justify-between gap-3 text-xs font-black tracking-[0.16em] text-cyan-200 uppercase"><span>Skriv svaret</span><span>{cardIndex + 1} / {sharedSet.cards.length}</span></div>
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7">
                <p className="text-xs font-black tracking-[0.18em] text-cyan-200 uppercase">Spørgsmål</p>
                <p className="mt-4 whitespace-pre-wrap text-2xl font-black leading-tight sm:text-3xl">{currentCard.front}</p>
                <form className="mt-7" onSubmit={(event) => { event.preventDefault(); checkWrittenAnswer(); }}>
                  <label className="text-sm font-bold text-slate-200" htmlFor="oevekort-answer">Dit svar</label>
                  <input autoComplete="off" className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-slate-950/65 px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-cyan-200 focus:ring-4 focus:ring-cyan-300/15" id="oevekort-answer" onChange={(event) => { setWrittenAnswer(event.target.value); setAnswerResult(null); }} placeholder="Skriv dit svar" value={writtenAnswer} />
                  <button className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-200 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-100" type="submit"><Check aria-hidden="true" className="h-4 w-4" /> Tjek svar</button>
                </form>
                {answerResult ? (
                  <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm leading-6 ${answerResult === "correct" ? "border-emerald-300/25 bg-emerald-300/12 text-emerald-100" : "border-amber-300/25 bg-amber-300/12 text-amber-50"}`}>
                    {answerResult === "correct" ? <p className="flex items-center gap-2 font-black"><CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Det er rigtigt.</p> : <><p className="font-black">Ikke helt.</p><p className="mt-1">Det rigtige svar er: <span className="font-bold">{currentCard.back}</span></p></>}
                  </div>
                ) : null}
              </div>
              <CardNavigation onNext={() => goToCard(cardIndex + 1)} onPrevious={() => goToCard(cardIndex - 1)} />
            </div>
          ) : null}

          {activity === "match" ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black tracking-[0.16em] text-cyan-200 uppercase">Find parrene</p><p className="mt-1 text-sm text-slate-300">Vælg en forside og dens bagside.</p></div><span className="rounded-full bg-white/8 px-3 py-1 text-sm font-bold text-cyan-100">{matchedCardIds.size} / {sharedSet.cards.length}</span></div>
              {allMatched ? <p className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/12 px-4 py-3 text-sm font-black text-emerald-100"><CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Du fandt alle parrene.</p> : null}
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {matchTiles.map((tile) => {
                  const isMatched = matchedCardIds.has(tile.cardId);
                  const isSelected = selectedTile?.id === tile.id;
                  return (
                    <button
                      aria-pressed={isSelected}
                      className={`min-h-22 rounded-2xl border px-4 py-4 text-left text-sm font-bold leading-6 transition ${isMatched ? "border-emerald-300/30 bg-emerald-300/12 text-emerald-100" : isSelected ? "border-cyan-200 bg-cyan-200 text-slate-950" : "border-white/10 bg-white/5 text-white hover:border-cyan-200/45 hover:bg-white/8"}`}
                      disabled={isMatched || isResolvingMatch}
                      key={tile.id}
                      onClick={() => selectMatchTile(tile)}
                      type="button"
                    >
                      <span className="block text-[0.65rem] tracking-[0.14em] opacity-70 uppercase">{tile.side === "front" ? "Forside" : "Bagside"}</span>
                      <span className="mt-1 block whitespace-pre-wrap">{tile.label}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-slate-300" aria-live="polite">{matchMessage}</p><button className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/7 px-3 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/12" onClick={() => chooseActivity("match")} type="button"><RotateCcw aria-hidden="true" className="h-4 w-4" /> Bland igen</button></div>
            </div>
          ) : null}

          {activity === "board" ? (
            <div>
              <div className="flex items-center justify-between gap-3 text-xs font-black tracking-[0.16em] text-cyan-200 uppercase"><span>Tavlekort</span><span>{cardIndex + 1} / {sharedSet.cards.length}</span></div>
              <div className="mt-4 flex min-h-80 items-center justify-center rounded-3xl border border-cyan-200/18 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_45%),linear-gradient(145deg,#10253d,#0d1e32)] px-6 py-10 text-center"><div><p className="text-xs font-black tracking-[0.2em] text-cyan-200 uppercase">{isFlipped ? "Svar" : "Spørgsmål"}</p><p className="mt-5 whitespace-pre-wrap text-3xl font-black leading-tight sm:text-5xl">{isFlipped ? currentCard.back : currentCard.front}</p></div></div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/7 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/12" onClick={() => goToCard(cardIndex - 1)} type="button"><ChevronLeft aria-hidden="true" className="h-4 w-4" /> Forrige</button><button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-200 px-5 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-100" onClick={() => setIsFlipped((visible) => !visible)} type="button">{isFlipped ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />} {isFlipped ? "Skjul svar" : "Vis svar"}</button><button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/7 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/12" onClick={() => goToCard(cardIndex + 1)} type="button">Næste <ChevronRight aria-hidden="true" className="h-4 w-4" /></button></div>
            </div>
          ) : null}
        </section>

        <section className="hidden print:block print:text-slate-950">
          <p className="text-xs font-black tracking-[0.16em] text-slate-500 uppercase">SkoleGPS Øvekort</p>
          <h1 className="mt-1 text-2xl font-black">{sharedSet.title}</h1>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {sharedSet.cards.map((card, index) => (
              <article key={card.id} className="break-inside-avoid border border-slate-300 p-4">
                <p className="text-xs font-black tracking-[0.14em] text-slate-500 uppercase">Kort {index + 1}</p>
                <div className="mt-3 border-b border-slate-200 pb-3"><p className="text-xs font-bold text-slate-500 uppercase">Forside</p><p className="mt-1 whitespace-pre-wrap font-black">{card.front}</p></div>
                <div className="pt-3"><p className="text-xs font-bold text-slate-500 uppercase">Bagside</p><p className="mt-1 whitespace-pre-wrap font-semibold">{card.back}</p></div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function CardNavigation({
  onNext,
  onPrevious,
}: {
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
      <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/7 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/12" onClick={onPrevious} type="button">
        <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Forrige
      </button>
      <button className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/7 px-4 py-2 text-sm font-bold text-slate-100 transition hover:bg-white/12" onClick={onNext} type="button">
        Næste <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}
