"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { AlertCircle, CheckCircle2, KeyRound, Loader2, Radio, Shield, Swords, Target, Timer, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import StudentRulesSheet from "./StudentRulesSheet";
import type { PlayActions, PlayUiState } from "./types";
import TeacherBroadcastModal from "./TeacherBroadcastModal";
import type { ZoneKrigGameTeam, ZoneKrigGameZone } from "./ZoneKrigElevMap";
import StudentAvatarGateView from "./shared/StudentAvatarGateView";
import StudentNameGateView from "./shared/StudentNameGateView";
import { createClient } from "@/utils/supabase/client";
import WifiConnectionTip from "@/components/WifiConnectionTip";

const ZoneKrigElevMap = dynamic(() => import("./ZoneKrigElevMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-96 w-full items-center justify-center rounded-4xl border border-white/10 bg-slate-900/60 text-cyan-100">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  ),
});

type ZoneKrigElevInterfaceProps = {
  sessionId?: string;
  ui: PlayUiState;
  actions: PlayActions;
};

type ZoneKrigSessionRow = {
  status?: string | null;
  ends_at?: string | null;
};

const DEFAULT_MAP_CENTER: [number, number] = [55.6761, 12.5683];

function formatDistance(distance: number | null) {
  if (distance === null) return "GPS måler...";
  return `${distance} m`;
}

