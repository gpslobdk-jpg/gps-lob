"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Edit2, MapPin, Play, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Poppins, Rubik } from "next/font/google";
import { useEffect, useState } from "react";

import { createClient } from "@/utils/supabase/client";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type RunQuestion = {
  id?: number;
  text?: string;
  answers?: string[];
  correctIndex?: number;
  lat?: number | null;
  lng?: number | null;
  mediaUrl?: string;
};

type Run = {
  id: string;
  title: string;
  subject: string;
  topic: string | null;
  questions: RunQuestion[] | null;
  created_at: string;
};

const ALL_SUBJECTS = [
  "Alle",
  "Dansk",
  "Matematik",
  "Engelsk",
  "Natur/Teknologi",
  "Historie",
  "Idræt",
  "Kristendomskundskab",
  "Tysk",
  "Fransk",
  "Geografi",
  "Biologi",
  "Fysik/Kemi",
  "Samfundsfag",
  "Håndværk/Design",
  "Billedkunst",
  "Madkundskab",
  "Musik",
];

const formatDanishDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Ukendt dato";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const getQuestionCount = (questions: Run["questions"]) => {
  return Array.isArray(questions) ? questions.length : 0;
};

export default function ArkivPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("Alle");
  const [runs, setRuns] = useState<Run[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingRunId, setStartingRunId] = useState<string | null>(null);

  useEffect(() => {
    const fetchRuns = async () => {
      setIsLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from("gps_runs")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Fejl ved hentning af løb:", error);
        alert("Kunne ikke hente løbsarkivet.");
      } else {
        setRuns((data ?? []) as Run[]);
      }
      setIsLoading(false);
    };

    void fetchRuns();
  }, []);

  const handleDeleteRun = async (runId: string) => {
    const shouldDelete = window.confirm("Vil du slette dette løb fra arkivet?");
    if (!shouldDelete) return;

    const supabase = createClient();
    const { error } = await supabase.from("gps_runs").delete().eq("id", runId);

    if (error) {
      console.error("Fejl ved sletning af løb:", error);
      alert("Kunne ikke slette løbet.");
      return;
    }

    setRuns((prev) => prev.filter((run) => run.id !== runId));
  };

  const handleStartRun = async (runId: string) => {
    setStartingRunId(runId);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Du skal være logget ind!");
        return;
      }

      const generatedPin = Math.floor(1000 + Math.random() * 9000).toString();

      const { data, error } = await supabase
        .from("live_sessions")
        .insert({
          run_id: runId,
          teacher_id: user.id,
          pin: generatedPin,
          status: "waiting",
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        router.push(`/dashboard/live/${data.id}`);
      }
    } catch (err) {
      console.error("Kunne ikke oprette live session:", err);
      alert("Der skete en fejl. Prøv igen.");
    } finally {
      setStartingRunId(null);
    }
  };

  const filteredRuns = runs.filter((run) => {
    const matchesSearch = run.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = selectedSubject === "Alle" || run.subject === selectedSubject;
    return matchesSearch && matchesSubject;
  });

  return (
    <main className={`min-h-screen bg-[#0a1128] p-6 text-white lg:p-12 ${poppins.className}`}>
      <div className="mx-auto max-w-7xl">
        <h1
          className={`bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-4xl font-black text-transparent sm:text-5xl ${rubik.className}`}
        >
          MIT LØBSARKIV
        </h1>

        {/* TOP PANEL: SØGNING OG FILTER */}
        <div className="mt-8 mb-10 flex max-w-5xl flex-col gap-4 md:flex-row">
          {/* SØGEFELT */}
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-white/40">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Søg i dine løb..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pr-4 pl-12 text-white shadow-[0_0_15px_rgba(0,0,0,0.2)] transition-all placeholder:text-white/40 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          {/* FAG DROPDOWN */}
          <div className="relative w-full shrink-0 md:w-64">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full cursor-pointer appearance-none rounded-2xl border border-white/10 bg-[#131b35] py-4 pr-12 pl-6 font-medium text-white shadow-[0_0_15px_rgba(168,85,247,0.15)] transition-colors hover:bg-[#1a2442] focus:ring-2 focus:ring-purple-500 focus:outline-none"
            >
              {ALL_SUBJECTS.map((subj) => (
                <option key={subj} value={subj} className="bg-[#0a1128] py-2">
                  {subj}
                </option>
              ))}
            </select>
            {/* Custom pil for at fjerne browserens standard-pil */}
            <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-purple-400">
              <svg
                width="14"
                height="8"
                viewBox="0 0 14 8"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 1L7 7L13 1"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence>
            {isLoading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="col-span-full rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/70"
              >
                Henter løb fra arkivet...
              </motion.div>
            ) : filteredRuns.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="col-span-full rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/70"
              >
                Ingen løb matcher din søgning.
              </motion.div>
            ) : (
              filteredRuns.map((run) => (
                <motion.div
                  key={run.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#131b35] p-6 transition-colors hover:border-purple-500/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-200">
                      {run.subject}
                    </span>
                    <span className="text-xs text-white/55">
                      {formatDanishDate(run.created_at)}
                    </span>
                  </div>

                  <h2 className={`mt-5 text-2xl font-bold leading-tight ${rubik.className}`}>
                    {run.title}
                  </h2>

                  <p className="mt-3 flex items-center gap-2 text-sm text-white/70">
                    <MapPin className="h-4 w-4 text-purple-300" />
                    {getQuestionCount(run.questions)} poster
                  </p>

                  <div className="mt-7 grid grid-cols-[1fr_auto_auto] gap-2">
                    <button
                      type="button"
                      onClick={() => void handleStartRun(run.id)}
                      disabled={startingRunId === run.id}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-purple-500 px-4 py-3 text-sm font-bold text-white shadow-[0_0_20px_rgba(16,185,129,0.25)] transition hover:brightness-110"
                    >
                      <Play className="h-4 w-4" />
                      {startingRunId === run.id ? "STARTER..." : "START LØB"}
                    </button>

                    <button
                      type="button"
                      aria-label="Rediger løb"
                      className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-white/70 transition hover:bg-white/20 hover:text-white"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      aria-label="Slet løb"
                      onClick={() => void handleDeleteRun(run.id)}
                      className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-white/70 transition hover:bg-white/20 hover:text-white"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="absolute right-0 bottom-0 left-0 h-1 bg-gradient-to-r from-purple-400 to-pink-500" />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </main>
  );
}
