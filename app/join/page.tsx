"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Poppins, Rubik } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, KeyRound, Leaf, Loader2, Timer, User } from "lucide-react";

import {
  type RunScheduleGate,
  type RunSchedule,
} from "@/utils/runSchedule";
import { saveStoredActiveParticipant } from "@/components/play/playUtils";
import { createClient } from "@/utils/supabase/client";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type JoinView = "form" | "waiting" | "scheduled" | "expired" | "scheduleError";

type JoinLookupResponse =
  | {
      kind: "invalid";
    }
  | {
      kind: "finished";
      runTitle: string;
      schedule: RunSchedule | null;
      scheduleGate: RunScheduleGate;
    }
  | {
      kind: "active";
      sessionId: string;
      sessionStatus: string | null;
      runTitle: string;
      schedule: RunSchedule | null;
      scheduleGate: RunScheduleGate;
    };

type JoinLookupErrorResponse = {
  error?: string;
};

type JoinParticipantResponse = {
  participantId: string;
  sessionId: string;
  studentName: string;
};

const formatLongDate = (value: string | null | undefined) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatClockTime = (value: string | null | undefined) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());

  const [pin, setPin] = useState(() =>
    (searchParams.get("pin") || "").replace(/\D/g, "").slice(0, 6)
  );
  const [name, setName] = useState("");
  const [view, setView] = useState<JoinView>("form");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [runTitle, setRunTitle] = useState("");
  const [schedule, setSchedule] = useState<RunSchedule | null>(null);

  const trimmedName = name.trim();
  const trimmedPin = pin.trim();
  const canSubmit = trimmedPin.length > 0 && trimmedName.length > 0;

  useEffect(() => {
    if (!sessionId || (view !== "waiting" && view !== "scheduled")) return;

    const channel = supabase
      .channel(`session-status-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const nextStatus = (payload.new as { status?: string | null }).status ?? null;

          if (nextStatus === "finished") {
            setView("expired");
            return;
          }

          if (nextStatus === "running") {
            router.push(`/play/${sessionId}?name=${encodeURIComponent(name.trim())}`);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [view, sessionId, name, router, supabase]);

  useEffect(() => {
    if (view !== "scheduled" || !sessionId || !schedule?.startAt) return;

    const startAtMs = Date.parse(schedule.startAt);
    if (!Number.isFinite(startAtMs)) {
      return;
    }

    const timeUntilStart = startAtMs - Date.now();
    if (timeUntilStart <= 0) {
      router.push(`/play/${sessionId}?name=${encodeURIComponent(name.trim())}`);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.push(`/play/${sessionId}?name=${encodeURIComponent(name.trim())}`);
    }, timeUntilStart);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [view, sessionId, name, schedule?.startAt, router]);

  useEffect(() => {
    if (!schedule?.endAt || (view !== "waiting" && view !== "scheduled")) return;

    const endAtMs = Date.parse(schedule.endAt);
    if (!Number.isFinite(endAtMs)) {
      return;
    }

    if (Date.now() >= endAtMs) {
      setView("expired");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setView("expired");
    }, endAtMs - Date.now());

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [view, schedule?.endAt]);

  const resetToForm = () => {
    setView("form");
    setError("");
    setSessionId(null);
    setRunTitle("");
    setSchedule(null);
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!trimmedPin || !trimmedName) {
      setError("Udfyld venligst både pinkode og navn.");
      return;
    }

    try {
      const response = await fetch(`/api/join?pin=${encodeURIComponent(trimmedPin)}`);
      const joinData = (await response.json()) as JoinLookupResponse | JoinLookupErrorResponse;

      if (response.status === 404 || ("kind" in joinData && joinData.kind === "invalid")) {
        setError("Ugyldig pinkode.");
        return;
      }

      if (!response.ok || !("kind" in joinData)) {
        const errorMessage = "error" in joinData ? joinData.error : undefined;
        throw new Error(errorMessage || "Kunne ikke hente sessionen.");
      }

      if (joinData.kind === "finished") {
        setRunTitle(joinData.runTitle);
        setSchedule(joinData.schedule);
        setView(joinData.scheduleGate === "error" ? "scheduleError" : "expired");
        return;
      }

      setRunTitle(joinData.runTitle);
      setSchedule(joinData.schedule);

      if (joinData.scheduleGate === "error") {
        setView("scheduleError");
        return;
      }

      if (joinData.scheduleGate === "expired") {
        setView("expired");
        return;
      }

      const registerResponse = await fetch("/api/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          sessionId: joinData.sessionId,
          studentName: trimmedName,
        }),
      });
      const registerData = (await registerResponse.json().catch(() => null)) as
        | JoinParticipantResponse
        | JoinLookupErrorResponse
        | null;

      if (!registerResponse.ok || !registerData || !("participantId" in registerData)) {
        const errorMessage =
          registerData && "error" in registerData ? registerData.error : "Kunne ikke klargÃ¸re deltageren.";
        throw new Error(errorMessage);
      }

      saveStoredActiveParticipant({
        participantId: registerData.participantId,
        sessionId: registerData.sessionId,
        studentName: registerData.studentName,
        savedAt: new Date().toISOString(),
      });

      setName(registerData.studentName);
      setSessionId(joinData.sessionId);

      if (joinData.scheduleGate === "scheduled") {
        setView("scheduled");
        return;
      }

      if (joinData.sessionStatus === "running" || joinData.scheduleGate === "active") {
        router.push(`/play/${joinData.sessionId}?name=${encodeURIComponent(trimmedName)}`);
        return;
      }

      setView("waiting");
    } catch (err) {
      console.error("Fejl ved deltagelse i løbet:", err);
      setError("Der skete en fejl. Prøv igen.");
    }
  };

  const scheduledDate = formatLongDate(schedule?.startAt);
  const scheduledTime = formatClockTime(schedule?.startAt);
  const endDate = formatLongDate(schedule?.endAt);
  const endTime = formatClockTime(schedule?.endAt);

  if (view === "scheduled") {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/20 bg-slate-900/60 p-5 text-white shadow-[0_36px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.04),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />

          <div className="relative">
            <div className="mx-auto flex max-w-max items-center gap-3 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-[11px] font-bold tracking-[0.34em] text-emerald-300 uppercase shadow-[0_0_24px_rgba(16,185,129,0.16)]">
              <Timer className="h-4 w-4" />
              Mission Briefing
            </div>

            <div className="mt-8 text-center">
              <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.24)]">
                <div className="absolute inset-4 rounded-full border border-emerald-400/20" />
                <div className="absolute inset-0 rounded-full border border-emerald-300/20 animate-pulse" />
                <div className="absolute h-px w-14 bg-emerald-300/35" />
                <div className="absolute h-14 w-px bg-emerald-300/35" />
                <Timer className="relative z-10 h-10 w-10 text-emerald-200" />
              </div>

              <p className="mt-6 text-xs font-semibold tracking-[0.42em] text-emerald-300 uppercase">
                Planlagt Mission
              </p>
              <h1 className={`mt-4 text-3xl font-black text-white sm:text-5xl ${rubik.className}`}>
                Missionen er låst og klar
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Missionen starter automatisk d. {scheduledDate ?? "ukendt dato"} kl.{" "}
                {scheduledTime ?? "ukendt tid"}. Hold agentudstyret klar.
              </p>

              {runTitle ? (
                <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-50/90 backdrop-blur-md">
                  {runTitle}
                </div>
              ) : null}
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5 text-left shadow-[0_18px_45px_rgba(15,23,42,0.28)] backdrop-blur-md">
                <p className="text-xs font-semibold tracking-[0.26em] text-emerald-200/60 uppercase">
                  Startvindue
                </p>
                <p className="mt-4 text-sm font-medium text-slate-300">
                  {scheduledDate ?? "Tid ikke sat"}
                </p>
                <p className="mt-3 font-mono text-4xl font-black tracking-[0.18em] text-emerald-300 sm:text-5xl">
                  {scheduledTime ?? "--:--"}
                </p>
              </div>

              <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5 text-left shadow-[0_18px_45px_rgba(15,23,42,0.28)] backdrop-blur-md">
                <p className="text-xs font-semibold tracking-[0.26em] text-emerald-200/60 uppercase">
                  Mission slutter
                </p>
                <p className="mt-4 text-sm font-medium text-slate-300">
                  {endDate ?? "Når arrangøren lukker"}
                </p>
                <p className="mt-3 font-mono text-4xl font-black tracking-[0.18em] text-white sm:text-5xl">
                  {endTime ?? "--:--"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "waiting") {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/20 bg-slate-900/60 p-6 text-center text-white shadow-[0_36px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.04),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />

          <div className="relative">
            <div className="mx-auto flex max-w-max items-center gap-3 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-[11px] font-bold tracking-[0.34em] text-emerald-300 uppercase shadow-[0_0_24px_rgba(16,185,129,0.16)]">
              <Leaf className="h-4 w-4" />
              Mission Briefing
            </div>

            <div className="mt-8">
              <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 p-8 shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-pulse">
                <div className="absolute inset-3 rounded-full border border-emerald-300/20" />
                <div className="absolute inset-0 rounded-full border border-emerald-300/20" />
                <div className="absolute h-px w-14 bg-emerald-300/35" />
                <div className="absolute h-14 w-px bg-emerald-300/35" />
                <Loader2 className="relative z-10 h-10 w-10 animate-spin text-emerald-200" />
              </div>

              <p className="mt-6 text-xs font-semibold tracking-[0.42em] text-emerald-300 uppercase">
                AGENT REGISTRERET
              </p>
              <h1 className={`mt-4 text-3xl font-black text-white sm:text-5xl ${rubik.className}`}>
                Mission Briefing aktiv
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                Venter på at Løbslederen starter missionen...
              </p>
            </div>

            {runTitle ? (
              <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-emerald-50/90 backdrop-blur-md">
                {runTitle}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (view === "scheduleError") {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl items-center justify-center px-6 py-10">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-rose-500/30 bg-rose-950/60 p-8 text-center text-white shadow-[0_32px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,113,133,0.16),transparent_30%),linear-gradient(140deg,rgba(255,255,255,0.04),transparent_42%)]" />

          <div className="relative">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-rose-200/18 bg-rose-300/[0.08] shadow-[0_0_36px_rgba(251,113,133,0.14)]">
              <AlertCircle className="h-10 w-10 text-rose-100" />
            </div>

            <p className="mt-6 text-xs font-semibold tracking-[0.38em] text-rose-100/55 uppercase">
              Tidsplan utilgængelig
            </p>
            <h1 className={`mt-4 text-3xl font-black text-white sm:text-4xl ${rubik.className}`}>
              Kunne ikke læse tidsplanen
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-rose-50/80 sm:text-lg">
              Kunne ikke læse tidsplanen. Kontakt arrangøren.
            </p>

            {runTitle ? (
              <p className="mt-5 text-sm font-semibold text-rose-100/70">{runTitle}</p>
            ) : null}

            <button
              type="button"
              onClick={resetToForm}
              className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
            >
              <ArrowLeft className="h-4 w-4" />
              Prøv en anden kode
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === "expired") {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl items-center justify-center px-6 py-10">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-amber-500/30 bg-amber-950/60 p-8 text-center text-white shadow-[0_32px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_30%),linear-gradient(140deg,rgba(255,255,255,0.04),transparent_42%)]" />

          <div className="relative">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-amber-200/18 bg-amber-300/[0.08] shadow-[0_0_36px_rgba(251,191,36,0.14)]">
              <Leaf className="h-10 w-10 text-amber-100" />
            </div>

            <p className="mt-6 text-xs font-semibold tracking-[0.38em] text-amber-100/55 uppercase">
              Løbet er lukket
            </p>
            <h1 className={`mt-4 text-3xl font-black text-white sm:text-4xl ${rubik.className}`}>
              Dette løb er desværre slut
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-amber-50/80 sm:text-lg">
              Dette løb er desværre slut. Kontakt din arrangør.
            </p>

            {runTitle ? (
              <p className="mt-5 text-sm font-semibold text-amber-100/70">{runTitle}</p>
            ) : null}

            <button
              type="button"
              onClick={resetToForm}
              className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
            >
              <ArrowLeft className="h-4 w-4" />
              Prøv en anden kode
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/20 bg-slate-900/60 p-5 text-white shadow-[0_36px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.04),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />

        <div className="relative">
          <div className="mb-8 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <Leaf className="h-9 w-9 text-emerald-200" />
            </div>
          </div>

          <p className="text-center text-xs font-semibold tracking-[0.4em] text-emerald-300 uppercase">
            Secret Agent Access
          </p>
          <h1 className={`mt-4 text-center text-3xl font-black text-white sm:text-4xl ${rubik.className}`}>
            Tilslut missionen
          </h1>
          <p className="mt-3 text-center text-sm leading-6 text-slate-300 sm:text-base">
            Indtast pinkoden og dit agentnavn. Vi checker automatisk, om missionen er klar til start.
          </p>

          <form onSubmit={handleJoin} className="mt-8 space-y-5">
            {error ? (
              <div className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-center text-sm text-rose-100 backdrop-blur-md">
                {error}
              </div>
            ) : null}

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-emerald-300/70">
                <KeyRound className="h-5 w-5" />
              </div>
              <input
                type="text"
                placeholder="Pinkode, f.eks. 4921"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-[1.75rem] border border-emerald-500/50 bg-slate-950 py-5 pr-4 pl-12 text-center font-mono text-3xl font-black tracking-[0.5em] text-white shadow-[0_0_24px_rgba(16,185,129,0.12)] shadow-inner outline-none transition placeholder:text-emerald-500/30 focus:border-emerald-400 focus:bg-slate-900 focus:ring-2 focus:ring-emerald-400/20"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
              />
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-emerald-300/70">
                <User className="h-5 w-5" />
              </div>
              <input
                type="text"
                placeholder="Dit navn"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-[1.6rem] border border-white/20 bg-slate-950 py-4 pr-4 pl-12 text-lg font-semibold text-white shadow-inner outline-none backdrop-blur-md transition placeholder:text-slate-500 focus:border-emerald-400 focus:bg-slate-900 focus:ring-2 focus:ring-emerald-400/20"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-2 w-full rounded-[1.6rem] border border-emerald-500/30 bg-emerald-500/10 py-4 text-base font-black tracking-[0.28em] text-emerald-300 uppercase shadow-[0_0_30px_rgba(16,185,129,0.22)] transition-all hover:bg-emerald-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
            >
              TILSLUT MISSION 🚀
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className={`relative flex min-h-svh items-start justify-center overflow-y-auto bg-slate-950 pb-20 text-white sm:items-center ${poppins.className}`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#020617_0%,#020b16_42%,#01040a_100%)]" />
      <div className="pointer-events-none absolute left-[-7rem] top-[-5rem] h-72 w-72 rounded-full bg-emerald-400/14 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-8rem] right-[-5rem] h-80 w-80 rounded-full bg-cyan-400/10 blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_28%),radial-gradient(circle_at_bottom,rgba(34,211,238,0.08),transparent_22%)]" />

      <Suspense
        fallback={
          <div className="relative z-10 text-emerald-100">
            <Loader2 size={32} className="animate-spin" />
          </div>
        }
      >
        <JoinForm />
      </Suspense>
    </div>
  );
}
