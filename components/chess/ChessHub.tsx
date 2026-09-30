"use client";

import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Crown,
  Dumbbell,
  Expand,
  Flag,
  GraduationCap,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import ChessBoard from "@/components/chess/ChessBoard";
import {
  calculateStandings,
  createEmptyBoard,
  createInitialBoard,
  createPairings,
  movePiece,
  normalizeNames,
  pairingHistory,
  setPiece,
  type ChessBoardState,
  type ChessPiece,
  type ChessPieceKind,
  type MatchResult,
  type Pairing,
  type TournamentMatch,
} from "@/lib/chess";

type Area = "home" | "learn" | "board" | "play";
type EditorPiece = ChessPiece | null;
type RoundState = "names" | "ready" | "active" | "finished";

const lessons = [
  {
    id: "setup",
    title: "Sæt brættet rigtigt",
    level: "Kom godt i gang",
    text: "Et lyst felt skal ligge i højre hjørne hos begge spillere. Dronningen står på sin egen farve.",
    prompt: "Find det lyse hjørne på jeres bræt.",
    tip: "Lad eleverne pege først. Sig derefter: Dronningen står på sin egen farve.",
    visual: "setup",
  },
  {
    id: "moves",
    title: "Sådan går brikkerne",
    level: "Kom godt i gang",
    text: "Bonden går frem. Tårnet går lige. Løberen går skråt. Springeren hopper.",
    prompt: "Lad én elev vise en lovlig vej for hver brik.",
    tip: "Tag én brik ad gangen. Det er lettere at huske en bevægelse end alle regler på én gang.",
    visual: "moves",
  },
  {
    id: "check",
    title: "Skak og skakmat",
    level: "Kom godt i gang",
    text: "Skak betyder, at kongen er truet. Skakmat betyder, at kongen ikke kan slippe væk, blokere eller slå truslen.",
    prompt: "Find ét felt, kongen kan flytte til, når den står i skak.",
    tip: "Spørg: Kan kongen flytte, slå eller få hjælp? Hvis svaret er nej til alle tre, er det mat.",
    visual: "check",
  },
  {
    id: "protect",
    title: "Beskyt dine brikker",
    level: "Næste skridt",
    text: "Se først: Hvad truer modstanderen? Se derefter: Hvilken af dine brikker er ubeskyttet?",
    prompt: "Peg på en brik, som en anden brik passer på.",
    tip: "Bed eleverne forklare med ordene: Den her brik beskytter den her.",
    visual: "protect",
  },
  {
    id: "centre",
    title: "Kampen om centrum",
    level: "Næste skridt",
    text: "Felterne i midten giver brikkerne flere muligheder. Udvikl stille og roligt, før du jagter en hurtig gevinst.",
    prompt: "Prøv at få en bonde eller en brik ind mod midten.",
    tip: "Vis de fire midterfelter og spørg, hvilken brik der kan se flest felter derfra.",
    visual: "centre",
  },
  {
    id: "fork",
    title: "Gaffel og dobbeltangreb",
    level: "Næste skridt",
    text: "Et dobbeltangreb truer to ting på én gang. Springeren er særlig god til gafler.",
    prompt: "Kan I lave et træk, der truer to brikker samtidig?",
    tip: "Lad eleverne sætte springeren på tavlen og tælle dens mulige landingsfelter højt.",
    visual: "fork",
  },
] as const;

type LessonVisual = (typeof lessons)[number]["visual"];

const activities = [
  { title: "Bondeløb", time: 5, text: "Spil kun med bønder. Første bonde på modstanderens baglinje vinder." },
  { title: "Springermission", time: 8, text: "Find tre forskellige springertræk. Vis dem først på tavlen, derefter på brættet." },
  { title: "Mat i én", time: 6, text: "Vis en stilling. Klassen får en tænkepause og peger derefter på det afgørende træk." },
] as const;

const pieceSymbols: Record<ChessPiece["color"], Record<ChessPieceKind, string>> = {
  white: { king: "♔", queen: "♕", rook: "♖", bishop: "♗", knight: "♘", pawn: "♙" },
  black: { king: "♚", queen: "♛", rook: "♜", bishop: "♝", knight: "♞", pawn: "♟" },
};