function formatShieldCountdown(shieldUntil: string | null, nowMs: number) {
  if (!shieldUntil) return null;
  const shieldUntilMs = new Date(shieldUntil).getTime();
  if (!Number.isFinite(shieldUntilMs) || shieldUntilMs <= nowMs) return null;

  const totalSeconds = Math.ceil((shieldUntilMs - nowMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getZoneStatusMessage(
  zone: ZoneKrigGameZone | null,
  owner: ZoneKrigGameTeam | null,
  myTeamId: string | null,
  nowMs: number
) {
  if (!zone) return "Ingen zone valgt";
  if (!zone.owner_team_id) return "Neutral zone. Svar korrekt for at overtage den.";

  const shieldCountdown = formatShieldCountdown(zone.shield_until, nowMs);
  if (myTeamId && zone.owner_team_id === myTeamId) {
    return shieldCountdown
      ? `I ejer denne zone. Zonen er beskyttet i ${shieldCountdown}.`
      : "I ejer denne zone.";
  }

  const ownerLabel = owner?.team_name ?? "et andet hold";
  return shieldCountdown
    ? `Zonen ejes af ${ownerLabel} og er beskyttet i ${shieldCountdown}.`
    : `Zonen ejes af ${ownerLabel}. Svar korrekt for at overtage den.`;
}

function getZoneCaptureFeedbackClasses(status: NonNullable<PlayUiState["progress"]["currentPost"]["activeZoneKrigCaptureFeedback"]>["status"]) {
  switch (status) {
    case "captured":
      return "border-emerald-300/30 bg-emerald-500/15 text-emerald-100";
    case "blocked_by_shield":
      return "border-amber-300/30 bg-amber-500/15 text-amber-100";
    case "already_owned":
      return "border-cyan-300/30 bg-cyan-500/15 text-cyan-100";
    case "zone_missing":
      return "border-rose-300/30 bg-rose-500/15 text-rose-100";
    case "game_over":
      return "border-amber-300/30 bg-amber-500/15 text-amber-100";
    case "capture_failed":
      return "border-rose-300/30 bg-rose-500/15 text-rose-100";
    default:
      return "border-white/10 bg-white/5 text-white";
  }
}

function deriveMapCenter(zones: ZoneKrigGameZone[], playerLocation: PlayUiState["gps"]["myLoc"]) {
  if (playerLocation) {
    return [playerLocation.lat, playerLocation.lng] as [number, number];
  }

  const validZones = zones.filter((zone) => Number.isFinite(zone.center_lat) && Number.isFinite(zone.center_lng));
  if (validZones.length === 0) {
    return DEFAULT_MAP_CENTER;
  }

  const lat = validZones.reduce((sum, zone) => sum + zone.center_lat, 0) / validZones.length;
  const lng = validZones.reduce((sum, zone) => sum + zone.center_lng, 0) / validZones.length;
  return [lat, lng] as [number, number];
}

function formatMatchCountdown(remainingMs: number | null) {
  if (remainingMs === null) return "--:--";
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function deriveZoneKrigWinner(teams: ZoneKrigGameTeam[], zones: ZoneKrigGameZone[]) {
  const zonesOwnedByTeam = new Map<string, number>(teams.map((team) => [team.id, 0]));

  for (const zone of zones) {
    if (!zone.owner_team_id) continue;
    zonesOwnedByTeam.set(zone.owner_team_id, (zonesOwnedByTeam.get(zone.owner_team_id) ?? 0) + 1);
  }

  const rankedTeams = teams
    .map((team) => ({
      team,
      ownedZones: zonesOwnedByTeam.get(team.id) ?? 0,
    }))
    .sort((left, right) => right.ownedZones - left.ownedZones);

  const topOwnedZones = rankedTeams[0]?.ownedZones ?? 0;
  const tiedTeams = rankedTeams.filter((entry) => entry.ownedZones === topOwnedZones);

  return {
    topOwnedZones,
    winner: topOwnedZones > 0 && tiedTeams.length === 1 ? tiedTeams[0]?.team ?? null : null,
    isTie: topOwnedZones > 0 && tiedTeams.length > 1,
  };
}

export default function ZoneKrigElevInterface({ sessionId, ui, actions }: ZoneKrigElevInterfaceProps) {
  const { player, gps, progress, flags } = ui;
  const [zones, setZones] = useState<ZoneKrigGameZone[]>([]);
  const [teams, setTeams] = useState<ZoneKrigGameTeam[]>([]);
  const [isBattlefieldLoading, setIsBattlefieldLoading] = useState(true);
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isRetryingConnection, setIsRetryingConnection] = useState(false);
  const [isResettingFromExpired, setIsResettingFromExpired] = useState(false);
  const [showRetrySlowHint, setShowRetrySlowHint] = useState(false);
  const retryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // One stable participant client per mount – avoids creating new GoTrueClient
  // instances inside effects, which compete for the same navigator.locks entry.
  const supabase = useMemo(() => createClient({ authScope: "participant" }), []);
  const avatarPreviewUrl = player.pendingAvatarUrl ?? player.avatarUrl;

  const selectedZone = zones.find((zone) => zone.zone_index === progress.currentPostIndex) ?? null;
  const selectedQuestion = progress.currentPost.activeQuestion;

  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const myTeam = player.teamId ? teamMap.get(player.teamId) ?? null : null;
  const selectedZoneOwner = selectedZone?.owner_team_id ? teamMap.get(selectedZone.owner_team_id) ?? null : null;
  const mapCenter = useMemo(
    () => deriveMapCenter(zones, gps.myLoc),
    [gps.myLoc, zones]
  );
  const selectedZoneAnswered = progress.answeredPostIndexes.includes(progress.currentPostIndex);
  const zoneCaptureFeedback = progress.currentPost.activeZoneKrigCaptureFeedback;
  const distanceToSelectedZone = formatDistance(gps.distance);
  const isAnswerSubmissionPending =
    (flags.isSubmittingAnswer || flags.isSubmitting) &&
    progress.currentPost.activeQuizAnswerFeedback?.tone !== "success";
  const canUnlockSelectedZone =
    flags.gpsOverrideEnabled ||
    (gps.autoUnlockRadius !== null && gps.distance !== null && gps.distance <= gps.autoUnlockRadius) ||
    flags.canManualUnlock;

  const myZoneCount = zones.filter((zone) => zone.owner_team_id === player.teamId).length;
  const neutralZoneCount = zones.filter((zone) => zone.owner_team_id === null).length;
  const winnerSummary = useMemo(() => deriveZoneKrigWinner(teams, zones), [teams, zones]);
  const remainingMs = useMemo(() => {
    if (!endsAt) return null;
    const endsAtMs = new Date(endsAt).getTime();
    if (!Number.isFinite(endsAtMs)) return null;
    return Math.max(0, endsAtMs - countdownNowMs);
  }, [countdownNowMs, endsAt]);
  const countdownLabel = formatMatchCountdown(remainingMs);
  const selectedZoneStatusMessage = getZoneStatusMessage(
    selectedZone,
    selectedZoneOwner,
    player.teamId,
    countdownNowMs
  );
  const isMatchOver =
    progress.screen.mode === "finished" ||
    sessionStatus === "finished" ||
    (remainingMs !== null && remainingMs <= 0);
  const isParticipantAuthExpired = progress.screen.loadErrorVariant === "participant_auth_expired";
  const isJoinSessionMissing = progress.screen.loadErrorVariant === "join_session_missing";

  const returnToJoin = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.assign("/join");
    }
  }, []);

  const startConnectionRetry = useCallback(
    (fn: () => void) => {
      setIsRetryingConnection(true);
      setShowRetrySlowHint(false);
      retryTimersRef.current.forEach(clearTimeout);
      retryTimersRef.current = [
        setTimeout(() => setShowRetrySlowHint(true), 2000),
        setTimeout(() => setIsRetryingConnection(false), 6000),
      ];
      fn();
    },
    [],
  );

  const handleRetryConnection = useCallback(() => {
    startConnectionRetry(actions.reloadPage);
  }, [startConnectionRetry, actions.reloadPage]);

  const handleResetFromExpiredWithFeedback = useCallback(() => {
    setIsResettingFromExpired(true);
    actions.resetFromExpired();
  }, [actions]);

  useEffect(() => {
    return () => {
      retryTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (
      progress.screen.mode === "load_error" ||
      !sessionId ||
      !player.hasConfirmedName ||
      !player.hasCompletedAvatarGate ||
      !player.participantId
    ) {
      return;
    }

    let isActive = true;

    const loadBattlefield = async () => {
      try {
        const [teamsRes, zonesRes, sessionRes] = await Promise.all([
          supabase.from("game_teams").select("id,team_name,color,score").eq("session_id", sessionId),
          supabase
            .from("game_zones")
            .select("id,session_id,zone_index,center_lat,center_lng,radius_m,owner_team_id,shield_until")
            .eq("session_id", sessionId)
            .order("zone_index"),
          supabase
            .from("live_sessions")
            .select("status,ends_at")
            .eq("id", sessionId)
            .maybeSingle<ZoneKrigSessionRow>(),
        ]);

        if (!isActive) return;

        setTeams((teamsRes.data ?? []) as ZoneKrigGameTeam[]);
        setZones((zonesRes.data ?? []) as ZoneKrigGameZone[]);
        setSessionStatus(sessionRes.data?.status ?? null);
        setEndsAt(sessionRes.data?.ends_at ?? null);
      } finally {
        if (isActive) {
          setIsBattlefieldLoading(false);
        }
      }
    };

    void loadBattlefield();

    const teamsChannel = supabase
      .channel(`zone-krig-elev-teams-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_teams", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (!isActive) return;

          if (payload.eventType === "INSERT") {
            setTeams((previous) => [...previous, payload.new as ZoneKrigGameTeam]);
            return;
          }

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as ZoneKrigGameTeam;
            setTeams((previous) => previous.map((team) => (team.id === updated.id ? updated : team)));
            return;
          }

          if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id?: string };
            setTeams((previous) => previous.filter((team) => team.id !== deleted.id));
          }
        }
      )
      .subscribe();

    const zonesChannel = supabase
      .channel(`zone-krig-elev-zones-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_zones", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (!isActive) return;

          if (payload.eventType === "INSERT") {
            const inserted = payload.new as ZoneKrigGameZone;
            setZones((previous) => [...previous, inserted].sort((a, b) => a.zone_index - b.zone_index));
            return;
          }

          if (payload.eventType === "UPDATE") {
            const updated = payload.new as ZoneKrigGameZone;
            setZones((previous) => previous.map((zone) => (zone.id === updated.id ? updated : zone)));
            return;
          }

          if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id?: string };
            setZones((previous) => previous.filter((zone) => zone.id !== deleted.id));
          }
        }
      )
      .subscribe();

    const sessionChannel = supabase
      .channel(`zone-krig-elev-session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          if (!isActive) return;
          const updated = payload.new as ZoneKrigSessionRow;
          setSessionStatus(updated.status ?? null);
          setEndsAt(updated.ends_at ?? null);
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      void supabase.removeChannel(teamsChannel);
      void supabase.removeChannel(zonesChannel);
      void supabase.removeChannel(sessionChannel);
    };
  }, [player.hasCompletedAvatarGate, player.hasConfirmedName, player.participantId, progress.screen.mode, sessionId]);

  useEffect(() => {
    if (
      progress.screen.mode === "load_error" ||
      sessionStatus === "finished" ||
      (!endsAt && !selectedZone?.shield_until)
    ) {
      return;
    }

    setCountdownNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setCountdownNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [endsAt, progress.screen.mode, selectedZone?.shield_until, sessionStatus]);

  if (progress.screen.mode === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-cyan-100">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin" />
          <p className="mt-4 text-sm text-white/70">Indlæser slagmarken...</p>
        </div>
      </div>
    );
  }

  if (progress.screen.mode === "load_error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-md rounded-4xl border border-rose-400/30 bg-rose-950/60 p-8 text-center shadow-2xl">
          {isParticipantAuthExpired ? (
            <KeyRound className="mx-auto h-10 w-10 text-rose-200" />
          ) : isJoinSessionMissing ? (
            <XCircle className="mx-auto h-10 w-10 text-rose-200" />
          ) : (
            <AlertCircle className="mx-auto h-10 w-10 text-rose-200" />
          )}
          <h1 className="mt-4 text-2xl font-black">
            {isParticipantAuthExpired
              ? "Hov, du har været væk lidt længe!"
              : isJoinSessionMissing
                ? "Løbet er muligvis afsluttet"
                : "Slagmarken kunne ikke indlæses"}
          </h1>
          <p className="mt-3 text-sm text-rose-100/75">{progress.screen.loadError}</p>
          {isParticipantAuthExpired ? (
            <>
              <p className="mt-3 text-xs text-rose-100/60">
                Dit adgangskort er udløbet. Tryk på &quot;Start forfra&quot; for at rydde op og starte en ny session.
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleResetFromExpiredWithFeedback}
                  disabled={isResettingFromExpired || isRetryingConnection}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition-all active:scale-95 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResettingFromExpired ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Rydder op...</>
                  ) : "Start forfra"}
                </button>
                <button
                  type="button"
                  onClick={handleRetryConnection}
                  disabled={isRetryingConnection || isResettingFromExpired}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-transparent px-5 py-3 text-sm font-bold text-white/80 transition-all active:scale-95 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRetryingConnection ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Genopretter...</>
                  ) : "Genopret forbindelse"}
                </button>
              </div>
              {showRetrySlowHint && (
                <div className="mt-3 flex flex-col gap-1">
                  <p className="text-center text-xs text-rose-100/60">
                    Vi forsøger at genoprette forbindelsen...
                  </p>
                  <p className="text-center text-xs text-rose-100/50">
                    Prøv at skifte til mobildata og tryk &quot;Genopret forbindelse&quot; igen.
                  </p>
                </div>
              )}
              <WifiConnectionTip className="mt-6 text-left" />
            </>
          ) : isJoinSessionMissing ? (
            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={returnToJoin}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition-all active:scale-95 active:opacity-80"
              >
                Gå til join
              </button>
              <button
                type="button"
                onClick={handleRetryConnection}
                disabled={isRetryingConnection}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-transparent px-5 py-3 text-sm font-bold text-white/80 transition-all active:scale-95 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRetryingConnection ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Genopretter...</>
                ) : "Prøv igen"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleRetryConnection}
              disabled={isRetryingConnection}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition-all active:scale-95 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRetryingConnection ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Genopretter...</>
              ) : "Prøv igen"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (progress.screen.mode === "waiting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="gpslob-waiting-enter w-full max-w-lg rounded-4xl border border-cyan-400/20 bg-slate-900/70 p-8 text-center shadow-2xl backdrop-blur-xl">
          <Radio className="mx-auto h-10 w-10 animate-pulse text-cyan-300" />
          <h1 className="mt-4 text-3xl font-black">Kommandocentralen kalibrerer</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">Du er registreret. Vent på at læreren starter Zone Krig.</p>
          <div className="mt-6 rounded-[1.7rem] border border-cyan-300/20 bg-cyan-500/10 px-5 py-5 text-left shadow-[0_18px_40px_rgba(34,211,238,0.12)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-100/70">Enhed registreret</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-full border border-cyan-200/30 bg-slate-950 shadow-[0_0_0_4px_rgba(34,211,238,0.12)]">
                {player.avatarUrl ? (
                  <Image
                    src={player.avatarUrl}
                    alt="Hold-avatar"
                    fill
                    className="object-cover"
                    unoptimized
                    loader={({ src }) => src}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.24),transparent_55%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,1))] text-xl">
                    <span aria-hidden="true">⚔️</span>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-lg font-black text-white">{player.activeDisplayName}</p>
                <p className="mt-1 text-sm text-white/65">
                  {player.avatarUrl ? "Avatar klar til kortet" : "Standard markør valgt"}
                </p>
              </div>
            </div>
          </div>
          {myTeam ? (
            <div
              className="mx-auto mt-5 inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold text-white"
              style={{
                borderColor: myTeam.color ?? "rgba(34,211,238,0.35)",
                backgroundColor: myTeam.color ? `${myTeam.color}22` : "rgba(34,211,238,0.12)",
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: myTeam.color ?? "#22d3ee" }}
              />
              <span className="truncate">Du er på {myTeam.team_name} hold!</span>
            </div>
          ) : null}
          <WifiConnectionTip className="mt-6" />
        </div>
      </div>
    );
  }

  if (progress.screen.mode === "kicked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-lg rounded-4xl border border-rose-400/20 bg-slate-900/70 p-8 text-center shadow-2xl backdrop-blur-xl">
          <Shield className="mx-auto h-10 w-10 text-rose-300" />
          <h1 className="mt-4 text-3xl font-black">Du er blevet fjernet fra kampen</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">Kontakt læreren, hvis det er en fejl.</p>
        </div>
      </div>
    );
  }

  if (isMatchOver) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-2xl rounded-4xl border border-amber-300/20 bg-slate-900/80 p-8 text-center shadow-2xl backdrop-blur-xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-amber-300/30 bg-amber-500/10">
            <CheckCircle2 className="h-8 w-8 text-amber-200" />
          </div>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.38em] text-amber-300/80">
            Game Over
          </p>
          <h1 className="mt-4 break-words text-4xl font-black sm:text-5xl">
            {winnerSummary.winner
              ? `${winnerSummary.winner.team_name.toUpperCase()} VINDER!`
              : winnerSummary.isTie
                ? "DET ENDER UAFGJORT!"
                : "KAMPEN ER AFSLUTTET"}
          </h1>
          <p className="mx-auto mt-4 max-w-xl break-words text-sm leading-7 text-white/75 sm:text-base">
            {remainingMs !== null && remainingMs <= 0
              ? "Tiden er ude!"
              : "Zone Krig er afsluttet af læreren."}{" "}
            {winnerSummary.winner
              ? `${winnerSummary.winner.team_name} holdet står øverst med ${winnerSummary.topOwnedZones} zoner.`
              : winnerSummary.isTie
                ? `Flere hold sluttede lige med ${winnerSummary.topOwnedZones} zoner hver.`
                : "Ingen hold nåede at overtage en zone før slutfløjtet."}
          </p>
          <div className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white">
            <Timer className="h-4 w-4 text-amber-300" />
            Sluttid: {countdownLabel}
          </div>
          {myTeam ? (
            <div
              className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold text-white"
              style={{
                borderColor: myTeam.color ?? "rgba(34,211,238,0.35)",
                backgroundColor: myTeam.color ? `${myTeam.color}22` : "rgba(34,211,238,0.12)",
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: myTeam.color ?? "#22d3ee" }}
              />
              Dit hold sluttede med {myZoneCount} zoner.
            </div>
          ) : null}
          <p className="hidden">Zone Krig er lukket. Vent på resultatet fra læreren.</p>
        </div>
      </div>
    );
  }

  if (progress.screen.mode === "name_gate") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <StudentNameGateView
          tone="cyan"
          title="Registrér holdet"
          description="Skriv holdnavnet først. Derefter kan I vælge en frivillig hold-avatar, før kampen starter."
          label="Holdnavn"
          placeholder="Skriv holdnavn"
          helperText="Holdnavnet bruges til holdlister og lærerens live-overblik."
          value={player.pendingPlayerName}
          error={player.nameError}
          isSubmitting={flags.isProvisioningParticipant}
          submitLabel="Klar"
          submittingLabel="Forbinder til slagmarken..."
          onChange={actions.setPendingPlayerName}
          onSubmit={actions.confirmName}
        />
      </div>
    );
  }

  if (progress.screen.mode === "avatar_gate") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <StudentAvatarGateView
          tone="cyan"
          title="Vælg enheds-avatar"
          description="Tag en frivillig hold-selfie, eller spring over og brug standardmarkøren på slagmarken."
          playerName={player.playerName || player.pendingPlayerName || "Jeres hold"}
          avatarPreviewUrl={avatarPreviewUrl}
          previewAlt="Preview af hold-selfie"
          helperText="Selfien bliver kun brugt lokalt på enheden og gør jeres markør nemmere at kende under kampen."
          captureLabel="Tag en hold-selfie"
          replaceLabel="Tag et nyt billede"
          confirmLabel="Brug denne avatar"
          skipLabel="Spring over uden avatar"
          onPreviewChange={actions.setPendingAvatarUrl}
          onComplete={actions.completeAvatarSetup}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-900/80 px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-cyan-300">
                  <Swords className="h-5 w-5" />
                  <span className="text-xs font-black uppercase tracking-[0.3em]">Zone Krig</span>
                </div>

                <h1 className="mt-2 truncate text-2xl font-black sm:text-3xl">{player.activeDisplayName}</h1>
                <p className="mt-1 truncate text-sm text-white/60">
                  {myTeam ? `${myTeam.team_name} er i kamp` : "Holdforbindelse mangler"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsRulesOpen(true)}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 text-xs font-bold text-white/78 transition hover:bg-white/10 hover:text-white"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/12 bg-white/8 text-[11px] font-black text-white/90">
                  ?
                </span>
                Regler
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Dine zoner</p>
              <p className="mt-2 text-2xl font-black">{myZoneCount}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Neutrale</p>
              <p className="mt-2 text-2xl font-black">{neutralZoneCount}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Målzone</p>
              <p className="mt-2 text-2xl font-black">Z{progress.currentPostIndex + 1}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Distance</p>
              <p className="mt-2 text-2xl font-black">{distanceToSelectedZone}</p>
            </div>
            <div className="rounded-3xl border border-amber-300/20 bg-amber-500/10 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.24em] text-amber-100/65">Tid tilbage</p>
              <p className="mt-2 flex items-center gap-2 text-2xl font-black text-amber-100">
                <Timer className="h-5 w-5 text-amber-300" />
                {countdownLabel}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)] lg:px-6">
        <section className="overflow-hidden rounded-4xl border border-white/10 bg-slate-900/60 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Live slagmark</p>
              <p className="mt-1 text-sm text-white/55">Tryk på en zone for at vælge dit næste angreb.</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/65">
              {isBattlefieldLoading ? "Synkroniserer..." : `${zones.length} zoner live`}
            </div>
          </div>

          <div className="h-[55svh] min-h-104 w-full">
            <ZoneKrigElevMap
              center={mapCenter}
              zones={zones}
              teams={teams}
              playerLocation={gps.myLoc}
              avatarUrl={player.avatarUrl}
              selectedZoneIndex={progress.currentPostIndex}
              onSelectZone={actions.selectPostIndex}
            />
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-4xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Valgt zone</p>
                <h2 className="mt-2 text-2xl font-black">{selectedZone ? `Zone ${selectedZone.zone_index + 1}` : "Ingen zone"}</h2>
                <p className="mt-2 text-sm leading-6 text-white/65">{selectedZoneStatusMessage}</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60">
                {selectedZone ? `${selectedZone.radius_m} m` : "-"}
              </div>
            </div>

            {selectedZoneAnswered ? (
              <div className="mt-4 rounded-3xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-100">
                Dit forsøg på denne zone er brugt. En anden spiller på holdet kan angribe en zone senere.
              </div>
            ) : null}

            {!progress.showQuestion ? (
              <>
                <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                  <div className="flex items-center justify-between gap-3">
                    <span>Afstand til zone</span>
                    <span className="font-black text-white">{distanceToSelectedZone}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span>Spørgsmålet åbner ved</span>
                    <span className="font-black text-white">{gps.autoUnlockRadius ?? 0} m</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!selectedZone || !canUnlockSelectedZone || selectedZoneAnswered}
                  onClick={actions.unlockCurrentPost}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-cyan-500 px-5 py-4 text-sm font-black uppercase tracking-[0.24em] text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/40"
                >
                  <Target className="h-5 w-5" />
                  {selectedZoneAnswered
                    ? "Forsøg brugt"
                    : flags.canManualUnlock && !flags.gpsOverrideEnabled && !canUnlockSelectedZone
                    ? "Manuel åbning"
                    : "Åbn zone-spørgsmål"}
                </button>

                {progress.currentPost.activePostActionError ? (
                  <p className="mt-3 text-sm leading-6 text-rose-300">
                    {progress.currentPost.activePostActionError}
                  </p>
                ) : !selectedZoneAnswered && !canUnlockSelectedZone ? (
                  <p className="mt-3 text-sm text-white/50">
                    Gå tættere på den valgte zone for at låse spørgsmålet op.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Spørgsmål</p>
                <h3 className="mt-3 text-lg font-black leading-7">{selectedQuestion?.text ?? "Spørgsmålet mangler."}</h3>

                {!selectedZoneAnswered ? (
                  <div className="mt-4 grid gap-3">
                    {(selectedQuestion?.answers ?? []).map((answer, index) => {
                      const feedback = progress.currentPost.activeQuizAnswerFeedback;
                      const isSuccess = feedback?.tone === "success" && feedback.selectedIndex === index;
                      const isError = feedback?.tone === "error" && feedback.selectedIndex === index;

                      return (
                        <button
                          key={`${progress.currentPostIndex}-${index}`}
                          type="button"
                          disabled={flags.isSubmittingAnswer || flags.isSubmitting || progress.currentPost.activeQuizAnswerFeedback?.tone === "success"}
                          onClick={() => void actions.submitQuizAnswer(index)}
                          className={`rounded-3xl border px-4 py-4 text-left text-sm font-semibold transition ${
                            isSuccess
                              ? "border-emerald-300/40 bg-emerald-500/20 text-emerald-100"
                              : isError
                                ? "border-rose-300/35 bg-rose-500/15 text-rose-50"
                                : "border-white/10 bg-slate-950/70 text-white hover:border-cyan-400/40 hover:bg-slate-900"
                          }`}
                        >
                          {answer}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/80">
                    <p>Dit forsøg på denne zone er brugt. Gå tilbage til kortet.</p>
                  </div>
                )}

                {isAnswerSubmissionPending ? (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sender svar...
                  </div>
                ) : null}

                {progress.currentPost.activeTypedAnswerError ? (
                  <p className="mt-4 text-sm text-rose-300">{progress.currentPost.activeTypedAnswerError}</p>
                ) : null}

                {zoneCaptureFeedback ? (
                  <div className={`mt-4 rounded-3xl border px-4 py-3 text-sm ${getZoneCaptureFeedbackClasses(zoneCaptureFeedback.status)}`}>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] opacity-80">Zone-status</div>
                    <p className="mt-2 leading-6">{zoneCaptureFeedback.message}</p>
                  </div>
                ) : null}

                {progress.currentPost.activeQuizAnswerFeedback?.tone === "success" || selectedZoneAnswered ? (
                  <button
                    type="button"
                    onClick={() => void actions.continueFromSolvedPost()}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-emerald-500 px-5 py-4 text-sm font-black uppercase tracking-[0.24em] text-slate-950"
                  >
                    <CheckCircle2 className="h-5 w-5" />
                    Tilbage til kortet
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={actions.dismissCurrentPost}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-sm font-bold text-white/80"
                  >
                    Luk spørgsmål
                  </button>
                )}
              </div>
            )}
          </section>

          <section className="rounded-4xl border border-white/10 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Zonevælger</p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {zones.map((zone) => {
                const owner = zone.owner_team_id ? teamMap.get(zone.owner_team_id) ?? null : null;
                const isSelected = zone.zone_index === progress.currentPostIndex;
                const isMine = Boolean(player.teamId && zone.owner_team_id === player.teamId);
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => actions.selectPostIndex(zone.zone_index)}
                    className={`rounded-3xl border px-3 py-3 text-left transition ${
                      isSelected
                        ? "border-white/30 bg-white/12 text-white"
                        : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
                    }`}
                  >
                    <div className="truncate text-sm font-black">Zone {zone.zone_index + 1}</div>
                    <div className="mt-1 truncate text-xs" style={{ color: owner?.color ?? "#cbd5e1" }}>
                      {isMine ? "Din zone" : owner ? owner.team_name : "Neutral"}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <TeacherBroadcastModal
            message={progress.feedback.latestMessage}
            onDismiss={actions.dismissLatestMessage}
          />
        </aside>
      </div>

      <StudentRulesSheet
        open={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        gameType="zone-krig"
      />
    </div>
  );
}
