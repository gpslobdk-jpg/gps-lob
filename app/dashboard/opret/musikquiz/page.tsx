"use client";

import {
  Check,
  Loader2,
  Music,
  Plus,
  Ruler,
  Search,
  Trash2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { MobileBuilderWarning } from "@/components/builders/MobileBuilderWarning";
import type { SavedPin, SavedZone } from "@/components/MapPicker";
import {
  DEFAULT_SELECTED_GRADE_LEVELS,
  normalizeGradeLevels,
  type GradeLevel,
} from "@/utils/gradeLevels";
import { RACE_TYPES } from "@/utils/gpsRuns";
import { findNearbyPinConflict, findOverlappingPinGroups } from "@/utils/pinProximity";
import { createClient } from "@/utils/supabase/client";

const MapPicker = dynamic(() => import("@/components/MapPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-3xl border border-pink-500/20 bg-slate-900/50" />
  ),
});

const rubik = Rubik({ subsets: ["latin"], weight: ["700", "800", "900"] });
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// ---------------------------------------------------------------------------
// Typer
// ---------------------------------------------------------------------------

type MusicQuestion = {
  id: number;
  type: "multiple_choice";
  text: string;
  answers: [string, string, string, string];
  correctIndex: number;
  points: number;
  lat: number | null;
  lng: number | null;
  // Musikfelter — gemmes i questions JSON
  previewUrl?: string;
  artworkUrl?: string;
  musicArtist?: string;
  musicProvider?: "itunes";
  providerTrackId?: string;
  trackName?: string;
};

/** Svar-format fra /api/music/search */
type MusicSearchResult = {
  provider: "itunes";
  trackId: string;
  trackName: string;
  artistName: string;
  collectionName: string | null;
  previewUrl: string;
  artworkUrl100: string | null;
};

type PostSearchState = {
  query: string;
  results: MusicSearchResult[];
  loading: boolean;
  error: string | null;
};

type MapCenter = { lat: number; lng: number };
type BuilderNotice = { tone: "success" | "error"; message: string };

// ---------------------------------------------------------------------------
// Konstanter
// ---------------------------------------------------------------------------

const DEFAULT_MAP_CENTER: MapCenter = { lat: 55.6761, lng: 12.5683 };
const DEFAULT_POINTS = 10;
const DEFAULT_ANSWERS: [string, string, string, string] = ["", "", "", ""];
const DEFAULT_QUESTION_TEXT = "Hvad hedder sangen?";

function createPost(): MusicQuestion {
  return {
    id: Date.now() + Math.floor(Math.random() * 100_000),
    type: "multiple_choice",
    text: DEFAULT_QUESTION_TEXT,
    answers: [...DEFAULT_ANSWERS] as [string, string, string, string],
    correctIndex: 0,
    points: DEFAULT_POINTS,
    lat: null,
    lng: null,
  };
}

