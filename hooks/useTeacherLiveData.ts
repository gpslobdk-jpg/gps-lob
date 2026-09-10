"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getTeacherMapCenter,
  normalizeName,
  prependAnswer,
  toLocation,
  toLiveAnswer,
} from "@/components/live/liveUtils";
import type {
  AnswerRow,
  LiveStudentLocation,
  SessionMessage,
  SessionRow,
  StudentRow,
  TeacherLiveData,
  TeacherLiveFeedStatus,
  TeacherLiveStanding,
} from "@/components/live/types";
import { buildLiveRouteOverview } from "@/lib/routes/liveRouteOverview";
import { isActiveStudentSessionStatus } from "@/lib/studentData/privacyPolicy";
import {
  CURRENT_ROUTE_VERSION,
  isDistributedCircularEligibleRaceType,
  POST_ORDER_MODES,
  resolveSessionPostOrderMode,
} from "@/lib/routes/postOrderPolicy";
import { normalizeRaceType, RACE_TYPES } from "@/utils/gpsRuns";
import { createClient } from "@/utils/supabase/client";
import {
  applyParticipantRosterEvent,
  createParticipantRoster,
  mergeParticipantRosterSnapshot,
  type ParticipantRosterState,
} from "@/lib/live/participantRoster";

const DEFAULT_ZONE_KRIG_DURATION_MINUTES = 15;
const LIVE_FEED_FALLBACK_POLL_INTERVAL_MS = 8_000;

type LiveFeedRecoveryReason =
  | "init"
  | "channel_error"
  | "visibility_resume"
  | "online_resume";

function toTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRealtimeEventTimestamp(payload: unknown) {
  if (!isRecord(payload)) return null;
  const value = payload.commit_timestamp;
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeTeacherLiveTheme(value: unknown): TeacherLiveData["theme"] {
  if (!isRecord(value)) return undefined;

  const vm26 = isRecord(value.vm26) ? value.vm26 : null;
  if (vm26?.enabled !== true) return undefined;

  const templateId = typeof vm26.templateId === "string" ? vm26.templateId : "";
  const version =
    typeof vm26.version === "number" && Number.isFinite(vm26.version)
      ? vm26.version
      : null;

  if (!templateId || version === null) return undefined;

  return {
    vm26: {
      enabled: true,
      templateId,
      version,
    },
  };
}

export function useTeacherLiveData(sessionId: string | null): TeacherLiveData {
  const [pin, setPin] = useState("");
  const [students, setStudents] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [liveFeedStatus, setLiveFeedStatus] = useState<TeacherLiveFeedStatus>("connecting");
  const [liveFeedLastSyncedAt, setLiveFeedLastSyncedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionRow["status"]>("waiting");
  const [gpsOverride, setGpsOverride] = useState(false);
  const [isUpdatingGpsOverride, setIsUpdatingGpsOverride] = useState(false);
  const [runRaceType, setRunRaceType] = useState<string | null>(null);
  const [postOrderMode, setPostOrderMode] =
    useState<TeacherLiveData["postOrderMode"]>(POST_ORDER_MODES.FIXED);
  const [routeVersion, setRouteVersion] = useState(CURRENT_ROUTE_VERSION);
  const [theme, setTheme] = useState<TeacherLiveData["theme"]>(undefined);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [newMessage, setNewMessageState] = useState("");
  const participantRosterRef = useRef<ParticipantRosterState>(createParticipantRoster([]));
  const [participantRosterState, setParticipantRosterState] = useState<ParticipantRosterState>(
    () => participantRosterRef.current
  );
  const [runQuestions, setRunQuestions] = useState<TeacherLiveData["runQuestions"]>([]);
  const [liveAnswers, setLiveAnswers] = useState<TeacherLiveData["liveAnswers"]>([]);
  const [sessionAnswers, setSessionAnswers] = useState<TeacherLiveData["liveAnswers"]>([]);
  const [hasParticipantsTable, setHasParticipantsTable] = useState(true);
  const [hasAnswersTable, setHasAnswersTable] = useState(true);
  const [isEndingRun, setIsEndingRun] = useState(false);
  const [isUpdatingPause, setIsUpdatingPause] = useState(false);

  const updateParticipantRoster = useCallback(
    (transform: (current: ParticipantRosterState) => ParticipantRosterState) => {
      const next = transform(participantRosterRef.current);
      if (next === participantRosterRef.current) return;
      participantRosterRef.current = next;
      setParticipantRosterState(next);
    },
    []
  );

  const replaceParticipantRoster = useCallback((next: ParticipantRosterState) => {
    participantRosterRef.current = next;
    setParticipantRosterState(next);
  }, []);

  const studentLocations = participantRosterState.entries;

  useEffect(() => {
    if (!sessionId) {
      setTheme(undefined);
      return;
    }

    let isActive = true;
    setTheme(undefined);

    void (async () => {
      try {
        const response = await fetch(
          `/api/dashboard/live/theme?sessionId=${encodeURIComponent(sessionId)}`,
          { cache: "no-store" }
        );

        if (!isActive) return;

        if (!response.ok) {
          setTheme(undefined);
          return;
        }

        const payload = (await response.json().catch(() => null)) as
          | { theme?: unknown }
          | null;

        if (!isActive) return;
        setTheme(normalizeTeacherLiveTheme(payload?.theme));
      } catch {
        if (isActive) {
          setTheme(undefined);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      replaceParticipantRoster(createParticipantRoster([]));
      setStudents([]);
      return;
    }

    const supabase = createClient();
    let isActive = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    replaceParticipantRoster(createParticipantRoster([]));
    // Timer der forsinker visningen af "Genopretter live-feed" med 2 s.
    // Hvis kanalen abonnerer inden timeren udløber, annulleres timeren og
    // læreren ser aldrig advarslen (typisk ved kort WiFi-reconnect).
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackPollTimer: ReturnType<typeof setInterval> | null = null;

    const stopFallbackPolling = () => {
      if (fallbackPollTimer !== null) {
        clearInterval(fallbackPollTimer);
        fallbackPollTimer = null;
      }
    };

    const startFallbackPolling = () => {
      if (fallbackPollTimer !== null || document.visibilityState !== "visible") return;

      // Realtime remains the normal path. This bounded, visible-page-only
      // recovery path makes a missed channel event self-healing without a
      // reload or a global polling loop.
      fallbackPollTimer = setInterval(() => {
        if (!isActive || document.visibilityState !== "visible") return;
        void fetchLobbyData({ showLoading: false });
      }, LIVE_FEED_FALLBACK_POLL_INTERVAL_MS);
    };

    const scheduleRecovery = (reason: LiveFeedRecoveryReason) => {
      startFallbackPolling();
      if (recoveryTimer !== null) return; // debounce: én ventende timer ad gangen
      recoveryTimer = setTimeout(() => {
        recoveryTimer = null;
        if (!isActive) return;
        setLiveFeedStatus("recovering");
        void recoverLiveState(reason);
      }, 2_000);
    };

    const cancelRecovery = () => {
      if (recoveryTimer !== null) {
        clearTimeout(recoveryTimer);
        recoveryTimer = null;
      }
    };

    // --- helpers ---

    const fetchLobbyData = async (options?: { showLoading?: boolean }) => {
      const shouldShowLoading = options?.showLoading !== false;
      if (shouldShowLoading) {
        setIsLoading(true);
      }

      const studentNames = new Set<string>();
      let fallbackSessionStudents: StudentRow[] = [];
      let didEncounterLiveFeedError = false;
      let fetchedSessionStatus: string | null = null;

      const { data: sessionData, error: sessionError } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("id", sessionId)
        .single<SessionRow>();

      if (!isActive) return { supportsParticipants: false, supportsAnswers: false };

      if (sessionError) {
        didEncounterLiveFeedError = true;
        console.error("Fejl ved hentning af session:", sessionError);
      } else if (sessionData) {
        fetchedSessionStatus = sessionData.status ?? null;
        setPin(String(sessionData.pin ?? ""));
        setStatus(sessionData.status ?? "waiting");
        setGpsOverride(Boolean(sessionData.gps_override));
        const parsedRouteVersion = Number(sessionData.route_version);
        const nextRouteVersion = Number.isSafeInteger(parsedRouteVersion)
          ? parsedRouteVersion
          : CURRENT_ROUTE_VERSION;
        setRouteVersion(nextRouteVersion);

        if (sessionData.run_id) {
          const { data: runData } = await supabase
            .from("gps_runs")
            .select("questions,race_type,raceType:race_type")
            .eq("id", sessionData.run_id)
            .single();

          if (!isActive) return { supportsParticipants: false, supportsAnswers: false };

          if (runData?.questions) {
            setRunQuestions(runData.questions as TeacherLiveData["runQuestions"]);
          }

          const nextRaceType =
            typeof runData?.race_type === "string"
              ? runData.race_type
              : typeof runData?.raceType === "string"
                ? runData.raceType
                : null;
          setRunRaceType(nextRaceType);
          setPostOrderMode(
            resolveSessionPostOrderMode(
              sessionData.post_order_mode,
              nextRaceType,
              sessionData.route_version
            )
          );
        } else {
          setRunRaceType(null);
          setPostOrderMode(POST_ORDER_MODES.FIXED);
        }
      }

      const { data: sessionStudentsData, error: sessionStudentsError } = await supabase
        .from("session_students")
        .select("*")
        .eq("session_id", sessionId);

      if (!isActive) return { supportsParticipants: false, supportsAnswers: false };

      if (sessionStudentsError) {
        didEncounterLiveFeedError = true;
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
      const participantSnapshotRevision = participantRosterRef.current.revision;

      const { data: participantsData, error: participantsError } = await supabase
        .from("participants")
        .select("*")
        .eq("session_id", sessionId)
        .is("removed_at", null);

      if (!isActive) return { supportsParticipants: false, supportsAnswers: false };

      if (participantsError) {
        supportsParticipants = false;
        if (participantsError.code !== "PGRST205") {
          didEncounterLiveFeedError = true;
          console.error("Fejl ved hentning af participants:", participantsError);
        }
      } else if (participantsData) {
        locationRows = participantsData as StudentRow[];
        // The participants table is authoritative whenever it is available.
        // Do not retain a legacy session_students name for a team that was
        // deliberately removed from this session.
        studentNames.clear();
        locationRows.forEach((row) => {
          const name = normalizeName(row.student_name);
          if (name) studentNames.add(name);
        });
      }

      const nextStudentNames = Array.from(studentNames);
      setStudents(nextStudentNames);

      let nextLocations = locationRows
        .map((row) => toLocation(row))
        .filter((row): row is LiveStudentLocation => row !== null);

      if (!isActiveStudentSessionStatus(fetchedSessionStatus)) {
        nextLocations = nextLocations.map((location) => ({
          ...location,
          lat: null,
          lng: null,
        }));
      }

      if (supportsParticipants) {
        updateParticipantRoster((current) =>
          mergeParticipantRosterSnapshot(current, nextLocations, participantSnapshotRevision)
        );
      } else {
        replaceParticipantRoster(createParticipantRoster(nextLocations));
      }
      setHasParticipantsTable(supportsParticipants);

      const { data: messagesData, error: messagesError } = await supabase
        .from("session_messages")
        .select("sender_name,is_teacher,message,created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (!isActive) return { supportsParticipants, supportsAnswers: false };

      if (messagesError) {
        didEncounterLiveFeedError = true;
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
          didEncounterLiveFeedError = true;
          console.error("Fejl ved hentning af answers:", answersError);
        }
      } else if (answersData) {
        const activeParticipantIds = new Set(nextLocations.map((participant) => participant.id));
        const parsed = (answersData as AnswerRow[])
          .map((row) => toLiveAnswer(row))
          .filter((row): row is NonNullable<typeof row> => row !== null)
          .filter(
            (row) =>
              !supportsParticipants ||
              (row.participantId !== null && activeParticipantIds.has(row.participantId))
          )
          .sort((a, b) => {
            const aTs = toTimestamp(a.createdAt) ?? 0;
            const bTs = toTimestamp(b.createdAt) ?? 0;
            return aTs - bTs;
          });

        setSessionAnswers(parsed);
        setLiveAnswers(
          [...parsed].sort((a, b) => {
            const aTs = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTs = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bTs - aTs;
          })
        );
      }

      setHasAnswersTable(supportsAnswers);
      if (!didEncounterLiveFeedError) {
        setLiveFeedLastSyncedAt(new Date().toISOString());
      } else {
        setLiveFeedStatus("recovering");
      }

      if (shouldShowLoading) {
        setIsLoading(false);
      }

      return { supportsParticipants, supportsAnswers };
    };

    const createRealtimeChannel = (
      supportsParticipants: boolean,
      supportsAnswers: boolean
    ) => {
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }

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
            const name = normalizeName(row.student_name);
            if (name) setStudents((prev) => (prev.includes(name) ? prev : [...prev, name]));
            if (!supportsParticipants) {
              const loc = toLocation(row);
              if (loc) {
                updateParticipantRoster((current) =>
                  applyParticipantRosterEvent(current, {
                    type: "INSERT",
                    row: loc,
                    eventTimestamp: getRealtimeEventTimestamp(payload),
                  })
                );
              }
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
            if (nextSession.status) {
              setStatus(nextSession.status);
              if (!isActiveStudentSessionStatus(nextSession.status)) {
                updateParticipantRoster((current) => ({
                  ...current,
                  entries: current.entries.map((location) => ({
                    ...location,
                    lat: null,
                    lng: null,
                  })),
                }))
              }
            }
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
              const loc = toLocation(payload.new as StudentRow);
              if (loc) {
                updateParticipantRoster((current) =>
                  applyParticipantRosterEvent(current, {
                    type: "INSERT",
                    row: loc,
                    eventTimestamp: getRealtimeEventTimestamp(payload),
                  })
                );
              }
            }
          )
          .on(
            "postgres_changes",
            {
              event: "DELETE",
              schema: "public",
              table: "participants",
              filter: `session_id=eq.${sessionId}`,
            },
            (payload) => {
              const deletedId = (payload.old as { id?: string | number | null })?.id;
              if (!deletedId) return;
              updateParticipantRoster((current) =>
                applyParticipantRosterEvent(current, {
                  type: "DELETE",
                  row: { id: String(deletedId) },
                  eventTimestamp: getRealtimeEventTimestamp(payload),
                })
              );
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
              const participantRow = payload.new as StudentRow;
              const participantId =
                participantRow.id === null || participantRow.id === undefined
                  ? ""
                  : String(participantRow.id);

              if (participantRow.removed_at && participantId) {
                updateParticipantRoster((current) =>
                  applyParticipantRosterEvent(current, {
                    type: "DELETE",
                    row: { id: participantId },
                    eventTimestamp: getRealtimeEventTimestamp(payload),
                  })
                );
                setSessionAnswers((current) =>
                  current.filter((answer) => answer.participantId !== participantId)
                );
                setLiveAnswers((current) =>
                  current.filter((answer) => answer.participantId !== participantId)
                );
                setStudents((previous) => {
                  const removedName = normalizeName(participantRow.student_name);
                  const hasAnotherActiveParticipantWithName = participantRosterRef.current.entries.some(
                    (participant) => participant.name === removedName
                  );
                  return removedName && !hasAnotherActiveParticipantWithName
                    ? previous.filter((name) => name !== removedName)
                    : previous;
                });
                return;
              }

              const loc = toLocation(participantRow);
              if (loc) {
                updateParticipantRoster((current) =>
                  applyParticipantRosterEvent(current, {
                    type: "UPDATE",
                    row: loc,
                    eventTimestamp: getRealtimeEventTimestamp(payload),
                  })
                );
              }
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
            const loc = toLocation(payload.new as StudentRow);
            if (loc) {
              updateParticipantRoster((current) =>
                applyParticipantRosterEvent(current, {
                  type: "UPDATE",
                  row: loc,
                  eventTimestamp: getRealtimeEventTimestamp(payload),
                })
              );
            }
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
            const parsed = toLiveAnswer(payload.new as AnswerRow);
            if (!parsed) return;
            if (
              supportsParticipants &&
              (!parsed.participantId ||
                !participantRosterRef.current.entries.some(
                  (participant) => participant.id === parsed.participantId
                ))
            ) {
              return;
            }
            setSessionAnswers((previous) =>
              [...previous.filter((item) => item.id !== parsed.id), parsed].sort((a, b) => {
                const aTs = toTimestamp(a.createdAt) ?? 0;
                const bTs = toTimestamp(b.createdAt) ?? 0;
                return aTs - bTs;
              })
            );
            setLiveAnswers((previous) => prependAnswer(previous, parsed));
          }
        );
      }

      channel = nextChannel.subscribe((status) => {
        if (!isActive) return;
        if (status === "SUBSCRIBED") {
          cancelRecovery(); // annullér eventuel ventende "recovering"-advarsel
          stopFallbackPolling();
          setLiveFeedStatus("live");
          void fetchLobbyData({ showLoading: false });
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          // Vent 2 s inden advarslen vises — normale WebSocket-reconnects løses
          // typisk inden for dette vindue og læreren ser ingen blink.
          scheduleRecovery("channel_error");
        }
      });
    };

    const recoverLiveState = async (_reason: LiveFeedRecoveryReason) => {
      void _reason;
      // Status er allerede sat til "recovering" af scheduleRecovery eller
      // fetchLobbyData (ved initial fetch-fejl) — sæt ikke her igen for at
      // undgå dobbelt render.
      try {
        const { supportsParticipants, supportsAnswers } = await fetchLobbyData({ showLoading: false });
        if (!isActive) return;
        createRealtimeChannel(supportsParticipants, supportsAnswers);
      } catch (error) {
        console.error("Kunne ikke genoprette lærerens live-data:", error);
        startFallbackPolling();
      }
    };

    // --- init ---
    void (async () => {
      setLiveFeedStatus("connecting");
      const { supportsParticipants, supportsAnswers } = await fetchLobbyData();
      if (!isActive) return;
      createRealtimeChannel(supportsParticipants, supportsAnswers);
    })();

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        stopFallbackPolling();
        return;
      }

      if (document.visibilityState === "visible") {
        // Giv kanalen 2 s til at genoprette selv før vi tvinger en recovery.
        scheduleRecovery("visibility_resume");
      }
    };

    const handleOnline = () => {
      scheduleRecovery("online_resume");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      isActive = false;
      cancelRecovery();
      stopFallbackPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [replaceParticipantRoster, sessionId, updateParticipantRoster]);

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
    if (hasParticipantsTable) {
      return studentLocations;
    }

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
        startOffset: null,
        updated_at: null,
        last_updated: null,
        finished_at: null,
      });
    }

    return Array.from(participantsById.values());
  }, [hasParticipantsTable, sessionId, studentLocations, students]);

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

  const liveRouteParticipants = useMemo<TeacherLiveData["liveRouteParticipants"]>(() => {
    if (!isDistributedCircularEligibleRaceType(runRaceType)) {
      return [];
    }

    const answerProgressByParticipant = new Map<
      string,
      { completedPostIndexes: Set<number>; lastActivityAt: string | null }
    >();

    for (const answer of sessionAnswers) {
      const normalizedName = normalizeName(answer.studentName);
      const participantKey =
        answer.participantId ??
        (normalizedName ? normalizedName.toLocaleLowerCase("da-DK") : null);
      if (!participantKey) continue;

      const progress =
        answerProgressByParticipant.get(participantKey) ?? {
          completedPostIndexes: new Set<number>(),
          lastActivityAt: null,
        };

      if (
        typeof answer.postNumber === "number" &&
        Number.isSafeInteger(answer.postNumber) &&
        answer.postNumber >= 1
      ) {
        progress.completedPostIndexes.add(answer.postNumber - 1);
      }

      const answerTimestamp = toTimestamp(answer.createdAt);
      const lastActivityTimestamp = toTimestamp(progress.lastActivityAt);
      if (
        answerTimestamp !== null &&
        (lastActivityTimestamp === null || answerTimestamp > lastActivityTimestamp)
      ) {
        progress.lastActivityAt = answer.createdAt;
      }

      answerProgressByParticipant.set(participantKey, progress);
    }

    const postIndexes = runQuestions.map((_, index) => index);
    return participantRoster
      .map((participant) => {
        const progress =
          answerProgressByParticipant.get(participant.id) ??
          answerProgressByParticipant.get(
            participant.name.toLocaleLowerCase("da-DK")
          );
        const overview = buildLiveRouteOverview({
          postIndexes,
          startOffset: participant.startOffset,
          completedPostIndexes: progress
            ? [...progress.completedPostIndexes]
            : [],
          postOrderMode,
          raceType: runRaceType,
          routeVersion,
          participantFinished: Boolean(participant.finished_at),
        });
        const activityCandidates = [
          progress?.lastActivityAt ?? null,
          participant.last_updated ?? null,
          participant.updated_at ?? null,
        ];
        const lastActivityAt =
          activityCandidates.reduce<string | null>((latest, candidate) => {
            const candidateTimestamp = toTimestamp(candidate);
            const latestTimestamp = toTimestamp(latest);
            return candidateTimestamp !== null &&
              (latestTimestamp === null || candidateTimestamp > latestTimestamp)
              ? candidate
              : latest;
          }, null);

        return { participant, overview, lastActivityAt };
      })
      .sort((left, right) => {
        if (left.overview.isCompleted !== right.overview.isCompleted) {
          return left.overview.isCompleted ? 1 : -1;
        }

        return left.participant.name.localeCompare(
          right.participant.name,
          "da"
        );
      });
  }, [
    participantRoster,
    postOrderMode,
    routeVersion,
    runQuestions,
    runRaceType,
    sessionAnswers,
  ]);
  const liveRouteIssueCount = liveRouteParticipants.filter(
    ({ overview }) => !overview.isConsistent
  ).length;

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
        const errorMessage = provisionPayload?.error || "Kunne ikke klargøre Stratego-holdene.";
        console.error("Kunne ikke klargøre Stratego-spillere:", errorMessage);
        throw new Error(errorMessage);
      }
    }

    const normalizedRaceType = normalizeRaceType(runRaceType);
    const usesAtomicPostAssignmentStart =
      isDistributedCircularEligibleRaceType(runRaceType);

    if (usesAtomicPostAssignmentStart) {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("start_live_session_with_post_assignments", {
        p_session_id: sessionId,
      });

      if (error) {
        console.error("Kunne ikke starte session atomart:", error);
        alert("Kunne ikke starte løbet.");
        return;
      }

      if (data && typeof data === "object" && "postOrderMode" in data) {
        setPostOrderMode(
          data.postOrderMode === POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
            ? POST_ORDER_MODES.DISTRIBUTED_CIRCULAR
            : POST_ORDER_MODES.FIXED
        );
      }
      setStatus("running");
      return;
    }

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
        .update({
          finished_at: finishedAt,
          lat: null,
          lng: null,
          accuracy: null,
          last_updated: finishedAt,
        })
        .eq("session_id", sessionId)
        .is("finished_at", null)
        .is("removed_at", null);

      if (finishParticipantsError) {
        console.warn("Kunne ikke registrere afslutning paa aktive deltagere:", finishParticipantsError);
      } else {
        updateParticipantRoster((current) => ({
          ...current,
          entries: current.entries.map((student) =>
            student.finished_at
              ? student
              : {
                  ...student,
                  finished_at: finishedAt,
                  lat: null,
                  lng: null,
                }
          ),
        }));
      }
    }

    setStatus("finished");
    setIsEndingRun(false);
  };

  const removeParticipant = async (student: LiveStudentLocation) => {
    if (!sessionId || !hasParticipantsTable) {
      return { ok: false, error: "Holdet kan ikke fjernes lige nu." };
    }

    try {
      const response = await fetch("/api/dashboard/live/participants/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ sessionId, participantId: student.id }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { removed?: boolean; error?: string }
        | null;

      if (!response.ok || payload?.removed !== true) {
        return {
          ok: false,
          error: payload?.error || "Holdet kunne ikke fjernes. Prøv igen.",
        };
      }

      updateParticipantRoster((current) =>
        applyParticipantRosterEvent(current, {
          type: "DELETE",
          row: { id: student.id },
        })
      );
      setSessionAnswers((current) =>
        current.filter((answer) => answer.participantId !== student.id)
      );
      setLiveAnswers((current) =>
        current.filter((answer) => answer.participantId !== student.id)
      );
      setStudents((previous) => {
        const hasAnotherActiveParticipantWithName = participantRosterRef.current.entries.some(
          (participant) => participant.name === student.name
        );
        return hasAnotherActiveParticipantWithName
          ? previous
          : previous.filter((name) => name !== student.name);
      });
      return { ok: true };
    } catch {
      return { ok: false, error: "Holdet kunne ikke fjernes. Prøv igen." };
    }
  };

  return {
    sessionId,
    pin,
    joinPin,
    students,
    isLoading: sessionId ? isLoading : false,
    liveFeedStatus,
    liveFeedLastSyncedAt,
    status: status ?? "waiting",
    gpsOverride,
    isUpdatingGpsOverride,
    runRaceType,
    postOrderMode,
    routeVersion,
    theme,
    isPhotoMission,
    messages,
    newMessage,
    participantRoster,
    runQuestions,
    liveAnswers,
    sessionAnswers,
    photoAnswers,
    hasParticipantsTable,
    hasAnswersTable,
    isEndingRun,
    isUpdatingPause,
    activeStudents,
    studentLocations,
    finishers,
    finalStandings,
    liveRouteParticipants,
    liveRouteIssueCount,
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
    removeParticipant,
  };
}
