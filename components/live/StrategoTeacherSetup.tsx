"use client";

import { ArrowLeft, ArrowRight, Loader2, MapPinned, Shield, Swords, Zap, type LucideIcon } from "lucide-react";
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

type StoredStrategoPresetRun = Pick<StoredRunRecord, "title" | "description" | "game_config" | "gameConfig">;
type PlacementMode = "red" | "blue";

const STEP_ONE_FEATURES: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Nyt live format",
    description: "Stratego starter som et enkelt lærerflow: først rammesætning, derefter præcis baseplacering på kortet.",
    icon: Swords,
  },
  {
    title: "Hemmelige roller",
    description: "Spillet er bygget til hold med skjulte funktioner, så eleverne går direkte ind i jagt, forsvar og taktik.",
    icon: Shield,
  },
  {
    title: "Live kontrol",
    description: "Læreren sætter kun det vigtigste op her og overlader resten til live-dashboardet, når sessionen er startet.",
    icon: MapPinned,
  },
  {
    title: "Direkte opstart",
    description: "Når baserne er placeret, kan sessionen oprettes med det samme uden ekstra paneler eller desktop-layouts.",
    icon: Zap,
  },
];

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

function InfoFeatureCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <article className="rounded-[1.6rem] border border-white/10 bg-white/6 p-4 shadow-[0_18px_44px_rgba(2,6,23,0.18)] backdrop-blur-xl">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-cyan-300">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-black tracking-tight text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-white/68">{description}</p>
        </div>
      </div>
    </article>
  );
}

function PlacementModeButtons({
  placementMode,
  onSelect,
  compact = false,
}: {
  placementMode: PlacementMode;
  onSelect: (mode: PlacementMode) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-3 sm:grid-cols-2 ${compact ? "" : "mt-5"}`}>
      <button
        type="button"
        onClick={() => onSelect("red")}
        className={`rounded-[1.3rem] border px-4 ${compact ? "py-3" : "py-4"} text-left transition ${
          placementMode === "red"
            ? "border-rose-300/30 bg-rose-500/12 text-rose-100"
            : "border-white/10 bg-white/6 text-white/70 hover:bg-white/10"
        }`}
      >
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Næste klik</p>
        <p className={`mt-2 font-black ${compact ? "text-base" : "text-lg"}`}>Hold Rød Base</p>
      </button>
      <button
        type="button"
        onClick={() => onSelect("blue")}
        className={`rounded-[1.3rem] border px-4 ${compact ? "py-3" : "py-4"} text-left transition ${
          placementMode === "blue"
            ? "border-sky-300/30 bg-sky-500/12 text-sky-100"
            : "border-white/10 bg-white/6 text-white/70 hover:bg-white/10"
        }`}
      >
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Næste klik</p>
        <p className={`mt-2 font-black ${compact ? "text-base" : "text-lg"}`}>Hold Blå Base</p>
      </button>
    </div>
  );
}

function BaseLocationCards({
  redBase,
  blueBase,
  compact = false,
}: {
  redBase: BaseLocation | null;
  blueBase: BaseLocation | null;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "grid grid-cols-2 gap-2" : "mt-5 grid gap-3 sm:grid-cols-2"}>
      <div className="rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Rød base</p>
        <p className={`mt-2 font-semibold text-white/88 ${compact ? "text-xs leading-5" : "text-sm"}`}>
          {compact ? (
            <>
              {formatCoordinate(redBase?.lat ?? null)}
              <br />
              {formatCoordinate(redBase?.lng ?? null)}
            </>
          ) : (
            <>{formatCoordinate(redBase?.lat ?? null)} / {formatCoordinate(redBase?.lng ?? null)}</>
          )}
        </p>
      </div>
      <div className="rounded-[1.3rem] border border-white/10 bg-white/6 px-4 py-4">
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Blå base</p>
        <p className={`mt-2 font-semibold text-white/88 ${compact ? "text-xs leading-5" : "text-sm"}`}>
          {compact ? (
            <>
              {formatCoordinate(blueBase?.lat ?? null)}
              <br />
              {formatCoordinate(blueBase?.lng ?? null)}
            </>
          ) : (
            <>{formatCoordinate(blueBase?.lat ?? null)} / {formatCoordinate(blueBase?.lng ?? null)}</>
          )}
        </p>
      </div>
    </div>
  );
}

function StartStrategoButton({
  isSaving,
  disabled,
  onClick,
  className = "",
}: {
  isSaving: boolean;
  disabled: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-14.5 w-full items-center justify-center gap-2 rounded-3xl bg-emerald-500 px-5 py-4 text-sm font-black uppercase tracking-[0.24em] text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/45 ${className}`}
    >
      {isSaving ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Opretter session...
        </>
      ) : (
        <>
          <Shield className="h-5 w-5" />
          Opret Live Session
        </>
      )}
    </button>
  );
}

