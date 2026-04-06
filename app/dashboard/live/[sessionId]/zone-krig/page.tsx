"use client";

import dynamic from "next/dynamic";
import { Poppins, Rubik } from "next/font/google";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Crown, Shield, Swords, Timer, Wifi, Zap } from "lucide-react";

import { FullscreenWarning } from "@/components/ui/FullscreenWarning";
import LiveRulesSheet from "@/components/live/LiveRulesSheet";
import type { GameTeam, GameZone } from "@/components/live/ZoneKrigMap";
import { createClient } from "@/utils/supabase/client";

const ZoneKrigMap = dynamic(() => import("@/components/live/ZoneKrigMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
        <p className="mt-3 text-xs text-white/50">Indlæser kampkortet...</p>
      </div>
    </div>
  ),
});

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const rubik = Rubik({ subsets: ["latin"], weight: ["700", "800", "900"] });

const DEFAULT_MAP_CENTER: [number, number] = [55.3959, 10.3883];

type LogEntry = {
  id: string;
  at: Date;
  teamName: string;
  teamColor: string;
  zoneIndex: number;
};

type LiveSessionStateRow = {
  status?: string | null;
  ends_at?: string | null;
};

function deriveMapCenter(zones: GameZone[]): [number, number] {
  const valid = zones.filter((z) => z.center_lat && z.center_lng);
  if (valid.length === 0) return DEFAULT_MAP_CENTER;
  const lat = valid.reduce((s, z) => s + z.center_lat, 0) / valid.length;
  const lng = valid.reduce((s, z) => s + z.center_lng, 0) / valid.length;
  return [lat, lng];
}

