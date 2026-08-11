"use client";

import { ArrowLeft, ArrowRight, Crosshair, Loader2, MapPinned, Shield, Swords, Zap, type LucideIcon } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { poppins, rubik } from "@/lib/fonts";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { useBuilderSaveGuidance } from "@/components/builders/useBuilderSaveGuidance";
import {
  buildStrategoGameConfig,
  getNormalizedRunRaceType,
  getStrategoBasePreset,
  type BaseLocation,
  RACE_TYPES,
  type StoredRunRecord,
} from "@/utils/gpsRuns";
import { createClient } from "@/utils/supabase/client";

type BuilderNotice = {
  tone: "success" | "error";
  message: string;
};

type LiveSession = {
  id: string;
  pin: string | null;
  status: string | null;
};

type ArchiveLiveSessionMutationResult = {
  session: LiveSession | null;
  source: "created" | "reused" | null;
};

type StoredStrategoRun = Pick<
  StoredRunRecord,
  "id" | "user_id" | "title" | "description" | "race_type" | "game_config" | "gameConfig"
>;

type PlacementMode = "red" | "blue";

const STEP_ONE_FEATURES: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    title: "Nyt live format",
    description: "Stratego bygges nu i to klare trin: først rammesætning, derefter baseplacering og direkte live-opstart.",
    icon: Swords,
  },
  {
    title: "Hemmelige roller",
    description: "Eleverne går ind i spillet med skjulte roller og et tydeligt hold-mod-hold setup fra første sekund.",
    icon: Shield,
  },
  {
    title: "Live kontrol",
    description: "Kortet bruges kun til det vigtige: præcise baser, roligt overblik og en ren vej ind i lærerens live-dashboard.",
    icon: MapPinned,
  },
  {
    title: "Direkte opstart",
    description: "Når begge baser er sat, gemmer vi løbet og åbner straks den rigtige live-session uden mellemtrin.",
    icon: Zap,
  },
];