const pieces: Array<{ label: string; piece: EditorPiece; symbol: string }> = [
  { label: "Fjern brik", piece: null, symbol: "×" },
  ...(["king", "queen", "rook", "bishop", "knight", "pawn"] as ChessPieceKind[]).flatMap((kind) => [
    {
      label: `Hvid ${kind === "king" ? "konge" : kind === "queen" ? "dronning" : kind === "rook" ? "tårn" : kind === "bishop" ? "løber" : kind === "knight" ? "springer" : "bonde"}`,
      piece: { color: "white" as const, kind },
      symbol: pieceSymbols.white[kind],
    },
    {
      label: `Sort ${kind === "king" ? "konge" : kind === "queen" ? "dronning" : kind === "rook" ? "tårn" : kind === "bishop" ? "løber" : kind === "knight" ? "springer" : "bonde"}`,
      piece: { color: "black" as const, kind },
      symbol: pieceSymbols.black[kind],
    },
  ]),
];

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function LessonGraphic({ visual }: { visual: LessonVisual }) {
  if (visual === "setup") {
    return (
      <div aria-hidden="true" className="grid aspect-square w-28 grid-cols-4 overflow-hidden rounded-2xl border-4 border-[#183450] bg-[#183450] shadow-sm sm:w-32">
        {Array.from({ length: 16 }, (_, index) => (
          <span key={index} className={`flex items-center justify-center ${Math.floor(index / 4) % 2 === index % 2 ? "bg-[#f5e6c8]" : "bg-[#729768]"}`}>
            {index === 13 ? <span className="text-2xl text-[#183450]">♕</span> : null}
          </span>
        ))}
      </div>
    );
  }

  if (visual === "moves") {
    return <div aria-hidden="true" className="flex min-h-28 w-28 items-center justify-center gap-2 rounded-2xl bg-emerald-50 text-4xl text-emerald-900 sm:w-32"><span>♙</span><span className="text-2xl">↑</span><span>♘</span></div>;
  }

  if (visual === "check") {
    return <div aria-hidden="true" className="flex min-h-28 w-28 items-center justify-center gap-1 rounded-2xl bg-rose-50 text-5xl text-rose-900 sm:w-32"><span>♔</span><span className="text-2xl">!</span></div>;
  }

  if (visual === "protect") {
    return <div aria-hidden="true" className="flex min-h-28 w-28 items-center justify-center gap-1 rounded-2xl bg-sky-50 text-4xl text-sky-900 sm:w-32"><span>♙</span><span className="text-xl">↔</span><span>♖</span></div>;
  }

  if (visual === "centre") {
    return <div aria-hidden="true" className="grid min-h-28 w-28 grid-cols-3 gap-1 rounded-2xl bg-amber-50 p-3 sm:w-32">{Array.from({ length: 9 }, (_, index) => <span key={index} className={`rounded ${index === 4 ? "flex items-center justify-center bg-amber-300 text-2xl" : "bg-amber-100"}`}>{index === 4 ? "♘" : null}</span>)}</div>;
  }

  return <div aria-hidden="true" className="flex min-h-28 w-28 items-center justify-center gap-1 rounded-2xl bg-violet-50 text-4xl text-violet-900 sm:w-32"><span>♘</span><span className="text-xl">↗</span><span>♜</span></div>;
}

function MiniBoard() {
  return (
    <div aria-hidden="true" className="grid aspect-square w-32 shrink-0 grid-cols-4 overflow-hidden rounded-2xl border-4 border-[#183450] bg-[#183450] shadow-[0_14px_26px_rgba(7,26,58,0.2)] sm:w-40">
      {Array.from({ length: 16 }, (_, index) => (
        <span key={index} className={`flex items-center justify-center text-2xl sm:text-3xl ${Math.floor(index / 4) % 2 === index % 2 ? "bg-[#f5e6c8] text-[#183450]" : "bg-[#729768] text-[#102f27]"}`}>
          {index === 1 ? "♘" : index === 14 ? "♟" : ""}
        </span>
      ))}
    </div>
  );
}

