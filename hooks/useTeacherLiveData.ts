"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getTeacherMapCenter,
  normalizeName,
  prependAnswer,
  toLocation,
  toLiveAnswer,
  upsertLocation,
} from "@/components/live/liveUtils";
import type {
  AnswerRow,
  LiveStudentLocation,
  SessionMessage,
  SessionRow,
  StudentRow,
  TeacherLiveData,
} from "@/components/live/types";
import { createClient } from "@/utils/supabase/client";

export function useTeacherLiveData(sessionId: string | null): TeacherLiveData {
  const [pin, setPin] = useState("");
  const [students, setStudents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<SessionRow["status"]>("waiting");
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [newMessage, setNewMessageState] = useState("");
  const [studentLocations, setStudentLocations] = useState<LiveStudentLocation[]>([]);
  const [runQuestions, setRunQuestions] = useState<TeacherLiveData["runQuestions"]>([]);
  const [liveAnswers, setLiveAnswers] = useState<TeacherLiveData["liveAnswers"]>([]);
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
      setStudents((previous) => (previous.includes(name) ? previous : [...previous, name]));
    };

    const addStudentLocation = (row: StudentRow) => {
      const location = toLocation(row);
      if (!location) return;

      setStudentLocations((previous) => upsertLocation(previous, location));
      addStudentName(location.name);
    };

    const addLiveAnswer = (row: AnswerRow) => {
      const parsed = toLiveAnswer(row);
      if (!parsed || parsed.isCorrect !== true) return;

      setLiveAnswers((previous) => prependAnswer(previous, parsed));
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
            setRunQuestions(runData.questions as TeacherLiveData["runQuestions"]);
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
        if (participantsError.code !== "PGRST205") {
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
        if (answersError.code !== "PGRST205") {
          console.error("Fejl ved hentning af answers:", answersError);
        }
      } else if (answersData) {
        const parsed = (answersData as AnswerRow[])
          .map((row) => toLiveAnswer(row))
          .filter((row): row is NonNullable<typeof row> => row !== null && row.isCorrect === true)
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
            setMessages((previous) => [...previous, row]);
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
              addStudentLocation(payload.new as StudentRow);
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
              addStudentLocation(payload.new as StudentRow);
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
            addStudentLocation(payload.new as StudentRow);
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
            addLiveAnswer(payload.new as AnswerRow);
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

  const joinPin = isLoading ? "----" : pin || "----";

  const mapCenter = useMemo(() => getTeacherMapCenter(runQuestions), [runQuestions]);
  const mapKey = useMemo(
    () => `${mapCenter[0]}-${mapCenter[1]}-${runQuestions.length}`,
    [mapCenter, runQuestions.length]
  );

  const finishers = useMemo(
    () =>
      [...studentLocations]
        .filter((student) => Boolean(student.finished_at))
        .sort((a, b) => {
          const aTime = new Date(a.finished_at ?? "").getTime();
          const bTime = new Date(b.finished_at ?? "").getTime();
          return aTime - bTime;
        }),
    [studentLocations]
  );

  const winnerCelebrationName =
    finishers[0]?.name || finishers[0]?.student_name || "Holdet";

  const activeStudents = useMemo(
    () =>
      [...studentLocations]
        .filter((student) => !student.finished_at)
        .sort((a, b) => a.name.localeCompare(b.name, "da")),
    [studentLocations]
  );

  const updateNewMessage = (value: string) => {
    setNewMessageState(value);
  };

  const sendMessage = async () => {
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

    setNewMessageState("");
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

  const endRun = async () => {
    if (!sessionId || isEndingRun) return;

    const confirmed = confirm(
      "Er du sikker på, at du vil afslutte løbet for alle deltagere? Dette kan ikke fortrydes."
    );
    if (!confirmed) return;

    setIsEndingRun(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("live_sessions")
      .update({ status: "finished" })
      .eq("id", sessionId);

    if (error) {
      console.error("Kunne ikke afslutte løbet:", error);
      alert("Kunne ikke afslutte løbet.");
      setIsEndingRun(false);
      return;
    }

    setStatus("finished");
    setIsEndingRun(false);
  };

  const kickParticipant = async (student: LiveStudentLocation) => {
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

    setStudentLocations((previous) => previous.filter((item) => item.id !== student.id));
    setStudents((previous) => previous.filter((name) => name !== student.name));
  };

  return {
    sessionId,
    pin,
    joinPin,
    students,
    isLoading: sessionId ? isLoading : false,
    status: status ?? "waiting",
    messages,
    newMessage,
    studentLocations,
    runQuestions,
    liveAnswers,
    hasParticipantsTable,
    hasAnswersTable,
    isEndingRun,
    activeStudents,
    studentLocations,
    finishers,
    winnerCelebrationName,
    mapCenter,
    mapKey,
    setNewMessage: updateNewMessage,
    sendMessage,
    startSession,
    endRun,
    kickParticipant,
  };
}
