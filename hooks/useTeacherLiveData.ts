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
  TeacherLiveStanding,
} from "@/components/live/types";
import { createClient } from "@/utils/supabase/client";

function toTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

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
  const [sessionAnswers, setSessionAnswers] = useState<TeacherLiveData["liveAnswers"]>([]);
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
        if (!parsed) return;

        setSessionAnswers((previous) =>
          [...previous.filter((item) => item.id !== parsed.id), parsed].sort((a, b) => {
            const aTs = toTimestamp(a.createdAt) ?? 0;
            const bTs = toTimestamp(b.createdAt) ?? 0;
            return aTs - bTs;
          })
        );

        if (parsed.isCorrect !== true) return;

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
        .eq("session_id", sessionId);

      if (!isActive) return { supportsParticipants, supportsAnswers: false };

      if (answersError) {
        supportsAnswers = false;
        if (answersError.code !== "PGRST205") {
          console.error("Fejl ved hentning af answers:", answersError);
        }
      } else if (answersData) {
        const parsed = (answersData as AnswerRow[])
          .map((row) => toLiveAnswer(row))
          .filter((row): row is NonNullable<typeof row> => row !== null)
          .sort((a, b) => {
            const aTs = toTimestamp(a.createdAt) ?? 0;
            const bTs = toTimestamp(b.createdAt) ?? 0;
            return aTs - bTs;
          });

        setSessionAnswers(parsed);
        setLiveAnswers(
          parsed
            .filter((row) => row.isCorrect === true)
          .sort((a, b) => {
            const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTs - aTs;
          })
            .slice(0, 40)
        );
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
  const totalPosts = runQuestions.length;

  const participantRoster = useMemo(() => {
    const participantsByName = new Map<string, LiveStudentLocation>();

    for (const student of studentLocations) {
      const normalizedKey = student.name.toLocaleLowerCase("da-DK");
      participantsByName.set(normalizedKey, student);
    }

    for (const studentName of students) {
      const normalizedName = normalizeName(studentName);
      if (!normalizedName) continue;

      const normalizedKey = normalizedName.toLocaleLowerCase("da-DK");
      if (participantsByName.has(normalizedKey)) continue;

      participantsByName.set(normalizedKey, {
        id: `${sessionId ?? "session"}-${normalizedKey}`,
        name: normalizedName,
        student_name: normalizedName,
        lat: null,
        lng: null,
        updated_at: null,
        finished_at: null,
      });
    }

    return Array.from(participantsByName.values());
  }, [sessionId, studentLocations, students]);

  const finalStandings = useMemo<TeacherLiveStanding[]>(() => {
    const statsByName = new Map<
      string,
      {
        correctPosts: Set<number>;
        attemptedPosts: Set<number>;
        correctAnswers: number;
        firstAnswerAt: string | null;
        lastCorrectAt: string | null;
        lastActivityAt: string | null;
      }
    >();

    for (const answer of sessionAnswers) {
      const normalizedName = normalizeName(answer.studentName);
      if (!normalizedName) continue;

      const normalizedKey = normalizedName.toLocaleLowerCase("da-DK");
      const entry =
        statsByName.get(normalizedKey) ??
        {
          correctPosts: new Set<number>(),
          attemptedPosts: new Set<number>(),
          correctAnswers: 0,
          firstAnswerAt: null,
          lastCorrectAt: null,
          lastActivityAt: null,
        };

      if (typeof answer.postNumber === "number" && Number.isFinite(answer.postNumber)) {
        entry.attemptedPosts.add(answer.postNumber);
        if (answer.isCorrect === true) {
          entry.correctPosts.add(answer.postNumber);
        }
      }

      const answerTs = toTimestamp(answer.createdAt);
      const firstAnswerTs = toTimestamp(entry.firstAnswerAt);
      if (answerTs !== null && (firstAnswerTs === null || answerTs < firstAnswerTs)) {
        entry.firstAnswerAt = answer.createdAt;
      }

      const lastActivityTs = toTimestamp(entry.lastActivityAt);
      if (answerTs !== null && (lastActivityTs === null || answerTs > lastActivityTs)) {
        entry.lastActivityAt = answer.createdAt;
      }

      if (answer.isCorrect === true) {
        entry.correctAnswers += 1;

        const lastCorrectTs = toTimestamp(entry.lastCorrectAt);
        if (answerTs !== null && (lastCorrectTs === null || answerTs > lastCorrectTs)) {
          entry.lastCorrectAt = answer.createdAt;
        }
      }

      statsByName.set(normalizedKey, entry);
    }

    return [...participantRoster]
      .map((student) => {
        const normalizedKey = student.name.toLocaleLowerCase("da-DK");
        const stats = statsByName.get(normalizedKey);
        const score = stats?.correctPosts.size ?? 0;
        const correctAnswers = stats?.correctAnswers ?? 0;
        const completedPosts = stats?.attemptedPosts.size ?? 0;
        const progressPercent =
          totalPosts > 0 ? Math.max(0, Math.min(100, Math.round((completedPosts / totalPosts) * 100))) : 0;
        const firstAnswerAt = stats?.firstAnswerAt ?? null;
        const endTimestamp = toTimestamp(student.finished_at ?? stats?.lastActivityAt ?? null);
        const startTimestamp = toTimestamp(firstAnswerAt);
        const elapsedTimeMs =
          startTimestamp !== null && endTimestamp !== null && endTimestamp >= startTimestamp
            ? endTimestamp - startTimestamp
            : null;

        return {
          student,
          score,
          correctAnswers,
          completedPosts,
          progressPercent,
          firstAnswerAt,
          lastActivityAt: stats?.lastCorrectAt ?? stats?.lastActivityAt ?? null,
          elapsedTimeMs,
        };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (b.correctAnswers !== a.correctAnswers) return b.correctAnswers - a.correctAnswers;

        const aFinished = Boolean(a.student.finished_at);
        const bFinished = Boolean(b.student.finished_at);
        if (aFinished !== bFinished) {
          return aFinished ? -1 : 1;
        }

        const aTime = a.elapsedTimeMs ?? Number.POSITIVE_INFINITY;
        const bTime = b.elapsedTimeMs ?? Number.POSITIVE_INFINITY;
        if (aTime !== bTime) return aTime - bTime;

        return a.student.name.localeCompare(b.student.name, "da");
      });
  }, [participantRoster, sessionAnswers, totalPosts]);

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
    finalStandings[0]?.student.name || finalStandings[0]?.student.student_name || "Holdet";

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
    const finishedAt = new Date().toISOString();
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

    if (hasParticipantsTable) {
      const { error: finishParticipantsError } = await supabase
        .from("participants")
        .update({ finished_at: finishedAt })
        .eq("session_id", sessionId)
        .is("finished_at", null);

      if (finishParticipantsError) {
        console.warn("Kunne ikke registrere afslutning paa aktive deltagere:", finishParticipantsError);
      } else {
        setStudentLocations((previous) =>
          previous.map((student) =>
            student.finished_at
              ? student
              : {
                  ...student,
                  finished_at: finishedAt,
                }
          )
        );
      }
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
    runQuestions,
    liveAnswers,
    hasParticipantsTable,
    hasAnswersTable,
    isEndingRun,
    activeStudents,
    studentLocations,
    finishers,
    finalStandings,
    winnerCelebrationName,
    totalPosts,
    mapCenter,
    mapKey,
    setNewMessage: updateNewMessage,
    sendMessage,
    startSession,
    endRun,
    kickParticipant,
  };
}
