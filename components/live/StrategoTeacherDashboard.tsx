"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import {
  AlertTriangle,
  Crown,
  Loader2,
  MapPinned,
  Shield,
  Swords,
  Target,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";

import { createClient } from "@/utils/supabase/client";

type StrategoTeacherDashboardProps = {
  sessionId?: string | null;
  joinPin: string;
  sessionStatus: string;
  isEndingRun: boolean;
  isUpdatingPause: boolean;
  onTogglePause: () => Promise<void>;
  onEndRun: () => Promise<void>;
};

type ParticipantRow = {
  id?: string | null;
  student_name?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  updated_at?: string | null;
};

type StrategoPlayerRow = {
  participant_id?: string | null;
  session_id?: string | null;
  team_code?: string | null;
  rank_key?: string | null;
  state?: string | null;
  last_duel_at?: string | null;
  eliminated_by_participant_id?: string | null;
};

type StrategoRoleRow = {
  rank_key?: string | null;
  display_name?: string | null;
};

type StrategoGameRow = {
  session_id?: string | null;
  red_base_lat?: number | string | null;
  red_base_lng?: number | string | null;
  blue_base_lat?: number | string | null;
  blue_base_lng?: number | string | null;
  winner_team?: string | null;
};

type StrategoDuelEventRow = {
  id?: string | null;
  winner_id?: string | null;
  loser_id?: string | null;
  attacker_id?: string | null;
  defender_id?: string | null;
  attacker_role_key?: string | null;
  defender_role_key?: string | null;
  is_draw?: boolean | null;
  created_at?: string | null;
};

type TeacherStrategoPlayer = {
  participantId: string;
  name: string;
  lat: number | null;
  lng: number | null;
  updatedAt: string | null;
  teamCode: "red" | "blue" | null;
  rankKey: string | null;
  state: string;
  eliminatedByParticipantId: string | null;
};

const DEFAULT_MAP_CENTER: [number, number] = [55.6761, 12.5683];
const LIVE_STATUS_WINDOW_MS = 30_000;

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function normalizeParticipantName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "Ukendt spiller";
}

function getRoleGlyph(rankKey: string | null | undefined) {
  switch (rankKey) {
    case "flag":
      return "F";
    case "bomb":
      return "B";
    case "spy":
      return "S";
    case "scout":
      return "2";
    case "miner":
      return "3";
    case "sergeant":
      return "4";
    case "lieutenant":
      return "5";
    case "captain":
      return "6";
    case "major":
      return "7";
    case "colonel":
      return "8";
    case "general":
      return "9";
    case "marshal":
      return "10";
    default:
      return "?";
  }
}

function getTeamHex(teamCode: string | null | undefined) {
  return teamCode === "blue" ? "#38bdf8" : "#f43f5e";
}

function createPlayerIcon(player: TeacherStrategoPlayer, roleName: string) {
  const color = getTeamHex(player.teamCode);
  const isReturning = player.state === "returning_to_base";
  const isLive =
    !player.updatedAt ||
    !Number.isFinite(new Date(player.updatedAt).getTime()) ||
    Date.now() - new Date(player.updatedAt).getTime() < LIVE_STATUS_WINDOW_MS;
  const statusDot = isLive ? "#34d399" : "#94a3b8";

  return L.divIcon({
    className: "stratego-teacher-player-icon",
    html: `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:18px;border:1px solid rgba(255,255,255,0.12);background:rgba(2,6,23,0.92);box-shadow:0 18px 38px rgba(2,6,23,0.45);backdrop-filter:blur(18px);${isReturning ? "opacity:0.58;" : ""}">
        <div style="display:flex;height:36px;width:36px;align-items:center;justify-content:center;border-radius:14px;background:${color};color:white;font-size:12px;font-weight:900;box-shadow:0 0 18px ${player.teamCode === "blue" ? "rgba(56,189,248,0.35)" : "rgba(244,63,94,0.35)"};">
          ${getRoleGlyph(player.rankKey)}
        </div>
        <div style="display:flex;flex-direction:column;min-width:0;">
          <span style="font-size:12px;font-weight:800;color:white;white-space:nowrap;">${player.name}</span>
          <span style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${color};white-space:nowrap;">${roleName}</span>
        </div>
        <span style="display:flex;height:10px;width:10px;border-radius:999px;background:${statusDot};box-shadow:0 0 12px ${statusDot};"></span>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [-8, 18],
  });
}

function createBaseIcon(teamCode: "red" | "blue") {
  const color = getTeamHex(teamCode);
  const label = teamCode === "blue" ? "B" : "R";

  return L.divIcon({
    className: "stratego-teacher-base-icon",
    html: `
      <div style="position:relative;width:36px;height:44px;">
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;border-radius:18px 18px 18px 0;transform:rotate(-45deg);background:${color};box-shadow:0 16px 28px ${teamCode === "blue" ? "rgba(56,189,248,0.32)" : "rgba(244,63,94,0.32)"};">
          <span style="transform:rotate(45deg);font-size:14px;font-weight:900;color:white;">${label}</span>
        </div>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 40],
  });
}

