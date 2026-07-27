"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Poppins, Rubik } from "next/font/google";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, KeyRound, Leaf, Loader2, Timer, User } from "lucide-react";

import {
  type RunScheduleGate,
  type RunSchedule,
} from "@/utils/runSchedule";
import { captureAppMessage, leaveAppBreadcrumb } from "@/utils/observability";
import QRScannerModal from "@/components/QRScannerModal";
import WifiConnectionTip from "@/components/WifiConnectionTip";
import { getSiteCopy } from "@/lib/siteCopy";
import {
  isCompleteJoinCode,
  JOIN_CODE_LENGTH,
  normalizeJoinCode,
} from "@/lib/join/studentJoin";
import { resolveSiteVariantFromHost, type SiteVariantKey } from "@/lib/siteVariant";
import { useInitialJoinSiteVariant } from "@/app/join/JoinSiteVariantContext";
import {
  readStoredActiveParticipant,
  saveStoredActiveParticipant,
  clearStoredActiveParticipant,
} from "@/components/play/playUtils";
import { buildStoredParticipantFromJoin } from "@/components/play/participantHandoff";
import { createClient } from "@/utils/supabase/client";
import { createClientTelemetryMessage, sendTelemetry } from "@/utils/telemetry";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type JoinView = "form" | "waiting" | "scheduled" | "expired" | "scheduleError";
type JoinStep = "code" | "name";

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
  startOffset?: number | null;
};

type JoinBrowserPlatform = "ios" | "android" | "other";

type JoinRequestStage = "lookup" | "register";

const formatLongDate = (value: string | null | undefined, localeTag: string) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(localeTag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
};