const StrategoBasePlacementMap = dynamic(() => import("@/components/live/StrategoBasePlacementMap"), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full animate-pulse rounded-[1.8rem] border border-white/10 bg-slate-950/55" />
  ),
});

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
    <article className="rounded-3xl border border-white/10 bg-white/6 p-4 shadow-[0_18px_44px_rgba(15,23,42,0.18)] backdrop-blur-xl">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-3 text-cyan-300">
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
  isBusy,
  onSelect,
}: {
  placementMode: PlacementMode;
  isBusy: boolean;
  onSelect: (mode: PlacementMode) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onSelect("red")}
        disabled={isBusy}
        className={`rounded-[1.3rem] border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
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
        onClick={() => onSelect("blue")}
        disabled={isBusy}
        className={`rounded-[1.3rem] border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
          placementMode === "blue"
            ? "border-sky-300/30 bg-sky-500/12 text-sky-100"
            : "border-white/10 bg-white/6 text-white/70 hover:bg-white/10"
        }`}
      >
        <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Næste klik</p>
        <p className="mt-2 text-lg font-black">Hold Blå Base</p>
      </button>
    </div>
  );
}

function BaseLocationCards({
  redBase,
  blueBase,
}: {
  redBase: BaseLocation | null;
  blueBase: BaseLocation | null;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
  );
}

function formatCoordinate(value: number | null) {
  if (value === null) return "Ikke sat";
  return value.toFixed(5);
}

async function requestArchiveLiveSessionMutation(runId: string) {
  const response = await fetch("/api/archive/live-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ runId, action: "ensure" }),
  });

  let body: { error?: string; session?: LiveSession | null; source?: "created" | "reused" | null } | null = null;

  try {
    body = (await response.json()) as { error?: string; session?: LiveSession | null; source?: "created" | "reused" | null };
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.error ?? "Kunne ikke åbne Stratego-lobbyen.");
  }

  return {
    session: body?.session ?? null,
    source: body?.source ?? null,
  } satisfies ArchiveLiveSessionMutationResult;
}

export default function StrategoBuilderPage() {
  return (
    <Suspense
      fallback={
        <main className={`relative min-h-screen overflow-hidden bg-slate-950 text-white ${poppins.className}`}>
          <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.18),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#1f2937_100%)]" />
          <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-12">
            <div className="w-full max-w-md rounded-4xl border border-white/12 bg-white/10 p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.32)] backdrop-blur-2xl">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-orange-200" />
              <p className="mt-4 text-xs font-semibold tracking-[0.28em] text-white/55 uppercase">Indlæser</p>
              <h1 className={`mt-2 text-3xl font-black text-white ${rubik.className}`}>Live Stratego</h1>
            </div>
          </div>
        </main>
      }
    >
      <StrategoBuilderContent />
    </Suspense>
  );
}

function StrategoBuilderContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const isEditMode = editRunId.length > 0;

  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const [isLoadingRun, setIsLoadingRun] = useState(isEditMode);
  const [isOpeningLive, setIsOpeningLive] = useState(false);
  const [redBase, setRedBase] = useState<BaseLocation | null>(null);
  const [blueBase, setBlueBase] = useState<BaseLocation | null>(null);
  const [placementMode, setPlacementMode] = useState<PlacementMode>("red");
  const saveFeedbackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isEditMode) return;

    let isMounted = true;

    const loadRun = async () => {
      setIsLoadingRun(true);
      setNotice(null);

      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("Du skal være logget ind for at åbne Live Stratego.");
        }

        const { data, error } = await supabase
          .from("gps_runs")
          .select("id,user_id,title,description,race_type,game_config,gameConfig:game_config")
          .eq("id", editRunId)
          .eq("user_id", user.id)
          .single<StoredStrategoRun>();

        if (error || !data) {
          throw new Error("Kunne ikke finde det valgte Stratego-løb.");
        }

        if (getNormalizedRunRaceType(data) !== RACE_TYPES.STRATEGO) {
          throw new Error("Det valgte loeb er ikke et Stratego-loeb.");
        }

        if (!isMounted) return;

        const preset = getStrategoBasePreset(data);
        setTitle(typeof data.title === "string" ? data.title : "");
        setDescription(typeof data.description === "string" ? data.description : "");
        setRedBase(preset.redBase);
        setBlueBase(preset.blueBase);
        setPlacementMode(preset.redBase && !preset.blueBase ? "blue" : "red");
      } catch (error) {
        if (!isMounted) return;
        setNotice({
          tone: "error",
          message: error instanceof Error ? error.message : "Kunne ikke åbne Stratego-løbet.",
        });
      } finally {
        if (isMounted) {
          setIsLoadingRun(false);
        }
      }
    };

    void loadRun();

    return () => {
      isMounted = false;
    };
  }, [editRunId, isEditMode]);

  const isBusy = isOpeningLive || isLoadingRun;
  const primaryTitle = useMemo(
    () => (title.trim().length > 0 ? title.trim() : "Live Stratego"),
    [title]
  );
  const hasPlacedBothBases = Boolean(redBase && blueBase);
  const isReadyToSave = title.trim() !== "" && hasPlacedBothBases;
  const { shouldHighlight: shouldHighlightSave } = useBuilderSaveGuidance(
    isReadyToSave,
    saveFeedbackRef
  );

  const handleMapPick = (lat: number, lng: number) => {
    setNotice(null);

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
    setNotice(null);
    setPlacementMode(teamCode);

    if (teamCode === "red") {
      setRedBase({ lat, lng });
      return;
    }

    setBlueBase({ lat, lng });
  };

  const saveRun = async () => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      setNotice({ tone: "error", message: "Giv først dit Stratego-løb en titel." });
      setStep(1);
      return;
    }

    if (!redBase || !blueBase) {
      setNotice({ tone: "error", message: "Placér først både rød og blå base på kortet." });
      setStep(2);
      return;
    }

    setNotice(null);
    setIsOpeningLive(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Du skal være logget ind for at gemme Live Stratego.");
      }

      const payload = {
        title: trimmedTitle,
        subject: "Stratego",
        description: trimmedDescription,
        topic: trimmedDescription || trimmedTitle,
        questions: [],
        race_type: RACE_TYPES.STRATEGO,
        game_config: buildStrategoGameConfig({
          redBase,
          blueBase,
        }),
      };

      let runId = editRunId;

      if (isEditMode) {
        const { data: updatedRuns, error } = await supabase
          .from("gps_runs")
          .update(payload)
          .eq("id", editRunId)
          .eq("user_id", user.id)
          .select("id");

        if (error) throw error;
        if (!updatedRuns || updatedRuns.length === 0) {
          throw new Error("Vi kunne ikke gemme ændringerne på Stratego-løbet.");
        }
      } else {
        const { data, error } = await supabase
          .from("gps_runs")
          .insert({ user_id: user.id, ...payload })
          .select("id")
          .single<{ id: string }>();

        if (error || !data?.id) {
          throw error ?? new Error("Kunne ikke oprette Live Stratego.");
        }

        runId = data.id;
      }

      const liveSession = await requestArchiveLiveSessionMutation(runId);
      if (!liveSession.session?.id) {
        throw new Error("Kunne ikke oprette en Stratego-session.");
      }

      router.push(`/dashboard/live/${liveSession.session.id}`);
    } catch (error) {
      setNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Der opstod en fejl, mens Stratego blev gemt.",
      });
    } finally {
      setIsOpeningLive(false);
    }
  };

  if (isEditMode && isLoadingRun) {
    return (
      <main className={`relative min-h-screen overflow-hidden bg-slate-950 text-white ${poppins.className}`}>
        <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.18),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#1f2937_100%)]" />
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-4xl border border-white/12 bg-white/10 p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.32)] backdrop-blur-2xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-orange-200" />
            <p className="mt-4 text-xs font-semibold tracking-[0.28em] text-white/55 uppercase">Indlæser</p>
            <h1 className={`mt-2 text-3xl font-black text-white ${rubik.className}`}>Live Stratego</h1>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`relative min-h-screen overflow-hidden bg-slate-950 text-white ${poppins.className}`}>
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.18),transparent_30%),radial-gradient(circle_at_bottom,rgba(220,38,38,0.14),transparent_36%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#111827_100%)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 md:px-10">
        <header className="flex items-center justify-between">
          <Link
            href="/dashboard/opret/valg"
            className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all duration-300 hover:border-white/28 hover:bg-white/16"
          >
            <ArrowLeft className="h-4 w-4 text-white/82" />
            Tilbage
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/25 bg-orange-500/10 px-4 py-2 text-[11px] font-bold tracking-[0.24em] text-orange-100 uppercase shadow-[0_12px_28px_rgba(249,115,22,0.15)]">
            <Shield className="h-4 w-4 text-orange-200" />
            Live Spil
          </div>
        </header>

        {step === 1 ? (
          <section className="mx-auto mt-10 w-full max-w-3xl rounded-4xl border border-white/12 bg-white/10 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.3)] backdrop-blur-2xl sm:p-8">
            <div className="flex flex-wrap items-center gap-4">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-red-300/30 bg-red-500/16 shadow-[0_14px_34px_rgba(239,68,68,0.22)]">
                <Crosshair className="h-7 w-7 text-orange-200" />
              </div>

              <div>
                <p className="text-xs font-semibold tracking-[0.32em] text-white/55 uppercase">Step 1 af 2</p>
                <h1 className={`mt-2 text-4xl font-black tracking-tight text-white md:text-5xl ${rubik.className}`}>
                  Live Stratego
                </h1>
              </div>
            </div>

            <p className="mt-6 text-base leading-7 text-white/74">
              Det klassiske brætspil vækkes til live. Først klargør du titel og intro. Derefter åbner vi et rent kort-step, hvor du sætter begge baser og starter sessionen.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {STEP_ONE_FEATURES.map((feature) => (
                <InfoFeatureCard
                  key={feature.title}
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                />
              ))}
            </div>

            <div className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-white/60 uppercase">
                  Titel
                </label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={isBusy}
                  placeholder="F.eks. Stratego i skoven for 6.A"
                  className="w-full rounded-[1.4rem] border border-white/14 bg-slate-950/45 px-5 py-4 text-lg font-semibold text-white placeholder:text-white/28 focus:border-orange-300/50 focus:outline-none focus:ring-2 focus:ring-orange-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold tracking-[0.22em] text-white/60 uppercase">
                  Kort intro
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={isBusy}
                  rows={5}
                  placeholder="Valgfrit: Skriv en kort note om klasse, område eller særlige regler."
                  className="w-full rounded-[1.4rem] border border-white/14 bg-slate-950/45 px-5 py-4 text-sm leading-6 text-white placeholder:text-white/28 focus:border-orange-300/50 focus:outline-none focus:ring-2 focus:ring-orange-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            </div>

            {notice ? (
              <div className="mt-6 rounded-[1.4rem] border border-red-300/28 bg-red-500/12 px-4 py-3 text-sm font-medium text-red-50">
                {notice.message}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setStep(2);
              }}
              disabled={isBusy}
              className="mt-8 inline-flex min-h-15 w-full items-center justify-center gap-3 rounded-3xl bg-cyan-400 px-5 py-4 text-sm font-black uppercase tracking-[0.24em] text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-white/45"
            >
              <ArrowRight className="h-5 w-5" />
              Næste: Placer baser på kortet
            </button>
          </section>
        ) : (
          <section className="mx-auto mt-10 w-full max-w-5xl space-y-4">
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setStep(1);
              }}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl transition-all duration-300 hover:border-white/28 hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ArrowLeft className="h-4 w-4 text-white/82" />
              Tilbage
            </button>

            <div className="rounded-4xl border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.08))] p-4 shadow-[0_24px_60px_rgba(15,23,42,0.34)] backdrop-blur-2xl sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.32em] text-white/55 uppercase">Step 2 af 2</p>
                  <h2 className={`mt-3 text-3xl font-black text-white ${rubik.className}`}>{primaryTitle}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                    Placér nu rød og blå base på kortet. Klik for første placering og træk markørerne, hvis du vil finjustere bagefter.
                  </p>
                </div>

                <div className="rounded-full border border-white/12 bg-slate-950/45 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-white/72">
                  {hasPlacedBothBases ? "Begge baser klar" : "Placér 2 baser"}
                </div>
              </div>

              {notice ? (
                <div className="mt-6 rounded-[1.4rem] border border-red-300/28 bg-red-500/12 px-4 py-3 text-sm font-medium text-red-50">
                  {notice.message}
                </div>
              ) : null}

              <div className="mt-6 overflow-hidden rounded-[1.8rem] border border-white/10">
                <StrategoBasePlacementMap
                  redBase={redBase}
                  blueBase={blueBase}
                  onPick={handleMapPick}
                  onBaseMove={handleBaseMove}
                  title="Placér baser på kortet"
                  description="Klik på kortet for at sætte baserne. Når de er sat, kan du trække dem til den endelige position."
                  readyLabel="Begge baser klar"
                  pendingLabel="Placér 2 baser"
                  className="rounded-none border-0 bg-transparent shadow-none"
                  mapHeightClassName="h-[60vh] min-h-[36rem] w-full xl:h-[68vh]"
                />
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,22rem)]">
                <div className="rounded-[1.8rem] border border-white/10 bg-slate-950/35 p-4 sm:p-5">
                  <PlacementModeButtons
                    placementMode={placementMode}
                    isBusy={isBusy}
                    onSelect={setPlacementMode}
                  />
                  <div className="mt-4">
                    <BaseLocationCards redBase={redBase} blueBase={blueBase} />
                  </div>
                </div>

                <div
                  ref={saveFeedbackRef}
                  className={`rounded-[1.8rem] border border-white/10 bg-slate-950/45 p-5 shadow-[0_18px_40px_rgba(15,23,42,0.18)] transition-all duration-300 ${
                    shouldHighlightSave
                      ? "border-orange-300/30 shadow-[0_0_0_1px_rgba(251,146,60,0.22),0_0_36px_rgba(249,115,22,0.18)]"
                      : ""
                  }`}
                >
                  <p className="text-[11px] font-semibold tracking-[0.26em] text-white/48 uppercase">Klar til live</p>
                  <h3 className={`mt-3 text-2xl font-black text-white ${rubik.className}`}>
                    {isEditMode ? "Gem og åbn live" : "Opret Live Session"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/70">
                    Når du starter her, gemmes Stratego-løbet og der oprettes en live-session med dine valgte baser.
                  </p>

                  <button
                    type="button"
                    onClick={() => void saveRun()}
                    disabled={isBusy || !hasPlacedBothBases}
                    className={`mt-6 inline-flex min-h-15 w-full items-center justify-center gap-3 rounded-3xl border border-orange-300/35 bg-[linear-gradient(135deg,rgba(249,115,22,0.92),rgba(220,38,38,0.92))] px-5 py-4 text-sm font-black uppercase tracking-[0.16em] text-white shadow-[0_18px_40px_rgba(220,38,38,0.24)] transition-all duration-300 hover:shadow-[0_24px_46px_rgba(220,38,38,0.28)] disabled:cursor-not-allowed disabled:opacity-70 ${
                      shouldHighlightSave
                        ? "scale-105 ring-4 ring-orange-300/80 ring-offset-2 ring-offset-slate-950 shadow-[0_24px_46px_rgba(249,115,22,0.38)]"
                        : ""
                    }`}
                  >
                    {isOpeningLive ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
                    Opret Live Session
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