function MapAutoFit({
  players,
  game,
}: {
  players: TeacherStrategoPlayer[];
  game: StrategoGameRow | null;
}) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    const points: [number, number][] = [];

    for (const player of players) {
      if (player.lat !== null && player.lng !== null) {
        points.push([player.lat, player.lng]);
      }
    }

    const redLat = toFiniteNumber(game?.red_base_lat);
    const redLng = toFiniteNumber(game?.red_base_lng);
    const blueLat = toFiniteNumber(game?.blue_base_lat);
    const blueLng = toFiniteNumber(game?.blue_base_lng);

    if (redLat !== null && redLng !== null) {
      points.push([redLat, redLng]);
    }

    if (blueLat !== null && blueLng !== null) {
      points.push([blueLat, blueLng]);
    }

    if (points.length === 0) {
      map.setView(DEFAULT_MAP_CENTER, 16, { animate: true });
      return;
    }

    if (!hasFittedRef.current || points.length > 1) {
      if (points.length === 1) {
        map.setView(points[0] ?? DEFAULT_MAP_CENTER, 17, { animate: true });
      } else {
        map.fitBounds(L.latLngBounds(points), {
          padding: [56, 56],
          maxZoom: 17,
          animate: true,
        });
      }
      hasFittedRef.current = true;
    }
  }, [game, map, players]);

  return null;
}

function formatRelativeTimestamp(value: string | null | undefined) {
  if (!value) return "ukendt";

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "ukendt";

  const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s siden`;
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m siden`;
  return `${Math.floor(diffSeconds / 3600)}t siden`;
}

function getWinnerBanner(game: StrategoGameRow | null) {
  if (!game?.winner_team) {
    return null;
  }

  return game.winner_team === "blue" ? "Hold Blå har vundet." : "Hold Rød har vundet.";
}

