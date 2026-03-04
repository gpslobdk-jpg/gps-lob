"use client";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { AlertCircle, CheckCircle2, Crosshair, MapPin } from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import trophyAnimation from "@/public/trophy.json";
import { createClient } from "@/utils/supabase/client";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), {
  ssr: false,
});
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), {
  ssr: false,
});
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), {
  ssr: false,
});

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

type Question = {
  text: string;
  answers: string[];
  correctIndex: number;
  lat: number;
  lng: number;
  mediaUrl?: string;
};

type Location = {
  lat: number;
  lng: number;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

type StoredActiveParticipant = {
  participantId: string;
  sessionId: string;
  studentName: string;
  savedAt: string;
};

type ParticipantRow = {
  id?: string | null;
  session_id?: string | null;
  student_name?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  finished_at?: string | null;
};

type AnswerProgressRow = {
  post_index?: number | string | null;
  question_index?: number | string | null;
  is_correct?: boolean | null;
};

const ACTIVE_PARTICIPANT_STORAGE_KEY = "gpslob_active_participant";

function isMissingColumnError(error: SupabaseErrorLike | null | undefined) {
  if (!error) return false;
  if (error.code === "42703" || error.code === "PGRST204") return true;
  return /column/i.test(error.message ?? "");
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readStoredActiveParticipant(): StoredActiveParticipant | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ACTIVE_PARTICIPANT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredActiveParticipant>;
    if (!parsed.participantId || !parsed.sessionId) return null;
    return {
      participantId: parsed.participantId,
      sessionId: parsed.sessionId,
      studentName: parsed.studentName ?? "",
      savedAt: parsed.savedAt ?? "",
    };
  } catch {
    return null;
  }
}

function saveStoredActiveParticipant(value: StoredActiveParticipant) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_PARTICIPANT_STORAGE_KEY, JSON.stringify(value));
}

function clearStoredActiveParticipant() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_PARTICIPANT_STORAGE_KEY);
}

function parseQuestion(raw: unknown): Question | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Record<string, unknown>;
  const lat = Number(candidate.lat);
  const lng = Number(candidate.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const answers = Array.isArray(candidate.answers)
    ? candidate.answers
        .slice(0, 4)
        .map((item) => (typeof item === "string" ? item : ""))
    : ["", "", "", ""];
  while (answers.length < 4) answers.push("");

  const correctIndex = Number(candidate.correctIndex);
  return {
    text: typeof candidate.text === "string" ? candidate.text : "",
    answers,
    correctIndex:
      Number.isInteger(correctIndex) && correctIndex >= 0 && correctIndex <= 3
        ? correctIndex
        : 0,
    lat,
    lng,
    mediaUrl: typeof candidate.mediaUrl === "string" ? candidate.mediaUrl : "",
  };
}