function createSearchState(query = ""): PostSearchState {
  return { query, results: [], loading: false, error: null };
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const inputClass =
  "w-full rounded-2xl border border-pink-500/30 bg-pink-950/20 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:cursor-not-allowed disabled:opacity-50";

// ---------------------------------------------------------------------------
// Side-wrapper med Suspense for searchParams
// ---------------------------------------------------------------------------

export default function OpretMusicQuizPage() {
  return (
    <Suspense>
      <OpretMusicQuizContent />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Hoved-komponent
// ---------------------------------------------------------------------------

function OpretMusicQuizContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editRunId = searchParams.get("id")?.trim() ?? "";
  const isEditMode = editRunId.length > 0;

  const [title, setTitle] = useState("");
  const [gradeLevels, setGradeLevels] = useState<GradeLevel[]>(
    DEFAULT_SELECTED_GRADE_LEVELS
  );
  const [posts, setPosts] = useState<MusicQuestion[]>(() => [createPost()]);
  const [searchStates, setSearchStates] = useState<
    Record<number, PostSearchState>
  >({});
  const [mapCenter, setMapCenter] = useState<MapCenter>(DEFAULT_MAP_CENTER);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRun, setIsLoadingRun] = useState(isEditMode);
  const [notice, setNotice] = useState<BuilderNotice | null>(null);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const pendingScrollId = useRef<number | null>(null);

  // -------------------------------------------------------------------------
  // Indlæs eksisterende løb
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isEditMode) {
      setIsLoadingRun(false);
      return;
    }
    let active = true;

    const load = async () => {
      setIsLoadingRun(true);
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (!active) return;
        if (userError || !user) {
          setNotice({
            tone: "error",
            message: "Du skal være logget ind for at redigere dette løb.",
          });
          return;
        }

        const { data: run, error } = await supabase
          .from("gps_runs")
          .select("id,title,questions,grade_levels")
          .eq("id", editRunId)
          .eq("user_id", user.id)
          .maybeSingle<{
            id: string;
            title: string | null;
            questions: unknown;
            grade_levels: string[] | null;
          }>();

        if (!active) return;
        if (error || !run) {
          setNotice({
            tone: "error",
            message: "Kunne ikke indlæse løbet. Prøv igen fra arkivet.",
          });
          return;
        }

        const loadedPosts = normalizePosts(run.questions);
        setTitle(run.title?.trim() ?? "");
        const gl = normalizeGradeLevels(run.grade_levels);
        setGradeLevels(
          gl.length > 0 ? gl : DEFAULT_SELECTED_GRADE_LEVELS
        );
        setPosts(loadedPosts.length > 0 ? loadedPosts : [createPost()]);
        setLoadedRunId(run.id);
        const firstPinned = loadedPosts.find(
          (p) => p.lat !== null && p.lng !== null
        );
        if (firstPinned?.lat && firstPinned?.lng) {
          setMapCenter({ lat: firstPinned.lat, lng: firstPinned.lng });
        }
      } catch (err) {
        console.error("Musikquiz load error:", err);
        if (active)
          setNotice({
            tone: "error",
            message: "Kunne ikke åbne løbet til redigering. Prøv igen.",
          });
      } finally {
        if (active) setIsLoadingRun(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [editRunId, isEditMode]);

  // -------------------------------------------------------------------------
  // Scroll til ny post
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (pendingScrollId.current === null || typeof window === "undefined")
      return;
    const id = pendingScrollId.current;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(`musikquiz-post-${id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      pendingScrollId.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [posts]);

  // -------------------------------------------------------------------------
  // Post-opdatering
  // -------------------------------------------------------------------------
  const updatePost = (id: number, updates: Partial<MusicQuestion>) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const updateAnswer = (postId: number, idx: number, value: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const answers = [...p.answers] as [string, string, string, string];
        answers[idx] = value;
        return { ...p, answers };
      })
    );
  };

  const addPost = () => {
    const next = createPost();
    pendingScrollId.current = next.id;
    setPosts((prev) => [...prev, next]);
  };

  const removePost = (idx: number) => {
    setPosts((prev) => {
      if (prev.length <= 1) return prev;
      const removed = prev[idx];
      if (removed) {
        setSearchStates((s) => {
          const next = { ...s };
          delete next[removed.id];
          return next;
        });
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const assignPin = (postId: number) => {
    const pinsToCheck = posts.map((p, i) => ({
      id: p.id,
      number: i + 1,
      lat: p.lat,
      lng: p.lng,
    }));
    const conflict = findNearbyPinConflict(pinsToCheck, mapCenter.lat, mapCenter.lng, postId);
    if (conflict) {
      setNotice({
        tone: "error",
        message: `Denne post ligger næsten samme sted som Post ${conflict.conflictingNumber} (${Math.round(conflict.distanceMeters)} m). Flyt kortet lidt, inden du henter pinnen.`,
      });
      return;
    }
    const currentIdx = posts.findIndex((p) => p.id === postId);
    const nextPost = posts[currentIdx + 1];
    if (nextPost) pendingScrollId.current = nextPost.id;
    updatePost(postId, { lat: mapCenter.lat, lng: mapCenter.lng });
  };

  // -------------------------------------------------------------------------
  // Musiksøgning
  // -------------------------------------------------------------------------
  const getSearchState = (postId: number): PostSearchState =>
    searchStates[postId] ?? createSearchState();

  const setSearchState = (
    postId: number,
    updates: Partial<PostSearchState>
  ) => {
    setSearchStates((prev) => ({
      ...prev,
      [postId]: { ...getSearchState(postId), ...updates },
    }));
  };

  const handleSearchQueryChange = (postId: number, value: string) => {
    setSearchState(postId, { query: value });
  };

  const handleSearch = async (postId: number) => {
    const state = getSearchState(postId);
    const q = state.query.trim();
    if (q.length < 2) {
      setSearchState(postId, {
        error: "Skriv mindst 2 tegn for at søge.",
        results: [],
      });
      return;
    }
    setSearchState(postId, { loading: true, error: null, results: [] });
    try {
      const res = await fetch(
        `/api/music/search?q=${encodeURIComponent(q)}`,
        { cache: "default" }
      );
      const data = (await res.json()) as
        | { results?: MusicSearchResult[] }
        | { error?: string };
      if (!res.ok) {
        const errMsg =
          "error" in data && typeof data.error === "string"
            ? data.error
            : "Musiksøgningen svarede ikke. Prøv igen.";
        setSearchState(postId, { loading: false, error: errMsg, results: [] });
        return;
      }
      const results =
        "results" in data && Array.isArray(data.results)
          ? (data.results as MusicSearchResult[])
          : [];
      setSearchState(postId, {
        loading: false,
        results,
        error:
          results.length === 0
            ? "Ingen resultater med lyd-preview. Prøv et andet søgeord."
            : null,
      });
    } catch {
      setSearchState(postId, {
        loading: false,
        error: "Musiksøgningen fejlede. Tjek din forbindelse og prøv igen.",
        results: [],
      });
    }
  };

  const handleSelectTrack = (
    postId: number,
    track: MusicSearchResult
  ) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;

        // Sæt spørgsmålstekst hvis tom
        const newText =
          p.text.trim() === "" || p.text === DEFAULT_QUESTION_TEXT
            ? DEFAULT_QUESTION_TEXT
            : p.text;

        // Sæt svar A til sangtitel og correctIndex = 0 kun hvis svar A er
        // tomt (default) — dvs. læreren har ikke selv skrevet egne svar endnu.
        const newAnswers = [...p.answers] as [
          string,
          string,
          string,
          string
        ];
        const answerAIsEmpty = !newAnswers[0].trim();
        if (answerAIsEmpty) {
          newAnswers[0] = track.trackName;
        }

        // Sæt correctIndex = 0 kun hvis svar A var tomt (vi satte det til
        // trackName) — bevar ellers lærerens nuværende valg.
        const newCorrectIndex = answerAIsEmpty ? 0 : p.correctIndex;

        return {
          ...p,
          text: newText,
          answers: newAnswers,
          correctIndex: newCorrectIndex,
          previewUrl: track.previewUrl,
          artworkUrl: track.artworkUrl100 ?? undefined,
          musicArtist: track.artistName,
          musicProvider: "itunes" as const,
          providerTrackId: track.trackId,
          trackName: track.trackName,
        };
      })
    );

    // Luk søgeresultater efter valg
    setSearchState(postId, { results: [], query: "" });
  };

  const handleClearTrack = (postId: number) => {
    updatePost(postId, {
      previewUrl: undefined,
      artworkUrl: undefined,
      musicArtist: undefined,
      musicProvider: undefined,
      providerTrackId: undefined,
      trackName: undefined,
    });
  };

  // -------------------------------------------------------------------------
  // Validering
  // -------------------------------------------------------------------------
  const normalizedPosts = useMemo(
    () =>
      posts
        .map((p) => ({
          ...p,
          text: p.text.trim(),
          answers: p.answers.map((a) => a.trim()) as [
            string,
            string,
            string,
            string
          ],
        }))
        .filter(
          (p) =>
            p.text.length > 0 ||
            p.answers.some((a) => a.length > 0) ||
            p.lat !== null
        ),
    [posts]
  );

  const hasIncomplete = normalizedPosts.some(
    (p) => !p.text || p.answers.some((a) => !a)
  );

  const hasMissingCoords = normalizedPosts.some(
    (p) => p.lat === null || p.lng === null
  );

  const overlapWarning = useMemo(() => {
    const pinsToCheck = posts.map((p, i) => ({
      id: p.id,
      number: i + 1,
      lat: p.lat,
      lng: p.lng,
    }));
    const groups = findOverlappingPinGroups(pinsToCheck);
    if (groups.length === 0) return null;
    return groups.map((g) => `Post ${g.postNumbers.join(" og ")}`).join(", ");
  }, [posts]);

  const isReadyToSave =
    title.trim().length > 0 &&
    normalizedPosts.length > 0 &&
    !hasIncomplete &&
    !hasMissingCoords;

  // -------------------------------------------------------------------------
  // Gem løb
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    setNotice(null);
    if (!title.trim()) {
      setNotice({ tone: "error", message: "Udfyld venligst en titel." });
      return;
    }
    if (normalizedPosts.length === 0) {
      setNotice({ tone: "error", message: "Tilføj mindst én post." });
      return;
    }
    if (hasIncomplete) {
      setNotice({
        tone: "error",
        message:
          "Udfyld spørgsmålstekst og alle fire svarmuligheder på alle poster.",
      });
      return;
    }
    if (hasMissingCoords) {
      setNotice({
        tone: "error",
        message: "Placer alle poster på kortet.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        setNotice({ tone: "error", message: "Du skal være logget ind." });
        return;
      }

      const payload = {
        title: title.trim(),
        subject: "Musikquiz",
        description: "",
        topic: title.trim(),
        questions: normalizedPosts,
        grade_levels: gradeLevels.length > 0 ? gradeLevels : null,
        race_type: RACE_TYPES.MUSIKQUIZ,
      };

      if (isEditMode && loadedRunId === editRunId) {
        const { error } = await supabase
          .from("gps_runs")
          .update(payload)
          .eq("id", editRunId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("gps_runs")
          .insert({ user_id: user.id, ...payload });
        if (error) throw error;
      }

      setNotice({
        tone: "success",
        message: isEditMode
          ? "Ændringerne er gemt!"
          : "Musikquiz-løbet er gemt i arkivet!",
      });
      await new Promise((r) => window.setTimeout(r, 450));
      router.push("/dashboard/arkiv");
    } catch (err) {
      console.error("Musikquiz gem fejl:", err);
      setNotice({ tone: "error", message: "Kunne ikke gemme løbet. Prøv igen." });
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Pins + zoner til MapPicker
  // -------------------------------------------------------------------------
  const pins = useMemo<SavedPin[]>(
    () =>
      posts
        .map((p, i) =>
          p.lat !== null && p.lng !== null
            ? { id: String(p.id), lat: p.lat, lng: p.lng, number: i + 1 }
            : null
        )
        .filter((p): p is SavedPin => p !== null),
    [posts]
  );

  const zones = useMemo<SavedZone[]>(
    () =>
      pins.map((pin) => ({
        id: `${pin.id}-15`,
        lat: pin.lat,
        lng: pin.lng,
        radius: 15,
      })),
    [pins]
  );

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------
  if (isEditMode && isLoadingRun) {
    return (
      <div
        className={`relative flex min-h-screen items-center justify-center bg-slate-950 text-white ${poppins.className}`}
      >
        <div className="text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-pink-300" />
          <p className="mt-4 text-sm text-pink-100/70">
            Indlæser musikquiz-løb...
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div
      className={`relative min-h-screen bg-slate-950 text-pink-50 ${poppins.className}`}
    >
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-pink-950/60 via-slate-900/80 to-fuchsia-900/40" />

      <div className="relative flex min-h-screen flex-col lg:flex-row">
        <div className="print:hidden">
          <MobileBuilderWarning />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Venstre: formular                                                  */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative w-full px-4 py-6 sm:px-6 lg:w-[52%] lg:px-8 lg:py-8">
          <div className="mx-auto max-w-3xl space-y-6">

            {/* Header */}
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.55rem] border border-pink-300/40 bg-pink-500/15 shadow-[0_10px_30px_rgba(219,39,119,0.2)]">
                <Music className="h-7 w-7 text-pink-300" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-pink-100/55">
                  Løbstype
                </p>
                <h1
                  className={`text-2xl font-black tracking-tight text-pink-50 ${rubik.className}`}
                >
                  Musikquiz
                </h1>
                <p className="mt-0.5 text-sm text-pink-100/70">
                  Lav et GPS-løb hvor eleverne hører musikklip og gætter
                  sangtitlen.
                </p>
              </div>
            </div>

            {isEditMode ? (
              <div className="inline-flex items-center rounded-full border border-pink-400/25 bg-pink-400/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.24em] text-pink-50">
                Redigerer eksisterende løb
              </div>
            ) : null}

            {/* Titel */}
            <div className="rounded-3xl border border-pink-500/30 bg-pink-950/20 p-5 backdrop-blur-xl">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-pink-100/65">
                Løbets titel
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSaving}
                placeholder="fx 5.A's musikquiz"
                className={inputClass}
              />
            </div>

            {/* Tæller */}
            <p className="px-1 text-xs font-semibold uppercase tracking-[0.24em] text-pink-100/65">
              Poster ({posts.length})
            </p>

            {notice ? (
              <div
                className={`rounded-3xl border px-4 py-3 text-sm font-semibold backdrop-blur-xl ${
                  notice.tone === "success"
                    ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100"
                    : "border-red-300/30 bg-red-500/10 text-red-100"
                }`}
              >
                {notice.message}
              </div>
            ) : null}

            {overlapWarning ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm font-semibold text-amber-200 backdrop-blur-xl">
                ⚠️ Poster på samme sted: {overlapWarning}. Brug &quot;Fjern placering&quot; og flyt kortet for at adskille dem.
              </div>
            ) : null}

            {/* Post-kort */}
            {posts.map((post, postIdx) => {
              const search = getSearchState(post.id);
              const hasTrack = Boolean(post.previewUrl);

              return (
                <article
                  key={post.id}
                  id={`musikquiz-post-${post.id}`}
                  className="rounded-[1.8rem] border border-pink-500/30 bg-pink-950/20 p-5 shadow-[0_22px_52px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
                >
                  {/* Post header */}
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2
                      className={`text-lg font-bold text-pink-50 ${rubik.className}`}
                    >
                      Post {postIdx + 1}
                    </h2>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-950/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-pink-100/75 backdrop-blur-xl">
                        Point
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={post.points}
                          onChange={(e) =>
                            updatePost(post.id, {
                              points: Math.max(
                                0,
                                Math.round(Number(e.target.value) || 0)
                              ),
                            })
                          }
                          disabled={isSaving}
                          className="w-14 bg-transparent text-right text-sm font-semibold text-pink-50 focus:outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => removePost(postIdx)}
                        disabled={isSaving || posts.length <= 1}
                        aria-label={`Slet post ${postIdx + 1}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-pink-500/30 bg-pink-950/20 text-pink-100/75 transition hover:border-red-300/40 hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* -------------------------------------------------------- */}
                  {/* Musiksektion                                              */}
                  {/* -------------------------------------------------------- */}
                  <div className="mb-5 rounded-[1.35rem] border border-pink-400/25 bg-pink-500/8 p-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-pink-100/65">
                      Musik
                    </p>

                    {/* Valgt nummer */}
                    {hasTrack ? (
                      <div className="mb-3 flex items-start gap-3 rounded-xl border border-pink-300/25 bg-pink-400/10 p-3">
                        {post.artworkUrl ? (
                          <Image
                            src={post.artworkUrl}
                            alt={post.trackName ?? "Artwork"}
                            width={56}
                            height={56}
                            className="h-14 w-14 shrink-0 rounded-lg object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-pink-400/20 bg-pink-900/40">
                            <Music className="h-6 w-6 text-pink-300/60" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-pink-50">
                            {post.trackName}
                          </p>
                          <p className="truncate text-xs text-pink-100/70">
                            {post.musicArtist}
                          </p>
                          {post.previewUrl ? (
                            <audio
                              controls
                              src={post.previewUrl}
                              className="mt-2 h-8 w-full"
                            />
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleClearTrack(post.id)}
                          aria-label="Fjern valgt nummer"
                          className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-pink-400/20 bg-pink-900/40 text-pink-200/70 transition hover:bg-red-500/20 hover:text-red-200"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p className="mb-3 text-xs text-amber-300/80">
                        ⚠ Der er ikke valgt musik endnu.
                      </p>
                    )}

                    {/* Søgefelt */}
                    <div className="flex gap-2">
                      <input
                        value={search.query}
                        onChange={(e) =>
                          handleSearchQueryChange(post.id, e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleSearch(post.id);
                          }
                        }}
                        disabled={isSaving || search.loading}
                        placeholder="Søg efter sang eller kunstner..."
                        className="min-w-0 flex-1 rounded-2xl border border-pink-500/30 bg-pink-950/30 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-pink-400 focus:outline-none disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSearch(post.id)}
                        disabled={isSaving || search.loading}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-pink-500/30 bg-pink-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {search.loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                        Søg
                      </button>
                    </div>

                    {/* Fejl */}
                    {search.error && !search.loading ? (
                      <p className="mt-2 text-xs text-red-300">{search.error}</p>
                    ) : null}

                    {/* Resultater */}
                    {search.results.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {search.results.map((track) => (
                          <div
                            key={track.trackId}
                            className="flex items-start gap-3 rounded-xl border border-pink-400/15 bg-pink-950/40 p-3"
                          >
                            {track.artworkUrl100 ? (
                              <Image
                                src={track.artworkUrl100}
                                alt={track.trackName}
                                width={44}
                                height={44}
                                className="h-11 w-11 shrink-0 rounded-lg object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-pink-400/20 bg-pink-900/40">
                                <Music className="h-5 w-5 text-pink-300/50" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-pink-50">
                                {track.trackName}
                              </p>
                              <p className="truncate text-xs text-pink-100/65">
                                {track.artistName}
                                {track.collectionName
                                  ? ` · ${track.collectionName}`
                                  : ""}
                              </p>
                              <audio
                                controls
                                src={track.previewUrl}
                                className="mt-1.5 h-8 w-full"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectTrack(post.id, track)}
                              className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-pink-400/30 bg-pink-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-white transition hover:bg-pink-500"
                            >
                              Vælg
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {/* -------------------------------------------------------- */}
                  {/* Spørgsmålstekst                                           */}
                  {/* -------------------------------------------------------- */}
                  <div className="mb-4">
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.22em] text-pink-100/65">
                      Spørgsmålstekst
                    </label>
                    <input
                      value={post.text}
                      onChange={(e) =>
                        updatePost(post.id, { text: e.target.value })
                      }
                      disabled={isSaving}
                      placeholder='fx "Hvad hedder sangen?"'
                      className={inputClass}
                    />
                  </div>

                  {/* -------------------------------------------------------- */}
                  {/* Svarmuligheder                                            */}
                  {/* -------------------------------------------------------- */}
                  <div className="space-y-2">
                    {post.answers.map((answer, ansIdx) => {
                      const isCorrect = post.correctIndex === ansIdx;
                      return (
                        <div
                          key={ansIdx}
                          className={`flex items-center gap-2.5 rounded-[1.25rem] border px-3 py-2.5 transition ${
                            isCorrect
                              ? "border-pink-300/40 bg-pink-500/12"
                              : "border-pink-500/30 bg-pink-950/20 hover:border-pink-400/25"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              updatePost(post.id, { correctIndex: ansIdx })
                            }
                            aria-label={`Marker svar ${ansIdx + 1} som korrekt`}
                            aria-pressed={isCorrect}
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-black transition ${
                              isCorrect
                                ? "border-pink-200 bg-pink-300 text-pink-950"
                                : "border-pink-500/30 bg-pink-950/20 text-pink-100/78 hover:border-pink-300/30"
                            }`}
                          >
                            {String.fromCharCode(65 + ansIdx)}
                          </button>

                          <input
                            value={answer}
                            onChange={(e) =>
                              updateAnswer(post.id, ansIdx, e.target.value)
                            }
                            disabled={isSaving}
                            placeholder={`Svar ${ansIdx + 1}`}
                            className="min-w-0 flex-1 bg-transparent py-1 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none disabled:opacity-50"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              updatePost(post.id, { correctIndex: ansIdx })
                            }
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] transition ${
                              isCorrect
                                ? "border-pink-200/60 bg-pink-300 text-pink-950"
                                : "border-pink-500/30 bg-pink-950/20 text-pink-100/72 hover:border-pink-300/30 hover:text-pink-100"
                            }`}
                          >
                            {isCorrect ? <Check className="h-3.5 w-3.5" /> : null}
                            {isCorrect ? "Korrekt" : "Marker"}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pin-knap */}
                  <button
                    type="button"
                    onClick={() => assignPin(post.id)}
                    disabled={isSaving}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[1.35rem] border border-pink-500/30 bg-pink-600 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-pink-500/20 transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Ruler className="h-4 w-4" />
                    Hent pin til kortet
                  </button>

                  {post.lat !== null && post.lng !== null ? (
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-xs text-pink-100/60">
                        Pin gemt: {post.lat.toFixed(5)}, {post.lng.toFixed(5)}
                      </p>
                      <button
                        type="button"
                        onClick={() => updatePost(post.id, { lat: null, lng: null })}
                        disabled={isSaving}
                        className="shrink-0 text-xs text-pink-300/60 underline underline-offset-2 hover:text-pink-200 disabled:pointer-events-none disabled:opacity-50"
                      >
                        Fjern placering
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}

            {/* Tilføj post + Gem */}
            <div className="rounded-[1.8rem] border border-pink-500/30 bg-pink-950/20 p-5 backdrop-blur-xl">
              <button
                type="button"
                onClick={addPost}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-[1.4rem] border border-pink-500/30 bg-pink-950/20 px-4 py-3 text-sm font-semibold text-pink-100 transition hover:bg-pink-900/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Tilføj post
              </button>

              <div className="mt-6">
                {notice?.tone === "error" ? (
                  <div className="mb-3 rounded-2xl border border-red-300/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
                    {notice.message}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className={`w-full rounded-[1.6rem] border border-pink-500/30 bg-pink-600 px-6 py-4 text-lg font-extrabold uppercase tracking-[0.22em] text-white shadow-lg shadow-pink-500/20 transition hover:bg-pink-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                    !isSaving && isReadyToSave
                      ? "ring-2 ring-pink-400/50 ring-offset-2 ring-offset-slate-950"
                      : ""
                  }`}
                >
                  {isSaving
                    ? "Gemmer..."
                    : isEditMode
                    ? "Gem ændringer"
                    : "Gem musikquiz i arkivet"}
                </button>
              </div>

              <div className="mt-4 text-center">
                <Link
                  href="/dashboard/arkiv"
                  className="text-sm text-pink-100/55 transition hover:text-pink-100/80"
                >
                  Tilbage til arkiv
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Højre: kort                                                       */}
        {/* ---------------------------------------------------------------- */}
        <aside className="hidden w-full p-4 lg:block lg:w-[48%] lg:p-8 lg:pl-0">
          <div className="lg:sticky lg:top-20">
            <div className="h-[42vh] min-h-80 w-full overflow-hidden rounded-4xl border border-pink-500/20 bg-slate-900/50 shadow-[0_24px_60px_rgba(0,0,0,0.38)] lg:h-[calc(100vh-7rem)]">
              <MapPicker
                center={mapCenter}
                pins={pins}
                zones={zones}
                onCenterChange={setMapCenter}
                onPinClick={(pinId) =>
                  document
                    .getElementById(`musikquiz-post-${pinId}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }
                onPinDragEnd={(pinId, coords) =>
                  updatePost(Number(pinId), {
                    lat: coords.lat,
                    lng: coords.lng,
                  })
                }
                autoLocateOnLoad={!isEditMode}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hjælpe-funktioner
// ---------------------------------------------------------------------------

function normalizePosts(raw: unknown): MusicQuestion[] {
  if (!Array.isArray(raw)) return [];
  const ts = Date.now();

  return raw
    .map((item, idx): MusicQuestion | null => {
      if (!item || typeof item !== "object") return null;
      const c = item as Record<string, unknown>;

      const lat = Number(c.lat);
      const lng = Number(c.lng);

      const rawAnswers = Array.isArray(c.answers) ? c.answers : [];
      const answers: [string, string, string, string] = [
        typeof rawAnswers[0] === "string" ? rawAnswers[0] : "",
        typeof rawAnswers[1] === "string" ? rawAnswers[1] : "",
        typeof rawAnswers[2] === "string" ? rawAnswers[2] : "",
        typeof rawAnswers[3] === "string" ? rawAnswers[3] : "",
      ];

      const ci = Number(c.correctIndex);
      const correctIndex =
        Number.isInteger(ci) && ci >= 0 && ci <= 3 ? ci : 0;

      return {
        id: typeof c.id === "number" ? c.id : ts + idx,
        type: "multiple_choice",
        text:
          typeof c.text === "string" ? c.text.trim() : DEFAULT_QUESTION_TEXT,
        answers,
        correctIndex,
        points:
          typeof c.points === "number" && Number.isFinite(c.points)
            ? Math.max(0, Math.round(c.points))
            : DEFAULT_POINTS,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        previewUrl:
          typeof c.previewUrl === "string" ? c.previewUrl : undefined,
        artworkUrl:
          typeof c.artworkUrl === "string" ? c.artworkUrl : undefined,
        musicArtist:
          typeof c.musicArtist === "string" ? c.musicArtist : undefined,
        musicProvider:
          c.musicProvider === "itunes" ? "itunes" : undefined,
        providerTrackId:
          typeof c.providerTrackId === "string" ? c.providerTrackId : undefined,
        trackName:
          typeof c.trackName === "string" ? c.trackName : undefined,
      };
    })
    .filter((p): p is MusicQuestion => p !== null);
}