export default function StrategoTeacherDashboard({
  sessionId,
  joinPin,
  sessionStatus,
  isEndingRun,
  isUpdatingPause,
  onTogglePause,
  onEndRun,
}: StrategoTeacherDashboardProps) {
  const [participantsById, setParticipantsById] = useState<Map<string, ParticipantRow>>(new Map());
  const [playersById, setPlayersById] = useState<Map<string, StrategoPlayerRow>>(new Map());
  const [roleNamesByKey, setRoleNamesByKey] = useState<Map<string, string>>(new Map());
  const [game, setGame] = useState<StrategoGameRow | null>(null);
  const [duelEvents, setDuelEvents] = useState<StrategoDuelEventRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const supabase = createClient();
    let isActive = true;

    const upsertParticipant = (row: ParticipantRow | null | undefined) => {
      const participantId = typeof row?.id === "string" ? row.id : null;
      if (!participantId) {
        return;
      }

      setParticipantsById((previous) => {
        const next = new Map(previous);
        next.set(participantId, row);
        return next;
      });
    };

    const deleteParticipant = (row: ParticipantRow | null | undefined) => {
      const participantId = typeof row?.id === "string" ? row.id : null;
      if (!participantId) {
        return;
      }

      setParticipantsById((previous) => {
        const next = new Map(previous);
        next.delete(participantId);
        return next;
      });
    };

    const upsertStrategoPlayer = (row: StrategoPlayerRow | null | undefined) => {
      const participantId = typeof row?.participant_id === "string" ? row.participant_id : null;
      if (!participantId) {
        return;
      }

      setPlayersById((previous) => {
        const next = new Map(previous);
        next.set(participantId, row);
        return next;
      });
    };

    const deleteStrategoPlayer = (row: StrategoPlayerRow | null | undefined) => {
      const participantId = typeof row?.participant_id === "string" ? row.participant_id : null;
      if (!participantId) {
        return;
      }

      setPlayersById((previous) => {
        const next = new Map(previous);
        next.delete(participantId);
        return next;
      });
    };

    const prependDuelEvent = (row: StrategoDuelEventRow | null | undefined) => {
      const eventId = typeof row?.id === "string" ? row.id : null;
      if (!eventId) {
        return;
      }

      setDuelEvents((previous) => {
        const next = [row, ...previous.filter((item) => item.id !== eventId)];
        return next.slice(0, 10);
      });
    };

    const loadStrategoDashboard = async () => {
      const [participantsRes, playersRes, rolesRes, gameRes, duelRes] = await Promise.all([
        supabase
          .from("participants")
          .select("id,student_name,lat,lng,updated_at")
          .eq("session_id", sessionId),
        supabase
          .from("stratego_players")
          .select("participant_id,session_id,team_code,rank_key,state,last_duel_at,eliminated_by_participant_id")
          .eq("session_id", sessionId),
        supabase.from("stratego_role_definitions").select("rank_key,display_name"),
        supabase
          .from("stratego_games")
          .select("session_id,red_base_lat,red_base_lng,blue_base_lat,blue_base_lng,winner_team")
          .eq("session_id", sessionId)
          .maybeSingle<StrategoGameRow>(),
        supabase
          .from("stratego_duel_events")
          .select("id,winner_id,loser_id,attacker_id,defender_id,attacker_role_key,defender_role_key,is_draw,created_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      if (!isActive) {
        return;
      }

      setParticipantsById(
        new Map(
          ((participantsRes.data ?? []) as ParticipantRow[])
            .filter((row) => typeof row.id === "string")
            .map((row) => [row.id as string, row])
        )
      );

      setPlayersById(
        new Map(
          ((playersRes.data ?? []) as StrategoPlayerRow[])
            .filter((row) => typeof row.participant_id === "string")
            .map((row) => [row.participant_id as string, row])
        )
      );

      setRoleNamesByKey(
        new Map(
          ((rolesRes.data ?? []) as StrategoRoleRow[])
            .filter((row) => typeof row.rank_key === "string" && typeof row.display_name === "string")
            .map((row) => [row.rank_key as string, row.display_name as string])
        )
      );

      setGame(!gameRes.error && gameRes.data ? gameRes.data : null);
      setDuelEvents((duelRes.data ?? []) as StrategoDuelEventRow[]);
      setIsLoading(false);
    };

    void loadStrategoDashboard();

    const channel = supabase
      .channel(`stratego-teacher-dashboard-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "participants", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (!isActive) {
            return;
          }

          if (payload.eventType === "DELETE") {
            deleteParticipant(payload.old as ParticipantRow);
            return;
          }

          upsertParticipant(payload.new as ParticipantRow);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stratego_players", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (!isActive) {
            return;
          }

          if (payload.eventType === "DELETE") {
            deleteStrategoPlayer(payload.old as StrategoPlayerRow);
            return;
          }

          upsertStrategoPlayer(payload.new as StrategoPlayerRow);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stratego_games", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (!isActive) {
            return;
          }

          if (payload.eventType === "DELETE") {
            setGame(null);
            return;
          }

          setGame(payload.new as StrategoGameRow);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stratego_duel_events", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (!isActive) {
            return;
          }

          prependDuelEvent(payload.new as StrategoDuelEventRow);
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const players = useMemo<TeacherStrategoPlayer[]>(() => {
    const participantIds = new Set<string>([
      ...Array.from(participantsById.keys()),
      ...Array.from(playersById.keys()),
    ]);

    return Array.from(participantIds)
      .map((participantId) => {
        const participant = participantsById.get(participantId);
        const strategoPlayer = playersById.get(participantId);

        return {
          participantId,
          name: normalizeParticipantName(participant?.student_name),
          lat: toFiniteNumber(participant?.lat),
          lng: toFiniteNumber(participant?.lng),
          updatedAt: typeof participant?.updated_at === "string" ? participant.updated_at : null,
          teamCode:
            strategoPlayer?.team_code === "red" || strategoPlayer?.team_code === "blue"
              ? strategoPlayer.team_code
              : null,
          rankKey: typeof strategoPlayer?.rank_key === "string" ? strategoPlayer.rank_key : null,
          state: typeof strategoPlayer?.state === "string" ? strategoPlayer.state : "alive",
          eliminatedByParticipantId:
            typeof strategoPlayer?.eliminated_by_participant_id === "string"
              ? strategoPlayer.eliminated_by_participant_id
              : null,
        };
      })
      .sort((left, right) => {
        if (left.teamCode !== right.teamCode) {
          return left.teamCode === "red" ? -1 : 1;
        }

        return left.name.localeCompare(right.name, "da");
      });
  }, [participantsById, playersById]);

  const teamStats = useMemo(() => {
    const initialStats = {
      red: { total: 0, alive: 0, returning: 0 },
      blue: { total: 0, alive: 0, returning: 0 },
    };

    for (const player of players) {
      if (player.teamCode !== "red" && player.teamCode !== "blue") {
        continue;
      }

      initialStats[player.teamCode].total += 1;
      if (player.state === "returning_to_base") {
        initialStats[player.teamCode].returning += 1;
      } else {
        initialStats[player.teamCode].alive += 1;
      }
    }

    return initialStats;
  }, [players]);

  const renderedDuelEvents = useMemo(() => {
    return duelEvents.map((event) => {
      const attackerName = normalizeParticipantName(participantsById.get(event.attacker_id ?? "")?.student_name);
      const defenderName = normalizeParticipantName(participantsById.get(event.defender_id ?? "")?.student_name);
      const attackerRole =
        roleNamesByKey.get(event.attacker_role_key ?? "") ?? event.attacker_role_key ?? "Ukendt";
      const defenderRole =
        roleNamesByKey.get(event.defender_role_key ?? "") ?? event.defender_role_key ?? "Ukendt";
      const winnerName = normalizeParticipantName(participantsById.get(event.winner_id ?? "")?.student_name);

      return {
        id: event.id ?? `${event.created_at}-${event.attacker_id}-${event.defender_id}`,
        attackerName,
        defenderName,
        attackerRole,
        defenderRole,
        winnerName,
        isDraw: event.is_draw === true,
        createdAt: event.created_at ?? null,
      };
    });
  }, [duelEvents, participantsById, roleNamesByKey]);

  const mapCenter = useMemo<[number, number]>(() => {
    const redLat = toFiniteNumber(game?.red_base_lat);
    const redLng = toFiniteNumber(game?.red_base_lng);
    const blueLat = toFiniteNumber(game?.blue_base_lat);
    const blueLng = toFiniteNumber(game?.blue_base_lng);

    if (redLat !== null && redLng !== null && blueLat !== null && blueLng !== null) {
      return [(redLat + blueLat) / 2, (redLng + blueLng) / 2];
    }

    const firstPlayerWithLocation = players.find((player) => player.lat !== null && player.lng !== null);
    if (firstPlayerWithLocation?.lat !== null && firstPlayerWithLocation.lng !== null) {
      return [firstPlayerWithLocation.lat, firstPlayerWithLocation.lng];
    }

    return DEFAULT_MAP_CENTER;
  }, [game, players]);

  const redBaseIcon = useMemo(() => createBaseIcon("red"), []);
  const blueBaseIcon = useMemo(() => createBaseIcon("blue"), []);

  const winnerBanner = getWinnerBanner(game);
  const isPaused = sessionStatus === "paused";

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.08),transparent_30%),linear-gradient(180deg,#020617_0%,#020b18_100%)]" />

      <header className="relative z-10 border-b border-white/10 bg-slate-900/76 px-5 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/6">
            <Swords className="h-5 w-5 text-rose-200" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">Live Stratego Kontrolrum</h1>
            <p className="text-sm text-white/55">PIN {joinPin} • lærerens fulde gude-overblik</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => void onTogglePause()}
              disabled={isUpdatingPause || isEndingRun}
              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.22em] transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-slate-800 disabled:text-white/45 ${
                isPaused
                  ? "border-emerald-300/25 bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  : "border-rose-300/25 bg-rose-500 text-white hover:bg-rose-400"
              }`}
            >
              {isUpdatingPause ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gemmer
                </>
              ) : isPaused ? (
                <>
                  <Shield className="h-4 w-4" />
                  GENOPTAG SPIL
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  PAUSE SPIL
                </>
              )}
            </button>
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-xs font-semibold text-white/65">
              {players.length} spillere
            </span>
            <button
              type="button"
              onClick={() => void onEndRun()}
              disabled={isEndingRun}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/45"
            >
              {isEndingRun ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Afslutter
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Afslut løb
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_23rem] lg:px-6">
        {isPaused ? (
          <div className="lg:col-span-2 rounded-[1.7rem] border border-amber-300/20 bg-amber-500/12 px-5 py-4 text-amber-100 shadow-[0_24px_60px_rgba(245,158,11,0.14)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-amber-100/70">Nødbremse aktiv</p>
                <p className="mt-1 text-lg font-black">Spillet er pauset for alle elever via realtime.</p>
              </div>
            </div>
          </div>
        ) : null}

        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 shadow-[0_30px_80px_rgba(2,6,23,0.38)] backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-300">Gude-kort</p>
              <p className="mt-1 text-sm text-white/55">Alle spillere, alle roller, alle baser. Ingen fog of war.</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/65">
              {isLoading ? "Synkroniserer..." : "Realtime aktiv"}
            </div>
          </div>

          <div className="h-[74svh] min-h-[42rem] w-full">
            <MapContainer center={mapCenter} zoom={16} className="h-full w-full" zoomControl>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; CARTO'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <MapAutoFit players={players} game={game} />

              {(() => {
                const redLat = toFiniteNumber(game?.red_base_lat);
                const redLng = toFiniteNumber(game?.red_base_lng);
                if (redLat === null || redLng === null) return null;

                return (
                  <Marker position={[redLat, redLng]} icon={redBaseIcon}>
                    <Popup>
                      <div className="text-sm text-slate-900">
                        <div className="font-black">Hold Rød Base</div>
                        <div>Genoplivning og flagzone</div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })()}

              {(() => {
                const blueLat = toFiniteNumber(game?.blue_base_lat);
                const blueLng = toFiniteNumber(game?.blue_base_lng);
                if (blueLat === null || blueLng === null) return null;

                return (
                  <Marker position={[blueLat, blueLng]} icon={blueBaseIcon}>
                    <Popup>
                      <div className="text-sm text-slate-900">
                        <div className="font-black">Hold Blå Base</div>
                        <div>Genoplivning og flagzone</div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })()}

              {players.map((player) =>
                player.lat !== null && player.lng !== null ? (
                  <Marker
                    key={player.participantId}
                    position={[player.lat, player.lng]}
                    icon={createPlayerIcon(
                      player,
                      roleNamesByKey.get(player.rankKey ?? "") ?? player.rankKey ?? "Ukendt"
                    )}
                  >
                    <Popup>
                      <div className="text-sm text-slate-900">
                        <div className="font-black">{player.name}</div>
                        <div>
                          {(player.teamCode === "blue" ? "Hold Blå" : "Hold Rød")} •{" "}
                          {roleNamesByKey.get(player.rankKey ?? "") ?? player.rankKey ?? "Ukendt"}
                        </div>
                        <div>{player.state === "returning_to_base" ? "På vej til basen" : "I live"}</div>
                        <div>Sidst set: {formatRelativeTimestamp(player.updatedAt)}</div>
                      </div>
                    </Popup>
                  </Marker>
                ) : null
              )}
            </MapContainer>
          </div>
        </section>

        <aside className="space-y-4">
          {winnerBanner ? (
            <section className="rounded-[1.7rem] border border-amber-300/20 bg-amber-500/12 p-5 text-amber-100 shadow-[0_24px_60px_rgba(245,158,11,0.14)] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.26em] text-amber-100/70">Resultat</p>
                  <p className="mt-1 text-lg font-black">{winnerBanner}</p>
                </div>
              </div>
            </section>
          ) : null}

          <section className="rounded-[1.7rem] border border-white/10 bg-slate-900/60 p-5 shadow-[0_24px_60px_rgba(2,6,23,0.34)] backdrop-blur-xl">
            <div className="flex items-center gap-2 text-white">
              <Target className="h-4 w-4 text-cyan-300" />
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/45">Holdstatus</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-[1.2rem] border border-rose-300/20 bg-rose-500/10 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-rose-100/65">Rød</p>
                <p className="mt-2 text-2xl font-black">{teamStats.red.total}</p>
                <p className="mt-1 text-xs text-white/60">
                  {teamStats.red.alive} i live • {teamStats.red.returning} til base
                </p>
              </div>
              <div className="rounded-[1.2rem] border border-sky-300/20 bg-sky-500/10 px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-sky-100/65">Blå</p>
                <p className="mt-2 text-2xl font-black">{teamStats.blue.total}</p>
                <p className="mt-1 text-xs text-white/60">
                  {teamStats.blue.alive} i live • {teamStats.blue.returning} til base
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-white/10 bg-slate-900/60 p-5 shadow-[0_24px_60px_rgba(2,6,23,0.34)] backdrop-blur-xl">
            <div className="flex items-center gap-2 text-white">
              <MapPinned className="h-4 w-4 text-cyan-300" />
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/45">Duel-log</p>
            </div>
            <div className="mt-4 space-y-3">
              {renderedDuelEvents.length > 0 ? (
                renderedDuelEvents.map((event) => (
                  <div key={event.id} className="rounded-[1.2rem] border border-white/10 bg-slate-950/45 px-4 py-3">
                    <p className="text-sm font-semibold text-white/88">
                      {event.attackerName} ({event.attackerRole}) vs {event.defenderName} ({event.defenderRole})
                    </p>
                    <p className="mt-1 text-xs text-white/55">
                      {event.isDraw ? "Uafgjort - begge tilbage til basen" : `${event.winnerName} tog duellen`} •{" "}
                      {formatRelativeTimestamp(event.createdAt)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.2rem] border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white/55">
                  Ingen dueller registreret endnu.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-white/10 bg-slate-900/60 p-5 shadow-[0_24px_60px_rgba(2,6,23,0.34)] backdrop-blur-xl">
            <div className="flex items-center gap-2 text-white">
              <Users className="h-4 w-4 text-cyan-300" />
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-white/45">Spillerliste</p>
            </div>
            <div className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {players.length > 0 ? (
                players.map((player) => (
                  <div
                    key={player.participantId}
                    className={`rounded-[1.2rem] border px-4 py-3 ${
                      player.teamCode === "blue"
                        ? "border-sky-300/18 bg-sky-500/10"
                        : "border-rose-300/18 bg-rose-500/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{player.name}</p>
                        <p className="mt-1 text-xs text-white/60">
                          {(player.teamCode === "blue" ? "Hold Blå" : "Hold Rød")} •{" "}
                          {roleNamesByKey.get(player.rankKey ?? "") ?? player.rankKey ?? "Ukendt"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">
                          {player.state === "returning_to_base" ? "Til base" : "I live"}
                        </p>
                        <p className="mt-1 text-[11px] text-white/45">{formatRelativeTimestamp(player.updatedAt)}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.2rem] border border-white/10 bg-slate-950/45 px-4 py-3 text-sm text-white/55">
                  Ingen Stratego-spillere registreret endnu.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
