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
import { leaveAppBreadcrumb } from "@/utils/observability";
import QRScannerModal from "@/components/QRScannerModal";
import WifiConnectionTip from "@/components/WifiConnectionTip";
import { getSiteCopy } from "@/lib/siteCopy";
import { DEFAULT_SITE_VARIANT, resolveSiteVariantFromHost, type SiteVariantKey } from "@/lib/siteVariant";
import {
  readStoredActiveParticipant,
  saveStoredActiveParticipant,
  clearStoredActiveParticipant,
  clearStoredPlaySnapshot,
} from "@/components/play/playUtils";
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

type JoinBrowserPlatform = "ios" | "android" | "other";

type JoinRequestStage = "lookup" | "register" | "connection_check";

type ConnectionCheckResult = {
  tone: "success" | "warning";
  title: string;
  detail: string;
};

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

const CONNECTION_CHECK_TIMEOUT_MS = 10_000;

const JOIN_TIMEOUT_ABORT_REASON = "join-request-timeout";

const JOIN_PIN_LENGTH = 6;

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
  sessionId: string | null,
  payload: Record<string, unknown>
) {
  try {
    sendTelemetry(eventName, {
      session_id: sessionId,
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

type JoinFormProps = {
  initialSiteVariantKey: SiteVariantKey;
};

function JoinForm({ initialSiteVariantKey }: JoinFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const pinFromQuery = (searchParams.get("pin") || "").replace(/\D/g, "").slice(0, JOIN_PIN_LENGTH);
  const [siteVariantKey, setSiteVariantKey] = useState<SiteVariantKey>(initialSiteVariantKey);
  const siteCopy = getSiteCopy(siteVariantKey);
  const joinCopy = siteCopy.join;

  const [pin, setPin] = useState(pinFromQuery);
  const [name, setName] = useState("");
  const [view, setView] = useState<JoinView>("form");
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [runTitle, setRunTitle] = useState("");
  const [schedule, setSchedule] = useState<RunSchedule | null>(null);
  const [raceType, setRaceType] = useState<string | null>(null);
  const [expiredMessage, setExpiredMessage] = useState(joinCopy.defaultExpiredMessage);
  const [assignedTeamName, setAssignedTeamName] = useState<string | null>(null);
  const [assignedTeamColor, setAssignedTeamColor] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [connectionCheckResult, setConnectionCheckResult] = useState<ConnectionCheckResult | null>(null);
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [showHomescreenTip, setShowHomescreenTip] = useState(false);
  const [browserPlatform, setBrowserPlatform] = useState<JoinBrowserPlatform>("other");
  const joinLockRef = useRef(false);
  const isMissingSessionNotice = searchParams.get("missingSession") === "1";
  const isZoneKrig = raceType === "zone_krig";
  const trimmedName = name.trim();
  const trimmedPin = pin.trim();
  const canSubmit = trimmedPin.length === JOIN_PIN_LENGTH && trimmedName.length > 0;

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

    // Capacitor-appen er allerede en native app — vis ikke "Tilføj til hjemmeskærm"-tipset.
    setShowHomescreenTip(
      !isCapacitorApp && isMobileBrowser && !isStandalone && !isKnownInApp && !isAndroidWebView && !isIosWebView,
    );
  }, []);

  const handleConnectionCheck = async () => {
    if (isCheckingConnection) {
      return;
    }

    const isOnline = typeof navigator === "undefined" ? null : navigator.onLine;
    if (isOnline === false) {
      const offlineResult: ConnectionCheckResult = {
        tone: "warning",
        title: joinCopy.connectionCheck.offlineTitle,
        detail: joinCopy.connectionCheck.offlineDetail,
      };

      setConnectionCheckResult(offlineResult);
      trackJoinTelemetry("join_connection_check", null, {
        result: "offline",
        online: false,
        platform: browserPlatform,
        reason: "offline",
        show_in_app_warning: showInAppWarning,
      });
      return;
    }

    setIsCheckingConnection(true);
    setConnectionCheckResult(null);

    const checkStartedAt = Date.now();
    const pinForCheck = trimmedPin.length === JOIN_PIN_LENGTH ? trimmedPin : "000000";

    try {
      const response = await fetchWithRetry(
        `/api/join?pin=${encodeURIComponent(pinForCheck)}`,
        {
          cache: "no-store",
        },
        1,
        CONNECTION_CHECK_TIMEOUT_MS,
        "connection_check"
      );
      const result: ConnectionCheckResult = response.ok
        ? {
            tone: "success",
            title: joinCopy.connectionCheck.okTitle,
            detail:
              browserPlatform === "ios"
                ? joinCopy.connectionCheck.okDetailIos
                : joinCopy.connectionCheck.okDetailDefault,
          }
        : {
            tone: "warning",
            title: joinCopy.connectionCheck.serverErrorTitle,
            detail: joinCopy.connectionCheck.serverErrorDetail(response.status),
          };

      setConnectionCheckResult(result);
      trackJoinTelemetry("join_connection_check", null, {
        result: response.ok ? "ok" : "http_error",
        ok: response.ok,
        duration_ms: Date.now() - checkStartedAt,
        status_code: response.status,
        online: isOnline,
        platform: browserPlatform,
        reason: response.ok ? "ok" : "http_error",
        show_in_app_warning: showInAppWarning,
        used_entered_pin: trimmedPin.length === JOIN_PIN_LENGTH,
      });
    } catch (error) {
      const result: ConnectionCheckResult = {
        tone: "warning",
        title: joinCopy.connectionCheck.offlineTitle,
        detail: joinCopy.connectionCheck.offlineDetail,
      };

      setConnectionCheckResult(result);
      trackJoinTelemetry("join_connection_check", null, {
        result: error instanceof JoinRequestTimeoutError ? "timeout" : "error",
        ok: false,
        duration_ms: Date.now() - checkStartedAt,
        status_code: null,
        online: isOnline,
        platform: browserPlatform,
        reason: error instanceof JoinRequestTimeoutError ? "timeout" : "error",
        show_in_app_warning: showInAppWarning,
      });
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const resetToForm = () => {
    setView("form");
    setError("");
    setSessionId(null);
    setRunTitle("");
    setSchedule(null);
    setRaceType(null);
    setExpiredMessage(joinCopy.defaultExpiredMessage);
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
      setError(joinCopy.fillPinAndName);
      return;
    }

    if (trimmedPin.length !== JOIN_PIN_LENGTH) {
      setError(joinCopy.pinLength(JOIN_PIN_LENGTH));
      return;
    }

    joinLockRef.current = true;
    setIsJoining(true);
    setConnectionCheckResult(null);
    let shouldReleaseLock = true;
    let activeSessionId: string | null = null;
    let currentStage: JoinRequestStage = "lookup";

    try {
      try {
        leaveAppBreadcrumb("join_attempt", {
          has_pin: trimmedPin.length > 0,
          pin_length: trimmedPin.length,
          has_name: trimmedName.length > 0,
          name_length: trimmedName.length,
          online: typeof navigator !== "undefined" ? navigator.onLine : null,
          platform: browserPlatform,
          show_in_app_warning: showInAppWarning,
        });
      } catch (_) {}

      Sentry.addBreadcrumb({
        category: "join",
        message: "join_attempt",
        data: {
          has_pin: trimmedPin.length > 0,
          pin_length: trimmedPin.length,
          has_name: trimmedName.length > 0,
          name_length: trimmedName.length,
          online: typeof navigator !== "undefined" ? navigator.onLine : null,
          platform: browserPlatform,
          show_in_app_warning: showInAppWarning,
        },
      });
    } catch (err) {
      // best-effort
    }

    try {
      const lookupStart = Date.now();
      const response = await fetchWithRetry(
        `/api/join?pin=${encodeURIComponent(trimmedPin)}`,
        {
          cache: "no-store",
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
        setError(joinCopy.rateLimit);
        return;
      }

      const joinData = (await response.json()) as JoinLookupResponse | JoinLookupErrorResponse;

      if (response.status === 404 || ("kind" in joinData && joinData.kind === "invalid")) {
        try {
          Sentry.withScope((scope) => {
            scope.setExtras({
              has_pin: trimmedPin.length > 0,
              pin_length: trimmedPin.length,
              has_name: trimmedName.length > 0,
              name_length: trimmedName.length,
              platform: browserPlatform,
              online: typeof navigator !== "undefined" ? navigator.onLine : null,
            });
            Sentry.captureMessage("Join lookup invalid or 404", "info");
          });
        } catch (err) {
          // best-effort
        }
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
        setError(joinCopy.rateLimit);
        return;
      }

      const registerData = (await registerResponse.json().catch(() => null)) as
        | JoinParticipantResponse
        | JoinLookupErrorResponse
        | null;

      if (registerResponse.status === 404 || registerResponse.status === 410) {
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

      // If joining a different session/participant, clear any stale stored state
      if (existingParticipant && !shouldPreserveExistingParticipant) {
        try {
          const _telemetryPayload = {
            has_pin: trimmedPin.length > 0,
            pin_length: trimmedPin.length,
            existingSessionId: existingParticipant.sessionId,
            existingParticipantId: existingParticipant.participantId,
            newSessionId: registerData.sessionId,
          };

          try {
            trackJoinTelemetry(
              "clearing_stored_participant_due_to_session_mismatch",
              registerData.sessionId ?? null,
              _telemetryPayload
            );
          } catch (_) {}

          try {
            leaveAppBreadcrumb("clearing_stored_participant_due_to_session_mismatch", _telemetryPayload);
          } catch (_) {}
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
        setError(joinCopy.timeout);
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
                <div className="absolute inset-0 rounded-full border border-emerald-300/20 animate-pulse" />
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
              <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 p-8 shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-pulse">
                <div className="absolute inset-3 rounded-full border border-emerald-300/20" />
                <div className="absolute inset-0 rounded-full border border-emerald-300/20" />
                <div className="absolute h-px w-14 bg-emerald-300/35" />
                <div className="absolute h-14 w-px bg-emerald-300/35" />
                <Loader2 className="relative z-10 h-10 w-10 animate-spin text-emerald-200" />
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
          <h1 className={`text-center text-3xl font-black text-white sm:text-4xl ${rubik.className}`}>
            {joinCopy.form.title}
          </h1>
          <p className="mt-3 text-center text-sm leading-6 text-slate-300 sm:text-base">
            {joinCopy.form.description}
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
                placeholder={joinCopy.form.codePlaceholder}
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

            <QRScannerModal buttonClassName="w-full justify-center" copy={siteCopy.qrScanner} />

            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-emerald-300/70">
                <User className="h-5 w-5" />
              </div>
              <input
                type="text"
                placeholder={joinCopy.form.namePlaceholder}
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
                  {joinCopy.form.submitPending}
                </span>
              ) : (
                joinCopy.form.submitButton
              )}
            </button>

            <div className="-mt-2 flex flex-col items-center gap-2 text-center">
              <button
                type="button"
                onClick={handleConnectionCheck}
                disabled={isJoining || isCheckingConnection}
                className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isCheckingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isCheckingConnection ? joinCopy.form.checkConnectionPending : joinCopy.form.checkConnectionButton}
              </button>

              {connectionCheckResult ? (
                <div
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm backdrop-blur-md ${
                    connectionCheckResult.tone === "success"
                      ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-50"
                      : "border-amber-400/25 bg-amber-400/10 text-amber-100"
                  }`}
                >
                  <p className="font-bold">{connectionCheckResult.title}</p>
                  <p className="mt-1 leading-5 opacity-90">{connectionCheckResult.detail}</p>
                </div>
              ) : null}
            </div>
          </form>

          <details className="mt-5 rounded-[1.35rem] border border-white/10 bg-slate-950/45 px-4 py-3 text-left shadow-[0_10px_24px_rgba(2,6,23,0.16)]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-100">
              <span>{joinCopy.form.troubleshootingTitle}</span>
              <span className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/70">{joinCopy.form.troubleshootingToggle}</span>
            </summary>

            <div className="mt-4 space-y-4">
              <p className="text-sm leading-6 text-slate-300">
                {joinCopy.form.troubleshootingParagraphs[0]}
              </p>

              <p className="text-sm leading-6 text-slate-300">
                {joinCopy.form.troubleshootingParagraphs[1]}
              </p>

              <p className="text-sm leading-6 text-slate-300">
                {joinCopy.form.troubleshootingParagraphs[2]}
              </p>

              <WifiConnectionTip className="shadow-none" text={siteCopy.wifiTip} />

              {showHomescreenTip ? (
                <div className="rounded-[1.2rem] border border-emerald-300/12 bg-slate-900/45 px-4 py-3 shadow-[0_10px_24px_rgba(2,6,23,0.16)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/75">
                    {joinCopy.form.homescreenTitle}
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-200/88">
                    {joinCopy.form.homescreenBody}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {joinCopy.form.homescreenIos}
                    <br />
                    {joinCopy.form.homescreenAndroid}
                  </p>
                </div>
              ) : null}

              <Link
                href="/"
                className="inline-flex items-center text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
              >
                {joinCopy.form.homeButton}
              </Link>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

type JoinPageProps = {
  initialSiteVariantKey?: SiteVariantKey;
};

export default function JoinPage(props: any) {
  const { initialSiteVariantKey = DEFAULT_SITE_VARIANT.key } = (props ?? {}) as JoinPageProps;

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
        <JoinForm initialSiteVariantKey={initialSiteVariantKey} />
      </Suspense>
    </div>
  );
}
