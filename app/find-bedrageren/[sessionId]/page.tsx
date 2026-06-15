"use client";

import {
  AlertCircle,
  BadgeCheck,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Shield,
  Trophy,
  UserCheck,
  UserSearch,
} from "lucide-react";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type SessionResponse = {
  sessionId?: string;
  participantId?: string;
  studentName?: string;
  phase?: string;
  sessionStatus?: string | null;
  canRevealRole?: boolean;
  hasSeenRole?: boolean;
  waitingForTeacher?: boolean;
  players?: PlayerOption[];
  result?: FindBedragerenResult | null;
  error?: string;
};

type RevealResponse = {
  studentName?: string;
  phase?: string;
  role?: "civilian" | "impostor";
  secretWord?: string;
  hasSeenRole?: boolean;
  error?: string;
};

type VoteResponse = {
  ok?: boolean;
  status?: "created" | "updated";
  error?: string;
};

type PlayerOption = {
  participantId: string;
  studentName: string;
};

type FindBedragerenResultSuspect = {
  participantId: string;
  studentName: string;
  voteCount: number;
  isImpostor?: boolean;
};

type FindBedragerenResult = {
  topSuspectParticipantId: string | null;
  topSuspectName: string | null;
  topSuspectIsImpostor: boolean | null;
  voteCount: number;
  totalVotes: number;
  tied: boolean;
  suspects: FindBedragerenResultSuspect[];
};

type StoredParticipant = {
  participantId?: unknown;
  studentName?: unknown;
  savedAt?: unknown;
};

type RoleView = {
  role: "civilian" | "impostor";
  secretWord?: string;
};

const phaseLabels: Record<string, string> = {
  lobby: "Lobby",
  reveal: "Rollevisning",
  discussion: "Diskussion",
  voting: "Afstemning",
  results: "Resultater",
  finished: "Afsluttet",
};

const AUTO_REFRESH_INTERVAL_MS = 2500;

type LoadSessionMode = "initial" | "refresh" | "poll";

const civilianRules = [
  "Giv hints",
  "Lyt til de andre",
  "Prøv at afsløre hvem der bluffer",
  "Sig ikke ordet direkte, hvis læreren beder jer undgå det",
];

const impostorRules = [
  "Lyt til de andres hints",
  "Prøv at virke som om du kender ordet",
  "Stil spørgsmål forsigtigt",
  "Undgå at blive afsløret",
];

function storageKey(sessionId: string) {
  return `find_bedrageren_participant_${sessionId}`;
}

function readStoredParticipant(sessionId: string) {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = window.localStorage.getItem(storageKey(sessionId));
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as StoredParticipant;
    const participantId = typeof parsed.participantId === "string" ? parsed.participantId : "";
    const studentName = typeof parsed.studentName === "string" ? parsed.studentName : "";

    if (!participantId) return null;

    return {
      participantId,
      studentName,
    };
  } catch {
    return null;
  }
}

function saveStoredParticipant(sessionId: string, participantId: string, studentName: string) {
  try {
    window.localStorage.setItem(
      storageKey(sessionId),
      JSON.stringify({
        participantId,
        studentName,
        savedAt: new Date().toISOString(),
      })
    );
  } catch {
    // Cookie-fallback er nok til at holde eleven i spillet.
  }
}

