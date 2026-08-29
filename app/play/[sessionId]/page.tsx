"use client";

import dynamic from "next/dynamic";
import { Crosshair, MapPin, RefreshCcw } from "lucide-react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import GPSManager, {
  type GpsErrorType,
  type StudentLocationRuntimeState,
} from "@/components/play/GPSManager";
import { usePlayGameState } from "@/components/play/GameState";
import PlayInterface from "@/components/play/PlayInterface";
import StudentConnectionStatus from "@/components/play/StudentConnectionStatus";
import StudentLocationStatus from "@/components/play/StudentLocationStatus";
import StandardPlayLocationStatus from "@/components/play/standard/StandardPlayLocationStatus";
import { FullscreenWarning } from "@/components/ui/FullscreenWarning";
import {
  resolveStudentLocationState,
  type StudentLocationPermission,
} from "@/lib/location/studentLocationState";

const MapDisplay = dynamic(() => import("@/components/play/MapDisplay"), {
  ssr: false,
});

const INITIAL_LOCATION_RUNTIME: StudentLocationRuntimeState = {
  supported: true,
  isLocating: false,
  hasPosition: false,
  observedAtMs: 0,
  positionTimestampMs: null,
  accuracyMeters: null,
  errorType: null,
  resumedAtMs: null,
};

function ModeLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-sm text-emerald-200">
      Indlæser spiltilstand...
    </div>
  );
}

const StrategoElevInterface = dynamic(
  () => import("@/components/play/StrategoElevInterface"),
  {
    ssr: false,
    loading: () => <ModeLoadingState />,
  }
);

const ZoneKrigElevInterface = dynamic(
  () => import("@/components/play/ZoneKrigElevInterface"),
  {
    ssr: false,
    loading: () => <ModeLoadingState />,
  }
);

function getLegacyGpsGuardCopy(errorType: GpsErrorType | null) {
  switch (errorType) {
    case "permission_denied":
      return {
        title: "GPS er blokeret",
        description:
          "Giv GPS Løb adgang til placering i dine iPhone- eller browserindstillinger, og prøv igen.",
      };
    case "position_unavailable":
      return {
        title: "Vi kan ikke finde dit GPS-signal",
        description:
          "Gå gerne udenfor eller tættere på et vindue. Vi prøver igen automatisk.",
      };
    case "timeout":
      return {
        title: "GPS bruger lidt tid",
        description: "Bliv på siden. Vi prøver igen automatisk.",
      };
    default:
      return {
        title: "Din GPS holder en lille pause",
        description:
          "Vi har problemer med at finde din placering. Tjek GPS og internet, og prøv igen.",
      };
  }
}

function LegacyGpsGuardOverlay({
  visible,
  errorType,
  onRetry,
  isRetrying,
}: {
  visible: boolean;
  errorType: GpsErrorType | null;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  if (!visible) {
    return null;
  }

  const copy = getLegacyGpsGuardCopy(errorType);

  return (
    <div className="fixed inset-0 z-[2200] flex items-center justify-center bg-slate-950/65 px-5 backdrop-blur-xl">
      <div className="pointer-events-auto relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-emerald-300/25 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.96))] p-6 text-white shadow-[0_32px_90px_rgba(2,6,23,0.62)] sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.14),transparent_36%)]" />
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] ring-1 ring-white/5" />

        <div className="relative z-10">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-400/12 text-emerald-200 shadow-[0_0_24px_rgba(16,185,129,0.18)]">
            <MapPin className="h-7 w-7" />
          </div>

          <p className="text-[11px] font-semibold tracking-[0.32em] text-emerald-200/70 uppercase">
            GPS-guide
          </p>
          <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
            {copy.title}
          </h2>
          <p className="mt-4 max-w-lg text-sm leading-6 text-white/80 sm:text-base">
            {copy.description}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              aria-busy={isRetrying}
              className="inline-flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-[1.25rem] border border-emerald-300/30 bg-gradient-to-r from-emerald-500 to-teal-400 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 shadow-[0_18px_38px_rgba(16,185,129,0.24)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100 disabled:active:scale-100"
            >
              <RefreshCcw
                className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
              />
              {isRetrying ? "Prøver igen..." : "Prøv igen"}
            </button>
          </div>

          <p className="mt-4 text-xs leading-5 text-white/55">
            Når GPS’en vågner igen, lukker vi denne besked automatisk.
          </p>
        </div>
      </div>
    </div>
  );
}

