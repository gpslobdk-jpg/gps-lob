"use client";

import dynamic from "next/dynamic";
import { Crosshair } from "lucide-react";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import GPSManager from "@/components/play/GPSManager";
import { usePlayGameState } from "@/components/play/GameState";
import PlayInterface from "@/components/play/PlayInterface";
import StrategoElevInterface from "@/components/play/StrategoElevInterface";
import ZoneKrigElevInterface from "@/components/play/ZoneKrigElevInterface";

const MapDisplay = dynamic(() => import("@/components/play/MapDisplay"), { ssr: false });

function PlayScreen() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const initialStudentName = searchParams.get("name")?.trim() || "";
  const game = usePlayGameState({ sessionId, initialStudentName });
  const isZoneKrig = game.progress.raceMode === "zone_krig";
  const isStratego = game.progress.raceMode === "stratego";
  const isTrackingEnabled =
    Boolean(sessionId) &&
    (game.progress.questions.length > 0 || game.flags.isStrategoRace) &&
    !game.progress.screen.isFinished &&
    !game.progress.screen.isKicked &&
    game.player.hasConfirmedName &&
    Boolean(game.player.participantId);

  return (
    <>
      <GPSManager
        enabled={isTrackingEnabled}
        target={game.progress.map.targetLocation}
        autoUnlockRadius={game.gps.autoUnlockRadius}
        currentPostIndex={game.progress.currentPostIndex}
        showQuestion={game.progress.showQuestion}
        dismissedPostIndex={game.progress.dismissedPostIndex}
        onLocationChange={game.actions.setLiveLocation}
        onDistanceChange={game.actions.setDistance}
        onGpsError={game.actions.setGpsError}
        onAutoUnlock={game.actions.unlockCurrentPost}
        onDismissedReset={game.actions.clearDismissedPost}
        onSyncLocation={game.actions.syncParticipantLocation}
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
            playerName={game.progress.map.playerName}
            dimmed={game.flags.isRoleplayImmersed}
          />
        </PlayInterface>
      )}
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