export default function ChessHub() {
  const [area, setArea] = useState<Area>("home");
  const [board, setBoard] = useState<ChessBoardState>(createInitialBoard);
  const [boardRestored, setBoardRestored] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [coordinates, setCoordinates] = useState(true);
  const [editorPiece, setEditorPiece] = useState<EditorPiece | undefined>(undefined);
  const [fullScreen, setFullScreen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<(typeof lessons)[number]["id"]>("setup");
  const [showTeacherTip, setShowTeacherTip] = useState(false);
  const [namesInput, setNamesInput] = useState("");
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [pairingRounds, setPairingRounds] = useState<Pairing[][]>([]);
  const [roundState, setRoundState] = useState<RoundState>("names");
  const [secondsLeft, setSecondsLeft] = useState(10 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [tournamentMatches, setTournamentMatches] = useState<TournamentMatch[]>([]);
  const [tournamentRound, setTournamentRound] = useState(0);
  const tavleButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem("skolegps-chess-board-v1");
      if (saved) setBoard(JSON.parse(saved) as ChessBoardState);
    } catch {
      // A board is a classroom convenience, never a prerequisite for the activity.
    } finally {
      setBoardRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!boardRestored) return;
    try {
      window.sessionStorage.setItem("skolegps-chess-board-v1", JSON.stringify(board));
    } catch {
      // A board is a classroom convenience, never a prerequisite for the activity.
    }
  }, [board, boardRestored]);

  useEffect(() => {
    if (!timerRunning || secondsLeft <= 0) return;
    const interval = window.setInterval(() => setSecondsLeft((value) => {
      if (value <= 1) {
        setTimerRunning(false);
        return 0;
      }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(interval);
  }, [secondsLeft, timerRunning]);

  useEffect(() => {
    if (!fullScreen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setFullScreen(false);
      window.requestAnimationFrame(() => tavleButtonRef.current?.focus());
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [fullScreen]);

  const names = useMemo(() => normalizeNames(namesInput), [namesInput]);
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? lessons[0];
  const standings = useMemo(() => calculateStandings(names, tournamentMatches), [names, tournamentMatches]);
  const currentTournamentMatches = useMemo(
    () => tournamentMatches.filter((match) => match.round === tournamentRound),
    [tournamentMatches, tournamentRound]
  );

  const returnHome = () => {
    setArea("home");
    setFullScreen(false);
  };

  const handleMove = (from: string, to: string) => {
    if (from === to) {
      setSelectedSquare(null);
      return;
    }

    if (!board[from]) {
      setSelectedSquare(to);
      return;
    }

    if (board[to]?.color === board[from]?.color) {
      setSelectedSquare(to);
      return;
    }

    setBoard((current) => movePiece(current, from, to));
    setLastMove({ from, to });
    setSelectedSquare(null);
  };

  const handleBoardSquare = (square: string) => {
    if (editorPiece !== undefined) {
      setBoard((current) => setPiece(current, square, editorPiece));
      setLastMove(null);
      setSelectedSquare(null);
      return;
    }

    if (!selectedSquare) {
      if (board[square]) setSelectedSquare(square);
      return;
    }

    handleMove(selectedSquare, square);
  };

  const prepareRound = () => {
    if (names.length < 2) return;
    const history = pairingHistory(pairingRounds.flat());
    const next = createPairings(names, history);
    setPairings(next);
    setPairingRounds((rounds) => [...rounds, next]);
    setRoundState("ready");
  };

  const startRound = () => {
    if (!pairings.length) return;
    setRoundState("active");
    setTimerRunning(secondsLeft > 0);
  };

  const finishRound = () => {
    setTimerRunning(false);
    setRoundState("finished");
  };

  const startTournamentRound = () => {
    if (names.length < 2) return;
    const nextRound = tournamentRound + 1;
    const previousPairings = tournamentMatches.map(({ board, white, black }) => ({ board, white, black }));
    const nextPairs = tournamentRound === 0 && pairings.length ? pairings : createPairings(names, pairingHistory(previousPairings));
    setTournamentRound(nextRound);
    setTournamentMatches((matches) => [...matches, ...nextPairs.map((pair) => ({ ...pair, round: nextRound }))]);
  };

  const setMatchResult = (boardNumber: number, result: MatchResult) => {
    setTournamentMatches((matches) =>
      matches.map((match) => match.round === tournamentRound && match.board === boardNumber ? { ...match, result } : match)
    );
  };

  const chooseLesson = (id: (typeof lessons)[number]["id"]) => {
    setSelectedLessonId(id);
    setShowTeacherTip(false);
  };

  return (
    <main className="skolegps-teacher-portal min-h-screen px-4 py-6 text-slate-950 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex items-center justify-between gap-3">
          <Link href="/dashboard/laerervaerktoejer" className="skolegps-teacher-secondary-action inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Lærerværktøjer
          </Link>
          {area !== "home" ? (
            <button type="button" onClick={returnHome} className="skolegps-teacher-secondary-action inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Skak
            </button>
          ) : null}
        </header>

        {area === "home" ? (
          <>
            <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-sky-100 bg-white shadow-[0_20px_60px_rgba(7,26,58,0.12)]">
              <div className="relative px-6 py-8 sm:px-9 sm:py-10 md:min-h-[19rem] md:max-w-[62%]">
                <p className="text-xs font-black tracking-[0.18em] text-sky-700 uppercase">Skak i klassen</p>
                <h1 className="mt-3 max-w-xl text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-5xl">Hvad skal der ske i klassen nu?</h1>
                <p className="mt-4 max-w-lg text-base font-semibold leading-7 text-slate-700 sm:text-lg">Vælg én enkel vej. Resten dukker først op, når I får brug for det.</p>
              </div>
              <div className="absolute inset-y-0 right-0 hidden w-[48%] md:block">
                <Image src="/brand/tools/skak-illustration.png" alt="Et skakbræt i et klasseværelse" fill priority sizes="(max-width: 1023px) 48vw, 31rem" className="object-cover object-center" />
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/35 to-transparent" />
              </div>
            </section>

            <section className="mt-7" aria-labelledby="chess-start-heading">
              <h2 id="chess-start-heading" className="sr-only">Vælg en skakaktivitet</h2>
              <button type="button" onClick={() => setArea("play")} className="group flex w-full flex-col gap-6 rounded-[1.75rem] border border-sky-200 bg-[linear-gradient(135deg,#075fb2,#0d84dc)] p-6 text-left text-white shadow-[0_18px_44px_rgba(3,119,216,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(3,119,216,0.32)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-500 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div className="min-w-0">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/16"><UsersRound className="h-6 w-6" aria-hidden="true" /></span>
                  <p className="mt-5 text-xs font-black tracking-[0.18em] text-sky-100 uppercase">Klar med eleverne</p>
                  <h2 className="mt-2 text-3xl font-black">Spil en runde</h2>
                  <p className="mt-2 max-w-xl text-base font-semibold leading-7 text-sky-50">Lav makkere, vælg tid og sæt klassen i gang i tre små trin.</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-black">Gør klar <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></span>
                </div>
                <MiniBoard />
              </button>

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <button type="button" onClick={() => setArea("board")} className="group rounded-[1.5rem] border border-sky-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_18px_38px_rgba(7,26,58,0.12)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-500">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-900"><Crown className="h-6 w-6" aria-hidden="true" /></span>
                  <h2 className="mt-5 text-2xl font-black text-[var(--skolegps-deep-navy)]">Vis på tavlen</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">Åbn et stort, frit bræt og vis ét træk sammen.</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-sky-800">Åbn tavlen <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></span>
                </button>
                <button type="button" onClick={() => setArea("learn")} className="group rounded-[1.5rem] border border-sky-100 bg-white p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-[0_18px_38px_rgba(7,26,58,0.12)] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-500">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-900"><GraduationCap className="h-6 w-6" aria-hidden="true" /></span>
                  <h2 className="mt-5 text-2xl font-black text-[var(--skolegps-deep-navy)]">Lær en regel</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">Vælg en kort øvelse, se den og prøv den på jeres bræt.</p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-sky-800">Vælg en regel <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden="true" /></span>
                </button>
              </div>
            </section>
          </>
        ) : null}

        {area === "learn" ? (
          <section className="mt-6" aria-labelledby="learn-heading">
            <div className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:p-8">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-900"><GraduationCap className="h-5 w-5" aria-hidden="true" /></span>
              <p className="mt-5 text-xs font-black tracking-[0.18em] text-sky-700 uppercase">Lær en regel</p>
              <h1 id="learn-heading" className="mt-2 text-3xl font-black text-[var(--skolegps-deep-navy)]">Vælg én ting at prøve</h1>
              <p className="mt-2 max-w-2xl font-semibold leading-6 text-slate-700">Start med en kort regel. Vis den, sig den højt og prøv den på det fysiske bræt.</p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3" aria-label="Begynderregler">
              {lessons.slice(0, 3).map((lesson) => (
                <button key={lesson.id} type="button" onClick={() => chooseLesson(lesson.id)} aria-pressed={selectedLessonId === lesson.id} className={`rounded-[1.5rem] border p-5 text-left transition focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-sky-500 ${selectedLessonId === lesson.id ? "border-sky-500 bg-sky-50 shadow-[0_14px_30px_rgba(3,119,216,0.14)]" : "border-sky-100 bg-white hover:border-sky-300 hover:bg-sky-50/50"}`}>
                  <LessonGraphic visual={lesson.visual} />
                  <p className="mt-4 text-xs font-black tracking-[0.14em] text-sky-700 uppercase">{lesson.level}</p>
                  <h2 className="mt-2 text-xl font-black text-[var(--skolegps-deep-navy)]">{lesson.title}</h2>
                </button>
              ))}
            </div>

            <details className="mt-5 rounded-[1.5rem] border border-sky-100 bg-white px-5 py-4 shadow-sm">
              <summary className="cursor-pointer font-black text-[var(--skolegps-deep-navy)]">Flere regler til næste gang</summary>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {lessons.slice(3).map((lesson) => <button key={lesson.id} type="button" onClick={() => chooseLesson(lesson.id)} aria-pressed={selectedLessonId === lesson.id} className={`rounded-2xl border px-4 py-4 text-left font-black transition ${selectedLessonId === lesson.id ? "border-sky-400 bg-sky-50 text-sky-950" : "border-sky-100 bg-white text-slate-800 hover:bg-sky-50"}`}>{lesson.title}</button>)}
              </div>
            </details>

            <article className="mt-6 overflow-hidden rounded-[1.75rem] border border-sky-100 bg-white shadow-[0_18px_42px_rgba(7,26,58,0.1)]">
              <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center">
                <LessonGraphic visual={selectedLesson.visual} />
                <div>
                  <p className="text-xs font-black tracking-[0.18em] text-sky-700 uppercase">{selectedLesson.level}</p>
                  <h2 className="mt-2 text-3xl font-black text-[var(--skolegps-deep-navy)]">{selectedLesson.title}</h2>
                  <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-700">{selectedLesson.text}</p>
                </div>
              </div>
              <div className="border-t border-sky-100 bg-amber-50 px-6 py-6 sm:px-8">
                <p className="text-xs font-black tracking-[0.16em] text-amber-800 uppercase">Prøv det på jeres bræt</p>
                <p className="mt-2 text-xl font-black text-amber-950">{selectedLesson.prompt}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={() => setShowTeacherTip((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-5 py-2.5 text-sm font-black text-white transition hover:bg-sky-700"><Sparkles className="h-4 w-4" aria-hidden="true" />{showTeacherTip ? "Skjul lærertip" : "Vis lærertip"}</button>
                  <button type="button" onClick={() => setArea("board")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-amber-300 bg-white px-5 py-2.5 text-sm font-black text-amber-950 transition hover:bg-amber-100"><Crown className="h-4 w-4" aria-hidden="true" />Vis på tavlen</button>
                </div>
                {showTeacherTip ? <p className="mt-4 max-w-2xl rounded-2xl border border-emerald-200 bg-white/80 p-4 font-semibold leading-6 text-emerald-950">{selectedLesson.tip}</p> : null}
              </div>
            </article>

            <details className="mt-5 rounded-[1.5rem] border border-sky-100 bg-white px-5 py-4 shadow-sm">
              <summary className="cursor-pointer font-black text-[var(--skolegps-deep-navy)]">Flere idéer til læreren</summary>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-sm font-semibold leading-6 text-slate-700">Brug en original udgiver, vælg niveauet og stop efter den del, klassen skal prøve fysisk.</p><a href="https://www.youtube.com/@FIDE_chess/videos" target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-black text-sky-900 hover:bg-sky-100">Se FIDE-videoer</a></div>
            </details>
          </section>
        ) : null}

        {area === "board" ? (
          <section className={fullScreen ? "fixed inset-0 z-50 overflow-auto bg-[#f3faff] px-4 py-6 sm:px-8" : "mt-6"} aria-label="Fri tavle">
            <div className="mx-auto w-full max-w-6xl">
              <div className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8">
                <div><span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black tracking-[0.12em] text-amber-950 uppercase">Fri tavle</span><h1 className="mt-3 text-3xl font-black text-[var(--skolegps-deep-navy)]">Vis ét træk sammen</h1><p className="mt-2 max-w-2xl font-semibold leading-6 text-slate-700">Tryk på en brik og derefter et felt. Brættet hjælper jer med at vise idéer — det kontrollerer ikke skakregler.</p></div>
                <button ref={tavleButtonRef} type="button" onClick={() => setFullScreen((value) => !value)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-black text-sky-900 transition hover:bg-sky-100 sm:mt-0"><Expand className="h-4 w-4" aria-hidden="true" />{fullScreen ? "Afslut tavlemodus" : "Tavlemodus"}</button>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
                <div className="mx-auto w-full max-w-[min(82vh,48rem)]"><ChessBoard board={board} coordinates={coordinates} flipped={flipped} lastMove={lastMove} selectedSquare={selectedSquare} onSquarePress={handleBoardSquare} /></div>
                <aside className="rounded-[1.5rem] border border-sky-100 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Tavle</p>
                  <div className="mt-3 grid gap-2"><button type="button" onClick={() => { setBoard(createInitialBoard()); setLastMove(null); setSelectedSquare(null); setEditorPiece(undefined); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--skolegps-blue-strong)] px-4 py-2 text-sm font-black text-white hover:bg-sky-700"><RotateCcw className="h-4 w-4" aria-hidden="true" />Nulstil brættet</button><button type="button" onClick={() => { setBoard(createEmptyBoard()); setLastMove(null); setSelectedSquare(null); setEditorPiece(undefined); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-900 hover:bg-sky-50"><X className="h-4 w-4" aria-hidden="true" />Tøm brættet</button></div>
                  <details className="mt-5 border-t border-sky-100 pt-4"><summary className="cursor-pointer text-sm font-black text-[var(--skolegps-deep-navy)]">Flere værktøjer</summary><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" aria-pressed={flipped} onClick={() => setFlipped((value) => !value)} className="chess-control"><RotateCw className="h-4 w-4" aria-hidden="true" />Vend</button><button type="button" aria-pressed={coordinates} onClick={() => setCoordinates((value) => !value)} className="chess-control">{coordinates ? "Skjul felter" : "Vis felter"}</button></div><fieldset className="mt-5 border-t border-sky-100 pt-4"><legend className="text-sm font-black text-[var(--skolegps-deep-navy)]">Byg en stilling</legend><p className="mt-2 text-sm font-semibold leading-5 text-slate-600">Vælg en brik og tryk på et felt. Vælg Flyt brikker for at vise træk igen.</p><button type="button" aria-pressed={editorPiece === undefined} onClick={() => { setEditorPiece(undefined); setSelectedSquare(null); }} className={`mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl px-3 text-sm font-black ${editorPiece === undefined ? "bg-sky-600 text-white" : "bg-sky-50 text-sky-900"}`}>Flyt brikker</button><div className="mt-3 grid grid-cols-4 gap-2">{pieces.map(({ label, piece, symbol }) => { const selected = editorPiece === piece || (editorPiece !== undefined && editorPiece !== null && piece !== null && editorPiece.color === piece.color && editorPiece.kind === piece.kind); return <button key={label} type="button" aria-label={label} aria-pressed={selected} onClick={() => { setEditorPiece(piece); setSelectedSquare(null); }} className={`inline-flex min-h-11 items-center justify-center rounded-xl text-2xl font-black transition ${selected ? "bg-amber-200 text-amber-950 ring-2 ring-amber-400" : "bg-slate-50 text-slate-800 hover:bg-slate-100"}`}>{symbol}</button>; })}</div></fieldset></details>
                </aside>
              </div>
            </div>
          </section>
        ) : null}

        {area === "play" ? (
          <section className="mt-6" aria-labelledby="play-heading">
            <div className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:p-8"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-900"><UsersRound className="h-5 w-5" aria-hidden="true" /></span><p className="mt-5 text-xs font-black tracking-[0.18em] text-sky-700 uppercase">Spil en runde</p><h1 id="play-heading" className="mt-2 text-3xl font-black text-[var(--skolegps-deep-navy)]">Gør klar i tre små trin</h1><p className="mt-2 max-w-2xl font-semibold leading-6 text-slate-700">Navne, makkere, start. Turnering og ekstra lege kommer først bagefter.</p></div>

            <ol className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Trin i skakrunden">{([ ["names", "1", "Navne"], ["ready", "2", "Makkere og tid"], ["active", "3", "Start"] ] as const).map(([state, number, label]) => { const active = roundState === state || (state === "active" && roundState === "finished"); const done = (state === "names" && roundState !== "names") || (state === "ready" && ["active", "finished"].includes(roundState)); return <li key={state} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-black ${active ? "border-sky-400 bg-sky-50 text-sky-950" : done ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-sky-100 bg-white text-slate-500"}`}><span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${active ? "bg-sky-600 text-white" : done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"}`}>{number}</span>{label}</li>; })}</ol>

            {roundState === "names" ? <article className="mt-6 rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-black text-[var(--skolegps-deep-navy)]">Hvem skal spille?</h2><p className="mt-2 font-semibold leading-6 text-slate-700">Skriv eller indsæt ét navn pr. linje. Navnene bruges kun i denne åbne skaksession.</p><label className="mt-5 block text-sm font-black text-slate-800" htmlFor="chess-names">Ét navn pr. linje</label><textarea id="chess-names" value={namesInput} onChange={(event) => setNamesInput(event.target.value)} placeholder={"Amina\nJonas\nSofia\nEmil"} className="mt-2 min-h-40 w-full max-w-2xl rounded-2xl border border-sky-200 bg-sky-50/45 p-4 font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100" /><p className="mt-2 text-sm font-semibold text-slate-600">{names.length} klar{names.length === 1 ? "" : "e"}</p><button type="button" disabled={names.length < 2} onClick={prepareRound} className="skolegps-teacher-primary-action mt-5 inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-45"><ArrowRight className="h-4 w-4" aria-hidden="true" />Fortsæt</button></article> : null}

            {roundState === "ready" ? <article className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><div className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Trin 2</p><h2 className="mt-2 text-2xl font-black text-[var(--skolegps-deep-navy)]">Makkere og tid</h2><Pairings pairings={pairings} /><button type="button" onClick={prepareRound} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-black text-sky-900 hover:bg-sky-100"><RotateCw className="h-4 w-4" aria-hidden="true" />Lav nye makkere</button></div><div className="rounded-[1.75rem] border border-sky-100 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Vælg tid</p><p className="mt-2 text-5xl font-black tabular-nums text-[var(--skolegps-deep-navy)]">{formatSeconds(secondsLeft)}</p><div className="mt-5 grid grid-cols-3 gap-2">{[5, 10, 15].map((minutes) => <button key={minutes} type="button" aria-pressed={secondsLeft === minutes * 60} onClick={() => { setSecondsLeft(minutes * 60); setTimerRunning(false); }} className={`min-h-11 rounded-xl px-3 text-sm font-black ${secondsLeft === minutes * 60 ? "bg-sky-600 text-white" : "border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"}`}>{minutes} min</button>)}</div><button type="button" onClick={startRound} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-3 text-base font-black text-white hover:bg-emerald-700"><Play className="h-5 w-5" aria-hidden="true" />Start runden</button></div></article> : null}

            {roundState === "active" ? <article className="mt-6 overflow-hidden rounded-[1.75rem] border border-emerald-200 bg-white shadow-[0_18px_42px_rgba(7,26,58,0.1)]"><div className="bg-emerald-600 px-6 py-5 text-white sm:px-8"><p className="text-xs font-black tracking-[0.16em] text-emerald-100 uppercase">Runden er i gang</p><p className="mt-2 text-5xl font-black tabular-nums sm:text-6xl">{formatSeconds(secondsLeft)}</p>{secondsLeft === 0 ? <p role="status" className="mt-3 font-black">Tiden er gået.</p> : null}</div><div className="p-6 sm:p-8"><Pairings pairings={pairings} /><div className="mt-6 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => setTimerRunning((value) => !value)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-black text-emerald-950 hover:bg-emerald-100"><Clock3 className="h-4 w-4" aria-hidden="true" />{timerRunning ? "Pause tiden" : "Fortsæt tiden"}</button><button type="button" onClick={finishRound} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-5 py-2.5 text-sm font-black text-white hover:bg-sky-700"><Flag className="h-4 w-4" aria-hidden="true" />Afslut runden</button></div></div></article> : null}

            {roundState === "finished" ? <article className="mt-6 rounded-[1.75rem] border border-emerald-200 bg-white p-6 shadow-sm sm:p-8"><p className="text-xs font-black tracking-[0.16em] text-emerald-700 uppercase">Færdig</p><h2 className="mt-2 text-3xl font-black text-[var(--skolegps-deep-navy)]">Runden er færdig</h2><p className="mt-2 max-w-2xl font-semibold leading-6 text-slate-700">I kan skifte makkere og tage en ny runde — eller vælge at føre point nedenfor.</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={prepareRound} className="skolegps-teacher-primary-action inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-black"><RotateCw className="h-4 w-4" aria-hidden="true" />Næste runde</button><button type="button" onClick={returnHome} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-sky-200 bg-white px-5 py-2.5 text-sm font-black text-sky-900 hover:bg-sky-50">Tilbage til Skak</button></div></article> : null}

            {roundState !== "names" ? <details className="mt-6 rounded-[1.75rem] border border-sky-100 bg-white px-6 py-5 shadow-sm sm:px-8"><summary className="cursor-pointer text-lg font-black text-[var(--skolegps-deep-navy)]">Turnering og point (valgfrit)</summary><p className="mt-3 max-w-2xl font-semibold leading-6 text-slate-700">Brug først dette, når I faktisk vil holde styr på resultater. Det er ikke nødvendigt for en almindelig runde.</p>{tournamentRound === 0 ? <button type="button" onClick={startTournamentRound} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-black text-sky-900 hover:bg-sky-100"><Trophy className="h-4 w-4" aria-hidden="true" />Før point for runden</button> : <button type="button" onClick={startTournamentRound} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-black text-sky-900 hover:bg-sky-100"><Trophy className="h-4 w-4" aria-hidden="true" />Start turneringsrunde {tournamentRound + 1}</button>}{currentTournamentMatches.length ? <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><div><h3 className="text-xl font-black text-[var(--skolegps-deep-navy)]">Point for runde {tournamentRound}</h3><div className="mt-3 space-y-3">{currentTournamentMatches.map((match) => <div key={match.board} className="rounded-2xl border border-sky-100 p-4"><p className="font-black text-slate-800">Bord {match.board}: {match.white} – {match.black ?? "fri"}</p>{match.black ? <div className="mt-3 flex flex-wrap gap-2">{(["white", "draw", "black"] as MatchResult[]).map((result) => <button key={result} type="button" onClick={() => setMatchResult(match.board, result)} className={`rounded-full px-3 py-2 text-xs font-black ${match.result === result ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{result === "white" ? `${match.white} vandt` : result === "black" ? `${match.black} vandt` : "Remis"}</button>)}</div> : <p className="mt-2 text-sm font-semibold text-slate-600">Frirunde</p>}</div>)}</div></div><div><h3 className="text-xl font-black text-[var(--skolegps-deep-navy)]">Stilling</h3><ol className="mt-3 space-y-2">{standings.map((standing, index) => <li key={standing.name} className="flex items-center justify-between rounded-xl bg-sky-50 px-4 py-3 font-bold"><span>{index + 1}. {standing.name}</span><span>{standing.points}</span></li>)}</ol></div></div> : null}</details> : null}

            <details className="mt-5 rounded-[1.75rem] border border-sky-100 bg-white px-6 py-5 shadow-sm sm:px-8"><summary className="cursor-pointer text-lg font-black text-[var(--skolegps-deep-navy)]">Eller vælg en skakleg</summary><div className="mt-5 grid gap-4 md:grid-cols-3">{activities.map((activity) => <article key={activity.title} className="rounded-2xl border border-sky-100 bg-sky-50/60 p-5"><Dumbbell className="h-6 w-6 text-sky-700" aria-hidden="true" /><h3 className="mt-3 text-xl font-black text-[var(--skolegps-deep-navy)]">{activity.title}</h3><p className="mt-1 text-sm font-black text-sky-700">{activity.time} min</p><p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{activity.text}</p><button type="button" onClick={() => { setSecondsLeft(activity.time * 60); setTimerRunning(false); }} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-sky-200 bg-white px-4 text-sm font-black text-sky-900 hover:bg-sky-100"><Clock3 className="h-4 w-4" aria-hidden="true" />Sæt {activity.time} min</button></article>)}</div></details>
          </section>
        ) : null}
      </div>
      <style jsx>{`.chess-control { display: inline-flex; min-height: 2.75rem; align-items: center; justify-content: center; gap: .45rem; border-radius: .75rem; border: 1px solid rgb(186 230 253); background: rgb(240 249 255); padding: .5rem .65rem; font-size: .8rem; font-weight: 800; color: rgb(12 74 110); transition: background .15s ease; } .chess-control:hover { background: rgb(224 242 254); }`}</style>
    </main>
  );
}

function Pairings({ pairings }: { pairings: Pairing[] }) {
  return <><h3 className="mt-5 text-xl font-black text-[var(--skolegps-deep-navy)]">Dagens makkere</h3><ol className="mt-3 grid gap-2 sm:grid-cols-2">{pairings.map((pair) => <li key={`${pair.board}-${pair.white}`} className="rounded-xl bg-sky-50 px-4 py-3 font-bold text-slate-800"><span className="mr-3 text-xs font-black text-sky-700">BORD {pair.board}</span>{pair.black ? `${pair.white} – ${pair.black}` : `${pair.white} har fri`}</li>)}</ol></>;
}
