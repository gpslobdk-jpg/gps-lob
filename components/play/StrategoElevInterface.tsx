"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Crown,
  Crosshair,
  Loader2,
  Radio,
  Shield,
  Swords,
  Target,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import StrategoClashModal from "./StrategoClashModal";
import TeacherBroadcastModal from "./TeacherBroadcastModal";
import type { PlayActions, PlayUiState } from "./types";
import { createClient } from "@/utils/supabase/client";
import WifiConnectionTip from "@/components/WifiConnectionTip";

const StrategoElevMap = dynamic(() => import("./StrategoElevMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[60svh] w-full items-center justify-center rounded-[2rem] border border-white/10 bg-slate-900/60 text-cyan-100">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  ),
});

type StrategoElevInterfaceProps = {
  sessionId?: string;
  ui: PlayUiState;
  actions: PlayActions;
};

type StrategoRoleDefinitionRow = {
  rank_key?: string | null;
  display_name?: string | null;
  sort_order?: number | null;
};

type StrategoGameRow = {
  red_base_lat?: number | string | null;
  red_base_lng?: number | string | null;
  blue_base_lat?: number | string | null;
  blue_base_lng?: number | string | null;
  winner_team?: string | null;
};

type StrategoAllyRow = {
  participant_id?: string | null;
  student_name?: string | null;
  rank_key?: string | null;
};

const FALLBACK_ROLE_NAMES: Record<string, string> = {
  flag: "Fane",
  bomb: "Bombe",
  spy: "Spion",
  scout: "Spejder",
  miner: "Minør",
  sergeant: "Sergent",
  lieutenant: "Løjtnant",
  captain: "Kaptajn",
  major: "Major",
  colonel: "Oberst",
  general: "General",
  marshal: "Feltmarskal",
};

function getRoleGlyph(rankKey: string | null | undefined) {
  switch (rankKey) {
    case "flag":
      return "⚑";
    case "bomb":
      return "✹";
    case "spy":
      return "◉";
    case "scout":
      return "➤";
    case "miner":
      return "⛏";
    case "sergeant":
      return "S";
    case "lieutenant":
      return "L";
    case "captain":
      return "K";
    case "major":
      return "M";
    case "colonel":
      return "O";
    case "general":
      return "G";
    case "marshal":
      return "FM";
    default:
      return "?";
  }
}

function getRoleName(rankKey: string | null | undefined, roleNamesByKey: Map<string, string>) {
  if (!rankKey) {
    return "Ukendt rang";
  }

  return roleNamesByKey.get(rankKey) ?? FALLBACK_ROLE_NAMES[rankKey] ?? rankKey;
}