function ErrorState({ message }: { message: string }) {
  return (
    <main className={`fb-stage min-h-screen px-5 py-7 text-white sm:px-6 sm:py-8 ${poppins.className}`}>
      <GameAtmosphereStyles />
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl items-center justify-center">
        <section className="fb-glass-shell w-full overflow-hidden rounded-[1.75rem] border border-white/15 shadow-2xl">
          <div className="fb-hero-band px-6 py-8 text-center text-white sm:px-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/30 bg-amber-300/15 text-amber-100">
              <AlertCircle className="h-7 w-7" />
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-amber-100">
              Find Bedrageren
            </p>
            <h1 className={`mt-3 text-3xl font-black ${rubik.className}`}>
              Vi kunne ikke finde dit spil
            </h1>
          </div>
          <div className="px-6 py-7 text-center sm:px-8">
            <p className="mx-auto max-w-lg text-base font-semibold leading-7 text-slate-200">{message}</p>
            <Link
              href="/find-bedrageren/join"
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-amber-950/30 transition hover:bg-amber-200"
            >
              Tilbage til join
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function GameAtmosphereStyles() {
  return (
    <style jsx global>{`
      .fb-stage {
        position: relative;
        isolation: isolate;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% -12%, rgba(251, 191, 36, 0.2), transparent 34rem),
          radial-gradient(circle at 16% 18%, rgba(190, 18, 60, 0.2), transparent 30rem),
          radial-gradient(circle at 86% 20%, rgba(16, 185, 129, 0.16), transparent 30rem),
          linear-gradient(135deg, #080812 0%, #12101c 46%, #081411 100%);
      }

      .fb-stage::before {
        content: "";
        position: absolute;
        inset: -18% -12%;
        z-index: 0;
        pointer-events: none;
        background:
          radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.16), transparent 32rem),
          radial-gradient(ellipse at 18% 78%, rgba(244, 63, 94, 0.13), transparent 28rem),
          radial-gradient(ellipse at 86% 80%, rgba(52, 211, 153, 0.11), transparent 28rem);
        filter: blur(2px);
        animation: fb-spotlight-drift 10s ease-in-out infinite alternate;
      }

      .fb-stage::after {
        content: "";
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        opacity: 0.2;
        background-image:
          linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);
        background-size: 64px 64px;
        mask-image: radial-gradient(circle at center, black 0%, transparent 72%);
      }

      .fb-stage > * {
        position: relative;
        z-index: 1;
      }

      .fb-glass-shell {
        background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.74));
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.38);
        backdrop-filter: blur(22px);
      }

      .fb-hero-band {
        position: relative;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 0%, rgba(251, 191, 36, 0.2), transparent 26rem),
          linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(88, 28, 135, 0.55), rgba(15, 23, 42, 0.98));
      }

      .fb-hero-band::after {
        content: "";
        position: absolute;
        inset: auto 8% -38% 8%;
        height: 68%;
        pointer-events: none;
        background: radial-gradient(ellipse, rgba(251, 191, 36, 0.2), transparent 62%);
        animation: fb-soft-pulse 3.8s ease-in-out infinite;
      }

      .fb-status-tile,
      .fb-suspense-panel,
      .fb-phase-panel {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.14);
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
        backdrop-filter: blur(18px);
      }

      .fb-suspense-card {
        position: relative;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 0%, rgba(251, 191, 36, 0.18), transparent 20rem),
          linear-gradient(145deg, rgba(2, 6, 23, 0.98), rgba(30, 41, 59, 0.92));
      }

      .fb-suspense-card::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        padding: 1px;
        background: linear-gradient(120deg, rgba(251, 191, 36, 0.7), rgba(255, 255, 255, 0.12), rgba(244, 63, 94, 0.5));
        mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
        mask-composite: exclude;
        pointer-events: none;
      }

      .fb-suspense-card::after {
        content: "";
        position: absolute;
        inset: -40% -80%;
        background: linear-gradient(110deg, transparent 42%, rgba(255, 255, 255, 0.2) 50%, transparent 58%);
        transform: translateX(-45%);
        animation: fb-shimmer 4.8s ease-in-out infinite;
        pointer-events: none;
      }

      .fb-reveal-button {
        box-shadow: 0 18px 36px rgba(251, 191, 36, 0.18), 0 0 0 1px rgba(251, 191, 36, 0.28);
        animation: fb-button-glow 2.8s ease-in-out infinite;
      }

      .fb-role-card,
      .fb-result-stage {
        animation: fb-reveal-card 420ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
      }

      .fb-role-civilian {
        background:
          radial-gradient(circle at 50% -10%, rgba(52, 211, 153, 0.28), transparent 21rem),
          linear-gradient(145deg, rgba(5, 46, 22, 0.96), rgba(6, 78, 59, 0.86));
        border-color: rgba(110, 231, 183, 0.34);
      }

      .fb-role-impostor {
        background:
          radial-gradient(circle at 50% -10%, rgba(251, 191, 36, 0.18), transparent 22rem),
          radial-gradient(circle at 12% 18%, rgba(244, 63, 94, 0.2), transparent 20rem),
          linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(76, 29, 149, 0.72));
        border-color: rgba(251, 191, 36, 0.32);
      }

      .fb-vote-card {
        position: relative;
        overflow: hidden;
      }

      .fb-vote-card-selected::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: radial-gradient(circle at 92% 20%, rgba(251, 191, 36, 0.22), transparent 11rem);
      }

      .fb-result-stage {
        position: relative;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% -8%, rgba(251, 191, 36, 0.26), transparent 24rem),
          radial-gradient(circle at 10% 18%, rgba(244, 63, 94, 0.2), transparent 22rem),
          linear-gradient(145deg, rgba(2, 6, 23, 0.98), rgba(30, 41, 59, 0.88));
      }

      .fb-result-stage::before {
        content: "";
        position: absolute;
        inset: -50% -20% auto -20%;
        height: 70%;
        pointer-events: none;
        background: conic-gradient(from 180deg, transparent, rgba(251, 191, 36, 0.24), transparent, rgba(244, 63, 94, 0.18), transparent);
        animation: fb-result-light 8s linear infinite;
      }

      @keyframes fb-spotlight-drift {
        from {
          transform: translate3d(-1.5%, -1%, 0) scale(1);
        }

        to {
          transform: translate3d(1.5%, 1%, 0) scale(1.03);
        }
      }

      @keyframes fb-soft-pulse {
        0%,
        100% {
          opacity: 0.55;
          transform: scale(0.98);
        }

        50% {
          opacity: 1;
          transform: scale(1.05);
        }
      }

      @keyframes fb-shimmer {
        0%,
        58% {
          transform: translateX(-45%);
        }

        100% {
          transform: translateX(45%);
        }
      }

      @keyframes fb-button-glow {
        0%,
        100% {
          transform: translateY(0);
          box-shadow: 0 18px 36px rgba(251, 191, 36, 0.18), 0 0 0 1px rgba(251, 191, 36, 0.28);
        }

        50% {
          transform: translateY(-1px);
          box-shadow: 0 22px 46px rgba(251, 191, 36, 0.26), 0 0 0 3px rgba(251, 191, 36, 0.16);
        }
      }

      @keyframes fb-reveal-card {
        from {
          opacity: 0;
          transform: translateY(14px) scale(0.985);
        }

        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes fb-result-light {
        from {
          transform: rotate(0deg);
        }

        to {
          transform: rotate(360deg);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .fb-stage::before,
        .fb-hero-band::after,
        .fb-suspense-card::after,
        .fb-reveal-button,
        .fb-role-card,
        .fb-result-stage,
        .fb-result-stage::before {
          animation: none;
        }
      }
    `}</style>
  );
}

export default function FindBedragerenStudentLobbyPage() {
  const params = useParams<{ sessionId: string }>();
  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId ?? "";
  const [participantId, setParticipantId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [phase, setPhase] = useState("lobby");
  const [canRevealRole, setCanRevealRole] = useState(false);
  const [waitingForTeacher, setWaitingForTeacher] = useState(false);
  const [roleView, setRoleView] = useState<RoleView | null>(null);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [result, setResult] = useState<FindBedragerenResult | null>(null);
  const [selectedSuspectParticipantId, setSelectedSuspectParticipantId] = useState("");
  const [isRoleVisible, setIsRoleVisible] = useState(false);
  const [error, setError] = useState("");
  const [revealError, setRevealError] = useState("");
  const [voteError, setVoteError] = useState("");
  const [voteMessage, setVoteMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const loadInFlightRef = useRef(false);

  const phaseLabel = useMemo(() => phaseLabels[phase] ?? "Lobby", [phase]);

  const loadSession = useCallback(
    async (mode: LoadSessionMode = "initial") => {
      if (!sessionId) {
        setError("Prøv at skrive koden igen.");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (loadInFlightRef.current) {
        return;
      }

      loadInFlightRef.current = true;

      if (mode === "refresh") {
        setIsRefreshing(true);
      } else if (mode === "initial") {
        setIsLoading(true);
      }

      if (mode !== "poll") {
        setError("");
        setRevealError("");
        setVoteError("");
      }

      const stored = readStoredParticipant(sessionId);

      try {
        const participantQuery = stored?.participantId
          ? `&participantId=${encodeURIComponent(stored.participantId)}`
          : "";
        const response = await fetch(
          `/api/find-bedrageren/session?sessionId=${encodeURIComponent(sessionId)}${participantQuery}`,
          { cache: "no-store" }
        );
        const body = (await response.json()) as SessionResponse;

        if (!response.ok) {
          throw new Error(body.error || "Kunne ikke hente spillet.");
        }

        const nextStudentName = body.studentName ?? stored?.studentName ?? "Elev";
        const nextPhase = body.phase ?? "lobby";
        const nextCanRevealRole = Boolean(body.canRevealRole);
        const nextParticipantId = body.participantId ?? stored?.participantId ?? "";

        setParticipantId(nextParticipantId);
        setStudentName(nextStudentName);
        setPhase(nextPhase);
        setCanRevealRole(nextCanRevealRole);
        setWaitingForTeacher(Boolean(body.waitingForTeacher));
        const nextPlayers = body.players ?? [];
        setPlayers(nextPlayers);
        setResult(nextPhase === "results" ? body.result ?? null : null);

        if (nextPhase === "voting") {
          setSelectedSuspectParticipantId((currentSuspectId) =>
            nextPlayers.some((player) => player.participantId === currentSuspectId) ? currentSuspectId : ""
          );
        } else {
          setSelectedSuspectParticipantId("");
          setVoteMessage("");
        }

        if (nextParticipantId) {
          saveStoredParticipant(sessionId, nextParticipantId, nextStudentName);
        }

        if (mode === "refresh" || nextPhase === "lobby" || !nextCanRevealRole) {
          setRoleView(null);
          setIsRoleVisible(false);
        }
      } catch (loadError) {
        if (mode !== "poll") {
          setError(loadError instanceof Error ? loadError.message : "Kunne ikke hente spillet.");
        }
      } finally {
        loadInFlightRef.current = false;
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!sessionId || phase === "finished") {
      return;
    }

    const isPageVisible = () =>
      typeof document === "undefined" || document.visibilityState === "visible";

    const pollSession = () => {
      if (!isPageVisible()) {
        return;
      }

      void loadSession("poll");
    };

    const intervalId = window.setInterval(pollSession, AUTO_REFRESH_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (isPageVisible()) {
        pollSession();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadSession, phase, sessionId]);

  async function handleRevealRole() {
    if (roleView) {
      setIsRoleVisible(true);
      return;
    }

    const stored = sessionId ? readStoredParticipant(sessionId) : null;
    setRevealError("");
    setIsRevealing(true);

    try {
      const response = await fetch("/api/find-bedrageren/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          participantId: stored?.participantId,
          action: "reveal",
        }),
      });
      const body = (await response.json()) as RevealResponse;

      if (!response.ok) {
        throw new Error(body.error || "Kunne ikke vise rollen.");
      }

      if (body.role !== "civilian" && body.role !== "impostor") {
        throw new Error("Din rolle er ikke klar endnu. Vent på læreren.");
      }

      if (body.role === "civilian" && !body.secretWord) {
        throw new Error("Dit ord er ikke klar endnu. Prøv igen om lidt.");
      }

      setStudentName(body.studentName ?? studentName);
      setPhase(body.phase ?? phase);
      setRoleView(
        body.role === "civilian"
          ? { role: body.role, secretWord: body.secretWord }
          : { role: body.role }
      );
      setCanRevealRole(true);
      setWaitingForTeacher(false);
      setIsRoleVisible(true);
    } catch (revealRoleError) {
      setRevealError(
        revealRoleError instanceof Error ? revealRoleError.message : "Kunne ikke vise rollen."
      );
    } finally {
      setIsRevealing(false);
    }
  }

  async function handleSubmitVote() {
    const stored = sessionId ? readStoredParticipant(sessionId) : null;
    const voterParticipantId = participantId || stored?.participantId || "";
    setVoteError("");
    setVoteMessage("");

    if (!voterParticipantId) {
      setVoteError("Deltageren kunne ikke findes. Prøv at joine igen.");
      return;
    }

    if (!selectedSuspectParticipantId) {
      setVoteError("Vælg en spiller først.");
      return;
    }

    if (selectedSuspectParticipantId === voterParticipantId) {
      setVoteError("Du kan ikke stemme på dig selv.");
      return;
    }

    setIsSubmittingVote(true);

    try {
      const response = await fetch("/api/find-bedrageren/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          participantId: voterParticipantId,
          suspectParticipantId: selectedSuspectParticipantId,
        }),
      });
      const body = (await response.json()) as VoteResponse;

      if (!response.ok) {
        throw new Error(body.error || "Kunne ikke gemme stemmen.");
      }

      setVoteMessage(body.status === "updated" ? "Din stemme er opdateret" : "Din stemme er registreret");
    } catch (submitError) {
      setVoteError(submitError instanceof Error ? submitError.message : "Kunne ikke gemme stemmen.");
    } finally {
      setIsSubmittingVote(false);
    }
  }

  if (isLoading) {
    return (
      <main className={`fb-stage min-h-screen px-5 py-7 text-white sm:px-6 sm:py-8 ${poppins.className}`}>
        <GameAtmosphereStyles />
        <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl items-center justify-center">
          <div className="fb-glass-shell w-full rounded-[1.75rem] border border-white/15 p-8 text-center shadow-2xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-200" />
            <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-slate-500">
              Find Bedrageren
            </p>
            <p className="mt-3 text-lg font-black text-white">Henter spillet...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  const isDiscussion = phase === "discussion";
  const isVoting = phase === "voting";
  const isResults = phase === "results";
  const isFinished = phase === "finished";
  const visibleRole = isRoleVisible ? roleView : null;
  const isImpostor = visibleRole?.role === "impostor";
  const resultHeadline =
    !result || result.totalVotes === 0
      ? "Der blev ikke registreret nogen stemmer."
      : result.tied
        ? "Der er stemmelighed."
        : `Flest stemmer gik til: ${result.topSuspectName ?? "Ukendt"}`;
  const resultOutcome =
    result && !result.tied && result.totalVotes > 0
      ? result.topSuspectIsImpostor
        ? "I fandt bedrageren"
        : "Bedrageren slap igennem"
      : "";
  const orderedSuspects = result?.suspects
    ? [...result.suspects].sort((firstSuspect, secondSuspect) => secondSuspect.voteCount - firstSuspect.voteCount)
    : [];
  const discussionDescription =
    visibleRole?.role === "civilian"
      ? "Du kender ordet. Giv hints, lyt til de andre og prøv at finde bedrageren."
      : visibleRole?.role === "impostor"
        ? "Du kender ikke ordet. Lyt godt efter, bluff roligt og prøv ikke at blive afsløret."
        : "Se din rolle først, hvis du ikke har nået det. Din rolle er privat.";
  const showWaitingForTeacher = phase === "lobby";
  const showRoleNotReady = !showWaitingForTeacher && (waitingForTeacher || !canRevealRole);
  const statusTitle = isResults
    ? "Afsløringen er klar"
    : isVoting
      ? "Afgør mistanken"
      : isDiscussion
        ? "Mistanken breder sig"
        : showWaitingForTeacher
          ? "Klar til mission"
          : showRoleNotReady
            ? "Rollekortet lades"
            : "Rollekortet er låst op";
  const statusDescription = isResults
    ? resultOutcome || resultHeadline
    : isVoting
      ? "Vælg den person, du tror er bedrageren."
      : isDiscussion
        ? discussionDescription
        : showWaitingForTeacher
          ? "Bliv på siden. Når læreren starter spillet, får du dit private rollekort her."
          : showRoleNotReady
            ? "Vent på læreren. Rollekortet åbner, når rollerne er fordelt."
            : "Kig for dig selv. Din rolle er privat, indtil du vælger at afsløre den.";
  const selectablePlayers = players.filter((player) => player.participantId !== participantId);

  if (isFinished) {
    return (
      <main className={`fb-stage min-h-screen px-5 py-7 text-white sm:px-6 sm:py-8 ${poppins.className}`}>
        <GameAtmosphereStyles />
        <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-2xl items-center justify-center">
          <section className="fb-glass-shell w-full overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl">
            <div className="fb-hero-band px-6 py-9 text-center text-white sm:px-8 sm:py-11">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-300 text-slate-950 shadow-lg shadow-amber-950/30">
                <Trophy className="h-7 w-7" />
              </div>
              <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-amber-100">
                Find Bedrageren
              </p>
              <h1 className={`mt-3 text-4xl font-black leading-tight sm:text-5xl ${rubik.className}`}>
                Spillet er slut
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base font-semibold leading-7 text-slate-200">
                Tak for spillet. Vent på læreren, hvis I skal spille igen.
              </p>
            </div>

            <div className="px-5 py-6 text-center sm:px-8 sm:py-8">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="fb-status-tile rounded-2xl p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Navn</p>
                  <p className="mt-2 truncate text-xl font-black text-white">{studentName}</p>
                </div>
                <div className="fb-status-tile rounded-2xl p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Status</p>
                  <p className="mt-2 text-xl font-black text-white">{phaseLabel}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void loadSession("refresh")}
                disabled={isRefreshing}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {isRefreshing ? "Opdaterer..." : "Opdater"}
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={`fb-stage min-h-screen px-5 py-7 text-white sm:px-6 sm:py-8 ${poppins.className}`}>
      <GameAtmosphereStyles />
      <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl items-center justify-center">
        <section className="fb-glass-shell w-full overflow-hidden rounded-[2rem] border border-white/15 shadow-2xl">
          <div className="fb-hero-band px-6 py-8 text-center text-white sm:px-8 sm:py-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200/30 bg-amber-300/15 text-amber-100 shadow-lg shadow-black/20">
              {isResults ? (
                <Trophy className="h-7 w-7" />
              ) : isVoting || isDiscussion || isImpostor ? (
                <UserSearch className="h-7 w-7" />
              ) : visibleRole?.role === "civilian" ? (
                <UserCheck className="h-7 w-7" />
              ) : (
                <Shield className="h-7 w-7" />
              )}
            </div>
            <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-amber-100">
              Find Bedrageren
            </p>
            <h1 className={`mt-3 text-4xl font-black leading-tight sm:text-5xl ${rubik.className}`}>
              {statusTitle}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base font-semibold leading-7 text-slate-200">
              {statusDescription}
            </p>
          </div>

          <div className="px-5 py-6 sm:px-8 sm:py-8">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="fb-status-tile rounded-2xl p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Navn</p>
                <p className="mt-2 truncate text-xl font-black text-white">{studentName}</p>
              </div>
              <div className="fb-status-tile rounded-2xl p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">Status</p>
                <p className="mt-2 text-xl font-black text-white">{phaseLabel}</p>
              </div>
            </div>

            <div className="fb-phase-panel mt-5 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950">
                  <BadgeCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Du er med i spillet</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-200">
                    Bliv på siden, så er du klar, når læreren går videre.
                  </p>
                </div>
              </div>
            </div>

            {showWaitingForTeacher ? (
              <section className="fb-suspense-panel mt-5 rounded-[1.5rem] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-200/30 bg-amber-300/15 text-amber-100">
                    <Shield className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-100">
                      Klar til mission
                    </p>
                    <h2 className={`mt-2 text-2xl font-black leading-tight text-white ${rubik.className}`}>
                      Vent på startsignalet
                    </h2>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-200">
                      Når læreren fordeler roller, åbner dit private rollekort her på siden. Siden
                      opdaterer automatisk, når læreren starter spillet.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {showRoleNotReady ? (
              <section className="fb-suspense-panel mt-5 rounded-[1.5rem] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-slate-100">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-300">
                      Rollekort venter
                    </p>
                    <h2 className={`mt-2 text-2xl font-black leading-tight text-white ${rubik.className}`}>
                      Læreren gør rollerne klar
                    </h2>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-200">
                      Bliv på siden. Knappen til rolleafsløring vises automatisk, når dit kort er klar.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {isDiscussion ? (
              <section className="fb-suspense-panel mt-5 rounded-[1.5rem] p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-200/30 bg-rose-400/15 text-rose-100">
                    <UserSearch className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.16em] text-rose-100">
                      Diskussion
                    </p>
                    <h2 className={`mt-2 text-2xl font-black leading-tight text-white ${rubik.className}`}>
                      Mistanken breder sig
                    </h2>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-200">
                      Hold din rolle privat, lyt til de andre og brug kun de hints, din rolle giver dig.
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {canRevealRole ? (
              <section className="mt-6 overflow-hidden rounded-[1.5rem] border border-white/15 bg-slate-950/70 p-5 text-white shadow-2xl sm:p-6">
                {!isRoleVisible ? (
                  <div className="fb-suspense-card rounded-[1.25rem] p-5 sm:p-6">
                    <div className="relative z-10">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/30 bg-amber-300/15 text-amber-100 shadow-lg shadow-black/30">
                        <Shield className="h-8 w-8" />
                      </div>
                      <div className="mx-auto mt-5 max-w-xl text-center">
                        <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-100">
                          Hemmeligt rollekort
                        </p>
                        <h2 className={`mt-3 text-3xl font-black leading-tight text-white ${rubik.className}`}>
                          Afslør kun for dig selv
                        </h2>
                        <p className="mt-4 text-base font-semibold leading-7 text-slate-200">
                          {isDiscussion
                            ? "Diskussionen er startet. Se din rolle, hvis du ikke har gjort det endnu."
                            : "Kortet er låst op. Tryk, når ingen andre kigger med."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRevealRole()}
                        disabled={isRevealing}
                        className="fb-reveal-button mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-4 text-lg font-black text-slate-950 transition hover:bg-amber-200 disabled:cursor-wait disabled:bg-slate-300 sm:py-5"
                      >
                        {isRevealing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Eye className="h-5 w-5" />}
                        {isRevealing ? "Afslører rolle..." : "Afslør min rolle"}
                      </button>
                    </div>
                  </div>
                ) : roleView?.role === "impostor" ? (
                  <div className="fb-role-card fb-role-impostor rounded-[1.25rem] border p-5 text-center shadow-2xl sm:p-6">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-200/30 bg-slate-950/80 text-amber-100 shadow-lg shadow-black/30">
                      <UserSearch className="h-7 w-7" />
                    </div>
                    <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-amber-100">
                      Din rolle
                    </p>
                    <h2 className={`mt-3 text-4xl font-black leading-tight text-white ${rubik.className}`}>
                      Du er bedrageren
                    </h2>
                    <p className="mx-auto mt-4 max-w-xl text-base font-semibold leading-7 text-slate-200">
                      Du kender ikke ordet. Lyt godt efter, bluff roligt og prøv ikke at blive afsløret.
                    </p>
                    <ul className="mt-5 grid gap-3 text-left sm:grid-cols-2">
                      {impostorRules.map((rule) => (
                        <li
                          key={rule}
                          className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold leading-6 text-slate-100"
                        >
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="fb-role-card fb-role-civilian rounded-[1.25rem] border p-5 text-center shadow-2xl sm:p-6">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100/40 bg-emerald-300/20 text-emerald-50 shadow-lg shadow-black/20">
                      <UserCheck className="h-7 w-7" />
                    </div>
                    <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-emerald-100">
                      Din rolle
                    </p>
                    <h2 className={`mt-3 text-4xl font-black leading-tight text-white ${rubik.className}`}>
                      Du kender ordet
                    </h2>
                    <div className="mx-auto mt-5 max-w-xl rounded-[1.5rem] border border-emerald-100/35 bg-white/95 p-5 text-center text-slate-950 shadow-lg shadow-emerald-950/20">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-800">
                        Det hemmelige ord
                      </p>
                      <p className={`mt-3 text-4xl font-black text-slate-950 ${rubik.className}`}>
                        {roleView?.secretWord}
                      </p>
                    </div>
                    <p className="mx-auto mt-5 max-w-xl text-base font-semibold leading-7 text-emerald-50">
                      {isDiscussion
                        ? "Du kender ordet. Giv hints, lyt til de andre og prøv at finde bedrageren."
                        : "Du skal hjælpe med at finde bedrageren uden at gøre det for nemt."}
                    </p>
                    <ul className="mt-5 grid gap-3 text-left sm:grid-cols-2">
                      {civilianRules.map((rule) => (
                        <li
                          key={rule}
                          className="rounded-2xl border border-emerald-100/25 bg-white/10 px-4 py-3 text-sm font-bold leading-6 text-emerald-50"
                        >
                          {rule}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isRoleVisible ? (
                  <button
                    type="button"
                    onClick={() => setIsRoleVisible(false)}
                    className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-white/15"
                  >
                    <EyeOff className="h-5 w-5" />
                    Skjul igen
                  </button>
                ) : null}

                {revealError ? (
                  <p className="mt-4 rounded-2xl border border-amber-200/40 bg-amber-300/10 px-4 py-3 text-sm font-bold leading-6 text-amber-50">
                    {revealError}
                  </p>
                ) : null}
              </section>
            ) : null}

            {isVoting ? (
              <section className="fb-suspense-panel mt-6 rounded-[1.5rem] p-5 sm:p-6">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.16em] text-amber-100">Afstemning</p>
                  <h2 className={`mt-2 text-3xl font-black text-white ${rubik.className}`}>
                    Stem på den, du tror er bedrageren
                  </h2>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-200">
                    Vælg én af de andre spillere. Du kan ændre din stemme, så længe afstemningen er i gang.
                  </p>
                </div>

                {selectablePlayers.length > 0 ? (
                  <div className="mt-5 grid gap-3">
                    {selectablePlayers.map((player, index) => {
                      const isSelected = selectedSuspectParticipantId === player.participantId;

                      return (
                        <button
                          key={player.participantId}
                          type="button"
                          onClick={() => {
                            setSelectedSuspectParticipantId(player.participantId);
                            setVoteError("");
                            setVoteMessage("");
                          }}
                          aria-pressed={isSelected}
                          className={`fb-vote-card rounded-2xl border px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/40 ${
                            isSelected
                              ? "fb-vote-card-selected border-amber-300 bg-amber-300/15 text-white shadow-lg shadow-black/20"
                              : "border-white/15 bg-white/10 text-slate-100 hover:border-white/30 hover:bg-white/15"
                          }`}
                        >
                          <span className="relative z-10 flex items-center gap-3">
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
                                isSelected ? "bg-amber-300 text-slate-950" : "bg-white/10 text-slate-200"
                              }`}
                            >
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-base font-black">{player.studentName}</span>
                              <span className="mt-1 block text-xs font-black uppercase tracking-[0.14em] text-slate-300">
                                Kandidat
                              </span>
                            </span>
                            {isSelected ? (
                              <span className="rounded-full bg-amber-300 px-3 py-1 text-xs font-black text-slate-950">
                                Valgt
                              </span>
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-5 rounded-2xl border border-amber-200/40 bg-amber-300/10 px-4 py-3 text-sm font-bold leading-6 text-amber-50">
                    Der er ikke andre spillere at stemme på endnu.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => void handleSubmitVote()}
                  disabled={isSubmittingVote || !selectedSuspectParticipantId || selectablePlayers.length === 0}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-4 text-base font-black text-slate-950 shadow-lg shadow-black/20 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-slate-100"
                >
                  {isSubmittingVote ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                  {isSubmittingVote ? "Gemmer stemme..." : "Afgiv stemme"}
                </button>

                {voteMessage ? (
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200/35 bg-emerald-400/10 px-4 py-3 text-sm font-bold leading-6 text-emerald-50">
                    <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    <p>{voteMessage}</p>
                  </div>
                ) : null}

                {voteError ? (
                  <p className="mt-4 rounded-2xl border border-amber-200/40 bg-amber-300/10 px-4 py-3 text-sm font-bold leading-6 text-amber-50">
                    {voteError}
                  </p>
                ) : null}
              </section>
            ) : null}

            {isResults ? (
              <section className="fb-result-stage mt-6 rounded-[1.75rem] border border-white/15 text-white shadow-2xl">
                <div className="relative z-10 border-b border-white/10 px-5 py-7 text-center sm:px-6 sm:py-8">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-300 text-slate-950 shadow-lg shadow-black/30">
                    <Trophy className="h-8 w-8" />
                  </div>
                  <p className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-amber-100">
                    Resultat
                  </p>
                  <h2 className={`mx-auto mt-3 max-w-xl text-4xl font-black leading-tight sm:text-5xl ${rubik.className}`}>
                    {resultOutcome || resultHeadline}
                  </h2>
                  {resultOutcome ? (
                    <p className="mx-auto mt-4 max-w-xl text-base font-bold leading-7 text-slate-200">
                      {resultHeadline}
                    </p>
                  ) : null}
                </div>

                {orderedSuspects.length > 0 ? (
                  <div className="relative z-10 p-4 sm:p-5">
                    <p className="px-1 text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                      Stemmeliste
                    </p>
                    <ul className="mt-3 grid gap-3">
                      {orderedSuspects.map((suspect, index) => (
                        <li
                          key={suspect.participantId}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/12 bg-white/10 px-4 py-4 shadow-sm"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-black text-white">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-base font-black text-white">{suspect.studentName}</p>
                              {suspect.isImpostor ? (
                                <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-amber-100">
                                  Bedrager
                                </p>
                              ) : (
                                <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
                                  Civil
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-white">
                            {suspect.voteCount} stemme{suspect.voteCount === 1 ? "" : "r"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            <button
              type="button"
              onClick={() => void loadSession("refresh")}
              disabled={isRefreshing}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-white/15 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {isRefreshing ? "Opdaterer..." : "Opdater"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