function PlayScreen() {
  const params = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());

  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;
  const initialStudentName = searchParams.get("name")?.trim() || "";
  const storedParticipantOnLoad = useMemo(() => {
    if (!sessionId) return null;
    const stored = readStoredActiveParticipant();
    if (!stored) return null;
    if (stored.sessionId !== sessionId) {
      clearStoredActiveParticipant();
      return null;
    }
    return stored;
  }, [sessionId]);
  const [playerName, setPlayerName] = useState(
    () => initialStudentName || storedParticipantOnLoad?.studentName || ""
  );

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [myLoc, setMyLoc] = useState<Location | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [showQuestion, setShowQuestion] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [gpsError, setGpsError] = useState("");
  const [latestMessage, setLatestMessage] = useState<string | null>(null);
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(
    () => storedParticipantOnLoad?.participantId ?? null
  );
  const [correctAnswersCount, setCorrectAnswersCount] = useState(0);
  const participantsTableMissingRef = useRef(false);
  const answersTableMissingRef = useRef(false);
  const hasRestoredRef = useRef(!Boolean(storedParticipantOnLoad));
  const resumeMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showResumeNotice = useCallback((message: string) => {
    setResumeMessage(message);
    if (resumeMessageTimerRef.current) {
      clearTimeout(resumeMessageTimerRef.current);
    }
    resumeMessageTimerRef.current = setTimeout(() => {
      setResumeMessage(null);
      resumeMessageTimerRef.current = null;
    }, 5000);
  }, []);

  const rememberActiveParticipant = useCallback(
    (nextParticipantId: string, nextStudentName: string) => {
      if (!sessionId || !nextParticipantId) return;
      const normalizedName = nextStudentName.trim();
      setParticipantId(nextParticipantId);
      saveStoredActiveParticipant({
        participantId: nextParticipantId,
        sessionId,
        studentName: normalizedName,
        savedAt: new Date().toISOString(),
      });
    },
    [sessionId]
  );

  useEffect(() => {
    return () => {
      if (resumeMessageTimerRef.current) {
        clearTimeout(resumeMessageTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!sessionId || !participantId || questions.length === 0 || hasRestoredRef.current) return;

    let isActive = true;

    const restoreFromStorage = async () => {
      const { data: participantData, error: participantError } = await supabase
        .from("participants")
        .select("id,session_id,student_name,lat,lng,finished_at")
        .eq("id", participantId)
        .eq("session_id", sessionId)
        .maybeSingle<ParticipantRow>();

      if (!isActive) return;

      if (participantError) {
        if (participantError.code === "PGRST205") {
          participantsTableMissingRef.current = true;
        } else {
          console.error("Kunne ikke genskabe elevdata fra participants:", participantError);
        }
        hasRestoredRef.current = true;
        return;
      }

      if (!participantData) {
        clearStoredActiveParticipant();
        setParticipantId(null);
        hasRestoredRef.current = true;
        return;
      }

      const restoredName =
        typeof participantData.student_name === "string"
          ? participantData.student_name.trim()
          : "";

      const resolvedName = restoredName || playerName || initialStudentName;
      if (resolvedName) {
        setPlayerName(resolvedName);
      }

      if (participantData.id && resolvedName) {
        rememberActiveParticipant(String(participantData.id), resolvedName);
      }

      const restoredLat = toFiniteNumber(participantData.lat);
      const restoredLng = toFiniteNumber(participantData.lng);
      if (restoredLat !== null && restoredLng !== null) {
        setMyLoc({ lat: restoredLat, lng: restoredLng });
      }

      if (participantData.finished_at) {
        clearStoredActiveParticipant();
        setParticipantId(null);
        setIsFinished(true);
        hasRestoredRef.current = true;
        return;
      }

      if (resolvedName) {
        const { data: answersData, error: answersError } = await supabase
          .from("answers")
          .select("post_index,question_index,is_correct")
          .eq("session_id", sessionId)
          .eq("student_name", resolvedName);

        if (!isActive) return;

        if (answersError) {
          if (answersError.code === "PGRST205") {
            answersTableMissingRef.current = true;
          } else {
            console.error("Kunne ikke hente elevens tidligere svar:", answersError);
          }
        } else if (answersData) {
          const rows = answersData as AnswerProgressRow[];
          const confirmedCorrect = rows.filter((row) => row.is_correct === true).length;
          setCorrectAnswersCount(confirmedCorrect);

          let highestCompletedPost = 0;
          for (const row of rows) {
            if (row.is_correct === false) continue;
            const postFromPostIndex = toFiniteNumber(row.post_index);
            const postFromQuestionIndex = toFiniteNumber(row.question_index);
            const normalizedPostNumber =
              postFromPostIndex ?? (postFromQuestionIndex === null ? null : postFromQuestionIndex + 1);
            if (
              normalizedPostNumber !== null &&
              normalizedPostNumber > highestCompletedPost
            ) {
              highestCompletedPost = normalizedPostNumber;
            }
          }

          if (highestCompletedPost >= questions.length) {
            clearStoredActiveParticipant();
            setParticipantId(null);
            setIsFinished(true);
            hasRestoredRef.current = true;
            return;
          }

          const nextPostNumber = Math.max(1, highestCompletedPost + 1);
          const nextPostIndex = Math.min(nextPostNumber, questions.length) - 1;
          setCurrentPostIndex(nextPostIndex);
          setShowQuestion(false);
          setDistance(null);
        }
      }

      if (resolvedName) {
        showResumeNotice(`Velkommen tilbage, ${resolvedName}! Genoptager løbet...`);
      }

      hasRestoredRef.current = true;
    };

    void restoreFromStorage();

    return () => {
      isActive = false;
    };
  }, [
    sessionId,
    participantId,
    questions.length,
    supabase,
    playerName,
    initialStudentName,
    rememberActiveParticipant,
    showResumeNotice,
  ]);

  const syncParticipantLocation = useCallback(
    async (lat: number, lng: number) => {
      const activeName = playerName.trim();
      if (!sessionId || !activeName) return;

      const timestamp = new Date().toISOString();

      if (!participantsTableMissingRef.current) {
        let { data, error } = await supabase
          .from("participants")
          .update({ lat, lng, last_updated: timestamp })
          .eq("session_id", sessionId)
          .eq("student_name", activeName)
          .select("id");

        if (error && isMissingColumnError(error)) {
          const retry = await supabase
            .from("participants")
            .update({ lat, lng })
            .eq("session_id", sessionId)
            .eq("student_name", activeName)
            .select("id");
          data = retry.data;
          error = retry.error;
        }

        if (!error && data && data.length > 0) {
          const resolvedId = (data[0] as { id?: string | null }).id;
          if (resolvedId) {
            rememberActiveParticipant(String(resolvedId), activeName);
          }
          return;
        }

        if (!error && (!data || data.length === 0)) {
          const createPayloads: Record<string, unknown>[] = [
            {
              session_id: sessionId,
              student_name: activeName,
              lat,
              lng,
              last_updated: timestamp,
            },
            {
              session_id: sessionId,
              student_name: activeName,
              lat,
              lng,
            },
          ];

          for (const payload of createPayloads) {
            const { data: inserted, error: insertError } = await supabase
              .from("participants")
              .insert(payload)
              .select("id")
              .single();

            if (!insertError) {
              const resolvedId = inserted?.id;
              if (resolvedId) {
                rememberActiveParticipant(String(resolvedId), activeName);
              }
              return;
            }

            if (insertError.code === "23505") {
              const { data: existing } = await supabase
                .from("participants")
                .select("id")
                .eq("session_id", sessionId)
                .eq("student_name", activeName)
                .maybeSingle();

              const resolvedId = existing?.id;
              if (resolvedId) {
                rememberActiveParticipant(String(resolvedId), activeName);
              }
              return;
            }

            if (insertError.code === "PGRST205") {
              participantsTableMissingRef.current = true;
              break;
            }
            if (isMissingColumnError(insertError)) continue;
            console.error("Kunne ikke oprette participant:", insertError);
            break;
          }
        } else if (error) {
          if (error.code === "PGRST205") {
            participantsTableMissingRef.current = true;
          } else {
            console.error("Kunne ikke opdatere participant:", error);
          }
        }
      }

      let { error: fallbackError } = await supabase
        .from("session_students")
        .update({ lat, lng, last_updated: timestamp })
        .eq("session_id", sessionId)
        .eq("student_name", activeName);

      if (fallbackError && isMissingColumnError(fallbackError)) {
        const retry = await supabase
          .from("session_students")
          .update({ lat, lng })
          .eq("session_id", sessionId)
          .eq("student_name", activeName);
        fallbackError = retry.error;
      }

      if (fallbackError && fallbackError.code !== "PGRST205") {
        console.error("Kunne ikke opdatere elevposition:", fallbackError);
      }
    },
    [playerName, rememberActiveParticipant, sessionId, supabase]
  );

  const markParticipantFinished = useCallback(async () => {
    const activeName = playerName.trim();
    if (!sessionId || !activeName) return;
    const finishedAt = new Date().toISOString();

    if (!participantsTableMissingRef.current) {
      const { error } = await supabase
        .from("participants")
        .update({ finished_at: finishedAt })
        .eq("session_id", sessionId)
        .eq("student_name", activeName);

      if (!error) {
        clearStoredActiveParticipant();
        setParticipantId(null);
        return;
      }
      if (error.code === "PGRST205") {
        participantsTableMissingRef.current = true;
      } else {
        console.error("Kunne ikke gemme målgang i participants:", error);
      }
    }

    const { error: fallbackError } = await supabase
      .from("session_students")
      .update({ finished_at: finishedAt })
      .eq("session_id", sessionId)
      .eq("student_name", activeName);

    if (fallbackError) {
      console.error("Kunne ikke gemme målgangstid:", fallbackError);
    }
    clearStoredActiveParticipant();
    setParticipantId(null);
  }, [playerName, sessionId, supabase]);

  const insertAnswerRecord = useCallback(
    async (
      selectedIndex: number,
      isCorrect: boolean,
      postNumber: number,
      questionText: string,
      lat: number | null,
      lng: number | null
    ) => {
      const activeName = playerName.trim();
      if (!sessionId || !activeName || answersTableMissingRef.current) return;

      const timestamp = new Date().toISOString();
      const payloads: Record<string, unknown>[] = [
        {
          session_id: sessionId,
          student_name: activeName,
          post_index: postNumber,
          question_index: postNumber - 1,
          selected_index: selectedIndex,
          answer_index: selectedIndex,
          is_correct: isCorrect,
          question_text: questionText,
          lat,
          lng,
          answered_at: timestamp,
        },
        {
          session_id: sessionId,
          student_name: activeName,
          post_index: postNumber,
          selected_index: selectedIndex,
          is_correct: isCorrect,
          answered_at: timestamp,
        },
        {
          session_id: sessionId,
          student_name: activeName,
          question_index: postNumber - 1,
          answer_index: selectedIndex,
          is_correct: isCorrect,
          created_at: timestamp,
        },
        {
          session_id: sessionId,
          student_name: activeName,
          selected_index: selectedIndex,
          is_correct: isCorrect,
        },
      ];

      for (const payload of payloads) {
        const { error } = await supabase.from("answers").insert(payload);
        if (!error) return;
        if (error.code === "PGRST205") {
          answersTableMissingRef.current = true;
          return;
        }
        if (isMissingColumnError(error)) continue;
        console.error("Kunne ikke gemme svar i answers:", error);
        return;
      }
    },
    [playerName, sessionId, supabase]
  );

  useEffect(() => {
    if (!sessionId) return;

    let isActive = true;

    const fetchRun = async () => {
      setIsLoading(true);
      setLoadError("");

      const { data: sessionData, error: sessionError } = await supabase
        .from("live_sessions")
        .select("run_id")
        .eq("id", sessionId)
        .single();

      if (!isActive) return;

      if (sessionError || !sessionData?.run_id) {
        setLoadError("Kunne ikke finde denne session.");
        setIsLoading(false);
        return;
      }

      const { data: runData, error: runError } = await supabase
        .from("gps_runs")
        .select("questions")
        .eq("id", sessionData.run_id)
        .single();

      if (!isActive) return;

      if (runError) {
        setLoadError("Kunne ikke hente løbet.");
        setIsLoading(false);
        return;
      }

      const parsedQuestions = Array.isArray(runData?.questions)
        ? runData.questions.map(parseQuestion).filter((q): q is Question => q !== null)
        : [];

      if (parsedQuestions.length === 0) {
        setLoadError("Dette løb har ingen gyldige GPS-poster endnu.");
      } else {
        setQuestions(parsedQuestions);
      }

      setIsLoading(false);
    };

    void fetchRun();

    return () => {
      isActive = false;
    };
  }, [sessionId, supabase]);

  useEffect(() => {
    if (!navigator.geolocation || questions.length === 0 || isFinished || !sessionId) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        setGpsError((prev) => (prev ? "" : prev));
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMyLoc({ lat, lng });

        const target = questions[currentPostIndex];
        if (target && Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
          const dist = getDistance(lat, lng, target.lat, target.lng);
          setDistance(dist);

          if (dist < 20 && !showQuestion) {
            setShowQuestion(true);
          }
        }

        await syncParticipantLocation(lat, lng);
      },
      (err) => {
        console.error("GPS Error:", err);
        setGpsError("GPS ikke tilgængelig. Tjek lokationstilladelser.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [
    questions,
    currentPostIndex,
    sessionId,
    isFinished,
    showQuestion,
    syncParticipantLocation,
  ]);

  useEffect(() => {
    if (!sessionId) return;

    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const messageChannel = supabase
      .channel(`student-messages-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const messageRow = payload.new as { is_teacher?: boolean; message?: string | null };
          if (messageRow.is_teacher && messageRow.message) {
            setLatestMessage(messageRow.message);
            if (hideTimer) clearTimeout(hideTimer);
            hideTimer = setTimeout(() => setLatestMessage(null), 8000);
          }
        }
      )
      .subscribe();

    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      void supabase.removeChannel(messageChannel);
    };
  }, [sessionId, supabase]);

  const handleAnswer = async (selectedIndex: number) => {
    const current = questions[currentPostIndex];
    if (!current) return;

    const isCorrect = selectedIndex === current.correctIndex;
    const postNumber = currentPostIndex + 1;
    await insertAnswerRecord(
      selectedIndex,
      isCorrect,
      postNumber,
      current.text,
      myLoc?.lat ?? null,
      myLoc?.lng ?? null
    );

    if (isCorrect) {
      alert("KORREKT! 🎉 Find næste post!");
      setShowQuestion(false);
      setDistance(null);
      setCorrectAnswersCount((prev) => prev + 1);
      if (currentPostIndex + 1 < questions.length) {
        setCurrentPostIndex((prev) => prev + 1);
      } else {
        await markParticipantFinished();
        setIsFinished(true);
      }
    } else {
      alert("Forkert! Prøv igen ❌");
    }
  };

  const activeQuestion = questions[currentPostIndex];
  const mapCenter: [number, number] = myLoc
    ? [myLoc.lat, myLoc.lng]
    : activeQuestion
      ? [activeQuestion.lat, activeQuestion.lng]
      : [55.6761, 12.5683];

  const mapKey = `${mapCenter[0].toFixed(4)}-${mapCenter[1].toFixed(4)}-${currentPostIndex}`;

  const playerIcon = useMemo(
    () =>
      L.divIcon({
        className: "bg-transparent border-none",
        html: '<div class="w-5 h-5 rounded-full bg-purple-400 border-2 border-purple-100 shadow-[0_0_18px_rgba(168,85,247,0.9)]"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
    []
  );

  const targetIcon = useMemo(
    () =>
      L.divIcon({
        className: "bg-transparent border-none",
        html: '<div class="relative w-8 h-8"><div class="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping"></div><div class="relative w-8 h-8 rounded-full bg-cyan-900 border-2 border-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.8)] flex items-center justify-center text-cyan-200 font-black">◎</div></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    []
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050816] text-cyan-300">
        <div className="text-center">
          <Crosshair className="mx-auto mb-3 h-8 w-8 animate-pulse" />
          <p className="text-sm uppercase tracking-widest">Indlæser mission...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050816] px-6 text-center text-white">
        <div className="max-w-md rounded-2xl border border-red-400/30 bg-red-500/10 p-6">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-300" />
          <p className="font-semibold">{loadError}</p>
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-amber-100 via-yellow-300 to-orange-400 px-6 text-slate-900">
        <div className="z-10 mb-8 h-64 w-64 drop-shadow-2xl md:h-80 md:w-80">
          <Lottie animationData={trophyAnimation} loop={true} />
        </div>

        <div className="z-10 w-full max-w-md rounded-3xl border border-white/60 bg-white/40 p-8 text-center shadow-[0_0_40px_rgba(255,255,255,0.5)] backdrop-blur-xl">
          <h1 className="mb-2 bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-4xl font-black tracking-widest text-transparent uppercase">
            Mission
            <br />
            Fuldført!
          </h1>
          <p className="mb-6 text-lg font-bold text-slate-700">
            Fantastisk gået, {playerName || "mester"}!
          </p>
          <div className="rounded-xl bg-white/50 px-4 py-3 text-sm font-medium text-slate-600">
            Løbet er slut. Gå tilbage til læreren for at se resultatet på
            storskærmen!
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-full flex-col bg-[#050816] text-white">
      <div className="absolute top-4 right-4 left-4 z-[1000] flex items-center justify-between rounded-2xl border border-white/10 bg-black/60 p-4 shadow-[0_0_20px_rgba(168,85,247,0.3)] backdrop-blur-md">
        <div>
          <div className="text-xs font-bold tracking-wider text-white/50 uppercase">Mission</div>
          <div className="bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-xl font-black text-transparent">
            Find Post {currentPostIndex + 1} / {questions.length}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold tracking-wider text-white/50 uppercase">Afstand</div>
          <div
            className={`text-2xl font-black ${
              distance !== null && distance < 20 ? "text-green-400 animate-pulse" : "text-white"
            }`}
          >
            {distance !== null ? `${distance}m` : "Søger GPS..."}
          </div>
          <div className="mt-1 text-[11px] font-semibold tracking-wider text-emerald-200 uppercase">
            Score: {correctAnswersCount}
          </div>
        </div>
      </div>

      {latestMessage ? (
        <div className="animate-in slide-in-from-top fade-in absolute top-24 right-4 left-4 z-[1000] duration-500">
          <div className="flex items-start gap-3 rounded-r-xl border-l-4 border-cyan-400 bg-cyan-900/90 p-4 shadow-[0_0_20px_rgba(34,211,238,0.4)] backdrop-blur-md">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
            <div>
              <div className="mb-1 text-xs font-bold tracking-wider text-cyan-400 uppercase">
                Besked fra Læreren
              </div>
              <div className="text-sm font-medium text-white">{latestMessage}</div>
            </div>
          </div>
        </div>
      ) : null}

      {resumeMessage ? (
        <div className="animate-in slide-in-from-top fade-in absolute top-40 right-4 left-4 z-[1000] duration-500">
          <div className="flex items-start gap-3 rounded-r-xl border-l-4 border-emerald-400 bg-emerald-900/90 p-4 shadow-[0_0_20px_rgba(16,185,129,0.35)] backdrop-blur-md">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div className="text-sm font-medium text-white">{resumeMessage}</div>
          </div>
        </div>
      ) : null}

      {gpsError ? (
        <div className="absolute top-28 right-4 left-4 z-[1000] rounded-xl border border-amber-400/30 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {gpsError}
          </div>
        </div>
      ) : null}

      <div className="relative z-0 flex-1">
        {typeof window !== "undefined" ? (
          <MapContainer
            key={mapKey}
            center={mapCenter}
            zoom={17}
            className="h-full w-full"
            zoomControl={false}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

            {activeQuestion ? (
              <Marker position={[activeQuestion.lat, activeQuestion.lng]} icon={targetIcon}>
                <Popup>
                  <div className="text-sm">
                    <div className="mb-1 flex items-center gap-2 font-semibold text-cyan-500">
                      <MapPin className="h-4 w-4" />
                      Næste post
                    </div>
                    {activeQuestion.text}
                  </div>
                </Popup>
              </Marker>
            ) : null}

            {myLoc ? (
              <Marker position={[myLoc.lat, myLoc.lng]} icon={playerIcon}>
                <Popup>Du er her{playerName ? `, ${playerName}` : ""}</Popup>
              </Marker>
            ) : null}
          </MapContainer>
        ) : null}

        <div className="pointer-events-none absolute right-4 bottom-6 left-4 z-[900] flex justify-center">
          <div className="rounded-full border border-cyan-400/30 bg-black/55 px-3 py-2 text-xs text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.25)] backdrop-blur-sm">
            Hold kursen mod den cyan markør
          </div>
        </div>
      </div>

      {showQuestion && activeQuestion ? (
        <div className="animate-in fade-in zoom-in absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-[#050816]/90 p-6 backdrop-blur-xl duration-300">
          <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl">
            <div className="mb-6 flex items-center gap-3 text-cyan-400">
              <CheckCircle2 size={32} />
              <h2 className="text-2xl font-black uppercase">Post Fundet!</h2>
            </div>

            {activeQuestion.mediaUrl ? (
              <div className="mb-5 overflow-hidden rounded-xl border border-white/15">
                <img
                  src={activeQuestion.mediaUrl}
                  alt="Spørgsmålsmedie"
                  className="h-auto w-full object-cover"
                />
              </div>
            ) : null}

            <p className="mb-8 text-xl font-bold">{activeQuestion.text}</p>

            <div className="space-y-3">
              {activeQuestion.answers.map((answer: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left font-medium transition-all hover:border-purple-500/50 hover:bg-purple-500/20"
                >
                  {answer}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#050816] text-cyan-300">
          <Crosshair className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <PlayScreen />
    </Suspense>
  );
}

