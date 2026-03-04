"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Award, Medal, Trophy, UserCircle } from "lucide-react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { useParams } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useState, type FormEvent } from "react";
import { QRCode } from "react-qrcode-logo";

import phoneAnimation from "@/public/phone.json";
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

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

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

type SessionStudentRow = {
  id: string | number;
  student_name: string | null;
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
  lat?: number | string | null;
  lng?: number | string | null;
  text?: string | null;
};

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

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const supabase = createClient();
    let isActive = true;

    const toNumber = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    const toLocation = (row: SessionStudentRow): LiveStudentLocation | null => {
      const lat = toNumber(row.lat ?? row.latitude);
      const lng = toNumber(row.lng ?? row.longitude);
      const name = row.student_name?.trim() ?? "";
      if (!name) return null;
      return {
        id: String(row.id),
        name,
        student_name: name,
        lat,
        lng,
        finished_at: row.finished_at ?? null,
      };
    };

    const upsertLocation = (location: LiveStudentLocation) => {
      setStudentLocations((prev) => {
        const idx = prev.findIndex((item) => item.id === location.id);
        if (idx === -1) return [...prev, location];
        const next = [...prev];
        next[idx] = location;
        return next;
      });
    };

    const fetchLobbyData = async () => {
      setIsLoading(true);

      const { data: sessionData, error: sessionError } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("id", sessionId)
        .single<SessionRow>();

      if (!isActive) return;

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

          if (runData && runData.questions) {
            setRunQuestions(runData.questions as RunQuestion[]);
          }
        }
      }

      const { data: studentsData, error: studentsError } = await supabase
        .from("session_students")
        .select("*")
        .eq("session_id", sessionId);

      if (!isActive) return;

      if (studentsError) {
        console.error("Fejl ved hentning af elever:", studentsError);
      } else if (studentsData) {
        const rows = studentsData as SessionStudentRow[];
        setStudents(
          rows
            .map((s) => s.student_name?.trim())
            .filter((name): name is string => Boolean(name))
        );
        setStudentLocations(
          rows
            .map((s) => toLocation(s))
            .filter((loc): loc is LiveStudentLocation => loc !== null)
        );
      }

      const { data: messagesData, error: messagesError } = await supabase
        .from("session_messages")
        .select("sender_name,is_teacher,message,created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (!isActive) return;

      if (messagesError) {
        console.error("Fejl ved hentning af beskeder:", messagesError);
      } else if (messagesData) {
        setMessages(messagesData as SessionMessage[]);
      }

      setIsLoading(false);
    };

    void fetchLobbyData();

    const channel = supabase
      .channel(`session-students-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "session_students",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as SessionStudentRow;
          const newName = row.student_name?.trim();
          if (newName) {
            setStudents((prev) => (prev.includes(newName) ? prev : [...prev, newName]));
          }
          const location = toLocation(row);
          if (location) {
            upsertLocation(location);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "session_students",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as SessionStudentRow;
          const location = toLocation(row);
          if (location) {
            upsertLocation(location);
          }
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
          if (nextStatus) {
            setStatus(nextStatus);
          }
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!sessionId || !newMessage.trim()) return;

    const supabase = createClient();
    const { error } = await supabase.from("session_messages").insert({
      session_id: sessionId,
      sender_name: "LÃ¦rer",
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
      alert("Kunne ikke starte lÃ¸bet.");
      return;
    }

    setStatus("running");
  };

  const handleEndRun = async () => {
    if (!sessionId) return;
    if (!confirm("Er du sikker pÃ¥, at du vil afslutte lÃ¸bet for alle?")) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("live_sessions")
      .update({ status: "finished" })
      .eq("id", sessionId);

    if (error) {
      console.error("Kunne ikke afslutte lÃ¸bet:", error);
      alert("Kunne ikke afslutte lÃ¸bet.");
      return;
    }

    setStatus("finished");
  };

  const joinPin = isLoading ? "----" : pin || "----";
  const firstRunQuestionWithCoords = runQuestions.find(
    (q: RunQuestion) =>
      q?.lat !== null && q?.lat !== undefined && q?.lng !== null && q?.lng !== undefined
  );
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
          className={`relative flex min-h-screen flex-col overflow-hidden bg-[#050816] p-6 text-white md:p-12 ${poppins.className}`}
        >
          <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 top-20 h-72 w-72 rounded-full bg-purple-600/25 blur-3xl" />
          <div className="pointer-events-none absolute right-1/4 -bottom-24 h-80 w-80 rounded-full bg-pink-500/20 blur-3xl" />

          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col">
            <section className="mx-auto w-full max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md md:p-8">
              <h1 className={`text-sm font-bold tracking-[0.2em] text-white/80 uppercase md:text-base ${rubik.className}`}>
                LOG IND I LOBBYEN PÃ… GPSLOB.DK/JOIN
              </h1>
              <p className={`mt-4 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-7xl font-black text-transparent md:text-9xl ${rubik.className} animate-pulse`}>
                {joinPin}
              </p>
            </section>

            <section className="mx-auto mt-12 flex w-full max-w-4xl flex-col items-center justify-center gap-12 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_0_30px_rgba(34,211,238,0.1)] backdrop-blur-md md:flex-row">
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
              <h2 className={`text-2xl font-black tracking-wide text-cyan-100 uppercase ${rubik.className}`}>
                ELEVER KLAR: {students.length}
              </h2>

              <div className="mt-4 flex flex-wrap gap-3">
                <AnimatePresence>
                  {students.map((name, index) => (
                    <motion.div
                      key={`${name}-${index}`}
                      initial={{ opacity: 0, scale: 0.9, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -8 }}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-[#0d1533] px-4 py-2 text-sm font-semibold text-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.2)]"
                    >
                      <UserCircle className="h-4 w-4 text-cyan-300" />
                      {name}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {!isLoading && students.length === 0 ? (
                  <p className="text-sm text-white/60">Ingen elever har joinet endnu.</p>
                ) : null}
              </div>
            </section>

            <button
              type="button"
              onClick={() => void startSession()}
              className={`mt-12 w-full rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 py-6 text-3xl font-black text-white uppercase shadow-[0_0_35px_rgba(217,70,239,0.55)] transition-transform hover:scale-[1.02] ${rubik.className}`}
            >
              START LÃ˜BET! ðŸ
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
          className={`relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-slate-100 to-slate-300 p-8 ${poppins.className}`}
        >
          <div className="pointer-events-none absolute top-10 h-64 w-64 opacity-20">
            <Lottie animationData={trophyAnimation} loop={true} />
          </div>

          <h1 className={`z-10 mb-16 text-center text-5xl font-black tracking-widest text-slate-800 uppercase drop-shadow-sm md:text-7xl ${rubik.className}`}>
            Resultater
          </h1>

          {finishers.length === 0 ? (
            <div className="z-10 rounded-3xl bg-white/50 p-8 text-2xl font-bold text-slate-500 backdrop-blur-md">
              Ingen nåede i mål...
            </div>
          ) : (
            <div className="z-10 flex h-96 flex-col items-end justify-center gap-4 md:flex-row md:gap-8">
              {finishers[1] ? (
                <div className="animate-in slide-in-from-bottom flex h-3/4 flex-col items-center duration-700 delay-300">
                  <div className="rounded-t-2xl border-b-4 border-slate-300 bg-white px-6 py-3 text-lg font-bold text-slate-700 shadow-xl">
                    {finishers[1].name || finishers[1].student_name}
                  </div>
                  <div className="flex w-32 flex-1 flex-col items-center rounded-t-lg border-x border-t border-slate-300/50 bg-gradient-to-t from-slate-400 to-slate-200 pt-6 shadow-2xl">
                    <Medal size={48} className="text-slate-500 drop-shadow-md" />
                    <span className="mt-2 text-4xl font-black text-slate-500 opacity-50">2</span>
                  </div>
                </div>
              ) : null}

              {finishers[0] ? (
                <div className="animate-in slide-in-from-bottom flex h-full flex-col items-center duration-1000 delay-500">
                  <div className="z-10 scale-110 rounded-t-3xl border-b-4 border-amber-200 bg-white px-8 py-4 text-2xl font-black text-amber-500 shadow-2xl">
                    {finishers[0].name || finishers[0].student_name}
                  </div>
                  <div className="flex w-40 flex-1 flex-col items-center rounded-t-xl border-x border-t border-yellow-200/50 bg-gradient-to-t from-amber-400 to-yellow-300 pt-8 shadow-[0_0_40px_rgba(251,191,36,0.5)]">
                    <Trophy size={64} className="text-amber-700 drop-shadow-lg" />
                    <span className="mt-2 text-6xl font-black text-amber-600 opacity-50">1</span>
                  </div>
                </div>
              ) : null}

              {finishers[2] ? (
                <div className="animate-in slide-in-from-bottom flex h-2/4 flex-col items-center duration-500 delay-100">
                  <div className="rounded-t-2xl border-b-4 border-amber-900/20 bg-white px-6 py-3 text-lg font-bold text-amber-800 shadow-xl">
                    {finishers[2].name || finishers[2].student_name}
                  </div>
                  <div className="flex w-32 flex-1 flex-col items-center rounded-t-lg border-x border-t border-orange-300/50 bg-gradient-to-t from-amber-700 to-orange-400 pt-6 shadow-2xl">
                    <Award size={48} className="text-amber-900 drop-shadow-md" />
                    <span className="mt-2 text-4xl font-black text-amber-900 opacity-50">3</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {finishers.length > 3 ? (
            <div className="z-10 mt-12 w-full max-w-2xl rounded-3xl bg-white/60 p-6 shadow-xl backdrop-blur-md">
              <h3 className={`mb-4 text-center text-xl font-bold tracking-widest text-slate-700 uppercase ${rubik.className}`}>
                Flot kæmpet!
              </h3>
              <div className="flex flex-wrap justify-center gap-3">
                {finishers.slice(3).map((f, i) => (
                  <div key={`${f.id}-${i}`} className="rounded-xl bg-white px-4 py-2 font-medium text-slate-600 shadow-sm">
                    {i + 4}. {f.name || f.student_name}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </motion.div>
      ) : (
        <motion.div
          key="running"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          className={`flex h-screen overflow-hidden bg-[#050816] text-white ${poppins.className}`}
        >
          <div className="relative z-0 h-full w-2/3 bg-[#050816]">
            <div className="absolute top-6 left-6 z-[1000] rounded-2xl border border-white/10 bg-black/80 p-4 shadow-[0_0_20px_rgba(34,211,238,0.2)] backdrop-blur-md">
              <h2 className={`text-xl font-black tracking-widest text-cyan-400 uppercase ${rubik.className}`}>
                Live OvervÃ¥gning
              </h2>
              <p className="text-sm text-white/50">{studentLocations.length} elever online</p>
              <button
                onClick={() => void handleEndRun()}
                className="mt-4 rounded-xl border border-red-500/50 bg-red-500/20 px-4 py-2 text-xs font-bold tracking-widest text-red-400 uppercase transition-all hover:bg-red-500/40"
              >
                Afslut LÃ¸b ðŸ›‘
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

                {runQuestions.map(
                  (q: RunQuestion, i: number) =>
                    q.lat &&
                    q.lng && (
                      <Marker
                        key={`post-${i}`}
                        position={[Number(q.lat), Number(q.lng)]}
                        icon={createPostIcon(i) ?? undefined}
                      >
                        <Popup>
                          <strong className="text-cyan-400">Post {i + 1}</strong>
                          <br />
                          {q.text}
                        </Popup>
                      </Marker>
                    )
                )}

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

          <div className="flex h-full w-1/3 flex-col border-l border-white/10 bg-white/5 backdrop-blur-xl">
            <div className="border-b border-white/10 p-6">
              <h3
                className={`bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-lg font-bold tracking-widest text-transparent uppercase ${rubik.className}`}
              >
                Klasse Chat
              </h3>
            </div>

            <div className="flex flex-1 flex-col space-y-4 overflow-y-auto p-6">
              {messages.map((msg, i) => (
                <div
                  key={`${msg.sender_name}-${msg.created_at ?? i}`}
                  className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                    msg.is_teacher
                      ? "self-end rounded-tr-none border border-purple-500/50 bg-purple-500/20 text-white"
                      : "self-start rounded-tl-none border border-white/10 bg-black/40 text-white/90"
                  }`}
                >
                  <div className="mb-1 text-xs font-bold text-white/50">{msg.sender_name}</div>
                  {msg.message}
                </div>
              ))}

              {messages.length === 0 ? (
                <p className="text-sm text-white/50">Ingen beskeder endnu.</p>
              ) : null}
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-white/10 bg-black/40 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Skriv besked til klassen..."
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition-colors focus:border-cyan-500/50 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 p-3 font-bold text-black transition-colors hover:bg-cyan-400"
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

