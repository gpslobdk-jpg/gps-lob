"use client";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { AlertCircle, CheckCircle2, Crosshair, MapPin } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
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
  const studentName = searchParams.get("name")?.trim() || "";

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
        setLoadError("Kunne ikke hente lÃ¸bet.");
        setIsLoading(false);
        return;
      }

      const parsedQuestions = Array.isArray(runData?.questions)
        ? runData.questions.map(parseQuestion).filter((q): q is Question => q !== null)
        : [];

      if (parsedQuestions.length === 0) {
        setLoadError("Dette lÃ¸b har ingen gyldige GPS-poster endnu.");
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
    if (!navigator.geolocation || questions.length === 0 || isFinished || !sessionId) return;

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

        if (studentName) {
          const { error } = await supabase
            .from("session_students")
            .update({ lat, lng, last_updated: new Date().toISOString() })
            .eq("session_id", sessionId)
            .eq("student_name", studentName);

          if (error) {
            console.error("Kunne ikke opdatere elevposition:", error);
          }
        }
      },
      (err) => {
        console.error("GPS Error:", err);
        setGpsError("GPS ikke tilgÃ¦ngelig. Tjek lokationstilladelser.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [
    questions,
    currentPostIndex,
    sessionId,
    studentName,
    isFinished,
    showQuestion,
    supabase,
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

    if (isCorrect) {
      alert("KORREKT! ðŸŽ‰ Find nÃ¦ste post!");
      setShowQuestion(false);
      setDistance(null);
      if (currentPostIndex + 1 < questions.length) {
        setCurrentPostIndex((prev) => prev + 1);
      } else {
        if (studentName && sessionId) {
          const { error } = await supabase
            .from("session_students")
            .update({ finished_at: new Date() })
            .eq("session_id", sessionId)
            .eq("student_name", studentName);

          if (error) {
            console.error("Kunne ikke gemme mÃ¥lgangstid:", error);
          }
        }
        setIsFinished(true);
      }
    } else {
      alert("Forkert! PrÃ¸v igen âŒ");
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
        html: '<div class="relative w-8 h-8"><div class="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping"></div><div class="relative w-8 h-8 rounded-full bg-cyan-900 border-2 border-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.8)] flex items-center justify-center text-cyan-200 font-black">â—Ž</div></div>',
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
          <p className="text-sm uppercase tracking-widest">IndlÃ¦ser mission...</p>
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
            Fantastisk gået, {studentName || "mester"}!
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
            {distance !== null ? `${distance}m` : "SÃ¸ger GPS..."}
          </div>
        </div>
      </div>

      {latestMessage ? (
        <div className="animate-in slide-in-from-top fade-in absolute top-24 right-4 left-4 z-[1000] duration-500">
          <div className="flex items-start gap-3 rounded-r-xl border-l-4 border-cyan-400 bg-cyan-900/90 p-4 shadow-[0_0_20px_rgba(34,211,238,0.4)] backdrop-blur-md">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />
            <div>
              <div className="mb-1 text-xs font-bold tracking-wider text-cyan-400 uppercase">
                Besked fra LÃ¦reren
              </div>
              <div className="text-sm font-medium text-white">{latestMessage}</div>
            </div>
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
                      NÃ¦ste post
                    </div>
                    {activeQuestion.text}
                  </div>
                </Popup>
              </Marker>
            ) : null}

            {myLoc ? (
              <Marker position={[myLoc.lat, myLoc.lng]} icon={playerIcon}>
                <Popup>Du er her{studentName ? `, ${studentName}` : ""}</Popup>
              </Marker>
            ) : null}
          </MapContainer>
        ) : null}

        <div className="pointer-events-none absolute right-4 bottom-6 left-4 z-[900] flex justify-center">
          <div className="rounded-full border border-cyan-400/30 bg-black/55 px-3 py-2 text-xs text-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.25)] backdrop-blur-sm">
            Hold kursen mod den cyan markÃ¸r
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
                  alt="SpÃ¸rgsmÃ¥lsmedie"
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

