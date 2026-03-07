"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, KeyRound, Leaf, Loader2, Timer, User } from "lucide-react";

import {
  type RunScheduleGate,
  type RunSchedule,
} from "@/utils/runSchedule";
import { createClient } from "@/utils/supabase/client";

type JoinView = "form" | "waiting" | "scheduled" | "expired" | "scheduleError";

type InsertErrorLike = {
  code?: string;
};

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

      const { error: insertError } = await supabase.from("session_students").insert({
        session_id: joinData.sessionId,
        student_name: trimmedName,
      });

      if (insertError && (insertError as InsertErrorLike).code !== "23505") {
        throw insertError;
      }

      setName(trimmedName);
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
      <div className="mx-auto flex h-full w-full max-w-3xl items-center justify-center px-6 py-10">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-emerald-100/12 bg-[linear-gradient(160deg,rgba(10,30,22,0.88),rgba(6,18,14,0.78))] p-8 text-white shadow-[0_32px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(163,230,53,0.12),transparent_32%),linear-gradient(140deg,rgba(255,255,255,0.05),transparent_45%)]" />

          <div className="relative text-center">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-emerald-200/20 bg-emerald-300/10 shadow-[0_0_36px_rgba(74,222,128,0.18)]">
              <div className="absolute h-24 w-24 rounded-full bg-emerald-300/10 blur-2xl" />
              <Timer className="relative h-10 w-10 text-emerald-100" />
            </div>

            <p className="mt-6 text-xs font-semibold tracking-[0.38em] text-emerald-100/60 uppercase">
              Planlagt løb
            </p>
            <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
              Skoven gør sig klar
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-emerald-50/85 sm:text-lg">
              Løbet er planlagt! Vi starter automatisk d. {scheduledDate ?? "ukendt dato"} kl.{" "}
              {scheduledTime ?? "ukendt tid"}. Hold telefonen klar!
            </p>

            {runTitle ? (
              <div className="mt-5 inline-flex rounded-full border border-emerald-100/12 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-emerald-50/90">
                {runTitle}
              </div>
            ) : null}

            <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/[0.18] p-5 backdrop-blur-xl">
                <p className="text-xs font-semibold tracking-[0.24em] text-emerald-100/50 uppercase">
                  Starter
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {scheduledDate ?? "Tid ikke sat"}
                </p>
                <p className="text-3xl font-black text-emerald-100">
                  {scheduledTime ?? "--:--"}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/[0.18] p-5 backdrop-blur-xl">
                <p className="text-xs font-semibold tracking-[0.24em] text-emerald-100/50 uppercase">
                  Slutter
                </p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {endDate ?? "Når arrangøren lukker"}
                </p>
                <p className="text-3xl font-black text-emerald-100">
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
      <div className="mx-auto flex h-full w-full max-w-2xl items-center justify-center px-6 py-10">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-emerald-100/12 bg-[linear-gradient(160deg,rgba(9,25,19,0.88),rgba(5,16,12,0.76))] p-8 text-center text-white shadow-[0_32px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.16),transparent_32%),linear-gradient(140deg,rgba(255,255,255,0.05),transparent_42%)]" />

          <div className="relative">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-emerald-200/18 bg-emerald-300/[0.08] shadow-[0_0_36px_rgba(74,222,128,0.16)]">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-100" />
            </div>

            <p className="mt-6 text-xs font-semibold tracking-[0.38em] text-emerald-100/55 uppercase">
              Lobby åben
            </p>
            <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
              Vi venter på startsignalet
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-emerald-50/80 sm:text-lg">
              Du er med i løbet. Arrangøren starter det snart, og så sender vi dig direkte videre.
            </p>

            {runTitle ? (
              <p className="mt-5 text-sm font-semibold text-emerald-100/70">{runTitle}</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  if (view === "scheduleError") {
    return (
      <div className="mx-auto flex h-full w-full max-w-2xl items-center justify-center px-6 py-10">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-rose-100/12 bg-[linear-gradient(160deg,rgba(34,16,14,0.88),rgba(20,8,8,0.8))] p-8 text-center text-white shadow-[0_32px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,113,133,0.16),transparent_30%),linear-gradient(140deg,rgba(255,255,255,0.04),transparent_42%)]" />

          <div className="relative">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-rose-200/18 bg-rose-300/[0.08] shadow-[0_0_36px_rgba(251,113,133,0.14)]">
              <AlertCircle className="h-10 w-10 text-rose-100" />
            </div>

            <p className="mt-6 text-xs font-semibold tracking-[0.38em] text-rose-100/55 uppercase">
              Tidsplan utilgængelig
            </p>
            <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
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
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-amber-100/12 bg-[linear-gradient(160deg,rgba(34,22,12,0.88),rgba(18,10,6,0.8))] p-8 text-center text-white shadow-[0_32px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.14),transparent_30%),linear-gradient(140deg,rgba(255,255,255,0.04),transparent_42%)]" />

          <div className="relative">
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-amber-200/18 bg-amber-300/[0.08] shadow-[0_0_36px_rgba(251,191,36,0.14)]">
              <Leaf className="h-10 w-10 text-amber-100" />
            </div>

            <p className="mt-6 text-xs font-semibold tracking-[0.38em] text-amber-100/55 uppercase">
              Løbet er lukket
            </p>
            <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
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
    <div className="mx-auto flex h-full w-full max-w-md flex-col items-center justify-center px-6 py-10">
      <div className="relative w-full overflow-hidden rounded-[2rem] border border-emerald-100/12 bg-[linear-gradient(160deg,rgba(10,30,22,0.82),rgba(5,16,12,0.74))] p-8 text-white shadow-[0_32px_90px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.18),transparent_34%),linear-gradient(140deg,rgba(255,255,255,0.04),transparent_42%)]" />

        <div className="relative">
          <div className="mb-8 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-emerald-200/15 bg-emerald-300/10 shadow-[0_0_26px_rgba(74,222,128,0.16)]">
              <Leaf className="h-9 w-9 text-emerald-100" />
            </div>
          </div>

          <p className="text-center text-xs font-semibold tracking-[0.34em] text-emerald-100/55 uppercase">
            gpslob.dk
          </p>
          <h1 className="mt-4 text-center text-3xl font-black text-white">
            Deltag i løbet
          </h1>
          <p className="mt-3 text-center text-sm leading-6 text-emerald-50/75">
            Indtast pinkoden og dit navn. Vi checker automatisk, om løbet er klar til start.
          </p>

          <form onSubmit={handleJoin} className="mt-8 space-y-5">
            {error ? (
              <div className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-center text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-emerald-100/60">
                <KeyRound className="h-5 w-5" />
              </div>
              <input
                type="text"
                placeholder="Pinkode, f.eks. 4921"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-4 pr-4 pl-12 font-mono text-lg text-white outline-none transition placeholder:text-white/30 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
              />
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-emerald-100/60">
                <User className="h-5 w-5" />
              </div>
              <input
                type="text"
                placeholder="Dit navn"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-4 pr-4 pl-12 text-lg text-white outline-none transition placeholder:text-white/30 focus:border-emerald-300/60 focus:ring-2 focus:ring-emerald-300/20"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-2 w-full rounded-2xl bg-[linear-gradient(135deg,#7ee787,#22c55e)] py-4 text-base font-black tracking-[0.3em] text-emerald-950 uppercase shadow-[0_16px_40px_rgba(74,222,128,0.2)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Gør klar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#03110d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#0d261b_0%,#07140f_48%,#020805_100%)]" />
      <div className="pointer-events-none absolute left-[-7rem] top-[-5rem] h-72 w-72 rounded-full bg-emerald-400/14 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-8rem] right-[-5rem] h-80 w-80 rounded-full bg-lime-300/10 blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.12),transparent_28%),radial-gradient(circle_at_bottom,rgba(163,230,53,0.08),transparent_22%)]" />

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