function PlayScreen() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const [gpsRestartNonce, setGpsRestartNonce] = useState(0);
  const [isLocationAttemptActive, setIsLocationAttemptActive] = useState(false);
  const [hasRequestedLocation, setHasRequestedLocation] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [locationPermission, setLocationPermission] =
    useState<StudentLocationPermission>("unknown");
  const [locationRuntime, setLocationRuntime] =
    useState<StudentLocationRuntimeState>(INITIAL_LOCATION_RUNTIME);
  const [isOnline, setIsOnline] = useState(true);
  const [legacyGpsGuardVisible, setLegacyGpsGuardVisible] = useState(false);
  const [legacyGpsGuardErrorType, setLegacyGpsGuardErrorType] =
    useState<GpsErrorType | null>(null);
  const [isLegacyGpsRetrying, setIsLegacyGpsRetrying] = useState(false);
  const locationAttemptLockedRef = useRef(false);
  const locationAttemptTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const legacyGpsRetryLockedRef = useRef(false);
  const legacyGpsRetryTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId)
    ? rawSessionId[0]
    : rawSessionId;
  const initialStudentName = searchParams.get("name")?.trim() || "";
  const game = usePlayGameState({ sessionId, initialStudentName });
  const isZoneKrig = game.progress.raceMode === "zone_krig";
  const isStratego = game.progress.raceMode === "stratego";
  const usesStandardLocation =
    game.flags.usesStandardStudentLocationExperience;
  const usesStandardPlayExperience =
    usesStandardLocation &&
    game.progress.raceMode === "quiz" &&
    (game.progress.currentPost.activePostVariant === "quiz" ||
      game.progress.currentPost.activePostVariant === "character");

  const baseTrackingEnabled =
    Boolean(sessionId) &&
    (game.progress.questions.length > 0 || game.flags.isStrategoRace) &&
    !game.progress.screen.isFinished &&
    !game.progress.screen.isKicked &&
    game.progress.screen.mode !== "load_error" &&
    game.player.hasConfirmedName &&
    game.player.hasCompletedAvatarGate &&
    Boolean(game.player.participantId);
  const standardLocationRequired =
    usesStandardLocation && !game.flags.gpsOverrideEnabled;
  const showStandardLocationStatus =
    baseTrackingEnabled &&
    standardLocationRequired &&
    !game.progress.showQuestion;
  const isTrackingEnabled =
    baseTrackingEnabled &&
    (usesStandardLocation
      ? !game.flags.gpsOverrideEnabled && hasRequestedLocation
      : true);

  const handleLegacyGpsRetry = useCallback(() => {
    if (legacyGpsRetryLockedRef.current) {
      return;
    }

    legacyGpsRetryLockedRef.current = true;
    setIsLegacyGpsRetrying(true);
    setGpsRestartNonce((current) => current + 1);
    if (legacyGpsRetryTimerRef.current !== null) {
      clearTimeout(legacyGpsRetryTimerRef.current);
    }
    legacyGpsRetryTimerRef.current = setTimeout(() => {
      legacyGpsRetryLockedRef.current = false;
      setIsLegacyGpsRetrying(false);
      legacyGpsRetryTimerRef.current = null;
    }, 3_500);
  }, []);

  const finishLocationAttempt = useCallback(() => {
    locationAttemptLockedRef.current = false;
    setIsLocationAttemptActive(false);
    setIsRequestingPermission(false);
    if (locationAttemptTimerRef.current !== null) {
      clearTimeout(locationAttemptTimerRef.current);
      locationAttemptTimerRef.current = null;
    }
  }, []);

  const beginLocationAttempt = useCallback(
    (isRetry: boolean) => {
      if (locationAttemptLockedRef.current) {
        return;
      }

      locationAttemptLockedRef.current = true;
      setIsLocationAttemptActive(true);
      setIsRequestingPermission(true);
      if (isRetry) {
        setLocationPermission((current) =>
          current === "denied" ? "unknown" : current
        );
      }
      setLocationRuntime((current) => ({
        ...current,
        isLocating: true,
        errorType: null,
      }));

      if (hasRequestedLocation || isRetry) {
        setGpsRestartNonce((current) => current + 1);
      }
      setHasRequestedLocation(true);

      if (locationAttemptTimerRef.current !== null) {
        clearTimeout(locationAttemptTimerRef.current);
      }
      locationAttemptTimerRef.current = setTimeout(
        finishLocationAttempt,
        32_000
      );
    },
    [finishLocationAttempt, hasRequestedLocation]
  );

  const handleLocationRuntimeChange = useCallback(
    (nextRuntime: StudentLocationRuntimeState) => {
      setLocationRuntime(nextRuntime);

      if (nextRuntime.hasPosition && nextRuntime.errorType === null) {
        setLocationPermission("granted");
        setIsRequestingPermission(false);
      } else if (nextRuntime.errorType === "permission_denied") {
        setLocationPermission("denied");
      }

      if (!nextRuntime.isLocating) {
        finishLocationAttempt();
      }
    },
    [finishLocationAttempt]
  );

  useEffect(() => {
    const updateConnection = () => {
      setIsOnline(navigator.onLine);
    };

    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);

    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  useEffect(() => {
    if (!showStandardLocationStatus) {
      return;
    }

    if (!navigator.geolocation) {
      const unsupportedTimer = setTimeout(() => {
        setLocationRuntime({
          ...INITIAL_LOCATION_RUNTIME,
          supported: false,
          observedAtMs: Date.now(),
        });
        finishLocationAttempt();
      }, 0);
      return () => clearTimeout(unsupportedTimer);
    }

    if (!navigator.permissions?.query) {
      return;
    }

    let isCancelled = false;
    let permissionStatus: PermissionStatus | null = null;

    const applyPermissionState = () => {
      if (isCancelled || !permissionStatus) {
        return;
      }

      setLocationPermission(permissionStatus.state);
      if (permissionStatus.state === "granted") {
        setHasRequestedLocation(true);
      } else if (permissionStatus.state === "denied") {
        setHasRequestedLocation(false);
        finishLocationAttempt();
      }
    };

    void navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (isCancelled) {
          return;
        }
        permissionStatus = status;
        applyPermissionState();
        permissionStatus.addEventListener("change", applyPermissionState);
      })
      .catch(() => {
        if (!isCancelled) {
          setLocationPermission("unknown");
        }
      });

    return () => {
      isCancelled = true;
      permissionStatus?.removeEventListener("change", applyPermissionState);
    };
  }, [finishLocationAttempt, showStandardLocationStatus]);

  useEffect(() => {
    return () => {
      if (locationAttemptTimerRef.current !== null) {
        clearTimeout(locationAttemptTimerRef.current);
      }
      if (legacyGpsRetryTimerRef.current !== null) {
        clearTimeout(legacyGpsRetryTimerRef.current);
      }
    };
  }, []);

  const locationStateInput = {
    enabled: showStandardLocationStatus,
    supported: locationRuntime.supported,
    online: isOnline,
    permission: locationPermission,
    requesting: isRequestingPermission,
    locating: locationRuntime.isLocating,
    hasPosition: locationRuntime.hasPosition,
    timestampMs: locationRuntime.positionTimestampMs,
    accuracyMeters: locationRuntime.accuracyMeters,
    error: locationRuntime.errorType,
    resumedAtMs: locationRuntime.resumedAtMs,
    nowMs: locationRuntime.observedAtMs,
  };
  const locationState = resolveStudentLocationState(locationStateInput);
  const locationPresentationState =
    locationState.status === "offline"
      ? resolveStudentLocationState({
          ...locationStateInput,
          online: true,
        })
      : locationState;
  const canOpenFromFreshLocation =
    game.flags.canOpenCurrentPostFromDistance &&
    locationState.canUsePositionForUnlock;
  const currentPostLabel =
    game.progress.map.targetNumber !== null
      ? `Post ${game.progress.map.targetNumber}`
      : null;

  return (
    <>
      <FullscreenWarning />
      <GPSManager
        enabled={isTrackingEnabled}
        standardStudentLocationFlow={usesStandardLocation}
        allowAutomaticUnlock={!usesStandardLocation}
        target={game.progress.map.targetLocation}
        autoUnlockRadius={game.gps.autoUnlockRadius}
        currentPostIndex={game.progress.currentPostIndex}
        showQuestion={game.progress.showQuestion}
        dismissedPostIndex={game.progress.dismissedPostIndex}
        onLocationChange={game.actions.setLiveLocation}
        onDistanceChange={game.actions.setDistance}
        onAutoUnlock={game.actions.unlockCurrentPost}
        onDismissedReset={game.actions.clearDismissedPost}
        onSyncLocation={game.actions.syncParticipantLocation}
        onGpsErrorChange={
          usesStandardLocation ? undefined : setLegacyGpsGuardVisible
        }
        onGpsErrorTypeChange={
          usesStandardLocation ? undefined : setLegacyGpsGuardErrorType
        }
        onLocationRuntimeChange={handleLocationRuntimeChange}
        restartNonce={gpsRestartNonce}
      />
      {isZoneKrig ? (
        <ZoneKrigElevInterface
          sessionId={sessionId}
          ui={game}
          actions={game.actions}
        />
      ) : isStratego ? (
        <StrategoElevInterface
          sessionId={sessionId}
          ui={game}
          actions={game.actions}
        />
      ) : (
        <PlayInterface ui={game} actions={game.actions}>
          <MapDisplay
            playerLocation={game.progress.map.playerLocation}
            targetLocation={game.progress.map.targetLocation}
            targetLabel={game.progress.map.targetLabel}
            targetNumber={game.progress.map.targetNumber}
            playerName={game.progress.map.playerName}
            avatarUrl={game.progress.map.avatarUrl}
            dimmed={game.flags.isRoleplayImmersed}
            isNearTarget={game.progress.map.isNearTarget}
            canOpenTarget={game.progress.map.canOpenTarget}
            distanceToTargetMeters={
              game.progress.map.distanceToTargetMeters
            }
            onTargetClick={game.actions.unlockCurrentPost}
          />
        </PlayInterface>
      )}
      {showStandardLocationStatus ? (
        <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[2200] mx-auto max-w-md">
          {usesStandardPlayExperience ? (
            <StandardPlayLocationStatus
              state={locationPresentationState}
              postNumber={game.progress.displayPostNumber}
              totalPosts={game.progress.totalQuestions}
              distanceMeters={game.progress.map.distanceToTargetMeters}
              isNearTarget={game.progress.map.isNearTarget}
              onStart={() => beginLocationAttempt(false)}
              onRetry={() => beginLocationAttempt(true)}
              isRetrying={isLocationAttemptActive}
              canOpenCurrentPost={canOpenFromFreshLocation}
              onOpenCurrentPost={game.actions.unlockCurrentPost}
            />
          ) : (
            <StudentLocationStatus
              state={locationPresentationState}
              onStart={() => beginLocationAttempt(false)}
              onRetry={() => beginLocationAttempt(true)}
              isRetrying={isLocationAttemptActive}
              isStandardFlow
              currentPostLabel={currentPostLabel}
              canOpenCurrentPost={canOpenFromFreshLocation}
              onOpenCurrentPost={game.actions.unlockCurrentPost}
            />
          )}
        </div>
      ) : null}
      {usesStandardLocation ? (
        <StudentConnectionStatus
          reconnectConfirmationNonce={
            game.flags.reconnectConfirmationNonce
          }
        />
      ) : null}
      <LegacyGpsGuardOverlay
        visible={
          !usesStandardLocation &&
          isTrackingEnabled &&
          legacyGpsGuardVisible
        }
        errorType={legacyGpsGuardErrorType}
        onRetry={handleLegacyGpsRetry}
        isRetrying={isLegacyGpsRetrying}
      />
    </>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-950 text-emerald-200">
          <Crosshair className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <PlayScreen />
    </Suspense>
  );
}
