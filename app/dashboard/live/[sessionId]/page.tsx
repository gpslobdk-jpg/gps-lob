"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Player } from "@lottiefiles/react-lottie-player";
import { Award, Medal, Trophy, UserCircle } from "lucide-react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { useParams } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useState, type FormEvent } from "react";
import { QRCode } from "react-qrcode-logo";

import phoneAnimation from "@/public/phone.json";
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

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const FIREWORKS_LOTTIE_URL = "https://assets2.lottiefiles.com/packages/lf20_touohxv0.json";

type SessionRow = {
  pin: string | null;
  status: string | null;
  run_id: string | null;
};

type SessionMessage = {
  sender_name: string;
  is_teacher: boolean;
  message: string;
  created_at?: string | null;
};

type StudentRow = {
  id?: string | number | null;
  session_id?: string | null;
  student_name?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  finished_at?: string | null;
};

type LiveStudentLocation = {
  id: string;
  name: string;
  student_name: string;
  lat: number | null;
  lng: number | null;
  finished_at?: string | null;
};

type RunQuestion = {
  type?: "multiple_choice" | "ai_image";
  lat?: number | string | null;
  lng?: number | string | null;
  text?: string | null;
  aiPrompt?: string | null;
  ai_prompt?: string | null;
};

type AnswerRow = {
  id?: string | number | null;
  student_name?: string | null;
  post_index?: number | string | null;
  question_index?: number | string | null;
  is_correct?: boolean | null;
  created_at?: string | null;
  answered_at?: string | null;
};

