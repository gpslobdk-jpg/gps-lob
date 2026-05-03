"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { Poppins, Rubik } from "next/font/google";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, KeyRound, Leaf, Loader2, Timer, User } from "lucide-react";

import {
  type RunScheduleGate,
  type RunSchedule,
} from "@/utils/runSchedule";
import * as Sentry from "@sentry/nextjs";
import QRScannerModal from "@/components/QRScannerModal";
import WifiConnectionTip from "@/components/WifiConnectionTip";
import {
  readStoredActiveParticipant,
  saveStoredActiveParticipant,
  clearStoredActiveParticipant,
  clearStoredPlaySnapshot,
} from "@/components/play/playUtils";
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
      raceType?: string | null;
    };

type JoinLookupErrorResponse = {
  error?: string;
};

type JoinParticipantResponse = {
  participantId: string;
  sessionId: string;
  studentName: string;
  sessionStatus?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  teamColor?: string | null;
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

const RATE_LIMIT_MESSAGE =
  "Der er lige nu kø i skolegården. Vent 5-10 sekunder og prøv at trykke 'Deltag i løbet' igen.";

const JOIN_PIN_LENGTH = 6;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  maxAttempts = 3
): Promise<Response> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(input, init);
    if (response.status !== 429 && response.status !== 503) {
      return response;
    }
    if (attempt < maxAttempts) {
      await sleep(500);
    } else {
      return response;
    }
  }
  return fetch(input, init);
}

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const pinFromQuery = (searchParams.get("pin") || "").replace(/\D/g, "").slice(0, JOIN_PIN_LENGTH);

  const [pin, setPin] = useState(pinFromQuery);
  const [name, setName] = useState("");
  const [view, setView] = useState<JoinView>("form");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [runTitle, setRunTitle] = useState("");
  const [schedule, setSchedule] = useState<RunSchedule | null>(null);
  const [raceType, setRaceType] = useState<string | null>(null);
  const [expiredMessage, setExpiredMessage] = useState("Dette løb er desværre slut. Kontakt din arrangør.");
  const [assignedTeamName, setAssignedTeamName] = useState<string | null>(null);
  const [assignedTeamColor, setAssignedTeamColor] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [showHomescreenTip, setShowHomescreenTip] = useState(false);
  const joinLockRef = useRef(false);
  const isMissingSessionNotice = searchParams.get("missingSession") === "1";
  const isZoneKrig = raceType === "zone_krig";
  const trimmedName = name.trim();
  const trimmedPin = pin.trim();
  const canSubmit = trimmedPin.length === JOIN_PIN_LENGTH && trimmedName.length > 0;

  useEffect(() => {
    setPin((current) => (current === pinFromQuery ? current : pinFromQuery));
  }, [pinFromQuery]);

  // ── Auto-resume: redirect to active game on cold start ──────────────
  useEffect(() => {
    if (isMissingSessionNotice) return;

    const stored = readStoredActiveParticipant();
    if (!stored?.sessionId || !stored?.participantId) return;
    // Only auto-resume if the saved session is < 6 hours old
    const ageMs = Date.now() - new Date(stored.savedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > 6 * 60 * 60 * 1000) return;
    router.replace(
      `/play/${stored.sessionId}?name=${encodeURIComponent(stored.studentName ?? "")}`,
    );
  }, [isMissingSessionNotice, router]);

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
            const existingParticipant = readStoredActiveParticipant();
            if (existingParticipant && existingParticipant.sessionId === sessionId) {
              saveStoredActiveParticipant({
                ...existingParticipant,
                sessionStatus: "running",
              });
            }
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
      setView("waiting");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setView("waiting");
    }, timeUntilStart);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [view, sessionId, schedule?.startAt]);

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

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return;
    }

    const ua = navigator.userAgent;
    // Capacitor-appen har `(wv)` i sin user-agent ligesom andre Android WebViews,
    // men GPS virker korrekt i Capacitor fordi BridgeActivity håndterer geolocation-
    // permissions. Vi undgår at vise den vildledende advarsel ved at detektere
    // window.Capacitor, som altid er til stede i Capacitor-apps (men ikke i browsere).
    const isCapacitorApp =
      typeof window !== "undefined" &&
      typeof (window as any).Capacitor !== "undefined";
    const isKnownInApp = /FBAN|FBAV|Instagram|Snapchat/i.test(ua);
    const isAndroidWebView = !isCapacitorApp && /Android/.test(ua) && /wv/.test(ua);
    const isIosWebView = /iPhone|iPad/.test(ua) && /AppleWebKit/.test(ua) && !/Safari/.test(ua);
    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || Boolean(navigatorWithStandalone.standalone);
    const isMobileBrowser =
      /iPad|iPhone|iPod|Android/i.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

    if (isKnownInApp || isAndroidWebView || isIosWebView) {
      setShowInAppWarning(true);
    }

    // Capacitor-appen er allerede en native app — vis ikke "Tilføj til hjemmeskærm"-tipset.
    setShowHomescreenTip(
      !isCapacitorApp && isMobileBrowser && !isStandalone && !isKnownInApp && !isAndroidWebView && !isIosWebView,
    );
  }, []);

  const resetToForm = () => {
    setView("form");
    setError("");
    setSessionId(null);
    setRunTitle("");
    setSchedule(null);
    setRaceType(null);
    setExpiredMessage("Dette løb er desværre slut. Kontakt din arrangør.");
    setAssignedTeamName(null);
    setAssignedTeamColor(null);
  };

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();

    if (joinLockRef.current) {
      return;
    }

    setError("");

    if (!trimmedPin || !trimmedName) {
      setError("Udfyld venligst både pinkode og navn.");
      return;
    }

    if (trimmedPin.length !== JOIN_PIN_LENGTH) {
      setError(`Pinkoden skal bestå af ${JOIN_PIN_LENGTH} tal.`);
      return;
    }

    joinLockRef.current = true;
    setIsJoining(true);
    let shouldReleaseLock = true;

    try {
      Sentry.addBreadcrumb({
        category: "join",
        message: "join_attempt",
        data: { pin: trimmedPin, name: trimmedName },
      });
    } catch (err) {
      // best-effort
    }

    try {
      const response = await fetchWithRetry(`/api/join?pin=${encodeURIComponent(trimmedPin)}`);

      if (response.status === 429 || response.status === 503) {
        setError(RATE_LIMIT_MESSAGE);
        return;
      }

      const joinData = (await response.json()) as JoinLookupResponse | JoinLookupErrorResponse;

      if (response.status === 404 || ("kind" in joinData && joinData.kind === "invalid")) {
        try {
            Sentry.withScope((scope) => {
            scope.setExtra("enteredPin", trimmedPin);
            scope.setExtra("enteredName", trimmedName);
            Sentry.captureMessage("Join lookup invalid or 404", "info");
          });
        } catch (err) {
          // best-effort
        }
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
        setExpiredMessage("Dette løb er desværre slut. Kontakt din arrangør.");
        setView(joinData.scheduleGate === "error" ? "scheduleError" : "expired");
        return;
      }

      setRunTitle(joinData.runTitle);
      setSchedule(joinData.schedule);
      setRaceType(joinData.raceType ?? null);

      if (joinData.scheduleGate === "error") {
        setView("scheduleError");
        return;
      }

      if (joinData.scheduleGate === "expired") {
        setExpiredMessage("Dette løb er desværre slut. Kontakt din arrangør.");
        setView("expired");
        return;
      }

      const registerResponse = await fetchWithRetry("/api/join", {
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

      if (registerResponse.status === 429 || registerResponse.status === 503) {
        setError(RATE_LIMIT_MESSAGE);
        return;
      }

      const registerData = (await registerResponse.json().catch(() => null)) as
        | JoinParticipantResponse
        | JoinLookupErrorResponse
        | null;

      if (registerResponse.status === 404 || registerResponse.status === 410) {
        setExpiredMessage("Løbet er afsluttet eller findes ikke længere. Få en ny pinkode fra din lærer.");
        setView("expired");
        return;
      }

      if (!registerResponse.ok || !registerData || !("participantId" in registerData)) {
        const errorMessage =
          registerData && "error" in registerData ? registerData.error : "Kunne ikke klargøre deltageren.";
        throw new Error(errorMessage);
      }

      const resolvedSessionStatus = registerData.sessionStatus ?? joinData.sessionStatus ?? null;
      const existingParticipant = readStoredActiveParticipant();
      const shouldPreserveExistingParticipant =
        existingParticipant?.sessionId === registerData.sessionId &&
        existingParticipant?.participantId === registerData.participantId;

      // If joining a different session/participant, clear any stale stored state
      if (existingParticipant && !shouldPreserveExistingParticipant) {
        try {
          Sentry.withScope((scope) => {
            scope.setExtras({
              enteredPin: trimmedPin,
              existingSessionId: existingParticipant.sessionId,
              existingParticipantId: existingParticipant.participantId,
              newSessionId: registerData.sessionId,
            });
            Sentry.captureMessage("Clearing stored participant state due to different session/participant", "info");
          });
        } catch (err) {
          // best-effort
        }
        clearStoredActiveParticipant();
        clearStoredPlaySnapshot();
      }

      saveStoredActiveParticipant({
        participantId: registerData.participantId,
        sessionId: registerData.sessionId,
        studentName: registerData.studentName,
        savedAt: new Date().toISOString(),
        teamId: registerData.teamId ?? null,
        teamColor: registerData.teamColor ?? null,
        avatarUrl: shouldPreserveExistingParticipant ? existingParticipant?.avatarUrl ?? null : null,
        sessionStatus: resolvedSessionStatus,
        hasCompletedAvatarGate: shouldPreserveExistingParticipant
          ? existingParticipant?.hasCompletedAvatarGate ?? true
          : false,
      });

      try {
        Sentry.addBreadcrumb({
          category: "join",
          message: "join_success",
          data: { sessionId: registerData.sessionId, participantId: registerData.participantId },
        });
      } catch (err) {
        // best-effort
      }

      setName(registerData.studentName);
      setSessionId(joinData.sessionId);
      setAssignedTeamName(registerData.teamName ?? null);
      setAssignedTeamColor(registerData.teamColor ?? null);
      shouldReleaseLock = false;
      router.push(`/play/${joinData.sessionId}?name=${encodeURIComponent(registerData.studentName)}`);
      return;
    } catch (err) {
      console.error("Fejl ved deltagelse i løbet:", err);
      setError("Der skete en fejl. Prøv igen.");
    } finally {
      if (shouldReleaseLock) {
        joinLockRef.current = false;
        setIsJoining(false);
      }
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

              {isZoneKrig && assignedTeamName ? (
                <div
                  className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold text-white shadow-[0_0_24px_rgba(15,23,42,0.24)]"
                  style={{
                    borderColor: assignedTeamColor ?? "rgba(34,211,238,0.35)",
                    backgroundColor: assignedTeamColor ? `${assignedTeamColor}22` : "rgba(34,211,238,0.12)",
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: assignedTeamColor ?? "#22d3ee" }}
                  />
                  Du er på {assignedTeamName} hold!
                </div>
              ) : null}

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
              Klar til start
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
                Løbet er ikke startet endnu
              </p>
              <h1 className={`mt-4 text-3xl font-black text-white sm:text-5xl ${rubik.className}`}>
                Du er klar
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                Vent på, at din lærer starter løbet.
              </p>

              {isZoneKrig && assignedTeamName ? (
                <div
                  className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold text-white shadow-[0_0_24px_rgba(15,23,42,0.24)]"
                  style={{
                    borderColor: assignedTeamColor ?? "rgba(34,211,238,0.35)",
                    backgroundColor: assignedTeamColor ? `${assignedTeamColor}22` : "rgba(34,211,238,0.12)",
                  }}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: assignedTeamColor ?? "#22d3ee" }}
                  />
                  Du er på {assignedTeamName} hold!
                </div>
              ) : null}
            </div>

            <WifiConnectionTip className="mx-auto mt-6 max-w-2xl" />

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
              {expiredMessage}
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
      {isMissingSessionNotice ? (
        <div className="relative mb-5 w-full overflow-hidden rounded-[2rem] border border-emerald-300/25 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.96))] p-5 text-white shadow-[0_28px_70px_rgba(2,6,23,0.5)] backdrop-blur-2xl sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_36%)]" />
          <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-white/5" />

          <div className="relative z-10">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-400/12 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.18)]">
              <Leaf className="h-6 w-6" />
            </div>

            <p className="text-[11px] font-semibold tracking-[0.32em] text-emerald-200/70 uppercase">
              Løb ikke fundet
            </p>
            <h1 className={`mt-3 text-2xl font-black text-white sm:text-3xl ${rubik.className}`}>
              Hov! Vi kan ikke finde dette løb 🏁
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/80 sm:text-base">
              Det ser ud til, at linket er blevet for gammelt, eller at din lærer har afsluttet løbet. Tjek med din lærer, om du har fået det rigtige link eller den rigtige PIN-kode.
            </p>

            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-[1.2rem] border border-emerald-300/30 bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_18px_38px_rgba(16,185,129,0.24)] transition hover:brightness-110 active:scale-[0.99]"
              >
                Gå til forsiden
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/20 bg-slate-900/60 p-5 text-white shadow-[0_36px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.04),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />

        <div className="relative">
          <h1 className={`text-center text-3xl font-black text-white sm:text-4xl ${rubik.className}`}>
            Deltag i løbet
          </h1>
          <p className="mt-3 text-center text-sm leading-6 text-slate-300 sm:text-base">
            Indtast løbskoden eller scan QR-koden. Skriv derefter dit navn.
          </p>

          {showInAppWarning ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200 backdrop-blur-md">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span className="flex-1 leading-5">
                <strong className="font-bold">GPS virker ikke i denne browser!</strong> Åbn linket i{" "}
                <strong>Safari</strong> (iPhone) eller <strong>Chrome</strong> (Android) for at GPS virker.
              </span>
              <button
                type="button"
                className="shrink-0 text-amber-300/70 hover:text-amber-200"
                onClick={() => setShowInAppWarning(false)}
                aria-label="Luk advarsel"
              >
                ×
              </button>
            </div>
          ) : null}

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
                placeholder="Løbskode, f.eks. 492173"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, JOIN_PIN_LENGTH))}
                className="w-full rounded-[1.75rem] border border-emerald-500/50 bg-slate-950 py-5 pr-6 pl-12 text-center font-mono text-3xl font-black tracking-[0.35em] text-white shadow-[0_0_24px_rgba(16,185,129,0.12)] shadow-inner outline-none transition placeholder:text-emerald-500/30 focus:border-emerald-400 focus:bg-slate-900 focus:ring-2 focus:ring-emerald-400/20"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={JOIN_PIN_LENGTH}
                autoComplete="one-time-code"
                disabled={isJoining}
              />
            </div>

            <QRScannerModal buttonClassName="w-full justify-center" />

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
                disabled={isJoining}
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit || isJoining}
              className="mt-2 mb-6 w-full rounded-[1.6rem] border border-emerald-500/30 bg-emerald-500/10 py-4 text-base font-black tracking-[0.28em] text-emerald-300 uppercase shadow-[0_0_30px_rgba(16,185,129,0.22)] transition-all hover:bg-emerald-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isJoining ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gør klar...
                </span>
              ) : (
                "Deltag i løbet"
              )}
            </button>
          </form>

          <details className="mt-5 rounded-[1.35rem] border border-white/10 bg-slate-950/45 px-4 py-3 text-left shadow-[0_10px_24px_rgba(2,6,23,0.16)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-100">
              <span>Problemer med at deltage?</span>
              <span className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/70">Vis hjælp</span>
            </summary>

            <div className="mt-4 space-y-4">
              <p className="text-sm leading-6 text-slate-300">
                Hvis koden er forkert eller for gammel, skal din lærer give dig en ny kode eller et nyt link.
              </p>

              <p className="text-sm leading-6 text-slate-300">
                Hvis kameraet ikke starter, kan du stadig taste koden manuelt i feltet ovenfor.
              </p>

              <WifiConnectionTip className="shadow-none" />

              {showHomescreenTip ? (
                <div className="rounded-[1.2rem] border border-emerald-300/12 bg-slate-900/45 px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.16)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/75">
                    Tip: Brug som app
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-200/88">
                    Tilføj GPS-løbet til hjemmeskærmen. Så fylder spillet mere på skærmen og fungerer ofte bedre.
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    iPhone: Del → Føj til hjemmeskærm
                    <br />
                    Android: Menu ⋮ → Føj til startskærm
                  </p>
                </div>
              ) : null}

              <Link
                href="/"
                className="inline-flex items-center text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
              >
                Tilbage til forsiden
              </Link>
            </div>
          </details>
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
