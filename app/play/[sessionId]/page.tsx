"use client";

import dynamic from "next/dynamic";
import { Crosshair } from "lucide-react";
import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";

import GPSManager from "@/components/play/GPSManager";
import { usePlayGameState } from "@/components/play/GameState";
import PlayInterface from "@/components/play/PlayInterface";

const MapDisplay = dynamic(() => import("@/components/play/MapDisplay"), { ssr: false });

function PlayScreen() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const initialStudentName = searchParams.get("name")?.trim() || "";
  const game = usePlayGameState({ sessionId, initialStudentName });
  const isTrackingEnabled =
    Boolean(sessionId) &&
    game.progress.questions.length > 0 &&
    !game.progress.screen.isFinished &&
    !game.progress.screen.isKicked &&
    game.player.hasConfirmedName;

  return (
    <>
      <GPSManager
        enabled={isTrackingEnabled}
        target={game.progress.map.targetLocation}
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
      <PlayInterface ui={game} actions={game.actions}>
        <MapDisplay
          playerLocation={game.progress.map.playerLocation}
          targetLocation={game.progress.map.targetLocation}
          targetLabel={game.progress.map.targetLabel}
          playerName={game.progress.map.playerName}
          dimmed={game.flags.isRoleplayImmersed}
        />
      </PlayInterface>
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
