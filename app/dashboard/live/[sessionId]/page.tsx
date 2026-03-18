"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Poppins } from "next/font/google";

import TeacherLiveLobby from "@/components/live/TeacherLiveLobby";
import TeacherLiveResults from "@/components/live/TeacherLiveResults";
import TeacherLiveSidebar from "@/components/live/TeacherLiveSidebar";
import { useTeacherLiveData } from "@/hooks/useTeacherLiveData";

const TeacherLiveMap = dynamic(() => import("@/components/live/TeacherLiveMap"), {
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

  return (
    <AnimatePresence mode="wait">
      {live.status === "waiting" ? (
        <TeacherLiveLobby
          joinPin={live.joinPin}
          students={live.students}
          isLoading={live.isLoading}
          onStartSession={live.startSession}
        />
      ) : live.status === "finished" ? (
        <TeacherLiveResults
          finishers={live.finishers}
          winnerCelebrationName={live.winnerCelebrationName}
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
            hasParticipantsTable={live.hasParticipantsTable}
            liveAnswers={live.liveAnswers}
            hasAnswersTable={live.hasAnswersTable}
            messages={live.messages}
            newMessage={live.newMessage}
            onNewMessageChange={live.setNewMessage}
            onSendMessage={live.sendMessage}
            onKickParticipant={live.kickParticipant}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
