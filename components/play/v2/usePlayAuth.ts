/**
 * usePlayAuth – Participant identity, joining, and session validation.
 *
 * Responsibilities:
 *  1. Read / write the active participant from localStorage.
 *  2. Provision a new participant (name-gate → API call → persist).
 *  3. Restore a returning participant (validate against server, handle expiry).
 *  4. Surface auth-level errors (kicked, expired, session missing).
 *
 * This hook owns NO game-progress state – only "who am I and am I allowed in?"
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createClient } from "@/utils/supabase/client";
import { authWithLockRetry } from "@/utils/supabase/authWithLockRetry";
import { sendTelemetry } from "@/utils/telemetry";

import type {
  ParticipantRow,
  StoredActiveParticipant,
  PlayLoadErrorVariant,
} from "../types";

import {
  readStoredActiveParticipant,
  saveStoredActiveParticipant,
  clearStoredActiveParticipant,
  clearStoredPlaySnapshot,
  toIntegerStartOffset,
  toFiniteNumber,
} from "../playUtils";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** The lifecycle of the auth process. */
export type AuthPhase =
  | "initializing"   // reading localStorage / checking server
  | "name_gate"      // waiting for the player to enter a name
  | "avatar_gate"    // waiting for the player to pick an avatar
  | "provisioning"   // API call in-flight to create participant
  | "restoring"      // validating a stored participant against server
  | "authenticated"  // ready – participantId is non-null
  | "kicked"         // removed by teacher
  | "expired"        // session or participant no longer valid
  | "error";         // unrecoverable load error

export interface PlayAuthIdentity {
  participantId: string;
  sessionId: string;
  studentName: string;
  teamId: string | null;
  teamColor: string | null;
  avatarUrl: string | null;
  startOffset: number;
}

export interface PlayAuthActions {
  /** Submit the name from the name-gate. */
  confirmName: (name: string) => Promise<void>;

  /** Submit the chosen avatar from the avatar-gate. */
  confirmAvatar: (avatarUrl: string) => Promise<void>;

  /** Retry after a recoverable error. */
  retry: () => void;

  /** Force-clear stored identity and go back to name-gate. */
  resetIdentity: () => void;
}

export interface UsePlayAuthReturn {
  phase: AuthPhase;
  identity: PlayAuthIdentity | null;

  /** Pending name while in name_gate. */
  pendingName: string;
  setPendingName: (name: string) => void;

  /** Pending avatar while in avatar_gate. */
  pendingAvatarUrl: string | null;
  setPendingAvatarUrl: (url: string | null) => void;

  /** Human-readable error when phase is "error". */
  errorMessage: string | null;
  errorVariant: PlayLoadErrorVariant;

  actions: PlayAuthActions;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CIRCUIT_BREAKER_VARIANTS: PlayLoadErrorVariant[] = [
  "participant_auth_expired",
  "join_session_missing",
];

/** Session statuses that mean "kicked". */
const KICKED_STATUSES = new Set(["kicked", "removed"]);

/** Max restore retries before giving up. */
const MAX_RESTORE_RETRIES = 6;
const RESTORE_RETRY_DELAY_MS = 2_500;

/** Polling intervals for session status. */
const WAITING_POLL_INTERVAL_MS = 4_000;
const ACTIVE_POLL_INTERVAL_MS = 15_000;

// ---------------------------------------------------------------------------
// Types for API responses
// ---------------------------------------------------------------------------

type JoinApiResponse = {
  participantId?: string;
  studentName?: string;
  startOffset?: number;
  sessionStatus?: string | null;
  teamId?: string | null;
  teamColor?: string | null;
  error?: string;
};

type StatusApiResponse = {
  sessionStatus?: string | null;
  gpsOverride?: boolean;
};

type ParticipantSnapshotApiResponse = {
  participant?: ParticipantRow | null;
  error?: string;
};

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

export function usePlayAuth(params: {
  sessionId: string | undefined;
  initialStudentName?: string;
}): UsePlayAuthReturn {
  const { sessionId, initialStudentName } = params;

  // Supabase client scoped to participant auth.
  const supabase = useMemo(() => createClient({ authScope: "participant" }), []);

  // -----------------------------------------------------------------------
  // 1. Read stored participant on mount (synchronous, stable across renders)
  // -----------------------------------------------------------------------
  const storedOnLoad = useMemo(() => {
    if (!sessionId) return null;
    const stored = readStoredActiveParticipant();
    if (!stored || stored.sessionId !== sessionId) return null;
    return stored;
  }, [sessionId]);

  // -----------------------------------------------------------------------
  // 2. State
  // -----------------------------------------------------------------------
  const [phase, setPhase] = useState<AuthPhase>("initializing");
  const [identity, setIdentity] = useState<PlayAuthIdentity | null>(null);
  const [pendingName, setPendingName] = useState(initialStudentName ?? "");
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorVariant, setErrorVariant] = useState<PlayLoadErrorVariant>("generic");
  const [sessionStatus, setSessionStatus] = useState<string | null>(null);
  const [gpsOverride, setGpsOverride] = useState(false);

