"use client";

import { AlertTriangle, Loader2, Shield, Swords, Users } from "lucide-react";
import { useEffect, useState } from "react";

import StrategoBasePlacementMap from "@/components/live/StrategoBasePlacementMap";
import {
  buildStrategoGameConfig,
  getStrategoBasePreset,
  type BaseLocation,
  type StoredRunRecord,
} from "@/utils/gpsRuns";
import { createClient } from "@/utils/supabase/client";

type StrategoTeacherSetupProps = {
  sessionId?: string | null;
  joinPin: string;
  students: string[];
  isLoading: boolean;
  onStartSession: () => Promise<void>;
};

type StrategoGameRow = {
  red_base_lat?: number | string | null;
  red_base_lng?: number | string | null;
  blue_base_lat?: number | string | null;
  blue_base_lng?: number | string | null;
};

type LiveSessionRunRow = {
  run_id?: string | null;
};

type StoredStrategoPresetRun = Pick<StoredRunRecord, "game_config" | "gameConfig">;

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatCoordinate(value: number | null) {
  if (value === null) return "Ikke sat";
  return value.toFixed(5);
}

export default function StrategoTeacherSetup({
  sessionId,
  joinPin,
  students,
  isLoading,
  onStartSession,
}: StrategoTeacherSetupProps) {
  const [redBase, setRedBase] = useState<BaseLocation | null>(null);
  const [blueBase, setBlueBase] = useState<BaseLocation | null>(null);
  const [placementMode, setPlacementMode] = useState<"red" | "blue">("red");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const supabase = createClient();
    let isActive = true;

    const loadSavedBases = async () => {
      const { data: sessionData, error: sessionError } = await supabase
        .from("live_sessions")
        .select("run_id")
        .eq("id", sessionId)
        .maybeSingle<LiveSessionRunRow>();

      if (!isActive) {
        return;
      }

      const nextRunId = typeof sessionData?.run_id === "string" ? sessionData.run_id : null;
      setRunId(nextRunId);

      if (sessionError) {
        return;
      }

      const [gameResult, runResult] = await Promise.all([
        supabase
          .from("stratego_games")
          .select("red_base_lat,red_base_lng,blue_base_lat,blue_base_lng")
          .eq("session_id", sessionId)
          .maybeSingle<StrategoGameRow>(),
        nextRunId
          ? supabase
              .from("gps_runs")
              .select("game_config,gameConfig:game_config")
              .eq("id", nextRunId)
              .maybeSingle<StoredStrategoPresetRun>()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (!isActive) {
        return;
      }

      const gameRow = gameResult.error ? null : gameResult.data;
      const preset = runResult.error ? { redBase: null, blueBase: null } : getStrategoBasePreset(runResult.data);

      const sessionRedBase =
        gameRow && toFiniteNumber(gameRow.red_base_lat) !== null && toFiniteNumber(gameRow.red_base_lng) !== null
          ? {
              lat: toFiniteNumber(gameRow.red_base_lat) ?? 0,
              lng: toFiniteNumber(gameRow.red_base_lng) ?? 0,
            }
          : null;
      const sessionBlueBase =
        gameRow && toFiniteNumber(gameRow.blue_base_lat) !== null && toFiniteNumber(gameRow.blue_base_lng) !== null
          ? {
              lat: toFiniteNumber(gameRow.blue_base_lat) ?? 0,
              lng: toFiniteNumber(gameRow.blue_base_lng) ?? 0,
            }
          : null;

      const nextRedBase = sessionRedBase ?? preset.redBase;
      const nextBlueBase = sessionBlueBase ?? preset.blueBase;

      setRedBase(nextRedBase);
      setBlueBase(nextBlueBase);

      if (nextRedBase && !nextBlueBase) {
        setPlacementMode("blue");
      } else {
        setPlacementMode("red");
      }
    };

    void loadSavedBases();

    return () => {
      isActive = false;
    };
  }, [sessionId]);

  const handleMapPick = (lat: number, lng: number) => {
    setSaveError(null);

    if (placementMode === "red" || !redBase) {
      setRedBase({ lat, lng });
      if (!blueBase) {
        setPlacementMode("blue");
      }
      return;
    }

    setBlueBase({ lat, lng });
  };

  const handleStart = async () => {
    if (!sessionId || !redBase || !blueBase || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.from("stratego_games").upsert(
        {
          session_id: sessionId,
          red_base_lat: redBase.lat,
          red_base_lng: redBase.lng,
          blue_base_lat: blueBase.lat,
          blue_base_lng: blueBase.lng,
        },
        {
          onConflict: "session_id",
        }
      );

      if (error) {
        throw error;
      }

      let nextRunId = runId;
      if (!nextRunId) {
        const { data: sessionData, error: sessionError } = await supabase
          .from("live_sessions")
          .select("run_id")
          .eq("id", sessionId)
          .maybeSingle<LiveSessionRunRow>();

        if (sessionError) {
          throw sessionError;
        }

        nextRunId = typeof sessionData?.run_id === "string" ? sessionData.run_id : null;
        setRunId(nextRunId);
      }

      if (nextRunId) {
        const { error: presetError } = await supabase
          .from("gps_runs")
          .update({
            game_config: buildStrategoGameConfig({
              redBase,
              blueBase,
            }),
          })
          .eq("id", nextRunId);

        if (presetError) {
          throw presetError;
        }
      }

      await onStartSession();
    } catch (error) {
      console.error("Kunne ikke gemme Stratego-baser:", error);
      setSaveError("Kunne ikke gemme baserne endnu. Prøv igen.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-4 text-white sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(22rem,28rem)_minmax(0,1fr)]">
        <section className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.3em] text-white/65">
            <Swords className="h-4 w-4 text-rose-200" />
            Live Stratego Setup
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(145deg,rgba(15,23,42,0.92),rgba(15,118,110,0.16))] px-5 py-5">
            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-emerald-200/70">Join PIN</p>
            <p className="mt-3 text-5xl font-black tracking-[0.24em] text-white">{joinPin}</p>
            <p className="mt-3 text-sm leading-6 text-white/65">
              Lad eleverne joine, placér derefter rød base og blå base på kortet, og start spillet.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPlacementMode("red")}
              className={`rounded-[1.3rem] border px-4 py-4 text-left transition ${
                placementMode === "red"
                  ? "border-rose-300/30 bg-rose-500/12 text-rose-100"
                  : "border-white/10 bg-white/6 text-white/70 hover:bg-white/10"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Næste klik</p>
              <p className="mt-2 text-lg font-black">Hold Rød Base</p>
            </button>
            <button
              type="button"
              onClick={() => setPlacementMode("blue")}
              className={`rounded-[1.3rem] border px-4 py-4 text-left transition ${
                placementMode === "blue"
                  ? "border-sky-300/30 bg-sky-500/12 text-sky-100"
                  : "border-white/10 bg-white/6 text-white/70 hover:bg-white/10"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Næste klik</p>
              <p className="mt-2 text-lg font-black">Hold Blå Base</p>
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Rød base</p>
              <p className="mt-2 text-sm font-semibold text-white/88">
                {formatCoordinate(redBase?.lat ?? null)} / {formatCoordinate(redBase?.lng ?? null)}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Blå base</p>
              <p className="mt-2 text-sm font-semibold text-white/88">
                {formatCoordinate(blueBase?.lat ?? null)} / {formatCoordinate(blueBase?.lng ?? null)}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-4">
            <div className="flex items-center gap-2 text-white">
              <Users className="h-4 w-4 text-cyan-300" />
              <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Deltagere klar</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {students.length > 0 ? (
                students.map((student) => (
                  <span
                    key={student}
                    className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-sm font-semibold text-white/82"
                  >
                    {student}
                  </span>
                ))
              ) : (
                <p className="text-sm text-white/55">{isLoading ? "Henter deltagere..." : "Ingen deltagere har joinet endnu."}</p>
              )}
            </div>
          </div>

          {saveError ? (
            <div className="mt-5 rounded-[1.3rem] border border-rose-300/25 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
              {saveError}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={!redBase || !blueBase || isSaving}
            className="mt-6 inline-flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[1.5rem] bg-emerald-500 px-5 py-4 text-sm font-black uppercase tracking-[0.24em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/45"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Gemmer og starter...
              </>
            ) : (
              <>
                <Shield className="h-5 w-5" />
                Start Live Stratego
              </>
            )}
          </button>
        </section>

        <div className="relative">
          <StrategoBasePlacementMap
            redBase={redBase}
            blueBase={blueBase}
            onPick={handleMapPick}
            readyLabel="Klar til start"
            pendingLabel="Afventer 2 klik"
            mapHeightClassName="h-[calc(100svh-2rem)] min-h-[42rem] w-full lg:h-[calc(100svh-2rem)]"
          />

          {!sessionId ? (
            <div className="pointer-events-none absolute inset-x-6 top-6">
              <div className="flex items-center gap-3 rounded-[1.4rem] border border-rose-300/20 bg-rose-500/12 px-4 py-3 text-sm text-rose-100 shadow-[0_18px_40px_rgba(244,63,94,0.12)] backdrop-blur-xl">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <span>Session-id mangler. Åbn live-sessionen igen fra dashboardet.</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