const formatClockTime = (value: string | null | undefined, localeTag: string) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(localeTag, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const JOIN_REQUEST_TIMEOUT_MS = 12_000;
const STORED_PARTICIPANT_RESUME_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const JOIN_TIMEOUT_ABORT_REASON = "join-request-timeout";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class JoinRequestTimeoutError extends Error {
  stage: JoinRequestStage;

  constructor(stage: JoinRequestStage) {
    super(`${stage}_timeout`);
    this.name = "JoinRequestTimeoutError";
    this.stage = stage;
  }
}

function trackJoinTelemetry(
  eventName: string,
  _sessionId: string | null,
  payload: Record<string, unknown>
) {
  try {
    sendTelemetry(eventName, {
      message: createClientTelemetryMessage(payload),
    });
  } catch {
    // best-effort
  }
}

async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  maxAttempts = 3,
  timeoutMs = JOIN_REQUEST_TIMEOUT_MS,
  timeoutStage: JoinRequestStage = "lookup"
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(JOIN_TIMEOUT_ABORT_REASON);
  }, timeoutMs);
  const parentSignal = init?.signal;
  const handleParentAbort = () => {
    timeoutController.abort(parentSignal?.reason);
  };

  if (parentSignal?.aborted) {
    timeoutController.abort(parentSignal.reason);
  } else {
    parentSignal?.addEventListener("abort", handleParentAbort, { once: true });
  }

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(input, { ...init, signal: timeoutController.signal });
        if (response.status !== 429 && response.status !== 503) {
          return response;
        }
        if (attempt < maxAttempts) {
          await sleep(500);
        } else {
          return response;
        }
      } catch (error) {
        if (
          timeoutController.signal.aborted &&
          timeoutController.signal.reason === JOIN_TIMEOUT_ABORT_REASON
        ) {
          throw new JoinRequestTimeoutError(timeoutStage);
        }

        throw error;
      }
    }
  } finally {
    clearTimeout(timeoutId);
    parentSignal?.removeEventListener("abort", handleParentAbort);
  }

  throw new Error("Join request ended unexpectedly.");
}

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSiteVariantKey = useInitialJoinSiteVariant();
  const [supabase] = useState(() => createClient());
  const rawPinFromQuery = searchParams.get("pin") ?? "";
  const pinFromQuery = normalizeJoinCode(rawPinFromQuery);
  const [siteVariantKey, setSiteVariantKey] = useState<SiteVariantKey>(initialSiteVariantKey);
  const siteCopy = getSiteCopy(siteVariantKey);
  const joinCopy = siteCopy.join;

  const [pin, setPin] = useState(pinFromQuery);
  const [name, setName] = useState("");
  const [step, setStep] = useState<JoinStep>("code");
  const [view, setView] = useState<JoinView>("form");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [runTitle, setRunTitle] = useState("");
  const [schedule, setSchedule] = useState<RunSchedule | null>(null);
  const [raceType, setRaceType] = useState<string | null>(null);
  const [expiredMessage, setExpiredMessage] = useState(joinCopy.defaultExpiredMessage);
  const [assignedTeamName, setAssignedTeamName] = useState<string | null>(null);
  const [assignedTeamColor, setAssignedTeamColor] = useState<string | null>(null);
  const [assignedStartOffset, setAssignedStartOffset] = useState<number | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [browserPlatform, setBrowserPlatform] = useState<JoinBrowserPlatform>("other");
  const joinLockRef = useRef(false);
  const resumeAttemptedRef = useRef(false);
  const isMissingSessionNotice = searchParams.get("missingSession") === "1";
  const hasExplicitJoinCode = searchParams.has("pin");
  const isZoneKrig = raceType === "zone_krig";
  const isStaggeredRace = raceType === "quiz" || raceType === "photo";
  const trimmedName = name.trim();
  const trimmedPin = normalizeJoinCode(pin);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextSiteVariantKey = resolveSiteVariantFromHost(window.location.host).key;
    setSiteVariantKey((current) => (current === nextSiteVariantKey ? current : nextSiteVariantKey));
  }, []);

  useEffect(() => {
    setExpiredMessage(joinCopy.defaultExpiredMessage);
  }, [joinCopy.defaultExpiredMessage]);

  useEffect(() => {
    if (step !== "code" || !pinFromQuery) return;
    setPin(pinFromQuery);
  }, [pinFromQuery, step]);

  useEffect(() => {
    if (
      !hasExplicitJoinCode ||
      typeof window === "undefined" ||
      !window.location.search
    ) {
      return;
    }

    // Keep legacy/QR links working, but remove the code from browser history
    // before any later join error can be reported.
    window.history.replaceState(window.history.state, "", "/join");
  }, [hasExplicitJoinCode]);

  useEffect(() => {
    if (resumeAttemptedRef.current) return;
    resumeAttemptedRef.current = true;

    // An explicit link/QR always wins over old local state. Otherwise, resume
    // only a recent handoff; /play revalidates it against the server before
    // allowing gameplay.
    if (hasExplicitJoinCode || isMissingSessionNotice) return;

    const storedParticipant = readStoredActiveParticipant();
    if (
      !storedParticipant?.sessionId ||
      !storedParticipant.participantId ||
      storedParticipant.sessionStatus === "finished"
    ) {
      return;
    }

    const savedAtMs = Date.parse(storedParticipant.savedAt);
    if (
      !Number.isFinite(savedAtMs) ||
      Date.now() - savedAtMs > STORED_PARTICIPANT_RESUME_MAX_AGE_MS
    ) {
      return;
    }

    router.replace(`/play/${encodeURIComponent(storedParticipant.sessionId)}`);
  }, [hasExplicitJoinCode, isMissingSessionNotice, router]);

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
            router.push(`/play/${sessionId}`);
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
      typeof (window as Window & { Capacitor?: unknown }).Capacitor !==
        "undefined";
    const isKnownInApp = /FBAN|FBAV|Instagram|Snapchat/i.test(ua);
    const isAndroidWebView = !isCapacitorApp && /Android/.test(ua) && /wv/.test(ua);
    const isIosWebView = /iPhone|iPad/.test(ua) && /AppleWebKit/.test(ua) && !/Safari/.test(ua);
    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches || Boolean(navigatorWithStandalone.standalone);
    const nextPlatform: JoinBrowserPlatform = /iPad|iPhone|iPod/i.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)
      ? "ios"
      : /Android/i.test(ua)
        ? "android"
        : "other";

    setBrowserPlatform(nextPlatform);

    if (isKnownInApp || isAndroidWebView || isIosWebView) {
      setShowInAppWarning(true);
      trackJoinTelemetry("join_webview_detected", null, {
        platform: nextPlatform,
        is_standalone: isStandalone,
        reason: isKnownInApp ? "known_in_app" : isIosWebView ? "ios_webview" : "android_webview",
        source: isKnownInApp ? "known_in_app" : isIosWebView ? "ios_webview" : "android_webview",
      });
    }
  }, []);

  const resetToForm = () => {
    setView("form");
    setStep("code");
    setError("");
    setSessionId(null);
    setRunTitle("");
    setSchedule(null);
    setRaceType(null);
    setExpiredMessage(joinCopy.defaultExpiredMessage);
    setAssignedTeamName(null);
    setAssignedTeamColor(null);
    setAssignedStartOffset(null);
  };

  const lookupJoinCode = useCallback(
    async (candidateCode: string) => {
      const normalizedCode = normalizeJoinCode(candidateCode);
      setPin(normalizedCode);
      setError("");

      if (!normalizedCode) {
        setError(joinCopy.emptyCode);
        return false;
      }

      if (!isCompleteJoinCode(normalizedCode)) {
        setError(joinCopy.pinLength(JOIN_CODE_LENGTH));
        return false;
      }

      if (joinLockRef.current) {
        return false;
      }

      joinLockRef.current = true;
      setIsJoining(true);

      try {
        const response = await fetchWithRetry(
          "/api/join",
          {
            cache: "no-store",
            headers: {
              "X-Student-Join-Code": normalizedCode,
            },
          },
          3,
          JOIN_REQUEST_TIMEOUT_MS,
          "lookup"
        );

        if (response.status === 429 || response.status === 503) {
          setError(joinCopy.networkError);
          return false;
        }

        const joinData = (await response.json()) as
          | JoinLookupResponse
          | JoinLookupErrorResponse;

        if (
          response.status === 404 ||
          ("kind" in joinData && joinData.kind === "invalid")
        ) {
          leaveAppBreadcrumb("join_code_not_found", {
            routeType: "student_join",
            online:
              typeof navigator.onLine === "boolean" ? navigator.onLine : null,
          });
          setError(joinCopy.invalidPin);
          return false;
        }

        if (!response.ok || !("kind" in joinData)) {
          throw new Error("join_lookup_failed");
        }

        if (joinData.kind === "finished") {
          setRunTitle(joinData.runTitle);
          setSchedule(joinData.schedule);
          setExpiredMessage(joinCopy.defaultExpiredMessage);
          setView("expired");
          return false;
        }

        if (joinData.scheduleGate === "scheduled") {
          setError(joinCopy.notOpen);
          return false;
        }

        if (joinData.scheduleGate === "error") {
          setView("scheduleError");
          return false;
        }

        if (joinData.scheduleGate === "expired") {
          setExpiredMessage(joinCopy.defaultExpiredMessage);
          setView("expired");
          return false;
        }

        setSessionId(joinData.sessionId);
        setRunTitle(joinData.runTitle);
        setSchedule(joinData.schedule);
        setRaceType(joinData.raceType ?? null);
        setStep("name");
        setError("");

        return true;
      } catch (lookupError) {
        if (lookupError instanceof JoinRequestTimeoutError) {
          setError(joinCopy.networkError);
          return false;
        }

        if (lookupError instanceof TypeError) {
          setError(joinCopy.networkError);
          return false;
        }

        captureAppMessage("join_session_lookup_failed", {
          category: "join_session_lookup_failed",
          routeType: "student_join",
          online:
            typeof navigator.onLine === "boolean" ? navigator.onLine : null,
        });
        setError(joinCopy.genericJoinError);
        return false;
      } finally {
        joinLockRef.current = false;
        setIsJoining(false);
      }
    },
    [joinCopy]
  );

  const autoLookupCodeRef = useRef("");
  useEffect(() => {
    if (
      step !== "code" ||
      !isCompleteJoinCode(rawPinFromQuery) ||
      autoLookupCodeRef.current === pinFromQuery
    ) {
      return;
    }

    autoLookupCodeRef.current = pinFromQuery;
    void lookupJoinCode(pinFromQuery);
  }, [lookupJoinCode, pinFromQuery, rawPinFromQuery, step]);

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault();

    if (step === "code") {
      await lookupJoinCode(trimmedPin);
      return;
    }

    if (joinLockRef.current) {
      return;
    }

    setError("");

    if (!trimmedName) {
      setError(joinCopy.missingName);
      return;
    }

    if (!isCompleteJoinCode(trimmedPin)) {
      setStep("code");
      setError(joinCopy.invalidPin);
      return;
    }

    joinLockRef.current = true;
    setIsJoining(true);
    let shouldReleaseLock = true;
    let activeSessionId: string | null = null;
    let currentStage: JoinRequestStage = "lookup";

    leaveAppBreadcrumb("join_attempt", {
      routeType: "student_join",
      online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
    });

    try {
      const lookupStart = Date.now();
      const response = await fetchWithRetry(
        "/api/join",
        {
          cache: "no-store",
          headers: {
            "X-Student-Join-Code": trimmedPin,
          },
        },
        3,
        JOIN_REQUEST_TIMEOUT_MS,
        "lookup"
      );
      const lookupDuration = Date.now() - lookupStart;
      trackJoinTelemetry("join_lookup", null, {
        duration_ms: lookupDuration,
        status_code: response.status,
        stage: "lookup",
        reason: response.ok ? "ok" : "http_error",
      });

      if (response.status === 429 || response.status === 503) {
        setError(joinCopy.networkError);
        return;
      }

      const joinData = (await response.json()) as JoinLookupResponse | JoinLookupErrorResponse;

      if (response.status === 404 || ("kind" in joinData && joinData.kind === "invalid")) {
        leaveAppBreadcrumb("join_code_not_found", {
          routeType: "student_join",
          online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
        });

        setError(joinCopy.invalidPin);
        return;
      }

      if (!response.ok || !("kind" in joinData)) {
        const errorMessage = "error" in joinData ? joinData.error : undefined;
        throw new Error(errorMessage || "Kunne ikke hente sessionen.");
      }

      if (joinData.kind === "finished") {
        setRunTitle(joinData.runTitle);
        setSchedule(joinData.schedule);
        setExpiredMessage(joinCopy.defaultExpiredMessage);
        setView(joinData.scheduleGate === "error" ? "scheduleError" : "expired");
        return;
      }

      setRunTitle(joinData.runTitle);
      setSchedule(joinData.schedule);
      setRaceType(joinData.raceType ?? null);
      activeSessionId = joinData.sessionId;

      if (joinData.scheduleGate === "error") {
        setView("scheduleError");
        return;
      }

      if (joinData.scheduleGate === "scheduled") {
        setStep("code");
        setError(joinCopy.notOpen);
        return;
      }

      if (joinData.scheduleGate === "expired") {
        setExpiredMessage(joinCopy.defaultExpiredMessage);
        setView("expired");
        return;
      }

      currentStage = "register";
      const registerStart = Date.now();
      const registerResponse = await fetchWithRetry(
        "/api/join",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
          body: JSON.stringify({
            sessionId: joinData.sessionId,
            studentName: trimmedName,
          }),
        },
        3,
        JOIN_REQUEST_TIMEOUT_MS,
        "register"
      );
      const registerDuration = Date.now() - registerStart;
      trackJoinTelemetry("join_register", joinData.sessionId ?? null, {
        duration_ms: registerDuration,
        status_code: registerResponse.status,
        stage: "register",
        reason: registerResponse.ok ? "ok" : "http_error",
      });

      if (registerResponse.status === 429 || registerResponse.status === 503) {
        setError(joinCopy.networkError);
        return;
      }

      const registerData = (await registerResponse.json().catch(() => null)) as
        | JoinParticipantResponse
        | JoinLookupErrorResponse
        | null;

      if (registerResponse.status === 404) {
        setStep("code");
        setSessionId(null);
        setError(joinCopy.invalidPin);
        return;
      }

      if (registerResponse.status === 410) {
        setExpiredMessage(joinCopy.finishedOrMissing);
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

      // Replace only the active handoff after a successful new registration.
      // A participant-scoped offline snapshot is left intact until the play
      // engine can authoritatively decide whether it belongs to this session.
      if (existingParticipant && !shouldPreserveExistingParticipant) {
        leaveAppBreadcrumb("join_handoff_replaced", {
          routeType: "student_join",
          online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
        });
        clearStoredActiveParticipant();
      }

      saveStoredActiveParticipant(
        buildStoredParticipantFromJoin({
          registration: registerData,
          existingParticipant,
          preserveExistingParticipant: shouldPreserveExistingParticipant,
          sessionStatus: resolvedSessionStatus,
        })
      );

      leaveAppBreadcrumb("join_success", {
        routeType: "student_join",
        online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
      });

      setName(registerData.studentName);
      setSessionId(joinData.sessionId);
      setAssignedTeamName(registerData.teamName ?? null);
      setAssignedTeamColor(registerData.teamColor ?? null);
      setAssignedStartOffset(typeof registerData.startOffset === "number" ? registerData.startOffset : null);
      shouldReleaseLock = false;
      router.replace(`/play/${joinData.sessionId}`);
      return;
    } catch (err) {
      if (err instanceof JoinRequestTimeoutError) {
        trackJoinTelemetry(
          err.stage === "lookup" ? "join_lookup_timeout" : "join_register_timeout",
          activeSessionId,
          {
            stage: err.stage,
            timeout_ms: JOIN_REQUEST_TIMEOUT_MS,
            online: typeof navigator !== "undefined" ? navigator.onLine : null,
            platform: browserPlatform,
            reason: "timeout",
            show_in_app_warning: showInAppWarning,
          }
        );
        setError(joinCopy.networkError);
        return;
      }

      if (err instanceof TypeError) {
        trackJoinTelemetry("join_network_error", activeSessionId, {
          stage: currentStage,
          online: typeof navigator !== "undefined" ? navigator.onLine : null,
          platform: browserPlatform,
          reason: "network_error",
          show_in_app_warning: showInAppWarning,
        });
        setError(joinCopy.networkError);
        return;
      }

      trackJoinTelemetry("join_failed", activeSessionId, {
        stage: currentStage,
        online: typeof navigator !== "undefined" ? navigator.onLine : null,
        platform: browserPlatform,
        reason: err instanceof Error && err.name ? err.name : "unexpected_error",
        show_in_app_warning: showInAppWarning,
      });

      captureAppMessage(
        currentStage === "lookup"
          ? "join_session_lookup_failed"
          : "participant_creation_failed",
        {
          category:
            currentStage === "lookup"
              ? "join_session_lookup_failed"
              : "participant_creation_failed",
          routeType: "student_join",
          online:
            typeof navigator.onLine === "boolean" ? navigator.onLine : null,
        }
      );
      setError(joinCopy.genericJoinError);
    } finally {
      if (shouldReleaseLock) {
        joinLockRef.current = false;
        setIsJoining(false);
      }
    }
  };

  const scheduledDate = formatLongDate(schedule?.startAt, siteCopy.localeTag);
  const scheduledTime = formatClockTime(schedule?.startAt, siteCopy.localeTag);
  const endDate = formatLongDate(schedule?.endAt, siteCopy.localeTag);
  const endTime = formatClockTime(schedule?.endAt, siteCopy.localeTag);

  if (view === "scheduled") {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
        <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/20 bg-slate-900/60 p-5 text-white shadow-[0_36px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-8">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.04),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />

          <div className="relative">
            <div className="mx-auto flex max-w-max items-center gap-3 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-[11px] font-bold tracking-[0.34em] text-emerald-300 uppercase shadow-[0_0_24px_rgba(16,185,129,0.16)]">
              <Timer className="h-4 w-4" />
              {joinCopy.scheduled.eyebrow}
            </div>

            <div className="mt-8 text-center">
              <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.24)]">
                <div className="absolute inset-4 rounded-full border border-emerald-400/20" />
                <div className="absolute inset-0 rounded-full border border-emerald-300/20 motion-safe:animate-pulse motion-reduce:animate-none" />
                <div className="absolute h-px w-14 bg-emerald-300/35" />
                <div className="absolute h-14 w-px bg-emerald-300/35" />
                <Timer className="relative z-10 h-10 w-10 text-emerald-200" />
              </div>

              <p className="mt-6 text-xs font-semibold tracking-[0.42em] text-emerald-300 uppercase">
                {joinCopy.scheduled.statusLabel}
              </p>
              <h1 className={`mt-4 text-3xl font-black text-white sm:text-5xl ${rubik.className}`}>
                {joinCopy.scheduled.title}
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                {joinCopy.scheduled.description(scheduledDate, scheduledTime)}
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
                  {joinCopy.teamBadge(assignedTeamName)}
                </div>
              ) : null}

              {isStaggeredRace && typeof assignedStartOffset === "number" ? (
                <p className="mx-auto mt-4 max-w-xs text-sm font-semibold text-emerald-200">
                  Jeres første post er post {assignedStartOffset + 1}.
                </p>
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
                  {joinCopy.scheduled.startWindowLabel}
                </p>
                <p className="mt-4 text-sm font-medium text-slate-300">
                  {scheduledDate ?? joinCopy.scheduled.unknownDate}
                </p>
                <p className="mt-3 font-mono text-4xl font-black tracking-[0.18em] text-emerald-300 sm:text-5xl">
                  {scheduledTime ?? joinCopy.scheduled.unknownTime}
                </p>
              </div>

              <div className="rounded-[1.7rem] border border-white/10 bg-white/5 p-5 text-left shadow-[0_18px_45px_rgba(15,23,42,0.28)] backdrop-blur-md">
                <p className="text-xs font-semibold tracking-[0.26em] text-emerald-200/60 uppercase">
                  {joinCopy.scheduled.endWindowLabel}
                </p>
                <p className="mt-4 text-sm font-medium text-slate-300">
                  {endDate ?? joinCopy.scheduled.endFallback}
                </p>
                <p className="mt-3 font-mono text-4xl font-black tracking-[0.18em] text-white sm:text-5xl">
                  {endTime ?? joinCopy.scheduled.unknownTime}
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
              {joinCopy.waiting.eyebrow}
            </div>

            <div className="mt-8">
              <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 p-8 shadow-[0_0_30px_rgba(16,185,129,0.4)] motion-safe:animate-pulse motion-reduce:animate-none">
                <div className="absolute inset-3 rounded-full border border-emerald-300/20" />
                <div className="absolute inset-0 rounded-full border border-emerald-300/20" />
                <div className="absolute h-px w-14 bg-emerald-300/35" />
                <div className="absolute h-14 w-px bg-emerald-300/35" />
                <Loader2 className="relative z-10 h-10 w-10 motion-safe:animate-spin motion-reduce:animate-none text-emerald-200" />
              </div>

              <p className="mt-6 text-xs font-semibold tracking-[0.42em] text-emerald-300 uppercase">
                {joinCopy.waiting.statusLabel}
              </p>
              <h1 className={`mt-4 text-3xl font-black text-white sm:text-5xl ${rubik.className}`}>
                {joinCopy.waiting.title}
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                {joinCopy.waiting.description}
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
                  {joinCopy.teamBadge(assignedTeamName)}
                </div>
              ) : null}

              {isStaggeredRace && typeof assignedStartOffset === "number" ? (
                <p className="mx-auto mt-4 max-w-xs text-sm font-semibold text-emerald-200">
                  Jeres første post er post {assignedStartOffset + 1}.
                </p>
              ) : null}
            </div>

            <WifiConnectionTip className="mx-auto mt-6 max-w-2xl" text={siteCopy.wifiTip} />

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
              {joinCopy.scheduleError.eyebrow}
            </p>
            <h1 className={`mt-4 text-3xl font-black text-white sm:text-4xl ${rubik.className}`}>
              {joinCopy.scheduleError.title}
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base leading-7 text-rose-50/80 sm:text-lg">
              {joinCopy.scheduleError.description}
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
              {joinCopy.scheduleError.retryButton}
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
              {joinCopy.expired.eyebrow}
            </p>
            <h1 className={`mt-4 text-3xl font-black text-white sm:text-4xl ${rubik.className}`}>
              {joinCopy.expired.title}
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
              {joinCopy.expired.retryButton}
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
              {joinCopy.missingSession.eyebrow}
            </p>
            <h1 className={`mt-3 text-2xl font-black text-white sm:text-3xl ${rubik.className}`}>
              {joinCopy.missingSession.title}
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/80 sm:text-base">
              {joinCopy.missingSession.description}
            </p>

            <div className="mt-6">
              <Link
                href="/"
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-[1.2rem] border border-emerald-300/30 bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_18px_38px_rgba(16,185,129,0.24)] transition hover:brightness-110 active:scale-[0.99]"
              >
                {joinCopy.missingSession.homeButton}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/20 bg-slate-900/60 p-5 text-white shadow-[0_36px_100px_rgba(0,0,0,0.55)] backdrop-blur-2xl sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_30%),linear-gradient(145deg,rgba(255,255,255,0.04),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />

        <div className="relative">
          <p className="text-center text-sm font-bold tracking-[0.22em] text-emerald-200 uppercase">
            {siteCopy.home.brandLabel}
          </p>
          <h1 className={`text-center text-3xl font-black text-white sm:text-4xl ${rubik.className}`}>
            {joinCopy.form.title}
          </h1>
          <p className="mt-3 text-center text-sm leading-6 text-slate-300 sm:text-base">
            {step === "name" && runTitle
              ? runTitle
              : joinCopy.form.description}
          </p>

          {browserPlatform === "ios" && !showInAppWarning ? (
            <div className="mt-4 rounded-2xl border border-sky-400/25 bg-sky-400/10 px-4 py-3 text-left text-sm text-sky-100 backdrop-blur-md">
              <p className="font-bold text-sky-50">{joinCopy.form.iosHintTitle}</p>
              <p className="mt-1 leading-5 text-sky-100/90">
                {joinCopy.form.iosHintDescription}
              </p>
            </div>
          ) : null}

          {showInAppWarning ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200 backdrop-blur-md">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span className="flex-1 leading-5">
                <strong className="font-bold">
                  {browserPlatform === "ios"
                    ? joinCopy.form.inAppWarningIosStrong
                    : joinCopy.form.inAppWarningAndroidStrong}
                </strong>{" "}
                {browserPlatform === "ios"
                  ? joinCopy.form.inAppWarningIosBody
                  : joinCopy.form.inAppWarningAndroidBody}
              </span>
              <button
                type="button"
                className="shrink-0 text-amber-300/70 hover:text-amber-200"
                onClick={() => setShowInAppWarning(false)}
                aria-label={joinCopy.form.dismissWarningLabel}
              >
                ×
              </button>
            </div>
          ) : null}

          <form onSubmit={handleJoin} className="mt-8 space-y-5">
            {error ? (
              <div
                id="join-error"
                className="rounded-2xl border border-rose-300/25 bg-rose-400/10 p-3 text-center text-sm text-rose-100 backdrop-blur-md"
                role="alert"
                aria-live="polite"
              >
                {error}
              </div>
            ) : null}

            {step === "code" ? (
              <>
                <div>
                  <label
                    htmlFor="join-code"
                    className="mb-2 block text-base font-semibold text-slate-100"
                  >
                    {joinCopy.form.codeLabel}
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-emerald-300/70">
                      <KeyRound className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <input
                      id="join-code"
                      type="text"
                      placeholder={joinCopy.form.codePlaceholder}
                      value={pin}
                      onChange={(event) => {
                        setPin(normalizeJoinCode(event.target.value));
                        setError("");
                      }}
                      className="min-h-16 w-full rounded-[1.5rem] border border-emerald-500/50 bg-slate-950 py-4 pr-5 pl-11 text-center font-mono text-2xl font-black tracking-[0.24em] text-white shadow-[0_0_24px_rgba(16,185,129,0.12)] shadow-inner outline-none transition placeholder:text-base placeholder:font-semibold placeholder:tracking-normal placeholder:text-emerald-100/35 focus-visible:border-emerald-300 focus-visible:ring-4 focus-visible:ring-emerald-300/20 sm:text-3xl"
                      inputMode="text"
                      autoCapitalize="characters"
                      autoComplete="one-time-code"
                      spellCheck={false}
                      disabled={isJoining}
                      aria-describedby={error ? "join-error" : undefined}
                    />
                  </div>
                </div>

                <QRScannerModal
                  buttonClassName="min-h-12 w-full justify-center rounded-2xl text-sm normal-case tracking-normal"
                  copy={siteCopy.qrScanner}
                  onCodeScanned={lookupJoinCode}
                />
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/8 px-4 py-3 text-sm text-emerald-50">
                  <p className="font-bold">{runTitle || joinCopy.form.title}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("code");
                      setPin("");
                      setName("");
                      setSessionId(null);
                      setRunTitle("");
                      setRaceType(null);
                      setError("");
                    }}
                    className="mt-2 min-h-11 rounded-lg text-sm font-semibold text-emerald-200 underline decoration-emerald-300/40 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                  >
                    {joinCopy.form.changeCodeButton}
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="join-name"
                    className="mb-2 block text-base font-semibold text-slate-100"
                  >
                    {joinCopy.form.nameLabel}
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-emerald-300/70">
                      <User className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <input
                      id="join-name"
                      type="text"
                      placeholder={joinCopy.form.namePlaceholder}
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setError("");
                      }}
                      className="min-h-14 w-full rounded-[1.4rem] border border-white/20 bg-slate-950 py-4 pr-4 pl-12 text-lg font-semibold text-white shadow-inner outline-none transition placeholder:text-slate-500 focus-visible:border-emerald-300 focus-visible:ring-4 focus-visible:ring-emerald-300/20"
                      autoComplete="off"
                      disabled={isJoining}
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isJoining}
              className="mt-2 mb-6 w-full rounded-[1.6rem] border border-emerald-500/30 bg-emerald-500/10 py-4 text-base font-black tracking-[0.28em] text-emerald-300 uppercase shadow-[0_0_30px_rgba(16,185,129,0.22)] transition-all hover:bg-emerald-500 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isJoining ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none" />
                  {joinCopy.form.submitPending}
                </span>
              ) : (
                step === "code"
                  ? joinCopy.form.continueButton
                  : joinCopy.form.submitButton
              )}
            </button>
          </form>

          {step === "code" ? (
          <details className="mt-5 rounded-[1.35rem] border border-white/10 bg-slate-950/45 px-4 py-3 text-left shadow-[0_10px_24px_rgba(2,6,23,0.16)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-100">
              <span>{joinCopy.form.troubleshootingTitle}</span>
              <span className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/70">{joinCopy.form.troubleshootingToggle}</span>
            </summary>

            <div className="mt-4 space-y-4">
              <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
                {joinCopy.form.troubleshootingParagraphs.map((paragraph) => (
                  <li key={paragraph}>{paragraph}</li>
                ))}
              </ul>

              <Link
                href="/"
                className="inline-flex items-center text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
              >
                {joinCopy.form.homeButton}
              </Link>
            </div>
          </details>
          ) : null}
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
            <Loader2 size={32} className="motion-safe:animate-spin motion-reduce:animate-none" />
          </div>
        }
      >
        <JoinForm />
      </Suspense>
    </div>
  );
}
