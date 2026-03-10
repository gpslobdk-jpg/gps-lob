"use client";

import { Poppins, Rubik } from "next/font/google";
import { type FormEvent } from "react";

import type {
  LiveAnswer,
  LiveStudentLocation,
  SessionMessage,
} from "@/components/live/types";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

type TeacherLiveSidebarProps = {
  activeStudents: LiveStudentLocation[];
  hasParticipantsTable: boolean;
  liveAnswers: LiveAnswer[];
  hasAnswersTable: boolean;
  messages: SessionMessage[];
  newMessage: string;
  onNewMessageChange: (value: string) => void;
  onSendMessage: () => Promise<void>;
  onKickParticipant: (student: LiveStudentLocation) => Promise<void>;
};

export default function TeacherLiveSidebar({
  activeStudents,
  hasParticipantsTable,
  liveAnswers,
  hasAnswersTable,
  messages,
  newMessage,
  onNewMessageChange,
  onSendMessage,
  onKickParticipant,
}: TeacherLiveSidebarProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSendMessage();
  };

  return (
    <div
      className={`ml-4 flex h-full w-1/3 flex-col overflow-hidden rounded-3xl border border-white/20 bg-white/10 shadow-2xl backdrop-blur-md ${poppins.className}`}
    >
      <div className="border-b border-white/20 p-6">
        <h3
          className={`text-lg font-bold tracking-widest text-white drop-shadow-md uppercase ${rubik.className}`}
        >
          Aktive Deltagere
        </h3>
        {!hasParticipantsTable ? (
          <p className="mt-2 text-xs text-blue-100">Rødt kort kræver `participants`-tabellen.</p>
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
              <span className="truncate text-sm font-semibold text-white drop-shadow-md">
                {student.name}
              </span>
              <button
                type="button"
                onClick={() => void onKickParticipant(student)}
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
        {messages.map((message, index) => (
          <div
            key={`${message.sender_name}-${message.created_at ?? index}`}
            className={`max-w-[85%] rounded-2xl p-3 text-sm ${
              message.is_teacher
                ? "self-end rounded-tr-none border border-white/20 bg-white/15 text-white"
                : "self-start rounded-tl-none border border-white/20 bg-white/10 text-blue-100"
            }`}
          >
            <div className="mb-1 text-xs font-bold text-blue-100">{message.sender_name}</div>
            {message.message}
          </div>
        ))}

        {messages.length === 0 ? (
          <p className="text-sm text-blue-100">Ingen beskeder endnu.</p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/20 bg-white/10 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(event) => onNewMessageChange(event.target.value)}
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
  );
}
