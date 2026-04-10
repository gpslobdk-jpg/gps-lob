"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Poppins } from "next/font/google";
import { Copy, QrCode, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { QRCode } from "react-qrcode-logo";

import { FullscreenWarning } from "@/components/ui/FullscreenWarning";
import LeaderboardModule from "@/components/live/LeaderboardModule";
import LiveFeedModule from "@/components/live/LiveFeedModule";
import TeacherLiveLobby from "@/components/live/TeacherLiveLobby";
import LivePhotoLightbox from "@/components/live/LivePhotoLightbox";
import LivePhotosModule from "@/components/live/LivePhotosModule";
import TeacherLiveResults from "@/components/live/TeacherLiveResults";
import TeacherLiveSidebar from "@/components/live/TeacherLiveSidebar";
import type { LiveAnswer, LiveModuleId } from "@/components/live/types";
import { useTeacherLiveData } from "@/hooks/useTeacherLiveData";
import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";

const TeacherLiveMap = dynamic(() => import("@/components/live/TeacherLiveMap"), {
  ssr: false,
});
const StrategoTeacherSetup = dynamic(() => import("@/components/live/StrategoTeacherSetup"), {
  ssr: false,
});
const StrategoTeacherDashboard = dynamic(() => import("@/components/live/StrategoTeacherDashboard"), {
  ssr: false,
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type TeacherAccessOverlayProps = {
  joinPin: string;
  open: boolean;
  didCopy: boolean;
  onCopy: () => Promise<void>;
  onClose: () => void;
};

function TeacherAccessOverlay({ joinPin, open, didCopy, onCopy, onClose }: TeacherAccessOverlayProps) {
  if (!open) {
    return null;
  }

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join?pin=${encodeURIComponent(joinPin)}` : `/join?pin=${encodeURIComponent(joinPin)}`;

  return (
    <div className={`fixed inset-0 z-1200 flex items-center justify-center bg-slate-950/72 px-4 py-6 backdrop-blur-md ${poppins.className}`}>
      <div className="relative w-full max-w-md overflow-hidden rounded-4xl border border-cyan-300/28 bg-slate-950/94 p-6 text-white shadow-[0_30px_90px_rgba(2,6,23,0.72)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white"
          aria-label="Luk QR-kode"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200/72">
          Del adgang til sene elever
        </p>
        <h2 className="mt-3 text-2xl font-black text-white">Pinkode og QR-kode</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Hold denne åben, mens forsinkede elever joiner. Løbet fortsætter imens i baggrunden.
        </p>

        <div className="mt-6 rounded-[1.7rem] border border-amber-300/25 bg-amber-300/10 px-5 py-5 text-center shadow-[0_16px_40px_rgba(251,191,36,0.12)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-100/72">Pinkode</p>
          <p className="mt-3 font-mono text-4xl font-black tracking-[0.32em] text-amber-50">{joinPin}</p>
        </div>

        <div className="mt-6 flex justify-center rounded-[1.7rem] border border-white/10 bg-white p-4 shadow-[0_20px_50px_rgba(255,255,255,0.08)]">
          <QRCode
            value={joinUrl}
            size={220}
            bgColor="#ffffff"
            fgColor="#050816"
            qrStyle="dots"
            eyeRadius={10}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void onCopy()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-[1.2rem] border border-cyan-300/30 bg-cyan-400/12 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/18"
          >
            <Copy className="h-4 w-4" />
            {didCopy ? "Kopieret" : "Kopiér link og PIN"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-[1.2rem] border border-white/12 bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Luk
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LiveLobbyPage() {
  const params = useParams<{ sessionId: string }>();
  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId ?? null;
  const live = useTeacherLiveData(sessionId);
  const [activeModule, setActiveModule] = useState<"none" | LiveModuleId>("none");
  const [selectedPhoto, setSelectedPhoto] = useState<LiveAnswer | null>(null);
  const [isAccessOverlayOpen, setIsAccessOverlayOpen] = useState(false);
  const [didCopyJoinAccess, setDidCopyJoinAccess] = useState(false);
  const previousStatusRef = useRef(live.status);
  const isStrategoRace =
    typeof live.runRaceType === "string" &&
    ["stratego", "live_stratego", "live-stratego"].includes(
      live.runRaceType.trim().toLocaleLowerCase("da-DK")
    );
  const isZoneKrigRace = normalizeRaceType(live.runRaceType) === RACE_TYPES.ZONE_KRIG;
  const hasRunningAccessControls =
    (live.status === "running" || live.status === "paused") &&
    Boolean(live.joinPin) &&
    live.joinPin !== "----";
  const isStandardRunningView =
    !isStrategoRace && live.status !== "waiting" && live.status !== "finished";

  const openAccessOverlay = () => {
    setDidCopyJoinAccess(false);
    setIsAccessOverlayOpen(true);
  };

  const closeAccessOverlay = () => {
    setDidCopyJoinAccess(false);
    setIsAccessOverlayOpen(false);
  };

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    const shouldAutoOpen = previousStatus === "waiting" && live.status === "running";
    const shouldAutoClose = live.status === "finished";

    previousStatusRef.current = live.status;

    if (!shouldAutoOpen && !shouldAutoClose) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (shouldAutoOpen) {
        openAccessOverlay();
        return;
      }

      if (shouldAutoClose) {
        closeAccessOverlay();
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [live.status]);

  const visibleActiveModule = isStandardRunningView ? activeModule : "none";
  const visibleSelectedPhoto = isStandardRunningView ? selectedPhoto : null;

  const handleCopyJoinAccess = async () => {
    if (typeof window === "undefined" || !live.joinPin || live.joinPin === "----") {
      return;
    }

    const joinUrl = `${window.location.origin}/join?pin=${encodeURIComponent(live.joinPin)}`;

    try {
      await navigator.clipboard.writeText(`PIN: ${live.joinPin}\nLink: ${joinUrl}`);
      setDidCopyJoinAccess(true);
    } catch (error) {
      console.error("Kunne ikke kopiere join-adgangen:", error);
      alert("Kunne ikke kopiere linket automatisk.");
    }
  };

  const handleModuleSelect = (module: LiveModuleId) => {
    setSelectedPhoto(null);
    setActiveModule(module);
  };

  const handleCloseModule = () => {
    setSelectedPhoto(null);
    setActiveModule("none");
  };

  const handleSelectPhoto = (answer: LiveAnswer) => {
    setSelectedPhoto(answer);
  };

  return (
    <>
      <FullscreenWarning />
      <AnimatePresence mode="wait">
      {live.status === "waiting" ? (
        isStrategoRace ? (
          <StrategoTeacherSetup
            sessionId={sessionId}
            joinPin={live.joinPin}
            students={live.students}
            isLoading={live.isLoading}
            onStartSession={live.startSession}
          />
        ) : (
          <TeacherLiveLobby
            joinPin={live.joinPin}
            students={live.students}
            isLoading={live.isLoading}
            onStartSession={live.startSession}
            startHint={
              isZoneKrigRace
                ? "Standard kampur: 15 minutter. Timeren starter automatisk, når du starter spillet."
                : null
            }
          />
        )
      ) : isStrategoRace ? (
        <StrategoTeacherDashboard
          sessionId={sessionId}
          joinPin={live.joinPin}
          sessionStatus={live.status}
          isEndingRun={live.isEndingRun}
          isUpdatingPause={live.isUpdatingPause}
          onTogglePause={live.togglePause}
          onEndRun={live.endRun}
        />
      ) : live.status === "finished" ? (
        <TeacherLiveResults
          standings={live.finalStandings}
          totalPosts={live.totalPosts}
          winnerCelebrationName={live.winnerCelebrationName}
          photoAnswers={live.photoAnswers}
          isPhotoMission={live.isPhotoMission}
        />
      ) : visibleActiveModule !== "none" ? (
        <motion.div
          key={`module-${visibleActiveModule}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          className={`h-screen w-screen overflow-hidden bg-slate-950 text-white ${poppins.className}`}
        >
          {visibleActiveModule === "leaderboard" ? (
            <LeaderboardModule
              activeStudents={live.activeStudents}
              allParticipants={live.studentLocations}
              liveAnswers={live.liveAnswers}
              hasParticipantsTable={live.hasParticipantsTable}
              onKickParticipant={live.kickParticipant}
              onClose={handleCloseModule}
            />
          ) : visibleActiveModule === "feed" ? (
            <LiveFeedModule
              liveAnswers={live.liveAnswers}
              hasAnswersTable={live.hasAnswersTable}
              messages={live.messages}
              onSelectPhoto={handleSelectPhoto}
              onClose={handleCloseModule}
            />
          ) : (
            <LivePhotosModule
              photoAnswers={live.photoAnswers}
              hasAnswersTable={live.hasAnswersTable}
              onSelectPhoto={handleSelectPhoto}
              onClose={handleCloseModule}
            />
          )}
        </motion.div>
      ) : (
        <motion.div
          key="running-map"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          className={`relative flex h-screen overflow-hidden bg-linear-to-b from-indigo-950 via-blue-900 to-cyan-800 p-4 text-white ${poppins.className}`}
        >
          <TeacherLiveMap
            mapCenter={live.mapCenter}
            mapKey={live.mapKey}
            runQuestions={live.runQuestions}
            studentLocations={live.studentLocations}
            hasParticipantsTable={live.hasParticipantsTable}
            isEndingRun={live.isEndingRun}
            onEndRun={live.endRun}
          />
          <TeacherLiveSidebar
            activeStudents={live.activeStudents}
            joinPin={live.joinPin}
            hasParticipantsTable={live.hasParticipantsTable}
            gpsOverride={live.gpsOverride}
            isUpdatingGpsOverride={live.isUpdatingGpsOverride}
            newMessage={live.newMessage}
            onNewMessageChange={live.setNewMessage}
            onSendMessage={live.sendMessage}
            onToggleGpsOverride={live.toggleGpsOverride}
            onModuleSelect={handleModuleSelect}
          />
        </motion.div>
      )}
      </AnimatePresence>

      <LivePhotoLightbox answer={visibleSelectedPhoto} onClose={() => setSelectedPhoto(null)} />

      {hasRunningAccessControls ? (
        <div className={`pointer-events-none fixed inset-x-4 top-4 z-1100 flex justify-center ${poppins.className}`}>
          <div className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-cyan-300/25 bg-slate-950/82 px-4 py-2.5 text-white shadow-[0_20px_50px_rgba(2,6,23,0.55)] backdrop-blur-xl">
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200/72">PIN</span>
            <span className="font-mono text-lg font-black tracking-[0.28em] text-cyan-50 sm:text-xl">{live.joinPin}</span>
            <button
              type="button"
              onClick={openAccessOverlay}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-300/22 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-50 transition hover:bg-cyan-400/18"
            >
              <QrCode className="h-3.5 w-3.5" />
              QR
            </button>
          </div>
        </div>
      ) : null}

      {hasRunningAccessControls ? (
        <TeacherAccessOverlay
          joinPin={live.joinPin}
          open={isAccessOverlayOpen}
          didCopy={didCopyJoinAccess}
          onCopy={handleCopyJoinAccess}
          onClose={closeAccessOverlay}
        />
      ) : null}
    </>
  );
}
