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
import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";
import { createClient } from "@/utils/supabase/client";

const DEFAULT_ZONE_KRIG_DURATION_MINUTES = 15;

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
  const [gpsOverride, setGpsOverride] = useState(false);
  const [isUpdatingGpsOverride, setIsUpdatingGpsOverride] = useState(false);
  const [runRaceType, setRunRaceType] = useState<string | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [newMessage, setNewMessageState] = useState("");
  const [studentLocations, setStudentLocations] = useState<LiveStudentLocation[]>([]);
  const [runQuestions, setRunQuestions] = useState<TeacherLiveData["runQuestions"]>([]);
  const [liveAnswers, setLiveAnswers] = useState<TeacherLiveData["liveAnswers"]>([]);
  const [sessionAnswers, setSessionAnswers] = useState<TeacherLiveData["liveAnswers"]>([]);
  const [hasParticipantsTable, setHasParticipantsTable] = useState(true);
  const [hasAnswersTable, setHasAnswersTable] = useState(true);
  const [isEndingRun, setIsEndingRun] = useState(false);
  const [isUpdatingPause, setIsUpdatingPause] = useState(false);

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
        setGpsOverride(Boolean(sessionData.gps_override));

        if (sessionData.run_id) {
          const { data: runData } = await supabase
            .from("gps_runs")
            .select("questions,race_type,raceType")
            .eq("id", sessionData.run_id)
            .single();

          if (!isActive) return { supportsParticipants: false, supportsAnswers: false };

          if (runData?.questions) {
            setRunQuestions(runData.questions as TeacherLiveData["runQuestions"]);
          }

          setRunRaceType(
            typeof runData?.race_type === "string"
              ? runData.race_type
              : typeof runData?.raceType === "string"
                ? runData.raceType
                : null
          );
        } else {
          setRunRaceType(null);
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
            const nextSession = payload.new as SessionRow;
            if (nextSession.status) setStatus(nextSession.status);
            setGpsOverride(Boolean(nextSession.gps_override));
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
  const photoAnswers = useMemo(
    () => liveAnswers.filter((answer) => Boolean(answer.image_url)),
    [liveAnswers]
  );
  const isPhotoMission = useMemo(
    () => normalizeRaceType(runRaceType) === RACE_TYPES.FOTO,
    [runRaceType]
  );

  const mapCenter = useMemo(() => getTeacherMapCenter(runQuestions), [runQuestions]);
  const mapKey = useMemo(
    () => `${mapCenter[0]}-${mapCenter[1]}-${runQuestions.length}`,
    [mapCenter, runQuestions.length]
  );
  const totalPosts = runQuestions.length;

  const participantRoster = useMemo(() => {
    const participantsById = new Map<string, LiveStudentLocation>();
    const namesWithTrackedParticipants = new Set<string>();

    for (const student of studentLocations) {
      participantsById.set(student.id, student);
      namesWithTrackedParticipants.add(student.name.toLocaleLowerCase("da-DK"));
    }

    for (const studentName of students) {
      const normalizedName = normalizeName(studentName);
      if (!normalizedName) continue;

      const normalizedKey = normalizedName.toLocaleLowerCase("da-DK");
      if (namesWithTrackedParticipants.has(normalizedKey)) continue;

      participantsById.set(`${sessionId ?? "session"}-${normalizedKey}`, {
        id: `${sessionId ?? "session"}-${normalizedKey}`,
        name: normalizedName,
        student_name: normalizedName,
        lat: null,
        lng: null,
        updated_at: null,
        finished_at: null,
      });
    }

    return Array.from(participantsById.values());
  }, [sessionId, studentLocations, students]);

  const finalStandings = useMemo<TeacherLiveStanding[]>(() => {
    const statsByParticipant = new Map<
      string,
      {
        correctPosts: Set<number>;
        attemptedPosts: Set<number>;
        score: number;
        correctAnswers: number;
        firstAnswerAt: string | null;
        lastCorrectAt: string | null;
        lastActivityAt: string | null;
      }
    >();

    for (const answer of sessionAnswers) {
      const normalizedName = normalizeName(answer.studentName);
      const participantKey =
        answer.participantId ?? (normalizedName ? normalizedName.toLocaleLowerCase("da-DK") : null);
      if (!participantKey) continue;

      const entry =
        statsByParticipant.get(participantKey) ??
        {
          correctPosts: new Set<number>(),
          attemptedPosts: new Set<number>(),
          score: 0,
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
        entry.score += answer.awardedPoints;
        entry.correctAnswers += 1;

        const lastCorrectTs = toTimestamp(entry.lastCorrectAt);
        if (answerTs !== null && (lastCorrectTs === null || answerTs > lastCorrectTs)) {
          entry.lastCorrectAt = answer.createdAt;
        }
      }

      statsByParticipant.set(participantKey, entry);
    }

    return [...participantRoster]
      .map((student) => {
        const stats =
          statsByParticipant.get(student.id) ??
          statsByParticipant.get(student.name.toLocaleLowerCase("da-DK"));
        const score = stats?.score ?? 0;
        const correctAnswers = stats?.correctAnswers ?? 0;
        const completedPosts = stats?.attemptedPosts.size ?? 0;
        const progressPercent =
          totalPosts > 0 ? Math.max(0, Math.min(100, Math.round((completedPosts / totalPosts) * 100))) : 0;
        const firstAnswerAt = stats?.firstAnswerAt ?? null;
        const effectiveStartAt = student.run_started_at ?? firstAnswerAt;
        const endTimestamp = toTimestamp(student.finished_at ?? stats?.lastActivityAt ?? null);
        const startTimestamp = toTimestamp(effectiveStartAt);
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

  const toggleGpsOverride = async () => {
    if (!sessionId || isUpdatingGpsOverride) return;

    const nextValue = !gpsOverride;
    setIsUpdatingGpsOverride(true);

    const supabase = createClient();
    const { error } = await supabase
      .from("live_sessions")
      .update({ gps_override: nextValue })
      .eq("id", sessionId);

    if (error) {
      console.error("Kunne ikke opdatere God Mode:", error);
      alert("Kunne ikke opdatere God Mode.");
      setIsUpdatingGpsOverride(false);
      return;
    }

    setGpsOverride(nextValue);
    setIsUpdatingGpsOverride(false);
  };

  const startSession = async () => {
    if (!sessionId) return;

    if (normalizeRaceType(runRaceType) === RACE_TYPES.STRATEGO) {
      const provisionResponse = await fetch("/api/stratego/provision", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ sessionId }),
      });

      const provisionPayload = (await provisionResponse.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!provisionResponse.ok) {
        console.error("Kunne ikke klargøre Stratego-spillere:", provisionPayload?.error);
        alert(provisionPayload?.error || "Kunne ikke klargøre Stratego-holdene.");
        return;
      }
    }

    const normalizedRaceType = normalizeRaceType(runRaceType);
    const sessionUpdate: { status: string; ends_at?: string | null } = {
      status: "running",
      ends_at:
        normalizedRaceType === RACE_TYPES.ZONE_KRIG
          ? new Date(Date.now() + DEFAULT_ZONE_KRIG_DURATION_MINUTES * 60 * 1000).toISOString()
          : null,
    };

    const supabase = createClient();
    const { error } = await supabase
      .from("live_sessions")
      .update(sessionUpdate)
      .eq("id", sessionId);

    if (error) {
      console.error("Kunne ikke starte session:", error);
      alert("Kunne ikke starte løbet.");
      return;
    }

    setStatus("running");
  };

  const togglePause = async () => {
    if (!sessionId || isUpdatingPause || isEndingRun || status === "finished") return;

    const nextStatus = status === "paused" ? "running" : "paused";
    setIsUpdatingPause(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("live_sessions")
        .update({ status: nextStatus })
        .eq("id", sessionId);

      if (error) {
        console.error("Kunne ikke opdatere pausetilstand:", error);
        alert("Kunne ikke skifte pause-tilstand.");
        return;
      }

      setStatus(nextStatus);
    } finally {
      setIsUpdatingPause(false);
    }
  };

  const endRun = async () => {
    if (!sessionId || isEndingRun || status === "finished") return;

    const confirmed = confirm(
      "Er du sikker på, at du vil afslutte løbet for alle deltagere? Dette kan ikke fortrydes."
    );
    if (!confirmed) return;

    setIsEndingRun(true);

    const supabase = createClient();
    const finishedAt = new Date().toISOString();
    const normalizedRaceType = normalizeRaceType(runRaceType);
    const sessionUpdate: { status: string; ends_at?: string } = { status: "finished" };
    if (normalizedRaceType === RACE_TYPES.ZONE_KRIG) {
      sessionUpdate.ends_at = finishedAt;
    }
    const { error } = await supabase
      .from("live_sessions")
      .update(sessionUpdate)
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
    gpsOverride,
    isUpdatingGpsOverride,
    runRaceType,
    isPhotoMission,
    messages,
    newMessage,
    runQuestions,
    liveAnswers,
    photoAnswers,
    hasParticipantsTable,
    hasAnswersTable,
    isEndingRun,
    isUpdatingPause,
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
    toggleGpsOverride,
    togglePause,
    startSession,
    endRun,
    kickParticipant,
  };
}
