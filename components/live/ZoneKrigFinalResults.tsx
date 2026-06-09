"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type GameTeam = {
  id: string;
  team_name: string;
  color?: string | null;
};

type GameZone = {
  id: string;
  zone_index?: number | null;
  owner_team_id?: string | null;
};

type Props = {
  sessionId?: string | null;
};
export function deriveZoneKrigFinalStandings(teamsInput: GameTeam[], zonesInput: GameZone[]) {
  const map = new Map<string, number>();
  for (const t of teamsInput) map.set(t.id, 0);
  for (const z of zonesInput) {
    if (z.owner_team_id) {
      map.set(z.owner_team_id, (map.get(z.owner_team_id) ?? 0) + 1);
    }
  }

  const standings = teamsInput
    .map((t) => ({ ...t, owned: map.get(t.id) ?? 0 }))
    .sort((a, b) => {
      if (b.owned !== a.owned) return b.owned - a.owned;
      return a.team_name.localeCompare(b.team_name, "da");
    });

  const topOwned = standings.length > 0 ? Math.max(0, ...standings.map((r) => r.owned)) : 0;
  const winners = standings.filter((r) => r.owned === topOwned && topOwned > 0).map((r) => r.id);

  return {
    standings,
    winnerTeamIds: winners,
    isTie: winners.length > 1,
    winningZoneCount: topOwned,
  } as const;
}

export default function ZoneKrigFinalResults({ sessionId }: Props) {
  const [teams, setTeams] = useState<GameTeam[]>([]);
  const [zones, setZones] = useState<GameZone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);



  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      setTeams([]);
      setZones([]);
      setError(null);
      return;
    }
    const supabase = createClient();
    let active = true;

    const fetchInitial = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [teamsRes, zonesRes] = await Promise.all([
          supabase.from("game_teams").select("id,team_name,color").eq("session_id", sessionId),
          supabase
            .from("game_zones")
            .select("id,zone_index,owner_team_id")
            .eq("session_id", sessionId)
            .order("zone_index"),
        ]);

        if (!active) return;
        if (teamsRes.error) {
          setError("Fejl ved hentning af teams");
        } else if (Array.isArray(teamsRes.data)) {
          setTeams(teamsRes.data as GameTeam[]);
        }

        if (zonesRes.error) {
          setError((prev) => prev ? prev + "; fejl ved hentning af zoner" : "Fejl ved hentning af zoner");
        } else if (Array.isArray(zonesRes.data)) {
          setZones(zonesRes.data as GameZone[]);
        }
      } catch (err) {
        console.error("Could not load ZoneKrig final data:", err);
        if (active) setError("Kunne ikke hente resultater");
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void fetchInitial();

    return () => {
      active = false;
    };
  }, [sessionId]);

  const derived = useMemo(() => deriveZoneKrigFinalStandings(teams, zones), [teams, zones]);
  const teamRows = derived.standings;
  const topOwned = derived.winningZoneCount;
  const winners = teamRows.filter((r) => r.owned === topOwned && topOwned > 0);

  if (isLoading) {
    return (
      <div className="p-6 text-white">Indlæser resultater...</div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-white">Der opstod en fejl ved indlæsning af resultater: {error}</div>
    );
  }

  return (
    <div className="min-h-screen p-6 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          {topOwned === 0 ? (
            <h1 className="text-3xl font-black">Kampen er afsluttet — ingen zoner er erobret</h1>
          ) : winners.length === 1 ? (
            <div>
              <h1 className="text-3xl font-black">Vinder: {winners[0].team_name}</h1>
              <p className="mt-2 text-lg">{topOwned} {topOwned === 1 ? "zone" : "zoner"}</p>
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-black">Uafgjort mellem {winners.map((w) => w.team_name).join(" og ")}</h1>
              <p className="mt-2 text-lg">{topOwned} {topOwned === 1 ? "zone" : "zoner"} hver</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase text-white/80">Scoreboard (zoner)</h2>
          <div className="space-y-2">
            {teamRows.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full" style={{ background: t.color ?? "#666" }} />
                  <div>
                    <p className="text-sm font-bold">{t.team_name}</p>
                    <p className="text-xs text-white/50">{t.owned} zoner</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black">{t.owned}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