function getTeamTheme(teamCode: string | null | undefined) {
  if (teamCode === "blue") {
    return {
      label: "Hold Blå",
      accent: "text-sky-200",
      pill: "border-sky-300/25 bg-sky-500/12 text-sky-100",
      surface:
        "border-sky-300/18 bg-[linear-gradient(145deg,rgba(56,189,248,0.14),rgba(2,6,23,0.74))]",
    };
  }

  return {
    label: "Hold Rød",
    accent: "text-rose-200",
    pill: "border-rose-300/25 bg-rose-500/12 text-rose-100",
    surface:
      "border-rose-300/18 bg-[linear-gradient(145deg,rgba(244,63,94,0.14),rgba(2,6,23,0.74))]",
  };
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function buildFinishedMessage(winnerTeam: string | null | undefined, myTeamCode: string | null | undefined) {
  if (!winnerTeam) {
    return "Stratego er afsluttet. Vent på lærerens gennemgang af slaget.";
  }

  if (winnerTeam === myTeamCode) {
    return `Sejren er jeres. ${winnerTeam === "blue" ? "Hold Blå" : "Hold Rød"} tog fanen hjem.`;
  }

  return `${winnerTeam === "blue" ? "Hold Blå" : "Hold Rød"} vandt slaget.`;
}

export default function StrategoElevInterface({
  sessionId,
  ui,
  actions,
}: StrategoElevInterfaceProps) {
  const { player, gps, progress, stratego, flags } = ui;
  const [roleNamesByKey, setRoleNamesByKey] = useState<Map<string, string>>(new Map());
  const [allyMetaById, setAllyMetaById] = useState<
    Map<string, { displayName: string; rankKey: string | null }>
  >(new Map());
  const [strategoGame, setStrategoGame] = useState<StrategoGameRow | null>(null);

  const selfTeamCode = stratego.selfPlayer?.teamCode ?? null;
  const teamTheme = getTeamTheme(selfTeamCode);
  const allyIds = useMemo(
    () => [...new Set(stratego.allyPresence.map((entry) => entry.participantId))].sort(),
    [stratego.allyPresence]
  );
  const allyIdsKey = allyIds.join(",");

  useEffect(() => {
    if (!sessionId || !player.participantId) {
      return;
    }

    const supabase = createClient({ participantId: player.participantId, sessionId });
    let isActive = true;

    const loadStrategoMeta = async () => {
      const [rolesRes, gameRes] = await Promise.all([
        supabase
          .from("stratego_role_definitions")
          .select("rank_key,display_name,sort_order")
          .order("sort_order"),
        supabase
          .from("stratego_games")
          .select("red_base_lat,red_base_lng,blue_base_lat,blue_base_lng,winner_team")
          .eq("session_id", sessionId)
          .maybeSingle<StrategoGameRow>(),
      ]);

      if (!isActive) {
        return;
      }

      const nextRoles = new Map<string, string>();
      for (const row of (rolesRes.data ?? []) as StrategoRoleDefinitionRow[]) {
        if (typeof row.rank_key === "string" && typeof row.display_name === "string") {
          nextRoles.set(row.rank_key, row.display_name);
        }
      }
      setRoleNamesByKey(nextRoles);

      if (!gameRes.error && gameRes.data) {
        setStrategoGame(gameRes.data);
      }
    };

    void loadStrategoMeta();

    return () => {
      isActive = false;
    };
  }, [player.participantId, sessionId]);

  useEffect(() => {
    if (!sessionId || !player.participantId || allyIds.length === 0) {
      return;
    }

    const supabase = createClient({ participantId: player.participantId, sessionId });
    let isActive = true;

    const loadAllyNames = async () => {
      const { data, error } = await supabase
        .from("stratego_ally_view")
        .select("participant_id,student_name,rank_key")
        .in("participant_id", allyIds);

      if (!isActive || error) {
        return;
      }

      const nextMeta = new Map<string, { displayName: string; rankKey: string | null }>();
      for (const row of (data ?? []) as StrategoAllyRow[]) {
        if (
          typeof row.participant_id === "string" &&
          typeof row.student_name === "string" &&
          row.student_name.trim()
        ) {
          nextMeta.set(row.participant_id, {
            displayName: row.student_name.trim(),
            rankKey: typeof row.rank_key === "string" ? row.rank_key : null,
          });
        }
      }

      setAllyMetaById(nextMeta);
    };

    void loadAllyNames();

    return () => {
      isActive = false;
    };
  }, [allyIdsKey, allyIds, player.participantId, sessionId]);

  const baseMarkers = useMemo(() => {
    const nextMarkers: Array<{ teamCode: "red" | "blue"; lat: number; lng: number }> = [];
    const redLat = toFiniteNumber(strategoGame?.red_base_lat);
    const redLng = toFiniteNumber(strategoGame?.red_base_lng);
    const blueLat = toFiniteNumber(strategoGame?.blue_base_lat);
    const blueLng = toFiniteNumber(strategoGame?.blue_base_lng);

    if (redLat !== null && redLng !== null) {
      nextMarkers.push({ teamCode: "red", lat: redLat, lng: redLng });
    }

    if (blueLat !== null && blueLng !== null) {
      nextMarkers.push({ teamCode: "blue", lat: blueLat, lng: blueLng });
    }

    return nextMarkers;
  }, [strategoGame?.blue_base_lat, strategoGame?.blue_base_lng, strategoGame?.red_base_lat, strategoGame?.red_base_lng]);

  const allyMarkers = useMemo(() => {
    return stratego.allyPresence.map((entry, index) => ({
      participantId: entry.participantId,
      displayName: allyMetaById.get(entry.participantId)?.displayName ?? `Allieret ${index + 1}`,
      glyph: getRoleGlyph(allyMetaById.get(entry.participantId)?.rankKey ?? null),
      state: entry.state,
      lat: entry.lat,
      lng: entry.lng,
    }));
  }, [allyMetaById, stratego.allyPresence]);

  const myRoleName = getRoleName(stratego.selfPlayer?.rankKey, roleNamesByKey);
  const myRoleGlyph = getRoleGlyph(stratego.selfPlayer?.rankKey);
  const isReturningToBase = stratego.selfPlayer?.state === "returning_to_base";
  const attackTargetId = stratego.targetInSight?.participantId ?? null;
  const showAttackButton =
    Boolean(attackTargetId) &&
    !isReturningToBase &&
    !stratego.isInSafeZone &&
    !stratego.isRealtimeRecovering &&
    !flags.isSessionPaused &&
    stratego.selfPlayer?.state === "alive" &&
    !Boolean(stratego.duelEvent);
  const previousAttackTargetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!showAttackButton || !attackTargetId) {
      previousAttackTargetIdRef.current = null;
      return;
    }

    if (previousAttackTargetIdRef.current === attackTargetId) {
      return;
    }

    previousAttackTargetIdRef.current = attackTargetId;

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]);
    }
  }, [attackTargetId, showAttackButton]);

  if (progress.screen.mode === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-cyan-100">
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin" />
          <p className="mt-4 text-sm text-white/70">Indlæser Stratego-radaren...</p>
        </div>
      </div>
    );
  }

  if (progress.screen.mode === "load_error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-md rounded-[2rem] border border-rose-400/30 bg-rose-950/60 p-8 text-center shadow-2xl">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-200" />
          <h1 className="mt-4 text-2xl font-black">Stratego kunne ikke indlæses</h1>
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
        <div className="w-full max-w-lg rounded-[2rem] border border-cyan-400/20 bg-slate-900/70 p-8 text-center shadow-2xl backdrop-blur-xl">
          <Radio className="mx-auto h-10 w-10 animate-pulse text-cyan-300" />
          <h1 className="mt-4 text-3xl font-black">Kommandocentralen kalibrerer</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">Du er registreret. Vent på at læreren starter Live Stratego.</p>
          <WifiConnectionTip className="mt-6" />
        </div>
      </div>
    );
  }

  if (progress.screen.mode === "gps_blocked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-lg rounded-[2rem] border border-amber-400/20 bg-slate-900/70 p-8 text-center shadow-2xl backdrop-blur-xl">
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
        <div className="w-full max-w-lg rounded-[2rem] border border-rose-400/20 bg-slate-900/70 p-8 text-center shadow-2xl backdrop-blur-xl">
          <Shield className="mx-auto h-10 w-10 text-rose-300" />
          <h1 className="mt-4 text-3xl font-black">Du er blevet fjernet fra kampen</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">Kontakt læreren, hvis det er en fejl.</p>
        </div>
      </div>
    );
  }

  if (progress.screen.mode === "finished") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-lg rounded-[2rem] border border-emerald-400/20 bg-slate-900/70 p-8 text-center shadow-2xl backdrop-blur-xl">
          <Crown className="mx-auto h-10 w-10 text-amber-300" />
          <h1 className="mt-4 text-3xl font-black">Stratego er afsluttet</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">
            {buildFinishedMessage(strategoGame?.winner_team, selfTeamCode)}
          </p>
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
        <form onSubmit={handleNameSubmit} className="w-full max-w-md rounded-[2rem] border border-cyan-400/20 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl">
          <h1 className="text-3xl font-black">Identificér agenten</h1>
          <p className="mt-3 text-sm leading-6 text-white/75">Indtast dit navn for at få adgang til Live Stratego.</p>
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
        </form>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.14),transparent_24%),radial-gradient(circle_at_bottom,rgba(244,63,94,0.16),transparent_24%),linear-gradient(180deg,rgba(2,6,23,0.78)_0%,rgba(2,6,23,0.94)_62%,rgba(2,6,23,1)_100%)]" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] sm:px-6">
          <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-slate-950/70 p-4 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur-2xl sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.3em] text-white/65">
                    <Swords className="h-4 w-4 text-rose-200" />
                    Live Stratego
                  </div>
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.28em] ${teamTheme.pill}`}>
                    <div className="h-2.5 w-2.5 rounded-full bg-current" />
                    {teamTheme.label}
                  </div>
                  {stratego.isInSafeZone ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/24 bg-emerald-500/14 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-emerald-100">
                      <Shield className="h-4 w-4" />
                      <span>🛡️ FREDET (SAFE ZONE)</span>
                    </div>
                  ) : null}
                  {flags.isSessionPaused ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/24 bg-amber-500/14 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-amber-100">
                      <AlertTriangle className="h-4 w-4" />
                      <span>SPIL PAUSET</span>
                    </div>
                  ) : null}
                  {stratego.isRealtimeRecovering ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-300/16 bg-slate-700/35 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-slate-100">
                      <Radio className="h-4 w-4" />
                      <span>NETVÆRK SØGES</span>
                    </div>
                  ) : null}
                  {stratego.duelInFlight ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-500/12 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.28em] text-amber-100">
                      <Target className="h-4 w-4" />
                      Clash registreres
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex items-center gap-4">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-[1.4rem] border text-2xl font-black ${teamTheme.surface}`}>
                    {myRoleGlyph}
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-2xl font-black sm:text-3xl">{player.activeDisplayName}</h1>
                    <p className={`mt-1 text-sm font-semibold ${teamTheme.accent}`}>{myRoleName}</p>
                    <p className="mt-1 text-sm text-white/50">
                      {isReturningToBase ? "På vej tilbage til basen" : "Klar på slagmarken"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-white/45">Allierede</p>
                  <p className="mt-2 text-2xl font-black">{stratego.allyPresence.length + 1}</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-white/45">Fjendtlige signaler</p>
                  <p className="mt-2 text-2xl font-black">{stratego.enemyPresence.length}</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-white/45">Din status</p>
                  <p className="mt-2 text-sm font-black uppercase tracking-[0.16em]">
                    {isReturningToBase ? "Til base" : "I live"}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.26em] text-white/45">Baser</p>
                  <p className="mt-2 text-2xl font-black">{baseMarkers.length}</p>
                </div>
              </div>
            </div>

            {stratego.error ? (
              <div className="mt-4 rounded-[1.3rem] border border-amber-300/20 bg-amber-500/12 px-4 py-3 text-sm text-amber-100">
                {stratego.error}
              </div>
            ) : null}
          </div>
        </header>

        <main className="relative flex-1 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:px-6">
          <div className="mx-auto grid h-full max-w-7xl gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 shadow-[0_30px_80px_rgba(2,6,23,0.4)] backdrop-blur-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-300">Live radar</p>
                  <p className="mt-1 text-sm text-white/55">Fjender er skjult som signaler. Hold øje med dine allierede og baserne.</p>
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/65">
                  {stratego.isLoading
                    ? "Synkroniserer..."
                    : stratego.isRealtimeRecovering
                      ? "Netværk søger..."
                      : "Realtime aktiv"}
                </div>
              </div>

              <div className="relative h-[66svh] min-h-[32rem] w-full">
                <StrategoElevMap
                  playerLocation={gps.myLoc}
                  playerName={player.activeDisplayName}
                  selfTeamCode={selfTeamCode}
                  allyMarkers={allyMarkers}
                  enemyMarkers={stratego.enemyPresence}
                  baseMarkers={baseMarkers}
                  dimmed={Boolean(stratego.duelEvent)}
                  radarAlertActive={showAttackButton}
                  isInSafeZone={stratego.isInSafeZone}
                  isRadarOffline={stratego.isRealtimeRecovering}
                />

                {showAttackButton && attackTargetId ? (
                  <div className="pointer-events-none absolute inset-x-4 bottom-6 z-[1100] flex justify-center">
                    <button
                      type="button"
                      onClick={() => void actions.triggerStrategoDuel(attackTargetId)}
                      disabled={stratego.duelInFlight}
                      className="pointer-events-auto inline-flex min-h-[4.75rem] items-center justify-center gap-3 rounded-[1.8rem] border border-rose-200/28 bg-[linear-gradient(145deg,rgba(251,113,133,0.96),rgba(190,24,93,0.98))] px-6 py-4 text-white shadow-[0_26px_60px_rgba(244,63,94,0.34)] transition hover:scale-[1.02] hover:shadow-[0_30px_72px_rgba(244,63,94,0.42)] disabled:cursor-not-allowed disabled:opacity-65 sm:px-8 animate-pulse"
                    >
                      <span className="text-sm font-black uppercase tracking-[0.24em] text-rose-50/92 sm:text-base">
                        Fjende nær!
                      </span>
                      <span className="rounded-full border border-white/18 bg-white/12 px-4 py-2 text-base font-black uppercase tracking-[0.28em] sm:text-lg">
                        ANGRIB
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            <aside className="space-y-4">
              <section className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-5 shadow-[0_30px_80px_rgba(2,6,23,0.38)] backdrop-blur-2xl">
                <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-300">Statuslinje</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Rang</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-[1rem] border text-lg font-black ${teamTheme.surface}`}>
                        {myRoleGlyph}
                      </div>
                      <div>
                        <p className="text-lg font-black text-white">{myRoleName}</p>
                        <p className="text-sm text-white/50">Kun du kan se din rang på telefonen</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Radarlogik</p>
                    <p className="mt-3 text-sm leading-6 text-white/72">
                      Når en levende fjende kommer inden for 20 meter uden for begge fredszoner, låser radaren målet og gør dit angreb klar.
                    </p>
                  </div>

                  <div className="rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-4">
                    <div className="flex items-center gap-2 text-white">
                      <Users className="h-4 w-4 text-cyan-300" />
                      <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Holdkammerater</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-3">
                        <span className="text-sm font-semibold text-white">{player.activeDisplayName}</span>
                        <span className={`text-xs font-black uppercase tracking-[0.2em] ${teamTheme.accent}`}>Dig</span>
                      </div>
                      {allyMarkers.length > 0 ? (
                        allyMarkers.map((ally) => (
                          <div
                            key={ally.participantId}
                            className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3"
                          >
                            <span className="text-sm font-semibold text-white/88">{ally.displayName}</span>
                            <span className="text-xs uppercase tracking-[0.2em] text-white/45">
                              {ally.state === "alive" ? "I live" : "Til base"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3 text-sm text-white/55">
                          Ingen andre holdkammerater er synlige endnu.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[1.4rem] border border-white/10 bg-white/6 px-4 py-4">
                    <div className="flex items-center gap-2 text-white">
                      <Crown className="h-4 w-4 text-amber-300" />
                      <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Mål</p>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/72">
                      Beskyt jeres egen fane og jagt modstanderens. Baser vises som store pins, når de er tilgængelige for klienten.
                    </p>
                  </div>
                </div>
              </section>

              <TeacherBroadcastModal
                message={progress.feedback.latestMessage}
                onDismiss={actions.dismissLatestMessage}
              />
            </aside>
          </div>
        </main>

        {isReturningToBase ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1250] px-4 pb-[max(env(safe-area-inset-bottom),1rem)] sm:px-6">
            <div className="mx-auto max-w-5xl rounded-[1.8rem] border border-rose-300/25 bg-[linear-gradient(145deg,rgba(127,29,29,0.94),rgba(136,19,55,0.92))] px-5 py-4 text-center shadow-[0_24px_80px_rgba(127,29,29,0.45)] backdrop-blur-2xl">
              <p className="text-sm font-black uppercase tracking-[0.28em] text-rose-100/75">Advarsel</p>
              <p className="mt-2 text-base font-black text-white sm:text-lg">
                DU ER BLIVET FANGET! LØB TILBAGE TIL BASEN FOR AT GENOPLIVE.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {flags.isSessionPaused ? (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-[linear-gradient(180deg,rgba(2,6,23,0.78),rgba(2,6,23,0.92))] px-6 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-[2rem] border border-amber-300/24 bg-slate-950/88 p-8 text-center shadow-[0_34px_90px_rgba(2,6,23,0.58)]">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.8rem] border border-amber-300/28 bg-amber-500/14 text-amber-100">
              <AlertTriangle className="h-10 w-10" />
            </div>
            <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-amber-100/70">
              Nødbremse Aktiv
            </p>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
              ⚠️ SPILLET ER PAUSET ⚠️
            </h2>
            <p className="mt-4 text-base leading-7 text-white/78 sm:text-lg">
              Læreren har midlertidigt stoppet spillet. Gå tilbage til basen eller vent på yderligere instruktioner.
            </p>
          </div>
        </div>
      ) : null}

      {stratego.duelError ? (
        <div className="pointer-events-none fixed inset-x-4 top-[calc(max(env(safe-area-inset-top),1rem)+1rem)] z-[1450] flex justify-center">
          <div className="max-w-lg rounded-[1.6rem] border border-rose-300/24 bg-[linear-gradient(145deg,rgba(127,29,29,0.94),rgba(136,19,55,0.92))] px-5 py-3 text-center shadow-[0_20px_60px_rgba(127,29,29,0.36)] backdrop-blur-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-rose-100/72">
              Clash Fejl
            </p>
            <p className="mt-1 text-sm font-semibold text-white sm:text-base">
              {stratego.duelError}
            </p>
          </div>
        </div>
      ) : null}

      <StrategoClashModal
        event={stratego.duelEvent}
        playerParticipantId={player.participantId}
        roleNamesByKey={roleNamesByKey}
        onClose={actions.clearStrategoDuelEvent}
      />
    </div>
  );
}
