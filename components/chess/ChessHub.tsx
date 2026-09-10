"use client";

import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  Clock3,
  Crown,
  Dumbbell,
  Expand,
  Flag,
  GraduationCap,
  Handshake,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  UsersRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import Mascot from "@/components/brand/Mascot";
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

const lessons = [
  {
    title: "Sådan står brættet",
    level: "Begynder",
    text: "Et lyst felt skal ligge i højre hjørne hos begge spillere. Dronningen står på sin egen farve.",
    prompt: "Find det lyse hjørne på jeres bræt.",
  },
  {
    title: "Sådan flytter brikkerne",
    level: "Begynder",
    text: "Bonden går frem. Tårnet går lige. Løberen går skråt. Springeren hopper. Dronningen kombinerer tårn og løber.",
    prompt: "Lad én elev vise en lovlig vej for hver brik.",
  },
  {
    title: "Skak og skakmat",
    level: "Begynder",
    text: "Skak betyder, at kongen er truet. Skakmat betyder, at kongen ikke kan komme væk, blokere eller slå truslen.",
    prompt: "Find ét felt, kongen kan flytte til, når den står i skak.",
  },
  {
    title: "Beskyt dine brikker",
    level: "Let",
    text: "Se først: Hvad truer modstanderen? Se derefter: Hvilken af dine brikker er ubeskyttet?",
    prompt: "Peg på en brik, som en anden brik passer på.",
  },
  {
    title: "Kampen om centrum",
    level: "Let",
    text: "Felterne i midten giver brikkerne flere muligheder. Udvikl stille og roligt, før du jagter en hurtig gevinst.",
    prompt: "Prøv at få en bonde eller en brik ind mod midten.",
  },
  {
    title: "Gaffel og dobbeltangreb",
    level: "Øvet",
    text: "Et dobbeltangreb truer to ting på én gang. Springeren er særlig god til gafler.",
    prompt: "Kan I lave et træk, der truer to brikker samtidig?",
  },
] as const;

const activities = [
  { title: "Bondeløb", time: "5 min", text: "Spil kun med bønder. Første bonde på modstanderens baglinje vinder." },
  { title: "Springermission", time: "8 min", text: "Find tre forskellige springertræk. Vis dem først på tavlen, derefter på brættet." },
  { title: "Mat i én", time: "6 min", text: "Vis en stilling. Klassen får en tænkepause og peger derefter på det afgørende træk." },
] as const;

const pieces: Array<{ label: string; piece: EditorPiece }> = [
  { label: "Fjern", piece: null },
  ...(["king", "queen", "rook", "bishop", "knight", "pawn"] as ChessPieceKind[]).flatMap((kind) => [
    { label: `Hvid ${kind === "king" ? "konge" : kind === "queen" ? "dronning" : kind === "rook" ? "tårn" : kind === "bishop" ? "løber" : kind === "knight" ? "springer" : "bonde"}`, piece: { color: "white" as const, kind } },
    { label: `Sort ${kind === "king" ? "konge" : kind === "queen" ? "dronning" : kind === "rook" ? "tårn" : kind === "bishop" ? "løber" : kind === "knight" ? "springer" : "bonde"}`, piece: { color: "black" as const, kind } },
  ]),
];