export default function StrategoTeacherSetup({
  sessionId,
  joinPin,
  students,
  isLoading,
  onStartSession,
}: StrategoTeacherSetupProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [redBase, setRedBase] = useState<BaseLocation | null>(null);
  const [blueBase, setBlueBase] = useState<BaseLocation | null>(null);
  const [placementMode, setPlacementMode] = useState<PlacementMode>("red");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [runTitle, setRunTitle] = useState("Live Stratego");
  const [introText, setIntroText] = useState("");

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
              .select("title,description,game_config,gameConfig:game_config")
              .eq("id", nextRunId)
              .maybeSingle<StoredStrategoPresetRun>()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (!isActive) {
        return;
      }

      const gameRow = gameResult.error ? null : gameResult.data;
      const preset = runResult.error ? { redBase: null, blueBase: null } : getStrategoBasePreset(runResult.data);

      setRunTitle(
        typeof runResult.data?.title === "string" && runResult.data.title.trim()
          ? runResult.data.title
          : "Live Stratego"
      );
      setIntroText(typeof runResult.data?.description === "string" ? runResult.data.description : "");

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

  const handleBaseMove = (teamCode: PlacementMode, lat: number, lng: number) => {
    setSaveError(null);
    setPlacementMode(teamCode);

    if (teamCode === "red") {
      setRedBase({ lat, lng });
      return;
    }

    setBlueBase({ lat, lng });
  };

  const isStartDisabled = !sessionId || !redBase || !blueBase || isSaving;

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
        const nextTitle = runTitle.trim() || "Live Stratego";
        const nextDescription = introText.trim();

        const { error: presetError } = await supabase
          .from("gps_runs")
          .update({
            title: nextTitle,
            description: nextDescription || null,
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
      const userMessage =
        error instanceof Error && error.message
          ? error.message
          : "Stratego kunne ikke starte. Tjek at mindst to elever er med, og prøv igen.";
      setSaveError(userMessage);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_32%),linear-gradient(180deg,#020617_0%,#0f172a_50%,#111827_100%)] px-4 py-6 text-white sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        {step === 1 ? (
          <section className="rounded-4xl border border-white/10 bg-slate-900/72 p-5 shadow-[0_30px_80px_rgba(2,6,23,0.32)] backdrop-blur-2xl sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.3em] text-white/72">
              <Swords className="h-4 w-4 text-rose-200" />
              Step 1 af 2
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Klargør Live Stratego</h1>
            <p className="mt-3 text-sm leading-6 text-white/68 sm:text-base">
              Først samler du rammesætningen for sessionen. Derefter går du videre til kortet og placerer de to baser i ro og mag.
            </p>

            <div className="mt-6 space-y-3">
              {STEP_ONE_FEATURES.map((feature) => (
                <InfoFeatureCard
                  key={feature.title}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                />
              ))}
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.28em] text-white/48">Titel</span>
                <input
                  type="text"
                  value={runTitle}
                  onChange={(event) => setRunTitle(event.target.value)}
                  placeholder="Live Stratego"
                  className="mt-2 w-full rounded-[1.4rem] border border-white/10 bg-slate-950/55 px-4 py-3 text-base font-semibold text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/40 focus:bg-slate-950/72"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-black uppercase tracking-[0.28em] text-white/48">Intro</span>
                <textarea
                  value={introText}
                  onChange={(event) => setIntroText(event.target.value)}
                  rows={6}
                  placeholder="Skriv en kort intro, som forklarer holdene, stemningen eller missionen, før spillet starter."
                  className="mt-2 w-full rounded-[1.4rem] border border-white/10 bg-slate-950/55 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/30 focus:border-cyan-300/40 focus:bg-slate-950/72"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-6 inline-flex min-h-15 w-full items-center justify-center gap-3 rounded-3xl bg-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.24em] text-slate-950 transition hover:bg-cyan-300"
            >
              <ArrowRight className="h-5 w-5" />
              Næste: Placer baser på kortet
            </button>
          </section>
        ) : (
          <section className="mx-auto max-w-5xl space-y-4">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-white/82 transition hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Tilbage
            </button>

            <StrategoBasePlacementMap
              redBase={redBase}
              blueBase={blueBase}
              onPick={handleMapPick}
              onBaseMove={handleBaseMove}
              title="Placér baser"
              description="Klik for at sætte baserne, og træk derefter markørerne for at finjustere placeringen."
              readyLabel="Begge baser klar"
              pendingLabel="Placér 2 baser"
              mapHeightClassName="h-[60vh] min-h-[60vh] w-full md:h-[68vh]"
            />

            <div className="rounded-[1.8rem] border border-white/10 bg-slate-900/72 p-4 shadow-[0_24px_60px_rgba(2,6,23,0.28)] backdrop-blur-2xl sm:p-5">
              <PlacementModeButtons placementMode={placementMode} onSelect={setPlacementMode} />
              <BaseLocationCards redBase={redBase} blueBase={blueBase} />

              {saveError ? (
                <div className="mt-4 rounded-[1.2rem] border border-rose-300/25 bg-rose-500/12 px-4 py-3 text-sm text-rose-100">
                  {saveError}
                </div>
              ) : null}

              <StartStrategoButton
                isSaving={isSaving}
                disabled={isStartDisabled}
                onClick={() => void handleStart()}
                className="mt-5"
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
