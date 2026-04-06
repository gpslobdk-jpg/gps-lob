"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Poppins } from "next/font/google";

import { FullscreenWarning } from "@/components/ui/FullscreenWarning";
import TeacherLiveLobby from "@/components/live/TeacherLiveLobby";
import TeacherLiveResults from "@/components/live/TeacherLiveResults";
import TeacherLiveSidebar from "@/components/live/TeacherLiveSidebar";
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

export default function LiveLobbyPage() {
  const params = useParams<{ sessionId: string }>();
  const rawSessionId = params?.sessionId;
  const sessionId = Array.isArray(rawSessionId) ? rawSessionId[0] : rawSessionId ?? null;
  const live = useTeacherLiveData(sessionId);
  const isStrategoRace =
    typeof live.runRaceType === "string" &&
    ["stratego", "live_stratego", "live-stratego"].includes(
      live.runRaceType.trim().toLocaleLowerCase("da-DK")
    );
  const isZoneKrigRace = normalizeRaceType(live.runRaceType) === RACE_TYPES.ZONE_KRIG;

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
      ) : (
        <motion.div
          key="running"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.35 }}
          className={`flex h-screen overflow-hidden bg-gradient-to-b from-indigo-950 via-blue-900 to-cyan-800 p-4 text-white ${poppins.className}`}
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
            allParticipants={live.studentLocations}
            joinPin={live.joinPin}
            hasParticipantsTable={live.hasParticipantsTable}
            gpsOverride={live.gpsOverride}
            isUpdatingGpsOverride={live.isUpdatingGpsOverride}
            liveAnswers={live.liveAnswers}
            hasAnswersTable={live.hasAnswersTable}
            messages={live.messages}
            newMessage={live.newMessage}
            onNewMessageChange={live.setNewMessage}
            onSendMessage={live.sendMessage}
            onToggleGpsOverride={live.toggleGpsOverride}
            onKickParticipant={live.kickParticipant}
          />
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