  // -----------------------------------------------------------------------
  // Refs for async-safety
  // -----------------------------------------------------------------------
  const isMountedRef = useRef(true);
  const circuitBreakerRef = useRef(false);
  const restoreRetryCountRef = useRef(0);
  const restoreRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectInFlightRef = useRef(false);
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // -----------------------------------------------------------------------
  // Circuit breaker — once tripped, errors are unrecoverable
  // -----------------------------------------------------------------------
  const tripCircuitBreaker = useCallback(
    (message: string, variant: PlayLoadErrorVariant) => {
      if (circuitBreakerRef.current) return;
      circuitBreakerRef.current = true;
      setErrorMessage(message);
      setErrorVariant(variant);
      if (variant === "participant_auth_expired") {
        setPhase("expired");
      } else {
        setPhase("error");
      }
    },
    [],
  );

  // -----------------------------------------------------------------------
  // API helpers
  // -----------------------------------------------------------------------

  /** POST /api/join → register or rebind a participant. */
  const callJoinApi = useCallback(
    async (name: string, preferredId: string | null): Promise<JoinApiResponse | null> => {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          sessionId,
          studentName: name,
          ...(preferredId ? { participantId: preferredId } : {}),
        }),
      });

      const payload = (await res.json().catch(() => null)) as JoinApiResponse | null;

      if (res.status === 404 || res.status === 410) {
        tripCircuitBreaker(
          "Løbet blev ikke fundet eller er afsluttet.",
          "join_session_missing",
        );
        return null;
      }
      if (!res.ok || !payload?.participantId) {
        throw new Error(payload?.error ?? "Kunne ikke klargøre deltageren.");
      }
      return payload;
    },
    [sessionId, tripCircuitBreaker],
  );

  /** GET /api/play/status → poll session status. */
  const fetchStatus = useCallback(async (): Promise<StatusApiResponse | null> => {
    const sid = sessionIdRef.current;
    if (!sid) return null;
    try {
      const res = await fetch(
        `/api/play/status?sessionId=${encodeURIComponent(sid)}`,
        { cache: "no-store" },
      );
      if (!res.ok) return null;
      return (await res.json().catch(() => null)) as StatusApiResponse | null;
    } catch {
      return null;
    }
  }, []);

  /** GET /api/play/participant → fetch participant snapshot for restore. */
  const fetchSnapshot = useCallback(
    async (
      pid: string,
    ): Promise<{ data: ParticipantRow | null; error: { status?: number } | null }> => {
      const sid = sessionIdRef.current;
      if (!sid) return { data: null, error: null };
      if (circuitBreakerRef.current) {
        return { data: null, error: { status: 401 } };
      }
      try {
        const res = await fetch(
          `/api/play/participant?sessionId=${encodeURIComponent(sid)}&participantId=${encodeURIComponent(pid)}`,
          { cache: "no-store" },
        );
        const body = (await res.json().catch(() => null)) as ParticipantSnapshotApiResponse | null;
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            tripCircuitBreaker(
              "Hov! Forbindelsen blev afbrudt. Bare rolig, alt dit fremskridt er gemt.",
              "participant_auth_expired",
            );
          }
          return { data: null, error: { status: res.status } };
        }
        return { data: body?.participant ?? null, error: null };
      } catch {
        return { data: null, error: { status: 0 } };
      }
    },
    [tripCircuitBreaker],
  );

  // -----------------------------------------------------------------------
  // Persist identity to localStorage
  // -----------------------------------------------------------------------
  const persistIdentity = useCallback(
    (
      pid: string,
      name: string,
      offset: number,
      tId: string | null,
      tColor: string | null,
      avatar: string | null,
      status: string | null,
    ) => {
      if (!sessionId) return;
      const existing = readStoredActiveParticipant();
      // Preserve savedAt when re-binding the same participant.
      const isRebind =
        existing?.participantId === pid && existing?.sessionId === sessionId;
      if (!isRebind) {
        clearStoredPlaySnapshot();
      }
      const savedAt = isRebind ? existing.savedAt : new Date().toISOString();

      saveStoredActiveParticipant({
        participantId: pid,
        sessionId,
        studentName: name,
        startOffset: offset,
        savedAt,
        teamId: tId ?? existing?.teamId ?? null,
        teamColor: tColor ?? existing?.teamColor ?? null,
        avatarUrl: avatar ?? existing?.avatarUrl ?? null,
        sessionStatus: status ?? existing?.sessionStatus ?? null,
        hasCompletedAvatarGate: true,
      });
    },
    [sessionId],
  );

  // -----------------------------------------------------------------------
  // Set authenticated state from API response
  // -----------------------------------------------------------------------
  const becomeAuthenticated = useCallback(
    (
      pid: string,
      name: string,
      offset: number,
      tId: string | null,
      tColor: string | null,
      avatar: string | null,
      status: string | null,
    ) => {
      const id: PlayAuthIdentity = {
        participantId: pid,
        sessionId: sessionId!,
        studentName: name,
        teamId: tId,
        teamColor: tColor,
        avatarUrl: avatar,
        startOffset: offset,
      };
      setIdentity(id);
      setSessionStatus(status);
      persistIdentity(pid, name, offset, tId, tColor, avatar, status);
      setPhase("authenticated");
    },
    [sessionId, persistIdentity],
  );

  // -----------------------------------------------------------------------
  // Auth recovery — refresh Supabase token or re-join
  // -----------------------------------------------------------------------
  const recoverAuth = useCallback(
    async (storedName: string): Promise<boolean> => {
      if (circuitBreakerRef.current) return false;

      // Try Supabase token refresh first (with lock-abort retry for iOS Safari).
      try {
        const { data, error } = await authWithLockRetry(
          () => supabase.auth.refreshSession(),
          "usePlayAuth.recoverAuth",
        );
        const userId = data.user?.id ?? data.session?.user?.id ?? null;
        if (!error && userId) return true;
      } catch {
        // Fall through to re-join.
      }

      // Token refresh failed → re-join via /api/join.
      const name = storedName.trim();
      if (!name) return false;

      try {
        const joinData = await callJoinApi(name, null);
        if (!joinData) return false;
        // Identity will be set by the caller if needed.
        return true;
      } catch {
        return false;
      }
    },
    [supabase, callJoinApi],
  );

  // -----------------------------------------------------------------------
  // Restore flow — called for returning participants
  // -----------------------------------------------------------------------
  const restoreParticipant = useCallback(
    async (stored: StoredActiveParticipant) => {
      if (!isMountedRef.current || circuitBreakerRef.current) return;
      setPhase("restoring");

      // Try Supabase auth refresh first.
      const authOk = await recoverAuth(stored.studentName);
      if (!isMountedRef.current) return;

      if (!authOk) {
        // Auth recovery failed. Try re-joining with stored name.
        try {
          const joinData = await callJoinApi(
            stored.studentName,
            stored.participantId,
          );
          if (!isMountedRef.current) return;
          if (!joinData) return; // circuit breaker tripped

          const name = (joinData.studentName ?? stored.studentName).trim();
          const offset = toIntegerStartOffset(joinData.startOffset) ?? 0;
          becomeAuthenticated(
            joinData.participantId!,
            name,
            offset,
            joinData.teamId ?? stored.teamId ?? null,
            joinData.teamColor ?? stored.teamColor ?? null,
            stored.avatarUrl ?? null,
            joinData.sessionStatus ?? null,
          );
          return;
        } catch {
          if (!isMountedRef.current) return;
          // Fall through to snapshot fetch attempt.
        }
      }

      // Auth is OK (or re-join succeeded) — fetch server snapshot to validate.
      const { data: snap, error: snapErr } = await fetchSnapshot(stored.participantId);
      if (!isMountedRef.current) return;

      if (snapErr?.status === 401 || snapErr?.status === 403) {
        // Circuit breaker already tripped inside fetchSnapshot.
        return;
      }

      if (snap) {
        const name =
          (typeof snap.student_name === "string" ? snap.student_name.trim() : "") ||
          stored.studentName;
        const offset = toIntegerStartOffset(snap.start_offset) ?? stored.startOffset ?? 0;

        if (snap.finished_at) {
          // Participant already finished — still authenticate so engine picks it up.
          becomeAuthenticated(
            stored.participantId,
            name,
            offset,
            stored.teamId ?? null,
            stored.teamColor ?? null,
            stored.avatarUrl ?? null,
            "finished",
          );
          return;
        }

        becomeAuthenticated(
          stored.participantId,
          name,
          offset,
          stored.teamId ?? null,
          stored.teamColor ?? null,
          stored.avatarUrl ?? null,
          stored.sessionStatus ?? null,
        );
        return;
      }

      // Snapshot fetch failed but not auth error — retry with backoff.
      if (restoreRetryCountRef.current < MAX_RESTORE_RETRIES) {
        restoreRetryCountRef.current++;
        restoreRetryTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) void restoreParticipant(stored);
        }, RESTORE_RETRY_DELAY_MS);
        return;
      }

      // Exhausted retries — fall back to name gate.
      setPhase("name_gate");
      setPendingName(stored.studentName);
    },
    [recoverAuth, callJoinApi, fetchSnapshot, becomeAuthenticated],
  );

  // -----------------------------------------------------------------------
  // Initialization effect — runs once when sessionId is set
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!sessionId) return;

    if (storedOnLoad) {
      // Returning participant — try to restore.
      setPendingName(storedOnLoad.studentName);
      void restoreParticipant(storedOnLoad);
    } else {
      // Fresh participant — go to name gate.
      setPhase("name_gate");
    }

    return () => {
      if (restoreRetryTimerRef.current) clearTimeout(restoreRetryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // -----------------------------------------------------------------------
  // Realtime subscription — live_sessions updates
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!sessionId || phase === "initializing" || phase === "name_gate") return;

    let mounted = true;
    const channelName = `v2-session-status-${sessionId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          if (!mounted) return;
          const row = payload.new as { status?: string | null; gps_override?: boolean } | null;
          const nextStatus = row?.status ?? null;
          setSessionStatus(nextStatus);
          setGpsOverride(Boolean(row?.gps_override));

          if (nextStatus === "finished") {
            // Don't trip circuit breaker — engine handles the finished state.
          }

          if (KICKED_STATUSES.has(nextStatus ?? "")) {
            setPhase("kicked");
          }
        },
      )
      .subscribe((status) => {
        if (!mounted) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          // Reconnect will be handled by polling + visibility events.
        }
      });

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [sessionId, supabase, phase]);

  // -----------------------------------------------------------------------
  // Session status polling
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!sessionId || phase !== "authenticated") return;

    let mounted = true;
    const intervalMs =
      sessionStatus === "running" ? ACTIVE_POLL_INTERVAL_MS : WAITING_POLL_INTERVAL_MS;

    const poll = async () => {
      const data = await fetchStatus();
      if (!mounted || !data) return;
      setSessionStatus(data.sessionStatus ?? null);
      setGpsOverride(Boolean(data.gpsOverride));
    };

    const timer = setInterval(() => void poll(), intervalMs);
    // Also poll immediately on mount.
    void poll();

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [sessionId, phase, sessionStatus, fetchStatus]);

  // -----------------------------------------------------------------------
  // Visibility / online recovery
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!sessionId || phase !== "authenticated" || !identity) return;

    const recover = async () => {
      if (reconnectInFlightRef.current || circuitBreakerRef.current) return;
      reconnectInFlightRef.current = true;
      try {
        // Refresh auth token.
        await supabase.auth.refreshSession().catch(() => undefined);

        // Check session status.
        const data = await fetchStatus();
        if (!isMountedRef.current) return;
        if (data) {
          setSessionStatus(data.sessionStatus ?? null);
          setGpsOverride(Boolean(data.gpsOverride));
        }

        // Fetch participant snapshot to detect kick/finish.
        const { data: snap } = await fetchSnapshot(identity.participantId);
        if (!isMountedRef.current) return;
        if (snap?.finished_at) {
          setSessionStatus("finished");
        }
      } catch {
        // Silently retry on next event.
      } finally {
        reconnectInFlightRef.current = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void recover();
    };
    const onOnline = () => void recover();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [sessionId, phase, identity, supabase, fetchStatus, fetchSnapshot]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  /** Confirm name from name-gate → call /api/join to provision participant. */
  const confirmName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || !sessionId || circuitBreakerRef.current) return;

      setPhase("provisioning");
      setErrorMessage(null);

      try {
        const preferredId = storedOnLoad?.participantId ?? null;
        const joinData = await callJoinApi(trimmed, preferredId);
        if (!isMountedRef.current) return;
        if (!joinData) return; // circuit breaker tripped

        const resolvedName = (joinData.studentName ?? trimmed).trim() || trimmed;
        const offset = toIntegerStartOffset(joinData.startOffset) ?? 0;

        becomeAuthenticated(
          joinData.participantId!,
          resolvedName,
          offset,
          joinData.teamId ?? null,
          joinData.teamColor ?? null,
          storedOnLoad?.avatarUrl ?? null,
          joinData.sessionStatus ?? null,
        );
      } catch (err) {
        if (!isMountedRef.current) return;
        setPhase("name_gate");
        setErrorMessage(
          err instanceof Error && err.message
            ? err.message
            : "Vi kunne ikke starte løbet lige nu. Prøv igen.",
        );
      }
    },
    [sessionId, storedOnLoad, callJoinApi, becomeAuthenticated],
  );

  const confirmAvatar = useCallback(async (_avatarUrl: string) => {
    // Avatar gate is not used in v2 — no-op.
  }, []);

  const retry = useCallback(() => {
    circuitBreakerRef.current = false;
    setErrorMessage(null);
    setErrorVariant("generic");
    if (storedOnLoad) {
      restoreRetryCountRef.current = 0;
      void restoreParticipant(storedOnLoad);
    } else {
      setPhase("name_gate");
    }
  }, [storedOnLoad, restoreParticipant]);

  const resetIdentity = useCallback(() => {
    clearStoredActiveParticipant();
    clearStoredPlaySnapshot();
    setIdentity(null);
    setPhase("name_gate");
    setErrorMessage(null);
    setErrorVariant("generic");
    circuitBreakerRef.current = false;
    restoreRetryCountRef.current = 0;
  }, []);

  // -----------------------------------------------------------------------
  // Expose sessionStatus + gpsOverride on identity for engine consumption
  // -----------------------------------------------------------------------
  // The engine needs to know the session status to map to SessionPhase.
  // We attach it to the return via a stable reference pattern.
  const enrichedIdentity = useMemo<PlayAuthIdentity | null>(() => {
    if (!identity) return null;
    return identity;
  }, [identity]);

  // -----------------------------------------------------------------------
  // Return
  // -----------------------------------------------------------------------
  const actions: PlayAuthActions = useMemo(
    () => ({ confirmName, confirmAvatar, retry, resetIdentity }),
    [confirmName, confirmAvatar, retry, resetIdentity],
  );

  return {
    phase,
    identity: enrichedIdentity,
    pendingName,
    setPendingName,
    pendingAvatarUrl,
    setPendingAvatarUrl,
    errorMessage,
    errorVariant,
    actions,
    // Extra fields for engine/gps consumption — not in the public type
    // but accessible via the concrete return object.
    sessionStatus,
    gpsOverride,
  } as UsePlayAuthReturn & { sessionStatus: string | null; gpsOverride: boolean };
}
