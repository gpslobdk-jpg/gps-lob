"use client";

import { AlertCircle, Eye, EyeOff, Loader2, RefreshCw, UserSearch } from "lucide-react";
import Link from "next/link";
import { Poppins, Rubik } from "next/font/google";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  discussion: "Samtale",
  voting: "Afstemning",
  results: "Resultater",
  finished: "Afsluttet",
};

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
    <main className={`min-h-screen bg-slate-100 px-6 py-8 text-slate-950 ${poppins.className}`}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center justify-center">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className={`mt-5 text-3xl font-black text-slate-950 ${rubik.className}`}>
            Vi kunne ikke finde dit spil
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-slate-600">{message}</p>
          <Link
            href="/find-bedrageren/join"
            className="mt-6 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
          >
            Tilbage til join
          </Link>
        </section>
      </div>
    </main>
  );
}

export default function FindBedragerenStudentLobbyPage() {
  const params = useParams<{ sessionId: string }>();
  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId ?? "";
  const [studentName, setStudentName] = useState("");
  const [phase, setPhase] = useState("lobby");
  const [canRevealRole, setCanRevealRole] = useState(false);
  const [waitingForTeacher, setWaitingForTeacher] = useState(false);
  const [roleView, setRoleView] = useState<RoleView | null>(null);
  const [isRoleVisible, setIsRoleVisible] = useState(false);
  const [error, setError] = useState("");
  const [revealError, setRevealError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  const phaseLabel = useMemo(() => phaseLabels[phase] ?? "Lobby", [phase]);

  const loadSession = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (!sessionId) {
        setError("Prøv at skrive koden igen.");
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (mode === "refresh") {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setError("");
      setRevealError("");

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

        setStudentName(nextStudentName);
        setPhase(nextPhase);
        setCanRevealRole(nextCanRevealRole);
        setWaitingForTeacher(Boolean(body.waitingForTeacher));

        if (body.participantId) {
          saveStoredParticipant(sessionId, body.participantId, nextStudentName);
        }

        if (mode === "refresh" || nextPhase === "lobby" || !nextCanRevealRole) {
          setRoleView(null);
          setIsRoleVisible(false);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Kunne ikke hente spillet.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

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

  if (isLoading) {
    return (
      <main className={`min-h-screen bg-slate-100 px-6 py-8 text-slate-950 ${poppins.className}`}>
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-amber-600" />
            <p className="mt-4 text-sm font-semibold text-slate-600">Henter spillet...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <main className={`min-h-screen bg-slate-100 px-6 py-8 text-slate-950 ${poppins.className}`}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center justify-center">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
            <UserSearch className="h-7 w-7" />
          </div>
          <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-amber-700">
            Find Bedrageren
          </p>
          <h1 className={`mt-3 text-4xl font-black text-slate-950 ${rubik.className}`}>
            Du er med i spillet.
          </h1>

          {phase === "lobby" ? (
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-slate-600">
              Vent på, at læreren starter.
            </p>
          ) : waitingForTeacher || !canRevealRole ? (
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-slate-600">
              Din rolle er ikke klar endnu. Vent på læreren.
            </p>
          ) : (
            <p className="mx-auto mt-4 max-w-xl text-lg leading-8 text-slate-600">
              Læreren har startet rollevisningen. Kig kun på din egen skærm.
            </p>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Navn</p>
              <p className="mt-2 text-xl font-black text-slate-950">{studentName}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Status</p>
              <p className="mt-2 text-xl font-black text-slate-950">{phaseLabel}</p>
            </div>
          </div>

          {canRevealRole ? (
            <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              {!isRoleVisible ? (
                <button
                  type="button"
                  onClick={() => void handleRevealRole()}
                  disabled={isRevealing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-lg font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:bg-slate-300"
                >
                  {isRevealing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Eye className="h-5 w-5" />}
                  {isRevealing ? "Henter rolle..." : "Se min rolle"}
                </button>
              ) : roleView?.role === "impostor" ? (
                <div>
                  <h2 className={`text-3xl font-black text-slate-950 ${rubik.className}`}>
                    Du er bedrageren.
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-base font-semibold leading-7 text-slate-700">
                    Du kender ikke det hemmelige ord. Lyt godt efter og prøv at blende ind.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-800">
                    Dit hemmelige ord er
                  </p>
                  <h2 className={`mt-3 text-4xl font-black text-slate-950 ${rubik.className}`}>
                    {roleView?.secretWord}
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-base font-semibold leading-7 text-slate-700">
                    Giv et hint uden at afsløre ordet direkte.
                  </p>
                </div>
              )}

              {isRoleVisible ? (
                <button
                  type="button"
                  onClick={() => setIsRoleVisible(false)}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-4 text-base font-black text-slate-900 shadow-sm transition hover:border-slate-500"
                >
                  <EyeOff className="h-5 w-5" />
                  Skjul igen
                </button>
              ) : null}

              {revealError ? (
                <p className="mt-4 rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold leading-6 text-amber-900">
                  {revealError}
                </p>
              ) : null}
            </section>
          ) : null}

          <button
            type="button"
            onClick={() => void loadSession("refresh")}
            disabled={isRefreshing}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:border-amber-400 hover:text-slate-950 disabled:cursor-wait disabled:opacity-60"
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isRefreshing ? "Opdaterer..." : "Opdater"}
          </button>
        </section>
      </div>
    </main>
  );
}
