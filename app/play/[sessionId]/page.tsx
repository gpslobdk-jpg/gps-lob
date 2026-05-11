"use client";

import dynamic from "next/dynamic";
import { Crosshair, MapPin, RefreshCcw } from "lucide-react";
import { Suspense, useCallback, useState, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

import { FullscreenWarning } from "@/components/ui/FullscreenWarning";
import GPSManager from "@/components/play/GPSManager";
import { usePlayGameState } from "@/components/play/GameState";
import PlayInterface from "@/components/play/PlayInterface";
import StrategoElevInterface from "@/components/play/StrategoElevInterface";
import ZoneKrigElevInterface from "@/components/play/ZoneKrigElevInterface";

const MapDisplay = dynamic(() => import("@/components/play/MapDisplay"), { ssr: false });

type GpsGuardErrorType =
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "unknown";

function getGpsGuardCopy(errorType: GpsGuardErrorType | null) {
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

function GpsGuardOverlay({
  visible,
  errorType,
  onRetry,
  isRetrying,
}: {
  visible: boolean;
  errorType: GpsGuardErrorType | null;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  if (!visible) {
    return null;
  }

  const copy = getGpsGuardCopy(errorType);

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
              <RefreshCcw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
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
  const [gpsGuardVisible, setGpsGuardVisible] = useState(false);
  const [gpsGuardErrorType, setGpsGuardErrorType] = useState<GpsGuardErrorType | null>(null);
  const [gpsRestartNonce, setGpsRestartNonce] = useState(0);
  const [isGpsRetrying, setIsGpsRetrying] = useState(false);
  const gpsRetryLockedRef = useRef(false);
  const gpsRetryUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const initialStudentName = searchParams.get("name")?.trim() || "";
  const game = usePlayGameState({ sessionId, initialStudentName });
  const isZoneKrig = game.progress.raceMode === "zone_krig";
  const isStratego = game.progress.raceMode === "stratego";
  const handleGpsRetry = useCallback(() => {
    if (gpsRetryLockedRef.current) return;
    gpsRetryLockedRef.current = true;
    setIsGpsRetrying(true);
    setGpsRestartNonce((current) => current + 1);
    if (gpsRetryUnlockTimerRef.current) {
      clearTimeout(gpsRetryUnlockTimerRef.current);
    }
    gpsRetryUnlockTimerRef.current = setTimeout(() => {
      gpsRetryLockedRef.current = false;
      setIsGpsRetrying(false);
    }, 3500);
  }, []);
  useEffect(() => {
    return () => {
      if (gpsRetryUnlockTimerRef.current) {
        clearTimeout(gpsRetryUnlockTimerRef.current);
      }
    };
  }, []);
  const isTrackingEnabled =
    Boolean(sessionId) &&
    (game.progress.questions.length > 0 || game.flags.isStrategoRace) &&
    !game.progress.screen.isFinished &&
    !game.progress.screen.isKicked &&
    game.progress.screen.mode !== "load_error" &&
    game.player.hasConfirmedName &&
    game.player.hasCompletedAvatarGate &&
    Boolean(game.player.participantId);

  return (
    <>
      <FullscreenWarning />
      <GPSManager
        enabled={isTrackingEnabled}
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
        onGpsErrorChange={setGpsGuardVisible}
        onGpsErrorTypeChange={setGpsGuardErrorType}
        restartNonce={gpsRestartNonce}
      />
      {isZoneKrig ? (
        <ZoneKrigElevInterface sessionId={sessionId} ui={game} actions={game.actions} />
      ) : isStratego ? (
        <StrategoElevInterface sessionId={sessionId} ui={game} actions={game.actions} />
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
            distanceToTargetMeters={game.progress.map.distanceToTargetMeters}
            onTargetClick={game.actions.unlockCurrentPost}
          />
        </PlayInterface>
      )}
      <GpsGuardOverlay
        visible={isTrackingEnabled && gpsGuardVisible}
        errorType={gpsGuardErrorType}
        onRetry={handleGpsRetry}
        isRetrying={isGpsRetrying}
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
