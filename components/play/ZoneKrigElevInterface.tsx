"use client";

import dynamic from "next/dynamic";
import { AlertCircle, CheckCircle2, Crosshair, Loader2, Radio, Shield, Swords, Target, Timer } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { PlayActions, PlayUiState } from "./types";
import TeacherBroadcastModal from "./TeacherBroadcastModal";
import type { ZoneKrigGameTeam, ZoneKrigGameZone } from "./ZoneKrigElevMap";
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

function getZoneStatusLabel(zone: ZoneKrigGameZone | null, owner: ZoneKrigGameTeam | null) {
  if (!zone) return "Ingen zone valgt";
  if (!owner) return "Neutral zone";
  return `Ejes af ${owner.team_name}`;
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

  const selectedZone = zones.find((zone) => zone.zone_index === progress.currentPostIndex) ?? null;
  const selectedQuestion = progress.currentPost.activeQuestion;

  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const myTeam = player.teamId ? teamMap.get(player.teamId) ?? null : null;
  const selectedZoneOwner = selectedZone?.owner_team_id ? teamMap.get(selectedZone.owner_team_id) ?? null : null;
  const mapCenter = useMemo(
    () => deriveMapCenter(zones, gps.myLoc),
    [gps.myLoc, zones]
  );
  const selectedZoneSolved = progress.solvedPostIndexes.includes(progress.currentPostIndex);
  const zoneCaptureFeedback = progress.currentPost.activeZoneKrigCaptureFeedback;
  const distanceToSelectedZone = formatDistance(gps.distance);
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
  const isMatchOver =
    progress.screen.mode === "finished" ||
    sessionStatus === "finished" ||
    (remainingMs !== null && remainingMs <= 0);

  useEffect(() => {
    if (!sessionId || !player.hasConfirmedName || !player.participantId) {
      return;
    }

    const supabase = createClient({ participantId: player.participantId, sessionId });
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
  }, [player.hasConfirmedName, player.participantId, sessionId]);

  useEffect(() => {
    if (!endsAt || sessionStatus === "finished") {
      return;
    }

    setCountdownNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setCountdownNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [endsAt, sessionStatus]);

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
          <AlertCircle className="mx-auto h-10 w-10 text-rose-200" />
          <h1 className="mt-4 text-2xl font-black">Slagmarken kunne ikke indlæses</h1>
          <p className="mt-3 text-sm text-rose-100/75">{progress.screen.loadError}</p>
          <button
            type="button"
            onClick={actions.reloadPage}
            className="mt-6 inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white"
          >
            Prøv igen
          </button>
        </div>
      </div>
    );
  }

  if (progress.screen.mode === "waiting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-lg rounded-4xl border border-cyan-400/20 bg-slate-900/70 p-8 text-center shadow-2xl backdrop-blur-xl">
          <Radio className="mx-auto h-10 w-10 animate-pulse text-cyan-300" />
          <h1 className="mt-4 text-3xl font-black">Kommandocentralen kalibrerer</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">Du er registreret. Vent på at læreren starter Zone Krig.</p>
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
              Du er på {myTeam.team_name} hold!
            </div>
          ) : null}
          <WifiConnectionTip className="mt-6" />
        </div>
      </div>
    );
  }

  if (progress.screen.mode === "gps_blocked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-lg rounded-4xl border border-amber-400/20 bg-slate-900/70 p-8 text-center shadow-2xl backdrop-blur-xl">
          <Crosshair className="mx-auto h-10 w-10 text-amber-300" />
          <h1 className="mt-4 text-3xl font-black">GPS kræves for at kæmpe</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">{gps.gpsErrorContent?.message ?? "Aktivér GPS for at fortsætte."}</p>
          <p className="mt-2 text-xs text-white/50">{gps.gpsErrorContent?.helper}</p>
          <button
            type="button"
            onClick={actions.reloadPage}
            className="mt-6 inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white"
          >
            Opdater siden
          </button>
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
          <h1 className="mt-4 text-4xl font-black sm:text-5xl">
            {winnerSummary.winner
              ? `${winnerSummary.winner.team_name.toUpperCase()} VINDER!`
              : winnerSummary.isTie
                ? "DET ENDER UAFGJORT!"
                : "KAMPEN ER AFSLUTTET"}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/75 sm:text-base">
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
    const handleNameSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      actions.confirmName(player.pendingPlayerName);
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <form onSubmit={handleNameSubmit} className="w-full max-w-md rounded-4xl border border-cyan-400/20 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl">
          <h1 className="text-3xl font-black">Identificér agenten</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">Indtast dit navn for at få adgang til slagmarken.</p>
          <input
            type="text"
            value={player.pendingPlayerName}
            onChange={(event) => actions.setPendingPlayerName(event.target.value)}
            disabled={flags.isProvisioningParticipant}
            className="mt-6 w-full rounded-3xl border border-white/10 bg-slate-950 px-4 py-4 text-base text-white outline-none focus:border-cyan-400"
            placeholder="Dit navn"
          />
          {player.nameError ? <p className="mt-3 text-sm text-rose-300">{player.nameError}</p> : null}
          <button
            type="submit"
            disabled={flags.isProvisioningParticipant}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-cyan-500 px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/45"
          >
            {flags.isProvisioningParticipant ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Forbinder til slagmarken...
              </>
            ) : (
              "Gå til slagmarken"
            )}
          </button>
          {flags.isProvisioningParticipant ? (
            <p className="mt-3 text-sm text-cyan-100/70">Vi opretter din plads i kampen og synkroniserer slagmarken.</p>
          ) : null}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-900/80 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-300">
              <Swords className="h-5 w-5" />
              <span className="text-xs font-black uppercase tracking-[0.3em]">Zone Krig</span>
            </div>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl">{player.activeDisplayName}</h1>
            <p className="mt-1 text-sm text-white/60">{myTeam ? `${myTeam.team_name} er i kamp` : "Holdforbindelse mangler"}</p>
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

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)] lg:px-6">
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
                <p className="mt-2 text-sm text-white/65">{getZoneStatusLabel(selectedZone, selectedZoneOwner)}</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60">
                {selectedZone ? `${selectedZone.radius_m} m` : "-"}
              </div>
            </div>

            {selectedZoneSolved ? (
              <div className="mt-4 rounded-3xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                Denne zone er allerede løst af dig tidligere. Du kan stadig angribe den igen, hvis kampen kræver det.
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
                  disabled={!selectedZone || !canUnlockSelectedZone}
                  onClick={actions.unlockCurrentPost}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-3xl bg-cyan-500 px-5 py-4 text-sm font-black uppercase tracking-[0.24em] text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/40"
                >
                  <Target className="h-5 w-5" />
                  {flags.canManualUnlock && !flags.gpsOverrideEnabled && !canUnlockSelectedZone
                    ? "Manuel åbning"
                    : "Åbn zone-spørgsmål"}
                </button>

                {!canUnlockSelectedZone ? (
                  <p className="mt-3 text-sm text-white/50">
                    Gå tættere på den valgte zone for at låse spørgsmålet op.
                  </p>
                ) : null}
              </>
            ) : (
              <div className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">Spørgsmål</p>
                <h3 className="mt-3 text-lg font-black leading-7">{selectedQuestion?.text ?? "Spørgsmålet mangler."}</h3>

                <div className="mt-4 grid gap-3">
                  {(selectedQuestion?.answers ?? []).map((answer, index) => {
                    const feedback = progress.currentPost.activeQuizAnswerFeedback;
                    const isSuccess = feedback?.tone === "success" && feedback.selectedIndex === index;
                    const isError = feedback?.tone === "error" && feedback.selectedIndex === index;

                    return (
                      <button
                        key={`${progress.currentPostIndex}-${index}`}
                        type="button"
                        disabled={flags.isSubmittingAnswer || progress.currentPost.activeQuizAnswerFeedback?.tone === "success"}
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

                {progress.currentPost.activeTypedAnswerError ? (
                  <p className="mt-4 text-sm text-rose-300">{progress.currentPost.activeTypedAnswerError}</p>
                ) : null}

                {zoneCaptureFeedback ? (
                  <div className={`mt-4 rounded-3xl border px-4 py-3 text-sm ${getZoneCaptureFeedbackClasses(zoneCaptureFeedback.status)}`}>
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] opacity-80">Zone-status</div>
                    <p className="mt-2 leading-6">{zoneCaptureFeedback.message}</p>
                  </div>
                ) : null}

                {progress.currentPost.activeQuizAnswerFeedback?.tone === "success" ? (
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
                    <div className="text-sm font-black">Zone {zone.zone_index + 1}</div>
                    <div className="mt-1 text-xs" style={{ color: owner?.color ?? "#cbd5e1" }}>
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
    </div>
  );
}