function formatLogTime(date: Date): string {
  return date.toLocaleTimeString("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return "99,102,241";
  return `${r},${g},${b}`;
}

function formatCountdown(remainingMs: number | null) {
  if (remainingMs === null) return "--:--";
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function ZoneKrigCommandCenter() {
  const params = useParams<{ sessionId: string }>();
  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : (rawSessionId ?? null);

  const [teams, setTeams] = useState<GameTeam[]>([]);
  const [zones, setZones] = useState<GameZone[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mapKey, setMapKey] = useState("initial");
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isEndingMatch, setIsEndingMatch] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  // Keep a stable ref to teams for use inside realtime callbacks
  const teamsRef = useRef<GameTeam[]>([]);
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);

  const finishMatch = useCallback(
    async (mode: "manual" | "timer") => {
      if (!sessionId || isEndingMatch || sessionStatus === "finished") {
        return;
      }

      if (
        mode === "manual" &&
        !confirm("Er du sikker på, at du vil afslutte Zone Krig med det samme?")
      ) {
        return;
      }

      setIsEndingMatch(true);

      try {
        const supabase = createClient();
        const finishedAt = new Date().toISOString();

        const { error } = await supabase
          .from("live_sessions")
          .update({ status: "finished", ends_at: finishedAt })
          .eq("id", sessionId);

        if (error) {
          throw error;
        }

        const { error: finishParticipantsError } = await supabase
          .from("participants")
          .update({ finished_at: finishedAt })
          .eq("session_id", sessionId)
          .is("finished_at", null);

        if (finishParticipantsError) {
          console.warn("Kunne ikke markere deltagere som afsluttede i Zone Krig:", finishParticipantsError);
        }

        setSessionStatus("finished");
        setEndsAt(finishedAt);
      } catch (error) {
        console.error("Kunne ikke afslutte Zone Krig-sessionen:", error);
        if (mode === "manual") {
          alert("Kunne ikke afslutte spillet.");
        }
      } finally {
        setIsEndingMatch(false);
      }
    },
    [isEndingMatch, sessionId, sessionStatus]
  );

  useEffect(() => {
    if (!sessionId) return;

    const supabase = createClient();
    let isActive = true;

    const loadInitial = async () => {
      try {
        const initResponse = await fetch("/api/zone-krig/init", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId }),
        });

        if (!initResponse.ok) {
          console.error("Kunne ikke initialisere neutrale Zone Krig-zoner.");
        }

        const [teamsRes, zonesRes, sessionRes] = await Promise.all([
          supabase.from("game_teams").select("*").eq("session_id", sessionId),
          supabase
            .from("game_zones")
            .select("*")
            .eq("session_id", sessionId)
            .order("zone_index"),
          supabase
            .from("live_sessions")
            .select("status,ends_at")
            .eq("id", sessionId)
            .maybeSingle<LiveSessionStateRow>(),
        ]);

        if (!isActive) return;
        if (teamsRes.data) setTeams(teamsRes.data as GameTeam[]);
        if (zonesRes.data) {
          setZones(zonesRes.data as GameZone[]);
          setMapKey(`loaded-${Date.now()}`);
        }
        setSessionStatus(sessionRes.data?.status ?? null);
        setEndsAt(sessionRes.data?.ends_at ?? null);
      } catch (error) {
        console.error("Kunne ikke indlæse Zone Krig-kommandocentralen:", error);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadInitial();

    // Realtime: game_teams
    const teamsChannel = supabase
      .channel(`zk-teams-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_teams",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (!isActive) return;
          if (payload.eventType === "INSERT") {
            setTeams((prev) => [...prev, payload.new as GameTeam]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as GameTeam;
            setTeams((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id?: string };
            setTeams((prev) => prev.filter((t) => t.id !== deleted.id));
          }
        }
      )
      .subscribe();

    // Realtime: game_zones
    const zonesChannel = supabase
      .channel(`zk-zones-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_zones",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          if (!isActive) return;

          if (payload.eventType === "INSERT") {
            const inserted = payload.new as GameZone;
            setZones((prev) =>
              [...prev, inserted].sort((a, b) => a.zone_index - b.zone_index)
            );
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as GameZone;
            const previous = payload.old as Partial<GameZone>;

            setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)));

            // Activity log: a new team conquered the zone
            if (
              updated.owner_team_id &&
              updated.owner_team_id !== previous.owner_team_id
            ) {
              const team = teamsRef.current.find((t) => t.id === updated.owner_team_id);
              if (team) {
                const entry: LogEntry = {
                  id: `${updated.id}-${Date.now()}`,
                  at: new Date(),
                  teamName: team.team_name,
                  teamColor: team.color,
                  zoneIndex: updated.zone_index,
                };
                setLog((prev) => [entry, ...prev].slice(0, 5));
              }
            }
          } else if (payload.eventType === "DELETE") {
            const deleted = payload.old as { id?: string };
            setZones((prev) => prev.filter((z) => z.id !== deleted.id));
          }
        }
      )
      .subscribe();

    const sessionChannel = supabase
      .channel(`zk-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (!isActive) return;
          const updated = payload.new as LiveSessionStateRow;
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
  }, [sessionId]);

  useEffect(() => {
    if (!endsAt || sessionStatus === "finished") {
      return;
    }

    setNowMs(Date.now());
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [endsAt, sessionStatus]);

  // Derived state
  const zonesOwnedByTeam = new Map<string, number>(teams.map((t) => [t.id, 0]));
  for (const zone of zones) {
    if (zone.owner_team_id) {
      zonesOwnedByTeam.set(
        zone.owner_team_id,
        (zonesOwnedByTeam.get(zone.owner_team_id) ?? 0) + 1
      );
    }
  }

  const sortedTeams = [...teams].sort((a, b) => {
    const aZ = zonesOwnedByTeam.get(a.id) ?? 0;
    const bZ = zonesOwnedByTeam.get(b.id) ?? 0;
    if (bZ !== aZ) return bZ - aZ;
    return b.score - a.score;
  });

  const leader = sortedTeams[0] ?? null;
  const topOwnedZones = leader ? zonesOwnedByTeam.get(leader.id) ?? 0 : 0;
  const tiedTeams = leader
    ? sortedTeams.filter((team) => (zonesOwnedByTeam.get(team.id) ?? 0) === topOwnedZones)
    : [];
  const winnerTeam = topOwnedZones > 0 && tiedTeams.length === 1 ? tiedTeams[0] ?? null : null;
  const isTie = topOwnedZones > 0 && tiedTeams.length > 1;
  const totalZones = zones.length;
  const contestedZones = zones.filter((z) => z.owner_team_id).length;
  const mapCenter = useMemo(() => deriveMapCenter(zones), [zones]);
  const remainingMs = useMemo(() => {
    if (!endsAt) return null;
    const endsAtMs = new Date(endsAt).getTime();
    if (!Number.isFinite(endsAtMs)) return null;
    return Math.max(0, endsAtMs - nowMs);
  }, [endsAt, nowMs]);
  const countdownLabel = formatCountdown(remainingMs);
  const isMatchOver = sessionStatus === "finished" || (remainingMs !== null && remainingMs <= 0);

  useEffect(() => {
    if (!endsAt || sessionStatus === "finished" || isEndingMatch) {
      return;
    }

    if (remainingMs === null || remainingMs > 0) {
      return;
    }

    void finishMatch("timer");
  }, [endsAt, finishMatch, isEndingMatch, remainingMs, sessionStatus]);

  return (
    <div
      className={`relative min-h-svh bg-slate-950 text-white ${poppins.className}`}
    >
      <FullscreenWarning />
      {/* Ambient glow layers */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top_left,rgba(34,211,238,0.06),transparent_40%),radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.07),transparent_40%),linear-gradient(180deg,#020617_0%,#020b18_100%)]" />

      {/* ── HEADER ── */}
      <header className="relative z-10 flex flex-wrap items-center gap-3 border-b border-white/10 bg-slate-900/70 px-5 py-3 backdrop-blur-xl">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10">
            <Swords className="h-4 w-4 text-cyan-400" />
          </div>
          <h1 className={`truncate text-base font-black tracking-tight text-white ${rubik.className}`}>
            Zone-Krigen
            <span className="ml-2 text-sm font-semibold text-white/40">
              Kommandocentral
            </span>
          </h1>
        </div>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
          <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/50 sm:inline-flex">
            {contestedZones}/{totalZones} zoner erobret
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-100">
            <Timer className="h-3.5 w-3.5 text-amber-300" />
            {countdownLabel}
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300">
            <Wifi className="h-3 w-3" />
            {isMatchOver ? "AFSLUTTET" : "LIVE"}
          </span>
          <button
            type="button"
            onClick={() => setIsRulesOpen(true)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-white/75 transition hover:bg-white/10 hover:text-white"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Spilregler
          </button>
          <button
            type="button"
            onClick={() => void finishMatch("manual")}
            disabled={isEndingMatch || isMatchOver}
            className="min-h-11 rounded-full border border-rose-400/30 bg-rose-500/10 px-3.5 py-2 text-xs font-bold text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isEndingMatch ? "Afslutter..." : "Afslut Spil"}
          </button>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 flex flex-col lg:flex-row lg:gap-0">

        {/* MAP COLUMN (dominant) */}
        <div className="relative order-2 h-[60svh] min-h-[400px] flex-1 border-r border-white/10 lg:order-1 lg:h-[calc(100svh-57px)]">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                <p className="mt-4 text-sm text-white/50">Indlæser kampzoner...</p>
              </div>
            </div>
          ) : zones.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center px-8">
              <div className="rounded-3xl border border-white/10 bg-white/5 px-10 py-8 text-center backdrop-blur-xl">
                <Swords className="mx-auto h-10 w-10 text-white/25" />
                <p className="mt-4 text-sm font-semibold text-white/45">
                  Ingen kampzoner er oprettet for denne session endnu.
                </p>
              </div>
            </div>
          ) : (
            <ZoneKrigMap
              key={mapKey}
              center={mapCenter}
              zones={zones}
              teams={teams}
            />
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="order-1 w-full shrink-0 border-b border-white/10 bg-slate-900/50 p-4 backdrop-blur-xl lg:order-2 lg:w-80 lg:border-b-0 lg:border-l lg:border-l-white/10 xl:w-96">
          <div className="flex flex-col gap-5 lg:sticky lg:top-0">

            {/* ── LEADER BADGE ── */}
            {!isLoading && (
              <div
                className="relative overflow-hidden rounded-2xl border p-4 shadow-lg"
                style={
                  leader
                    ? {
                        borderColor: `rgba(${hexToRgb(leader.color)},0.35)`,
                        background: `rgba(${hexToRgb(leader.color)},0.08)`,
                        boxShadow: `0 0 40px rgba(${hexToRgb(leader.color)},0.08)`,
                      }
                    : { borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }
                }
              >
                {isMatchOver ? (
                  <div className="relative flex items-center gap-3">
                    <Crown className="h-7 w-7 shrink-0 text-amber-300" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/70">
                        Kampen er slut
                      </p>
                      <p className={`truncate text-2xl font-black text-white ${rubik.className}`}>
                        {winnerTeam
                          ? `${winnerTeam.team_name} vinder`
                          : isTie
                            ? "Uafgjort"
                            : "Ingen vinder"}
                      </p>
                      <p className="mt-1 text-xs text-white/55">
                        {winnerTeam
                          ? `${winnerTeam.team_name} kontrollerer ${topOwnedZones} zoner ved slutfløjtet.`
                          : isTie
                            ? `Flere hold sluttede lige med ${topOwnedZones} zoner hver.`
                            : "Ingen hold nåede at erobre en zone før tiden løb ud."}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-3xl font-black ${rubik.className}`}>{countdownLabel}</p>
                      <p className="text-[10px] uppercase tracking-widest text-white/40">
                        sluttid
                      </p>
                    </div>
                  </div>
                ) : leader ? (
                  <>
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: `radial-gradient(circle at top,rgba(${hexToRgb(leader.color)},0.12),transparent 55%)`,
                      }}
                    />
                    <div className="relative flex items-center gap-3">
                      <Crown className="h-7 w-7 shrink-0 text-yellow-400" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-400/70">
                          Fører lige nu
                        </p>
                        <p
                          className={`truncate text-2xl font-black text-white ${rubik.className}`}
                        >
                          {leader.team_name}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={`text-4xl font-black ${rubik.className}`}
                          style={{ color: leader.color }}
                        >
                          {zonesOwnedByTeam.get(leader.id) ?? 0}
                        </p>
                        <p className="text-[10px] uppercase tracking-widest text-white/40">
                          zoner
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <Crown className="h-7 w-7 shrink-0 text-white/20" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/35">
                        Fører
                      </p>
                      <p className="text-base font-bold text-white/30">
                        Ingen har erobret zoner endnu
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SCOREBOARD ── */}
            <div>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.32em] text-white/35">
                Scoreboard
              </p>
              <div className="space-y-2">
                {isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-14 animate-pulse rounded-2xl bg-white/5"
                      />
                    ))}
                  </div>
                ) : sortedTeams.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/35">
                    Ingen hold tilmeldt endnu.
                  </p>
                ) : (
                  sortedTeams.map((team, idx) => {
                    const ownedCount = zonesOwnedByTeam.get(team.id) ?? 0;
                    const isLeadingTeam = idx === 0 && ownedCount > 0;
                    const rgb = hexToRgb(team.color);

                    return (
                      <div
                        key={team.id}
                        className="flex items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-md transition-all"
                        style={{
                          borderColor: `rgba(${rgb},0.2)`,
                          background: `rgba(${rgb},0.06)`,
                        }}
                      >
                        {/* Rank circle */}
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black text-slate-950 shadow-lg"
                          style={{ background: team.color }}
                        >
                          {idx + 1}
                        </div>

                        {/* Name + score */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">
                            {team.team_name}
                          </p>
                          <p className="text-xs text-white/40">
                            {team.score} point
                          </p>
                        </div>

                        {/* Zone count */}
                        <div className="shrink-0 text-right">
                          <p
                            className={`text-xl font-black ${rubik.className}`}
                            style={{ color: team.color }}
                          >
                            {ownedCount}
                          </p>
                          <p className="text-[10px] uppercase tracking-wider text-white/30">
                            zoner
                          </p>
                        </div>

                        {isLeadingTeam && (
                          <Crown className="h-4 w-4 shrink-0 text-yellow-400" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── ACTIVITY LOG ── */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-cyan-400" />
                <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-white/35">
                  Krigslog
                </p>
                <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/40">
                  Seneste 5
                </span>
              </div>

              <div className="space-y-2">
                {log.length === 0 ? (
                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center">
                    <p className="text-xs italic text-white/30">
                      Ingen kampe udkæmpet endnu...
                    </p>
                  </div>
                ) : (
                  log.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur-sm"
                      style={{
                        opacity: 1 - idx * 0.15,
                      }}
                    >
                      <Shield
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{ color: entry.teamColor }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-white/80">
                          <span
                            className="font-bold"
                            style={{ color: entry.teamColor }}
                          >
                            {entry.teamName}
                          </span>{" "}
                          erobrede Zone {entry.zoneIndex + 1}
                        </p>
                        <p className="mt-0.5 font-mono text-[10px] text-white/35">
                          {formatLogTime(entry.at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </aside>
      </div>

      <LiveRulesSheet open={isRulesOpen} onClose={() => setIsRulesOpen(false)} gameType="zone-krig" />
    </div>
  );
}