function formatSeconds(total: number) {
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function ChessHub() {
  const [area, setArea] = useState<Area>("home");
  const [board, setBoard] = useState<ChessBoardState>(() => {
    if (typeof window === "undefined") return createInitialBoard();
    try {
      const saved = window.sessionStorage.getItem("skolegps-chess-board-v1");
      return saved ? (JSON.parse(saved) as ChessBoardState) : createInitialBoard();
    } catch {
      return createInitialBoard();
    }
  });
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [coordinates, setCoordinates] = useState(true);
  const [editorPiece, setEditorPiece] = useState<EditorPiece | undefined>(undefined);
  const [fullScreen, setFullScreen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState(0);
  const [showLessonAnswer, setShowLessonAnswer] = useState(false);
  const [namesInput, setNamesInput] = useState("");
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [pairingRounds, setPairingRounds] = useState<Pairing[][]>([]);
  const [secondsLeft, setSecondsLeft] = useState(10 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [tournamentMatches, setTournamentMatches] = useState<TournamentMatch[]>([]);
  const [tournamentRound, setTournamentRound] = useState(0);

  useEffect(() => {
    try {
      window.sessionStorage.setItem("skolegps-chess-board-v1", JSON.stringify(board));
    } catch {
      // This is an optional convenience, never a required classroom dependency.
    }
  }, [board]);

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

  const names = useMemo(() => normalizeNames(namesInput), [namesInput]);
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
    setBoard((current) => movePiece(current, from, to));
    setLastMove({ from, to });
    setSelectedSquare(null);
  };

  const handleBoardSquare = (square: string) => {
    if (editorPiece !== undefined) {
      setBoard((current) => setPiece(current, square, editorPiece));
      setLastMove(null);
      return;
    }

    if (!selectedSquare) {
      if (board[square]) setSelectedSquare(square);
      return;
    }
    handleMove(selectedSquare, square);
  };

  const makePairs = () => {
    if (names.length < 2) return;
    const history = pairingHistory(pairingRounds.flat());
    const next = createPairings(names, history);
    setPairings(next);
    setPairingRounds((rounds) => [...rounds, next]);
  };

  const startTournamentRound = () => {
    if (names.length < 2) return;
    const previousPairings = tournamentMatches.map(({ board, white, black }) => ({ board, white, black }));
    const nextPairs = createPairings(names, pairingHistory(previousPairings));
    const nextRound = tournamentRound + 1;
    setTournamentRound(nextRound);
    setTournamentMatches((matches) => [...matches, ...nextPairs.map((pair) => ({ ...pair, round: nextRound }))]);
  };

  const setMatchResult = (boardNumber: number, result: MatchResult) => {
    setTournamentMatches((matches) =>
      matches.map((match) =>
        match.round === tournamentRound && match.board === boardNumber ? { ...match, result } : match
      )
    );
  };

  return (
    <main className="min-h-screen bg-[var(--skolegps-muted-bg)] px-5 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="flex items-center justify-between gap-3">
          <Link
            href="/dashboard/laerervaerktoejer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-100 bg-white px-4 py-2 text-sm font-bold text-[var(--skolegps-deep-navy)] shadow-sm transition hover:bg-sky-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Værktøjer
          </Link>
          {area !== "home" ? (
            <button type="button" onClick={returnHome} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-100 bg-white px-4 py-2 text-sm font-bold text-sky-800 shadow-sm hover:bg-sky-50">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Skak
            </button>
          ) : null}
        </header>

        {area === "home" ? (
          <>
            <section className="relative mt-6 overflow-hidden rounded-[2rem] border border-sky-100 bg-white px-6 py-8 shadow-[0_24px_70px_rgba(7,26,58,0.13)] sm:px-9 sm:py-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_15%,rgba(247,183,51,0.24),transparent_26%),radial-gradient(circle_at_10%_100%,rgba(14,165,233,0.14),transparent_30%)]" />
              <div className="relative flex items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <p className="text-xs font-black tracking-[0.18em] text-sky-700 uppercase">Aktivér klassen</p>
                  <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--skolegps-deep-navy)] sm:text-5xl">Skak i klassen</h1>
                  <p className="mt-4 text-base font-semibold leading-7 text-slate-700 sm:text-lg">Brug rigtige brætter. SkoleGPS hjælper med næste skridt.</p>
                </div>
                <Mascot variant="chess" size="lg" className="hidden sm:block" />
              </div>
            </section>

            <section className="mt-7 grid gap-5 md:grid-cols-3" aria-label="Vælg skakaktivitet">
              {[
                { area: "learn" as const, icon: GraduationCap, title: "Lær", text: "Korte ideer og øvelser til jeres bræt.", action: "Lær skak" },
                { area: "board" as const, icon: Crown, title: "Vis", text: "Et stort fælles bræt til tavlen.", action: "Vis på tavlen" },
                { area: "play" as const, icon: UsersRound, title: "Spil", text: "Lav makkere, start tid og hold styr på runder.", action: "Organisér spil" },
              ].map(({ area: nextArea, icon: Icon, title, text, action }) => (
                <button key={nextArea} type="button" onClick={() => setArea(nextArea)} className="group rounded-[1.5rem] border border-sky-100 bg-white p-6 text-left shadow-[0_16px_40px_rgba(7,26,58,0.1)] transition hover:-translate-y-1 hover:border-sky-300 hover:shadow-[0_24px_54px_rgba(7,26,58,0.16)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-500">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-600 text-white shadow-[0_10px_20px_rgba(3,119,216,0.24)]"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                  <h2 className="mt-5 text-2xl font-black text-[var(--skolegps-deep-navy)]">{title}</h2>
                  <p className="mt-2 min-h-12 text-sm font-semibold leading-6 text-slate-600">{text}</p>
                  <span className="mt-5 inline-flex rounded-full bg-sky-50 px-4 py-2 text-sm font-black text-sky-800 transition group-hover:bg-sky-100">{action}</span>
                </button>
              ))}
            </section>
          </>
        ) : null}

        {area === "learn" ? (
          <section className="mt-6">
            <PageIntro icon={GraduationCap} title="Lær skak" text="Vælg én idé. Vis den kort. Prøv den på jeres eget bræt." />
            <div className="mt-7 grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
              <nav className="grid gap-2 self-start rounded-[1.5rem] border border-sky-100 bg-white p-3 shadow-sm" aria-label="Skaklektioner">
                {lessons.map((lesson, index) => (
                  <button key={lesson.title} type="button" onClick={() => { setSelectedLesson(index); setShowLessonAnswer(false); }} className={`rounded-xl px-4 py-3 text-left transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-sky-500 ${selectedLesson === index ? "bg-sky-600 text-white" : "hover:bg-sky-50"}`}>
                    <span className="block text-xs font-black uppercase opacity-75">{lesson.level}</span>
                    <span className="mt-1 block font-black">{lesson.title}</span>
                  </button>
                ))}
              </nav>
              <article className="rounded-[1.5rem] border border-sky-100 bg-white p-6 shadow-[0_16px_40px_rgba(7,26,58,0.1)] sm:p-8">
                <p className="text-xs font-black tracking-[0.18em] text-sky-700 uppercase">{lessons[selectedLesson].level}</p>
                <h2 className="mt-2 text-3xl font-black text-[var(--skolegps-deep-navy)]">{lessons[selectedLesson].title}</h2>
                <p className="mt-4 max-w-xl text-base font-semibold leading-7 text-slate-700">{lessons[selectedLesson].text}</p>
                <div className="mt-6 rounded-2xl bg-amber-50 p-5">
                  <p className="text-xs font-black tracking-[0.16em] text-amber-800 uppercase">Prøv det på jeres bræt</p>
                  <p className="mt-2 text-lg font-black text-amber-950">{lessons[selectedLesson].prompt}</p>
                </div>
                <button type="button" onClick={() => setShowLessonAnswer((value) => !value)} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-sky-700">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {showLessonAnswer ? "Skjul svar" : "Vis svar"}
                </button>
                {showLessonAnswer ? <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 font-semibold leading-6 text-emerald-950">Der kan være flere gode løsninger. Lad først eleverne forklare deres idé med brættet foran sig.</p> : null}
              </article>
            </div>

            <section className="mt-8 grid gap-5 md:grid-cols-2">
              <article className="rounded-[1.5rem] border border-sky-100 bg-white p-6 shadow-sm">
                <p className="text-xs font-black tracking-[0.18em] text-sky-700 uppercase">Dagens skakidé</p>
                <h2 className="mt-2 text-2xl font-black text-[var(--skolegps-deep-navy)]">Hvid trækker – hvad ville du gøre?</h2>
                <p className="mt-3 font-semibold leading-6 text-slate-700">Vis en stilling på tavlen. Giv klassen 30 sekunders tænkepause. Lad to elever vise hver sin idé.</p>
                <button type="button" onClick={() => setArea("board")} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-black text-sky-900 hover:bg-sky-100"><Crown className="h-4 w-4" aria-hidden="true" />Åbn brættet</button>
              </article>
              <article className="rounded-[1.5rem] border border-sky-100 bg-white p-6 shadow-sm">
                <p className="text-xs font-black tracking-[0.18em] text-sky-700 uppercase">Inspiration</p>
                <h2 className="mt-2 text-2xl font-black text-[var(--skolegps-deep-navy)]">Stormesterens blik</h2>
                <p className="mt-3 font-semibold leading-6 text-slate-700">Magnus Carlsen: Se først, hvad modstanderen truer med. Brug derefter jeres bræt til at afprøve svaret.</p>
                <a href="https://ratings.fide.com/profile/1503014" target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-11 items-center rounded-full border border-sky-200 bg-white px-5 py-2.5 text-sm font-black text-sky-900 hover:bg-sky-50">Kilde: FIDE spillerprofil</a>
              </article>
              <article className="rounded-[1.5rem] border border-sky-100 bg-white p-6 shadow-sm md:col-span-2">
                <p className="text-xs font-black tracking-[0.18em] text-sky-700 uppercase">Video til læreren</p>
                <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><h2 className="text-2xl font-black text-[var(--skolegps-deep-navy)]">Vælg en kort forklaring</h2><p className="mt-2 font-semibold leading-6 text-slate-700">Brug en original udgiver, vælg niveauet og stop efter den del, klassen skal prøve fysisk.</p></div>
                  <a href="https://www.youtube.com/@FIDE_chess/videos" target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-red-600 px-5 py-2.5 text-sm font-black text-white hover:bg-red-700">Se FIDE-videoer</a>
                </div>
              </article>
            </section>
          </section>
        ) : null}

        {area === "board" ? (
          <section className={fullScreen ? "fixed inset-0 z-50 overflow-auto bg-[var(--skolegps-muted-bg)] px-5 py-6 sm:px-8" : "mt-6"}>
            <div className="mx-auto w-full max-w-6xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PageIntro icon={Crown} title="Vis på tavlen" text="Tryk på en brik og derefter et felt for at vise et træk." compact />
                <button type="button" onClick={() => setFullScreen((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-sky-200 bg-white px-5 py-2.5 text-sm font-black text-sky-900 shadow-sm hover:bg-sky-50"><Expand className="h-4 w-4" aria-hidden="true" />{fullScreen ? "Afslut tavlemodus" : "Tavlemodus"}</button>
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
                <div className="mx-auto w-full max-w-[48rem]"><ChessBoard board={board} coordinates={coordinates} flipped={flipped} lastMove={lastMove} selectedSquare={selectedSquare} onMove={handleMove} onSquareEdit={editorPiece !== undefined ? handleBoardSquare : undefined} /></div>
                <aside className="space-y-4 rounded-[1.5rem] border border-sky-100 bg-white p-5 shadow-sm">
                  <div><p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Bræt</p><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setBoard(createInitialBoard()); setLastMove(null); setSelectedSquare(null); }} className="control"><RotateCcw className="h-4 w-4" />Start</button><button type="button" onClick={() => { setBoard(createEmptyBoard()); setLastMove(null); setSelectedSquare(null); }} className="control"><X className="h-4 w-4" />Ryd</button><button type="button" onClick={() => setFlipped((value) => !value)} className="control"><RotateCw className="h-4 w-4" />Vend</button><button type="button" onClick={() => setCoordinates((value) => !value)} className="control">{coordinates ? "Skjul felter" : "Vis felter"}</button></div></div>
                  <div className="border-t border-sky-100 pt-4"><p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Opsæt stilling</p><p className="mt-2 text-sm font-semibold leading-5 text-slate-600">Vælg en brik og tryk på et felt. Vælg Flyt for at vise træk igen.</p><button type="button" onClick={() => { setEditorPiece(undefined); setSelectedSquare(null); }} className={`mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-xl px-3 text-sm font-black ${editorPiece === undefined ? "bg-sky-600 text-white" : "bg-sky-50 text-sky-900"}`}>Flyt brikker</button><div className="mt-3 grid grid-cols-2 gap-2">{pieces.map(({ label, piece }) => <button key={label} type="button" onClick={() => { setEditorPiece(piece); setSelectedSquare(null); }} className={`min-h-10 rounded-xl px-2 text-left text-xs font-bold ${editorPiece === piece || (editorPiece?.color === piece?.color && editorPiece?.kind === piece?.kind) ? "bg-amber-100 text-amber-950 ring-2 ring-amber-300" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>{label}</button>)}</div></div>
                </aside>
              </div>
            </div>
          </section>
        ) : null}

        {area === "play" ? (
          <section className="mt-6"><PageIntro icon={UsersRound} title="Spil skak" text="Skriv navnene én gang. Lav makkere, start tiden og hold runden enkel." />
            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              <article className="rounded-[1.5rem] border border-sky-100 bg-white p-6 shadow-sm"><h2 className="text-2xl font-black text-[var(--skolegps-deep-navy)]">Lav makkere</h2><label className="mt-4 block text-sm font-bold text-slate-700" htmlFor="chess-names">Ét navn pr. linje</label><textarea id="chess-names" value={namesInput} onChange={(event) => setNamesInput(event.target.value)} placeholder={"Amina\nJonas\nSofia\nEmil"} className="mt-2 min-h-36 w-full rounded-xl border border-sky-200 bg-sky-50/45 p-3 font-semibold text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100" /><p className="mt-2 text-sm font-semibold text-slate-600">{names.length} klar{names.length === 1 ? "" : "e"}</p><button type="button" disabled={names.length < 2} onClick={() => makePairs()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-5 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"><Handshake className="h-4 w-4" />Lav makkere</button></article>
              <article className="rounded-[1.5rem] border border-sky-100 bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Fælles tid</p><h2 className="mt-1 text-2xl font-black text-[var(--skolegps-deep-navy)]">{formatSeconds(secondsLeft)}</h2></div><Clock3 className="h-10 w-10 text-sky-600" aria-hidden="true" /></div><div className="mt-5 grid grid-cols-3 gap-2">{[5, 10, 15].map((minutes) => <button key={minutes} type="button" onClick={() => { setSecondsLeft(minutes * 60); setTimerRunning(false); }} className="control justify-center">{minutes} min</button>)}</div><div className="mt-3 flex gap-2"><button type="button" onClick={() => setTimerRunning((value) => !value)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700"><Play className="h-4 w-4" />{timerRunning ? "Pause" : "Start timer"}</button><button type="button" aria-pressed={soundOn} onClick={() => setSoundOn((value) => !value)} className="inline-flex min-h-11 w-11 items-center justify-center rounded-full border border-sky-200 bg-white text-sky-900">{soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button></div>{secondsLeft === 0 ? <p role="status" className="mt-4 rounded-xl bg-amber-100 p-3 text-sm font-black text-amber-950">Tiden er gået.</p> : null}</article>
            </div>
            {pairings.length ? <article className="mt-5 rounded-[1.5rem] border border-sky-100 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-black text-[var(--skolegps-deep-navy)]">Dagens makkere</h2><button type="button" onClick={() => makePairs()} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 text-sm font-black text-sky-900"><RotateCw className="h-4 w-4" />Næste runde</button></div><ol className="mt-4 grid gap-2 sm:grid-cols-2">{pairings.map((pair) => <li key={`${pair.board}-${pair.white}`} className="rounded-xl bg-sky-50 px-4 py-3 font-bold text-slate-800"><span className="mr-3 text-xs font-black text-sky-700">BORD {pair.board}</span>{pair.black ? `${pair.white} – ${pair.black}` : `${pair.white} har fri`}</li>)}</ol></article> : null}
            <section className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><article className="rounded-[1.5rem] border border-sky-100 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Enkel turnering</p><h2 className="mt-1 text-2xl font-black text-[var(--skolegps-deep-navy)]">Runde {tournamentRound || "–"}</h2></div><button type="button" disabled={names.length < 2} onClick={startTournamentRound} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--skolegps-blue-strong)] px-5 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"><Flag className="h-4 w-4" />{tournamentRound ? "Ny runde" : "Start turnering"}</button></div>{currentTournamentMatches.length ? <div className="mt-5 space-y-3">{currentTournamentMatches.map((match) => <div key={match.board} className="rounded-xl border border-sky-100 p-4"><p className="text-sm font-black text-slate-800">Bord {match.board}: {match.white} – {match.black ?? "fri"}</p>{match.black ? <div className="mt-3 flex flex-wrap gap-2">{(["white", "draw", "black"] as MatchResult[]).map((result) => <button key={result} type="button" onClick={() => setMatchResult(match.board, result)} className={`rounded-full px-3 py-2 text-xs font-black ${match.result === result ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{result === "white" ? `${match.white} vandt` : result === "black" ? `${match.black} vandt` : "Remis"}</button>)}</div> : <p className="mt-2 text-sm font-semibold text-slate-600">Frirunde</p>}</div>)}</div> : <p className="mt-4 font-semibold leading-6 text-slate-600">Start, når navnene er klar. Systemet prøver at undgå samme modstander igen.</p>}</article><article className="rounded-[1.5rem] border border-sky-100 bg-white p-6 shadow-sm"><p className="text-xs font-black tracking-[0.16em] text-sky-700 uppercase">Stilling</p><h2 className="mt-1 text-2xl font-black text-[var(--skolegps-deep-navy)]">Point</h2><ol className="mt-4 space-y-2">{standings.length ? standings.map((standing, index) => <li key={standing.name} className="flex items-center justify-between rounded-xl bg-sky-50 px-4 py-3 font-bold"><span>{index + 1}. {standing.name}</span><span>{standing.points}</span></li>) : <li className="font-semibold text-slate-600">Tilføj navne for at se stillingen.</li>}</ol></article></section>
            <section className="mt-8"><h2 className="text-2xl font-black text-[var(--skolegps-deep-navy)]">Skaklege</h2><div className="mt-4 grid gap-4 md:grid-cols-3">{activities.map((activity) => <article key={activity.title} className="rounded-[1.5rem] border border-sky-100 bg-white p-5 shadow-sm"><Dumbbell className="h-6 w-6 text-sky-600" aria-hidden="true" /><h3 className="mt-3 text-xl font-black text-[var(--skolegps-deep-navy)]">{activity.title}</h3><p className="mt-1 text-sm font-black text-sky-700">{activity.time}</p><p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{activity.text}</p><button type="button" onClick={() => { const minutes = Number(activity.time); setSecondsLeft(minutes * 60); setTimerRunning(false); }} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 text-sm font-black text-sky-900"><Clock3 className="h-4 w-4" />Sæt timer</button></article>)}</div></section>
          </section>
        ) : null}
      </div>
      <style jsx>{`.control { display: inline-flex; min-height: 2.75rem; align-items: center; gap: .45rem; border-radius: .75rem; border: 1px solid rgb(186 230 253); background: rgb(240 249 255); padding: .5rem .65rem; font-size: .8rem; font-weight: 800; color: rgb(12 74 110); transition: background .15s ease; } .control:hover { background: rgb(224 242 254); }`}</style>
    </main>
  );
}

function PageIntro({ icon: Icon, title, text, compact = false }: { icon: typeof BookOpen; title: string; text: string; compact?: boolean }) {
  return <div className={compact ? "flex min-w-0 items-center gap-3" : "rounded-[1.5rem] border border-sky-100 bg-white p-6 shadow-sm"}><span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white"><Icon className="h-5 w-5" aria-hidden="true" /></span><div><h1 className={compact ? "text-2xl font-black text-[var(--skolegps-deep-navy)]" : "text-3xl font-black text-[var(--skolegps-deep-navy)]"}>{title}</h1><p className="mt-1 font-semibold leading-6 text-slate-700">{text}</p></div></div>;
}
