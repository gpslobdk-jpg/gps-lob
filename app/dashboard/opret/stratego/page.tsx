"use client";

import { ArrowLeft, Crosshair, Loader2, Shield } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { Suspense, useEffect, useMemo, useState } from "react";

import {
  buildStrategoGameConfig,
  getNormalizedRunRaceType,
  getStrategoBasePreset,
  type BaseLocation,
  RACE_TYPES,
  type StoredRunRecord,
} from "@/utils/gpsRuns";
import { createClient } from "@/utils/supabase/client";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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

const StrategoBasePlacementMap = dynamic(() => import("@/components/live/StrategoBasePlacementMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[24rem] w-full animate-pulse rounded-[1.8rem] border border-white/10 bg-slate-950/55" />
  ),
});

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
            <div className="w-full max-w-md rounded-[2rem] border border-white/12 bg-white/10 p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.32)] backdrop-blur-2xl">
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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const [isLoadingRun, setIsLoadingRun] = useState(isEditMode);
  const [isSavingArchive, setIsSavingArchive] = useState(false);
  const [isOpeningLive, setIsOpeningLive] = useState(false);
  const [redBase, setRedBase] = useState<BaseLocation | null>(null);
  const [blueBase, setBlueBase] = useState<BaseLocation | null>(null);
  const [placementMode, setPlacementMode] = useState<"red" | "blue">("red");

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

  const isBusy = isSavingArchive || isOpeningLive || isLoadingRun;
  const primaryTitle = useMemo(
    () => (title.trim().length > 0 ? title.trim() : "Live Stratego"),
    [title]
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

  const saveRun = async (mode: "archive" | "live") => {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      setNotice({ tone: "error", message: "Giv først dit Stratego-løb en titel." });
      return;
    }

    setNotice(null);
    if (mode === "archive") {
      setIsSavingArchive(true);
    } else {
      setIsOpeningLive(true);
    }

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

      if (mode === "archive") {
        setNotice({
          tone: "success",
          message: isEditMode ? "Stratego-løbet er gemt i arkivet." : "Live Stratego er gemt i arkivet.",
        });
        router.push("/dashboard/arkiv");
        return;
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
      setIsSavingArchive(false);
      setIsOpeningLive(false);
    }
  };

  if (isEditMode && isLoadingRun) {
    return (
      <main className={`relative min-h-screen overflow-hidden bg-slate-950 text-white ${poppins.className}`}>
        <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.18),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_48%,#1f2937_100%)]" />
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-[2rem] border border-white/12 bg-white/10 p-8 text-center shadow-[0_24px_60px_rgba(15,23,42,0.32)] backdrop-blur-2xl">
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

        <section className="mt-10 grid flex-1 gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="rounded-[2.2rem] border border-white/12 bg-white/10 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.3)] backdrop-blur-2xl">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-red-300/30 bg-red-500/16 shadow-[0_14px_34px_rgba(239,68,68,0.22)]">
              <Crosshair className="h-7 w-7 text-orange-200" />
            </div>

            <p className="mt-6 text-xs font-semibold tracking-[0.34em] text-white/55 uppercase">
              Nyt Live Format
            </p>
            <h1 className={`mt-3 text-4xl font-black tracking-tight text-white md:text-5xl ${rubik.className}`}>
              Live Stratego
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/74">
              Det klassiske brætspil vækkes til live. Eleverne får hemmelige roller på mobilen, finder modstanderne ude i virkeligheden og kæmper om at erobre fanen.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.6rem] border border-white/10 bg-white/7 p-4">
                <p className="text-[11px] font-semibold tracking-[0.22em] text-white/52 uppercase">Hemmelige roller</p>
                <p className="mt-2 text-sm leading-6 text-white/76">Spillere får skjulte rangkort og kun læreren har det fulde overblik.</p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/7 p-4">
                <p className="text-[11px] font-semibold tracking-[0.22em] text-white/52 uppercase">Live kontrolrum</p>
                <p className="mt-2 text-sm leading-6 text-white/76">Placer baser først. Derefter kører Stratego live med radar, safe zones og pauseknap.</p>
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-white/7 p-4">
                <p className="text-[11px] font-semibold tracking-[0.22em] text-white/52 uppercase">Direkte opstart</p>
                <p className="mt-2 text-sm leading-6 text-white/76">Når du er klar, åbner vi lobbyen og sender dig direkte videre til lærerens setup-skærm.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[2.2rem] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.08))] p-8 shadow-[0_24px_60px_rgba(15,23,42,0.34)] backdrop-blur-2xl">
            <p className="text-xs font-semibold tracking-[0.32em] text-white/55 uppercase">
              {isEditMode ? "Redigér Stratego" : "Opret Stratego"}
            </p>
            <h2 className={`mt-3 text-3xl font-black text-white ${rubik.className}`}>{primaryTitle}</h2>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Giv løbet en titel her. Du kan allerede gemme et base-preset til arkivet nu, så næste Stratego-session åbner med de rigtige baser på plads.
            </p>

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
                  Kort intro til arkivet
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

              <div className="rounded-[1.6rem] border border-white/10 bg-slate-950/35 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.22em] text-white/55 uppercase">
                      Base-preset til arkivet
                    </p>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
                      Valgfrit, men smart: Gem rød og blå base her, så live-setup&apos;et åbner med de samme placeringer næste gang.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setPlacementMode("red")}
                      disabled={isBusy}
                      className={`rounded-[1.1rem] border px-4 py-3 text-sm font-bold transition ${
                        placementMode === "red"
                          ? "border-rose-300/35 bg-rose-500/12 text-rose-100"
                          : "border-white/10 bg-white/6 text-white/72 hover:bg-white/10"
                      }`}
                    >
                      Næste klik: Rød
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlacementMode("blue")}
                      disabled={isBusy}
                      className={`rounded-[1.1rem] border px-4 py-3 text-sm font-bold transition ${
                        placementMode === "blue"
                          ? "border-sky-300/35 bg-sky-500/12 text-sky-100"
                          : "border-white/10 bg-white/6 text-white/72 hover:bg-white/10"
                      }`}
                    >
                      Næste klik: Blå
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Rød base</p>
                    <p className="mt-2 text-sm font-semibold text-white/88">
                      {formatCoordinate(redBase?.lat ?? null)} / {formatCoordinate(redBase?.lng ?? null)}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-white/45">Blå base</p>
                    <p className="mt-2 text-sm font-semibold text-white/88">
                      {formatCoordinate(blueBase?.lat ?? null)} / {formatCoordinate(blueBase?.lng ?? null)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-[1.8rem] border border-white/10">
                  <StrategoBasePlacementMap
                    redBase={redBase}
                    blueBase={blueBase}
                    onPick={handleMapPick}
                    title="Kort til base-preset"
                    description="Klik på kortet for at sætte rød og blå base. Du kan altid gemme uden preset og placere baserne senere i live-setup'et."
                    readyLabel="Preset klar"
                    pendingLabel="Valgfri preset"
                    className="rounded-none border-0 bg-transparent shadow-none"
                    mapHeightClassName="h-[24rem] w-full"
                  />
                </div>
              </div>
            </div>

            {notice ? (
              <div
                className={`mt-6 rounded-[1.4rem] border px-4 py-3 text-sm font-medium ${
                  notice.tone === "success"
                    ? "border-emerald-300/30 bg-emerald-500/12 text-emerald-50"
                    : "border-red-300/28 bg-red-500/12 text-red-50"
                }`}
              >
                {notice.message}
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void saveRun("live")}
                disabled={isBusy}
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[1.2rem] border border-orange-300/35 bg-[linear-gradient(135deg,rgba(249,115,22,0.92),rgba(220,38,38,0.92))] px-5 py-4 text-sm font-black tracking-[0.16em] text-white uppercase shadow-[0_18px_40px_rgba(220,38,38,0.24)] transition hover:scale-[1.01] hover:shadow-[0_24px_46px_rgba(220,38,38,0.28)] disabled:cursor-wait disabled:opacity-70"
              >
                {isOpeningLive ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                {isEditMode ? "Gem og åbn live" : "Opret live session"}
              </button>

              <button
                type="button"
                onClick={() => void saveRun("archive")}
                disabled={isBusy}
                className="inline-flex h-12 items-center justify-center rounded-[1.2rem] border border-white/16 bg-white/8 px-5 py-4 text-sm font-semibold text-white transition hover:border-white/26 hover:bg-white/12 disabled:cursor-wait disabled:opacity-70"
              >
                {isSavingArchive ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gem i arkiv"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