type LiveAnswer = {
  id: string;
  studentName: string;
  postNumber: number | null;
  isCorrect: boolean | null;
  createdAt: string | null;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toLocation(row: StudentRow): LiveStudentLocation | null {
  const name = normalizeName(row.student_name);
  if (!name) return null;
  const lat = toFiniteNumber(row.lat ?? row.latitude);
  const lng = toFiniteNumber(row.lng ?? row.longitude);
  const baseId = row.id ?? `${row.session_id ?? "session"}-${name}`;

  return {
    id: String(baseId),
    name,
    student_name: name,
    lat,
    lng,
    finished_at: row.finished_at ?? null,
  };
}

function upsertLocation(
  previous: LiveStudentLocation[],
  nextLocation: LiveStudentLocation
): LiveStudentLocation[] {
  const index = previous.findIndex((item) => item.id === nextLocation.id);
  if (index === -1) return [...previous, nextLocation];
  const next = [...previous];
  next[index] = nextLocation;
  return next;
}

function toLiveAnswer(row: AnswerRow): LiveAnswer | null {
  const studentName = normalizeName(row.student_name);
  if (!studentName) return null;

  const rawIndex = toFiniteNumber(row.post_index ?? row.question_index);
  const postNumber = rawIndex === null ? null : rawIndex >= 1 ? rawIndex : rawIndex + 1;
  const createdAt = row.answered_at ?? row.created_at ?? null;
  const idSource = row.id ?? `${studentName}-${createdAt ?? Date.now()}-${postNumber ?? "?"}`;

  return {
    id: String(idSource),
    studentName,
    postNumber,
    isCorrect: typeof row.is_correct === "boolean" ? row.is_correct : null,
    createdAt,
  };
}

function prependAnswer(previous: LiveAnswer[], nextAnswer: LiveAnswer): LiveAnswer[] {
  const deduped = previous.filter((item) => item.id !== nextAnswer.id);
  return [nextAnswer, ...deduped].slice(0, 40);
}

export default function LiveLobbyPage() {
  const params = useParams<{ sessionId: string }>();
  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId;

  const [pin, setPin] = useState("");
  const [students, setStudents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState("waiting");
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [studentLocations, setStudentLocations] = useState<LiveStudentLocation[]>([]);
  const [runQuestions, setRunQuestions] = useState<RunQuestion[]>([]);
  const [liveAnswers, setLiveAnswers] = useState<LiveAnswer[]>([]);
  const [hasParticipantsTable, setHasParticipantsTable] = useState(true);
  const [hasAnswersTable, setHasAnswersTable] = useState(true);
  const [isEndingRun, setIsEndingRun] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const supabase = createClient();
    let isActive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const addStudentName = (rawName: unknown) => {
      const name = normalizeName(rawName);
      if (!name) return;
      setStudents((prev) => (prev.includes(name) ? prev : [...prev, name]));
    };

    const addStudentLocation = (row: StudentRow) => {
      const location = toLocation(row);
      if (!location) return;
      setStudentLocations((prev) => upsertLocation(prev, location));
      addStudentName(location.name);
    };

    const addLiveAnswer = (row: AnswerRow) => {
      const parsed = toLiveAnswer(row);
      if (!parsed || parsed.isCorrect !== true) return;
      setLiveAnswers((prev) => prependAnswer(prev, parsed));
    };

    const fetchLobbyData = async () => {
      setIsLoading(true);

      const studentNames = new Set<string>();
      let fallbackSessionStudents: StudentRow[] = [];

      const { data: sessionData, error: sessionError } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("id", sessionId)
        .single<SessionRow>();

      if (!isActive) return { supportsParticipants: false, supportsAnswers: false };

      if (sessionError) {
        console.error("Fejl ved hentning af session:", sessionError);
      } else if (sessionData) {
        setPin(String(sessionData.pin ?? ""));
        setStatus(sessionData.status ?? "waiting");

        if (sessionData.run_id) {
          const { data: runData } = await supabase
            .from("gps_runs")
            .select("questions")
            .eq("id", sessionData.run_id)
            .single();

          if (!isActive) return { supportsParticipants: false, supportsAnswers: false };
          if (runData?.questions) {
            setRunQuestions(runData.questions as RunQuestion[]);
          }
        }
      }

      const { data: sessionStudentsData, error: sessionStudentsError } = await supabase
        .from("session_students")
        .select("*")
        .eq("session_id", sessionId);

      if (!isActive) return { supportsParticipants: false, supportsAnswers: false };

      if (sessionStudentsError) {
        console.error("Fejl ved hentning af elever:", sessionStudentsError);
      } else if (sessionStudentsData) {
        fallbackSessionStudents = sessionStudentsData as StudentRow[];
        fallbackSessionStudents.forEach((row) => {
          const name = normalizeName(row.student_name);
          if (name) studentNames.add(name);
        });
      }

      let supportsParticipants = true;
      let locationRows: StudentRow[] = fallbackSessionStudents;

      const { data: participantsData, error: participantsError } = await supabase
        .from("participants")
        .select("*")
        .eq("session_id", sessionId);

      if (!isActive) return { supportsParticipants: false, supportsAnswers: false };

      if (participantsError) {
        supportsParticipants = false;
        if (participantsError.code === "PGRST205") {
          // Fallback til session_students hvis participants-tabellen ikke findes endnu.
        } else {
          console.error("Fejl ved hentning af participants:", participantsError);
        }
      } else if (participantsData) {
        locationRows = participantsData as StudentRow[];
        locationRows.forEach((row) => {
          const name = normalizeName(row.student_name);
          if (name) studentNames.add(name);
        });
      }

      setStudents(Array.from(studentNames));
      setStudentLocations(
        locationRows
          .map((row) => toLocation(row))
          .filter((row): row is LiveStudentLocation => row !== null)
      );
      setHasParticipantsTable(supportsParticipants);

      const { data: messagesData, error: messagesError } = await supabase
        .from("session_messages")
        .select("sender_name,is_teacher,message,created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (!isActive) return { supportsParticipants, supportsAnswers: false };

      if (messagesError) {
        console.error("Fejl ved hentning af beskeder:", messagesError);
      } else if (messagesData) {
        setMessages(messagesData as SessionMessage[]);
      }

      let supportsAnswers = true;
      const { data: answersData, error: answersError } = await supabase
        .from("answers")
        .select("*")
        .eq("session_id", sessionId)
        .limit(120);

      if (!isActive) return { supportsParticipants, supportsAnswers: false };

      if (answersError) {
        supportsAnswers = false;
        if (answersError.code === "PGRST205") {
          // answers-tabellen findes ikke endnu.
        } else {
          console.error("Fejl ved hentning af answers:", answersError);
        }
      } else if (answersData) {
        const parsed = (answersData as AnswerRow[])
          .map((row) => toLiveAnswer(row))
          .filter((row): row is LiveAnswer => row !== null && row.isCorrect === true)
          .sort((a, b) => {
            const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTs - aTs;
          })
          .slice(0, 40);

        setLiveAnswers(parsed);
      }

      setHasAnswersTable(supportsAnswers);
      setIsLoading(false);
      return { supportsParticipants, supportsAnswers };
    };

    const initRealtime = async () => {
      const { supportsParticipants, supportsAnswers } = await fetchLobbyData();
      if (!isActive) return;

      let nextChannel = supabase
        .channel(`teacher-live-${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "session_students",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const row = payload.new as StudentRow;
            addStudentName(row.student_name);
            if (!supportsParticipants) addStudentLocation(row);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "session_messages",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const row = payload.new as SessionMessage;
            setMessages((prev) => [...prev, row]);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "live_sessions",
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            const nextStatus = (payload.new as SessionRow).status;
            if (nextStatus) setStatus(nextStatus);
          }
        );

      if (supportsParticipants) {
        nextChannel = nextChannel
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "participants",
              filter: `session_id=eq.${sessionId}`,
            },
            (payload) => {
              const row = payload.new as StudentRow;
              addStudentLocation(row);
            }
          )
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "participants",
              filter: `session_id=eq.${sessionId}`,
            },
            (payload) => {
              const row = payload.new as StudentRow;
              addStudentLocation(row);
            }
          );
      } else {
        nextChannel = nextChannel.on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "session_students",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const row = payload.new as StudentRow;
            addStudentLocation(row);
          }
        );
      }

      if (supportsAnswers) {
        nextChannel = nextChannel.on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "answers",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const row = payload.new as AnswerRow;
            addLiveAnswer(row);
          }
        );
      }

      channel = nextChannel.subscribe();
    };

    void initRealtime();

    return () => {
      isActive = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [sessionId]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionId || !newMessage.trim()) return;

    const supabase = createClient();
    const { error } = await supabase.from("session_messages").insert({
      session_id: sessionId,
      sender_name: "Lærer",
      is_teacher: true,
      message: newMessage.trim(),
    });

    if (error) {
      console.error("Kunne ikke sende besked:", error);
      alert("Beskeden kunne ikke sendes.");
      return;
    }

    setNewMessage("");
  };

  const startSession = async () => {
    if (!sessionId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("live_sessions")
      .update({ status: "running" })
      .eq("id", sessionId);

    if (error) {
      console.error("Kunne ikke starte session:", error);
      alert("Kunne ikke starte løbet.");
      return;
    }

    setStatus("running");
  };

  const handleEndRun = async () => {
    if (!sessionId || isEndingRun) return;
    const confirmed = confirm(
      "Er du sikker på, at du vil afslutte løbet for alle deltagere? Dette kan ikke fortrydes."
    );
    if (!confirmed) return;

    setIsEndingRun(true);
    const supabase = createClient();
    const { error } = await supabase.from("live_sessions").update({ status: "finished" }).eq("id", sessionId);

    if (error) {
      console.error("Kunne ikke afslutte løbet:", error);
      alert("Kunne ikke afslutte løbet.");
      setIsEndingRun(false);
      return;
    }

    setStatus("finished");
    setIsEndingRun(false);
  };

  const handleKickParticipant = async (student: LiveStudentLocation) => {
    if (!sessionId || !hasParticipantsTable) return;

    const confirmed = confirm(
      `Er du sikker på, at du vil fjerne ${student.name} fra løbet?`
    );
    if (!confirmed) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("participants")
      .delete()
      .eq("id", student.id)
      .eq("session_id", sessionId);

    if (error) {
      console.error("Kunne ikke fjerne elev fra løbet:", error);
      alert("Kunne ikke fjerne deltageren fra løbet.");
      return;
    }

    setStudentLocations((prev) => prev.filter((item) => item.id !== student.id));
    setStudents((prev) => prev.filter((name) => name !== student.name));
  };

  const joinPin = isLoading ? "----" : pin || "----";
  const firstRunQuestionWithCoords = runQuestions.find((q: RunQuestion) => {
    const lat = toFiniteNumber(q.lat);
    const lng = toFiniteNumber(q.lng);
    return lat !== null && lng !== null;
  });
  const mapCenter: [number, number] = firstRunQuestionWithCoords
    ? [Number(firstRunQuestionWithCoords.lat), Number(firstRunQuestionWithCoords.lng)]
    : [55.3959, 10.3883];
  const mapKey = `${mapCenter[0]}-${mapCenter[1]}-${runQuestions.length}`;
  const finishers = [...studentLocations]
    .filter((s) => Boolean(s.finished_at))
    .sort((a, b) => {
      const aTime = new Date(a.finished_at ?? "").getTime();
      const bTime = new Date(b.finished_at ?? "").getTime();
      return aTime - bTime;
    });
  const winnerCelebrationName = finishers[0]?.name || finishers[0]?.student_name || "Holdet";
  const activeStudents = [...studentLocations]
    .filter((student) => !student.finished_at)
    .sort((a, b) => a.name.localeCompare(b.name, "da"));

  const createPostIcon = (index: number) => {
    if (typeof window === "undefined") return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet");

    return L.divIcon({
      className: "bg-transparent border-none",
      html: `<div class="w-8 h-8 rounded-full bg-cyan-950 border-2 border-cyan-400 flex items-center justify-center text-cyan-400 font-bold shadow-[0_0_15px_rgba(34,211,238,0.6)] backdrop-blur-md">${index + 1}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const createStudentIcon = (name: string) => {
    if (typeof window === "undefined") return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet");

    return L.divIcon({
      className: "bg-transparent border-none w-auto",
      html: `<div class="px-3 py-1.5 rounded-full bg-purple-600 border-2 border-purple-400 text-white text-xs font-bold shadow-[0_0_15px_rgba(168,85,247,0.8)] whitespace-nowrap drop-shadow-lg">${name}</div>`,
      iconSize: [0, 0],
      iconAnchor: [-10, 10],
    });
  };

  return (
    <AnimatePresence mode="wait">
      {status === "waiting" ? (
        <motion.main
          key="waiting"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          className={`relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-b from-indigo-950 via-blue-900 to-cyan-800 p-6 text-white md:p-12 ${poppins.className}`}
        >
          <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 top-20 h-72 w-72 rounded-full bg-purple-600/25 blur-3xl" />
          <div className="pointer-events-none absolute right-1/4 -bottom-24 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />

          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col">
            <section className="mx-auto w-full max-w-5xl rounded-3xl border border-white/20 bg-white/10 p-6 text-center shadow-2xl backdrop-blur-md md:p-8">
              <h1 className={`text-sm font-bold tracking-[0.2em] text-white drop-shadow-md uppercase md:text-base ${rubik.className}`}>
                LOG IND I LOBBYEN PÅ GPSLOB.DK/JOIN
              </h1>
              <p className={`mt-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-7xl font-black text-transparent md:text-9xl ${rubik.className} animate-pulse`}>
                {joinPin}
              </p>
            </section>

            <section className="mx-auto mt-12 flex w-full max-w-4xl flex-col items-center justify-center gap-12 rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-md md:flex-row">
              <div className="h-48 w-48 md:h-64 md:w-64">
                <Lottie animationData={phoneAnimation} loop={true} />
              </div>

              <div className="rounded-3xl bg-white p-4 shadow-[0_0_25px_rgba(255,255,255,0.25)]">
                <QRCode
                  value={`https://gpslob.dk/join?pin=${joinPin}`}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#050816"
                  qrStyle="dots"
                  eyeRadius={10}
                />
              </div>
            </section>

            <section className="mx-auto mt-10 w-full max-w-5xl">
              <h2 className={`text-2xl font-black tracking-wide text-white drop-shadow-md uppercase ${rubik.className}`}>
                DELTAGERE KLAR: {students.length}
              </h2>

              <div className="mt-4 flex flex-wrap gap-3">
                <AnimatePresence>
                  {students.map((name, index) => (
                    <motion.div
                      key={`${name}-${index}`}
                      initial={{ opacity: 0, scale: 0.9, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -8 }}
                      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-blue-100 shadow-lg backdrop-blur-md"
                    >
                      <UserCircle className="h-4 w-4 text-white" />
                      {name}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {!isLoading && students.length === 0 ? (
                  <p className="text-sm text-white/60">Ingen deltagere har joinet endnu.</p>
                ) : null}
              </div>
            </section>

            <button
              type="button"
              onClick={() => void startSession()}
              className={`mt-12 w-full rounded-xl border border-teal-400/50 bg-teal-600 py-6 text-3xl font-black text-white uppercase shadow-lg transition-colors hover:bg-teal-500 ${rubik.className}`}
            >
              START LØBET! 🏁
            </button>
          </div>
        </motion.main>
      ) : status === "finished" ? (
        <motion.div
          key="finished"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          className={`relative min-h-screen overflow-hidden bg-gradient-to-b from-indigo-950 via-blue-900 to-cyan-800 px-6 py-10 text-white md:px-10 ${poppins.className}`}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.25),transparent_40%),radial-gradient(circle_at_80%_10%,rgba(251,191,36,0.22),transparent_42%),radial-gradient(circle_at_50%_90%,rgba(244,114,182,0.2),transparent_40%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-75">
            <Player
              autoplay
              loop
              src={FIREWORKS_LOTTIE_URL}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 28 }).map((_, index) => (
              <motion.span
                key={`confetti-${index}`}
                className="absolute h-2.5 w-2.5 rounded-full bg-gradient-to-br from-yellow-300 via-pink-300 to-cyan-300 shadow-[0_0_10px_rgba(255,255,255,0.4)]"
                style={{ left: `${(index * 17) % 100}%` }}
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: ["0vh", "105vh"], opacity: [0, 1, 0.2] }}
                transition={{
                  duration: 4.5 + (index % 6) * 0.6,
                  repeat: Infinity,
                  ease: "linear",
                  delay: (index % 10) * 0.18,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center">
            <div className="text-center">
              <h1
                className={`bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-100 bg-clip-text text-5xl font-black tracking-[0.16em] text-transparent uppercase drop-shadow-[0_0_30px_rgba(251,191,36,0.5)] md:text-7xl ${rubik.className}`}
              >
                Resultater
              </h1>
              <p className="mt-4 text-lg font-semibold text-emerald-100 md:text-2xl">
                KÆMPE TILLYKKE, {winnerCelebrationName}! I er GPS MESTRE!
              </p>
            </div>

            {finishers.length === 0 ? (
              <div className="mt-24 w-full max-w-2xl rounded-3xl border border-white/20 bg-white/10 p-8 text-center text-2xl font-bold text-slate-100 backdrop-blur-md">
                Ingen nåede i mål...
              </div>
            ) : (
              <div className="mt-28 flex h-[30rem] w-full flex-col items-end justify-end gap-4 md:flex-row md:gap-8">
                {finishers[1] ? (
                  <div className="animate-in slide-in-from-bottom flex h-3/4 flex-col items-center duration-700 delay-300">
                    <div className="rounded-t-2xl border-b-4 border-slate-200 bg-white/95 px-6 py-3 text-lg font-bold text-slate-700 shadow-xl">
                      {finishers[1].name || finishers[1].student_name}
                    </div>
                    <div className="flex w-32 flex-1 flex-col items-center rounded-t-lg border-x border-t border-slate-200/70 bg-gradient-to-t from-slate-500 to-slate-300 pt-6 shadow-2xl">
                      <Medal size={48} className="text-slate-100 drop-shadow-md" />
                      <span className="mt-2 text-4xl font-black text-slate-100/70">2</span>
                    </div>
                  </div>
                ) : null}

                {finishers[0] ? (
                  <div className="animate-in slide-in-from-bottom flex h-full flex-col items-center duration-1000 delay-500">
                    <div className="z-10 scale-110 rounded-t-3xl border-b-4 border-amber-200 bg-white px-8 py-4 text-2xl font-black text-amber-600 shadow-2xl">
                      {finishers[0].name || finishers[0].student_name}
                    </div>
                    <div className="flex w-40 flex-1 flex-col items-center rounded-t-xl border-x border-t border-yellow-200/50 bg-gradient-to-t from-amber-500 to-yellow-300 pt-8 shadow-[0_0_50px_rgba(251,191,36,0.55)]">
                      <Trophy size={64} className="text-amber-800 drop-shadow-lg" />
                      <span className="mt-2 text-6xl font-black text-amber-700/70">1</span>
                    </div>
                  </div>
                ) : null}

                {finishers[2] ? (
                  <div className="animate-in slide-in-from-bottom flex h-2/4 flex-col items-center duration-500 delay-100">
                    <div className="rounded-t-2xl border-b-4 border-amber-900/20 bg-white/95 px-6 py-3 text-lg font-bold text-amber-800 shadow-xl">
                      {finishers[2].name || finishers[2].student_name}
                    </div>
                    <div className="flex w-32 flex-1 flex-col items-center rounded-t-lg border-x border-t border-orange-300/50 bg-gradient-to-t from-amber-800 to-orange-500 pt-6 shadow-2xl">
                      <Award size={48} className="text-amber-100 drop-shadow-md" />
                      <span className="mt-2 text-4xl font-black text-amber-100/70">3</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {finishers.length > 3 ? (
              <div className="mt-10 w-full max-w-3xl rounded-3xl border border-white/20 bg-white/10 p-6 shadow-xl backdrop-blur-md">
                <h3
                  className={`mb-4 text-center text-xl font-bold tracking-widest text-amber-100 uppercase ${rubik.className}`}
                >
                  Flot kæmpet!
                </h3>
                <div className="flex flex-wrap justify-center gap-3">
                  {finishers.slice(3).map((f, i) => (
                    <div
                      key={`${f.id}-${i}`}
                    className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 font-medium text-blue-100 backdrop-blur-md"
                    >
                      {i + 4}. {f.name || f.student_name}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="running"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          className={`flex h-screen overflow-hidden bg-gradient-to-b from-indigo-950 via-blue-900 to-cyan-800 p-4 text-white ${poppins.className}`}
        >
          <div className="relative z-0 h-full w-2/3 overflow-hidden rounded-[2rem] border-4 border-white/20 shadow-2xl">
            <div className="absolute top-6 left-6 z-[1000] rounded-3xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
              <h2 className={`text-xl font-black tracking-widest text-white drop-shadow-md uppercase ${rubik.className}`}>
                Live Overvågning
              </h2>
              <p className="text-sm text-blue-100">{studentLocations.length} deltagere online</p>
              {!hasParticipantsTable ? (
                <p className="mt-1 text-xs text-blue-100">`participants` mangler - bruger fallback.</p>
              ) : null}
              <button
                onClick={() => void handleEndRun()}
                disabled={isEndingRun}
                className="mt-4 rounded-xl border border-teal-400/50 bg-teal-600 px-4 py-2 text-xs font-bold tracking-widest text-white uppercase shadow-lg transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isEndingRun ? "Afslutter løb..." : "Afslut Løb 🛑"}
              </button>
            </div>

            {typeof window !== "undefined" && (
              <MapContainer
                key={mapKey}
                center={mapCenter}
                zoom={16}
                className="z-0 h-full w-full"
                zoomControl={false}
              >
                <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

                {runQuestions.map((q: RunQuestion, i: number) => {
                  const lat = toFiniteNumber(q.lat);
                  const lng = toFiniteNumber(q.lng);
                  if (lat === null || lng === null) return null;

                  return (
                    <Marker
                      key={`post-${i}`}
                      position={[lat, lng]}
                      icon={createPostIcon(i) ?? undefined}
                    >
                      <Popup>
                        <strong className="text-cyan-400">Post {i + 1}</strong>
                        <br />
                        {q.text}
                      </Popup>
                    </Marker>
                  );
                })}

                {studentLocations.map(
                  (student, i) =>
                    student.lat !== null &&
                    student.lng !== null && (
                      <Marker
                        key={`student-${i}`}
                        position={[student.lat, student.lng]}
                        icon={createStudentIcon(student.name) ?? undefined}
                      />
                    )
                )}
              </MapContainer>
            )}
          </div>

          <div className="ml-4 flex h-full w-1/3 flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md">
            <div className="border-b border-white/20 p-6">
              <h3
                className={`text-lg font-bold tracking-widest text-white drop-shadow-md uppercase ${rubik.className}`}
              >
                Aktive Deltagere
              </h3>
              {!hasParticipantsTable ? (
                <p className="mt-2 text-xs text-blue-100">
                  Rødt kort kræver `participants`-tabellen.
                </p>
              ) : null}
            </div>

            <div className="max-h-52 space-y-2 overflow-y-auto border-b border-white/20 p-4">
              {activeStudents.length === 0 ? (
                <p className="text-sm text-blue-100">Ingen aktive deltagere lige nu.</p>
              ) : (
                activeStudents.map((student) => (
                  <div
                    key={`active-${student.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2"
                  >
                    <span className="truncate text-sm font-semibold text-white drop-shadow-md">{student.name}</span>
                    <button
                      type="button"
                      onClick={() => void handleKickParticipant(student)}
                      disabled={!hasParticipantsTable}
                      className="rounded-xl border border-teal-400/50 bg-teal-600 px-2 py-1 text-[11px] font-bold tracking-wide text-white shadow-lg transition-colors hover:bg-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      🚫 Smid ud
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="border-b border-white/20 p-6">
              <h3
                className={`text-lg font-bold tracking-widest text-white drop-shadow-md uppercase ${rubik.className}`}
              >
                Live Svar
              </h3>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto border-b border-white/20 p-4">
              {!hasAnswersTable ? (
                <p className="text-sm text-blue-100">`answers` mangler - ingen live svar endnu.</p>
              ) : liveAnswers.length === 0 ? (
                <p className="text-sm text-blue-100">Ingen svar endnu.</p>
              ) : (
                liveAnswers.map((answer) => (
                  <div
                    key={answer.id}
                    className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-white">{answer.studentName}</span>
                      <span className="text-blue-100">
                        {answer.createdAt
                          ? new Date(answer.createdAt).toLocaleTimeString("da-DK", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className="text-blue-100">
                        {answer.postNumber !== null ? `Post ${answer.postNumber}` : "Ukendt post"}
                      </span>
                      <span
                        className={
                          answer.isCorrect === null
                            ? "text-white/50"
                            : answer.isCorrect
                              ? "text-emerald-300"
                              : "text-rose-300"
                        }
                      >
                        {answer.isCorrect === null
                          ? "Uden facit"
                          : answer.isCorrect
                            ? "Korrekt"
                            : "Forkert"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-b border-white/20 p-6">
              <h3
                className={`text-lg font-bold tracking-widest text-white drop-shadow-md uppercase ${rubik.className}`}
              >
                Holdchat
              </h3>
            </div>

            <div className="flex flex-1 flex-col space-y-4 overflow-y-auto p-6">
              {messages.map((msg, i) => (
                <div
                  key={`${msg.sender_name}-${msg.created_at ?? i}`}
                  className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                    msg.is_teacher
                      ? "self-end rounded-tr-none border border-white/20 bg-white/15 text-white"
                      : "self-start rounded-tl-none border border-white/20 bg-white/10 text-blue-100"
                  }`}
                >
                  <div className="mb-1 text-xs font-bold text-blue-100">{msg.sender_name}</div>
                  {msg.message}
                </div>
              ))}

              {messages.length === 0 ? (
                <p className="text-sm text-blue-100">Ingen beskeder endnu.</p>
              ) : null}
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-white/20 bg-white/10 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Skriv besked til holdet..."
                  className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-blue-100 focus:outline-none focus:ring-2 focus:ring-teal-400/50"
                />
                <button
                  type="submit"
                  className="rounded-xl border border-teal-400/50 bg-teal-600 p-3 font-bold text-white shadow-lg transition-colors hover:bg-teal-500"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

